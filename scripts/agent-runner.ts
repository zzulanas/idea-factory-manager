#!/usr/bin/env npx tsx
/**
 * Agent Runner - Background process that picks up pending tasks and executes them
 * using OpenCode CLI agent.
 * 
 * Usage: npx tsx scripts/agent-runner.ts
 */

import { spawn } from 'child_process';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const client = postgres(DATABASE_URL);
const db = drizzle(client, { schema });

const POLL_INTERVAL = 5000; // 5 seconds
const OPENCODE_PATH = process.env.OPENCODE_PATH || 'opencode';
const DOKPLOY_API_KEY = process.env.DOKPLOY_API_KEY || '';
const DOKPLOY_URL = process.env.DOKPLOY_URL || 'http://localhost:3000';

// Map project paths to Dokploy application IDs
const PROJECT_APP_IDS: Record<string, string> = {
  '/home/zzula/projects/idea-factory-manager': 'VmkFm8AScDwiiX0KNyNKL',
  '/home/zzula/projects/idea-factory-template': 'HAZQTYfaNCUmsMVi4lBDu',
};

async function getNextTask() {
  const task = await db.query.agentTasks.findFirst({
    where: eq(schema.agentTasks.status, 'pending'),
    orderBy: [schema.agentTasks.createdAt],
  });
  return task;
}

async function updateTaskStatus(
  id: string, 
  status: schema.TaskStatus, 
  extra?: { output?: string; error?: string; branchName?: string; commitHash?: string }
) {
  const updateData: Record<string, unknown> = { 
    status, 
    ...extra, 
    updatedAt: new Date() 
  };
  
  if (status === 'running') {
    updateData.startedAt = new Date();
  }
  if (status === 'completed' || status === 'failed') {
    updateData.completedAt = new Date();
  }
  
  await db
    .update(schema.agentTasks)
    .set(updateData)
    .where(eq(schema.agentTasks.id, id));
}

async function runAgent(task: schema.AgentTask): Promise<{ success: boolean; output: string; error?: string }> {
  return new Promise((resolve) => {
    console.log(`[Agent] Running task: ${task.title}`);
    console.log(`[Agent] Project: ${task.projectPath}`);
    console.log(`[Agent] Prompt: ${task.prompt.substring(0, 100)}...`);

    const args = [
      '-p', task.prompt,
      '-c', task.projectPath,
      '-f', 'text',
      '-q', // quiet mode (no spinner)
    ];

    const proc = spawn(OPENCODE_PATH, args, {
      cwd: task.projectPath,
      env: { 
        ...process.env,
        // Use the model from task if specified
        ...(task.model && { ANTHROPIC_MODEL: task.model }),
      },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
      process.stdout.write(data);
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
      process.stderr.write(data);
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true, output: stdout });
      } else {
        resolve({ success: false, output: stdout, error: stderr || `Exit code: ${code}` });
      }
    });

    proc.on('error', (err) => {
      resolve({ success: false, output: stdout, error: err.message });
    });
  });
}

async function runGitCommand(args: string[], cwd: string): Promise<{ success: boolean; output: string }> {
  return new Promise((resolve) => {
    const proc = spawn('git', args, { cwd });
    let output = '';

    proc.stdout.on('data', (data) => { output += data.toString(); });
    proc.stderr.on('data', (data) => { output += data.toString(); });

    proc.on('close', (code) => {
      resolve({ success: code === 0, output });
    });

    proc.on('error', (err) => {
      resolve({ success: false, output: err.message });
    });
  });
}

async function commitAndPush(task: schema.AgentTask): Promise<{ success: boolean; branchName?: string; commitHash?: string; error?: string }> {
  const cwd = task.projectPath;
  console.log(`[Git] Checking for changes in ${cwd}`);

  // Check if there are any changes
  const status = await runGitCommand(['status', '--porcelain'], cwd);
  if (!status.output.trim()) {
    console.log('[Git] No changes to commit');
    return { success: true };
  }

  console.log(`[Git] Changes detected:\n${status.output}`);

  // Get current branch name
  const branchResult = await runGitCommand(['rev-parse', '--abbrev-ref', 'HEAD'], cwd);
  const branchName = branchResult.output.trim();
  console.log(`[Git] Current branch: ${branchName}`);

  // Stage all changes (excluding .opencode/)
  const addResult = await runGitCommand(['add', '-A'], cwd);
  if (!addResult.success) {
    return { success: false, error: `Failed to stage changes: ${addResult.output}` };
  }

  // Create commit with task title
  const commitMessage = `feat: ${task.title}\n\nTask ID: ${task.id}\nAutomated commit by agent-runner`;
  const commitResult = await runGitCommand(['commit', '-m', commitMessage], cwd);
  if (!commitResult.success) {
    return { success: false, error: `Failed to commit: ${commitResult.output}` };
  }

  // Get commit hash
  const hashResult = await runGitCommand(['rev-parse', 'HEAD'], cwd);
  const commitHash = hashResult.output.trim().substring(0, 7);
  console.log(`[Git] Committed: ${commitHash}`);

  // Push to remote
  console.log(`[Git] Pushing to origin/${branchName}`);
  const pushResult = await runGitCommand(['push', 'origin', branchName], cwd);
  if (!pushResult.success) {
    return { success: false, branchName, commitHash, error: `Failed to push: ${pushResult.output}` };
  }

  console.log(`[Git] ✅ Pushed successfully`);
  return { success: true, branchName, commitHash };
}

async function triggerDokployDeploy(projectPath: string): Promise<{ success: boolean; error?: string }> {
  const appId = PROJECT_APP_IDS[projectPath];
  if (!appId) {
    console.log(`[Deploy] No Dokploy app ID mapped for ${projectPath}`);
    return { success: true }; // Not an error, just no deployment configured
  }

  if (!DOKPLOY_API_KEY) {
    console.log('[Deploy] DOKPLOY_API_KEY not set, skipping deployment');
    return { success: true };
  }

  console.log(`[Deploy] Triggering Dokploy deployment for app ${appId}`);

  try {
    const response = await fetch(`${DOKPLOY_URL}/api/trpc/application.deploy`, {
      method: 'POST',
      headers: {
        'x-api-key': DOKPLOY_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ json: { applicationId: appId } }),
    });

    if (!response.ok) {
      const text = await response.text();
      return { success: false, error: `Deploy failed: ${response.status} ${text}` };
    }

    console.log('[Deploy] ✅ Deployment triggered successfully');
    return { success: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Deploy error: ${errorMsg}` };
  }
}

async function processTask(task: schema.AgentTask) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[Runner] Processing task: ${task.id}`);
  console.log(`[Runner] Title: ${task.title}`);
  console.log(`${'='.repeat(60)}\n`);

  await updateTaskStatus(task.id, 'running');

  try {
    const result = await runAgent(task);

    if (result.success) {
      // Commit and push changes
      const gitResult = await commitAndPush(task);

      if (gitResult.success) {
        // Trigger Dokploy deployment if changes were pushed
        if (gitResult.commitHash) {
          await triggerDokployDeploy(task.projectPath);
        }

        await updateTaskStatus(task.id, 'completed', {
          output: result.output,
          branchName: gitResult.branchName,
          commitHash: gitResult.commitHash,
        });
        console.log(`\n[Runner] ✅ Task completed and pushed successfully`);
      } else {
        await updateTaskStatus(task.id, 'failed', {
          output: result.output,
          error: gitResult.error,
          branchName: gitResult.branchName,
          commitHash: gitResult.commitHash,
        });
        console.log(`\n[Runner] ❌ Task completed but git failed: ${gitResult.error}`);
      }
    } else {
      await updateTaskStatus(task.id, 'failed', { output: result.output, error: result.error });
      console.log(`\n[Runner] ❌ Task failed: ${result.error}`);
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    await updateTaskStatus(task.id, 'failed', { error: errorMsg });
    console.error(`\n[Runner] ❌ Task error: ${errorMsg}`);
  }
}

async function main() {
  console.log('[Runner] Agent Runner started');
  console.log(`[Runner] Polling interval: ${POLL_INTERVAL}ms`);
  console.log(`[Runner] OpenCode path: ${OPENCODE_PATH}`);
  
  while (true) {
    try {
      const task = await getNextTask();
      
      if (task) {
        await processTask(task);
      } else {
        process.stdout.write('.');
      }
    } catch (err) {
      console.error('[Runner] Error:', err);
    }
    
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
  }
}

main().catch(console.error);

