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
  extra?: {
    output?: string;
    error?: string;
    branchName?: string;
    commitHash?: string;
    prUrl?: string;
    prNumber?: number;
    previewUrl?: string;
    previewDeploymentId?: string;
  }
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

async function commitAndPush(task: schema.AgentTask): Promise<{
  success: boolean;
  branchName?: string;
  commitHash?: string;
  prUrl?: string;
  prNumber?: number;
  error?: string
}> {
  const cwd = task.projectPath;
  console.log(`[Git] Checking for changes in ${cwd}`);

  // Check if there are any changes
  const status = await runGitCommand(['status', '--porcelain'], cwd);
  if (!status.output.trim()) {
    console.log('[Git] No changes to commit');
    return { success: true };
  }

  console.log(`[Git] Changes detected:\n${status.output}`);

  // Get current branch (should be main)
  const mainBranchResult = await runGitCommand(['rev-parse', '--abbrev-ref', 'HEAD'], cwd);
  const mainBranch = mainBranchResult.output.trim();
  console.log(`[Git] Current branch: ${mainBranch}`);

  // Create a feature branch for this task
  const shortId = task.id.substring(0, 8);
  const slugTitle = task.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 30);
  const featureBranch = `agent/${shortId}-${slugTitle}`;
  console.log(`[Git] Creating feature branch: ${featureBranch}`);

  // Create and checkout the feature branch
  const checkoutResult = await runGitCommand(['checkout', '-b', featureBranch], cwd);
  if (!checkoutResult.success) {
    return { success: false, error: `Failed to create branch: ${checkoutResult.output}` };
  }

  // Stage all changes (excluding .opencode/)
  const addResult = await runGitCommand(['add', '-A'], cwd);
  if (!addResult.success) {
    // Switch back to main before returning
    await runGitCommand(['checkout', mainBranch], cwd);
    return { success: false, error: `Failed to stage changes: ${addResult.output}` };
  }

  // Create commit with task title
  const commitMessage = `feat: ${task.title}\n\nTask ID: ${task.id}\nAutomated commit by agent-runner`;
  const commitResult = await runGitCommand(['commit', '-m', commitMessage], cwd);
  if (!commitResult.success) {
    await runGitCommand(['checkout', mainBranch], cwd);
    return { success: false, error: `Failed to commit: ${commitResult.output}` };
  }

  // Get commit hash
  const hashResult = await runGitCommand(['rev-parse', 'HEAD'], cwd);
  const commitHash = hashResult.output.trim().substring(0, 7);
  console.log(`[Git] Committed: ${commitHash}`);

  // Push the feature branch to remote
  console.log(`[Git] Pushing to origin/${featureBranch}`);
  const pushResult = await runGitCommand(['push', '-u', 'origin', featureBranch], cwd);
  if (!pushResult.success) {
    await runGitCommand(['checkout', mainBranch], cwd);
    return { success: false, branchName: featureBranch, commitHash, error: `Failed to push: ${pushResult.output}` };
  }

  console.log(`[Git] ✅ Pushed successfully`);

  // Create a Pull Request using GitHub CLI
  const prResult = await createPullRequest(task, featureBranch, mainBranch, cwd);

  // Switch back to main branch
  await runGitCommand(['checkout', mainBranch], cwd);

  if (!prResult.success) {
    return {
      success: true, // Branch pushed successfully, just PR failed
      branchName: featureBranch,
      commitHash,
      error: `Branch pushed but PR creation failed: ${prResult.error}`
    };
  }

  return {
    success: true,
    branchName: featureBranch,
    commitHash,
    prUrl: prResult.prUrl,
    prNumber: prResult.prNumber
  };
}

async function createPullRequest(
  task: schema.AgentTask,
  featureBranch: string,
  baseBranch: string,
  cwd: string
): Promise<{ success: boolean; prUrl?: string; prNumber?: number; error?: string }> {
  console.log(`[PR] Creating Pull Request: ${featureBranch} -> ${baseBranch}`);

  return new Promise((resolve) => {
    const prTitle = `feat: ${task.title}`;
    const prBody = `## Task
${task.title}

## Description
${task.prompt.substring(0, 500)}${task.prompt.length > 500 ? '...' : ''}

---
*Task ID: ${task.id}*
*Created automatically by Agent Runner*`;

    const args = [
      'pr', 'create',
      '--title', prTitle,
      '--body', prBody,
      '--base', baseBranch,
      '--head', featureBranch,
    ];

    const proc = spawn('gh', args, { cwd });
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    proc.on('close', (code) => {
      if (code === 0) {
        // gh pr create outputs the PR URL on success
        const prUrl = stdout.trim();
        // Extract PR number from URL (e.g., https://github.com/owner/repo/pull/123)
        const prNumberMatch = prUrl.match(/\/pull\/(\d+)/);
        const prNumber = prNumberMatch ? parseInt(prNumberMatch[1], 10) : undefined;

        console.log(`[PR] ✅ Pull Request created: ${prUrl}`);
        resolve({ success: true, prUrl, prNumber });
      } else {
        console.log(`[PR] ❌ Failed to create PR: ${stderr || stdout}`);
        resolve({ success: false, error: stderr || stdout || `Exit code: ${code}` });
      }
    });

    proc.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });
  });
}

async function waitForPreviewDeployment(
  projectPath: string,
  branchName: string,
  maxWaitSeconds: number = 60
): Promise<{ success: boolean; previewUrl?: string; deploymentId?: string; error?: string }> {
  const appId = PROJECT_APP_IDS[projectPath];
  if (!appId) {
    console.log(`[Preview] No Dokploy app ID mapped for ${projectPath}, skipping preview check`);
    return { success: true };
  }

  if (!DOKPLOY_API_KEY) {
    console.log('[Preview] DOKPLOY_API_KEY not set, skipping preview check');
    return { success: true };
  }

  console.log(`[Preview] Waiting for preview deployment for branch ${branchName} (max ${maxWaitSeconds}s)`);

  const startTime = Date.now();
  const pollInterval = 5000; // 5 seconds

  while (Date.now() - startTime < maxWaitSeconds * 1000) {
    try {
      const encodedInput = encodeURIComponent(JSON.stringify({ json: { applicationId: appId } }));
      const response = await fetch(`${DOKPLOY_URL}/api/trpc/previewDeployment.all?input=${encodedInput}`, {
        headers: { 'x-api-key': DOKPLOY_API_KEY },
      });

      if (response.ok) {
        const data = await response.json();
        const previews = data.result?.data?.json || [];

        // Find a preview for our branch
        const preview = previews.find((p: { branch: string }) => p.branch === branchName);
        if (preview) {
          console.log(`[Preview] ✅ Found preview deployment: ${preview.previewDeploymentId}`);

          // Construct the preview URL based on Dokploy's pattern
          // Usually it's something like: {previewDomain} or app-name-branch.domain
          const previewUrl = preview.domain || `Preview for ${branchName}`;

          return {
            success: true,
            previewUrl: previewUrl,
            deploymentId: preview.previewDeploymentId
          };
        }
      }
    } catch (err) {
      console.log(`[Preview] Error checking for preview: ${err}`);
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, pollInterval));
    process.stdout.write('.');
  }

  console.log(`\n[Preview] ⚠️  No preview deployment found after ${maxWaitSeconds}s`);
  return { success: true }; // Not a failure - preview might come later
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
      // Commit to feature branch, push, and create PR
      const gitResult = await commitAndPush(task);

      if (gitResult.success && gitResult.commitHash) {
        // Wait briefly for Dokploy to create preview deployment via webhook
        const previewResult = await waitForPreviewDeployment(
          task.projectPath,
          gitResult.branchName!,
          30 // Wait up to 30 seconds for preview
        );

        // Submit for review with PR and preview info
        await updateTaskStatus(task.id, 'review', {
          output: result.output,
          branchName: gitResult.branchName,
          commitHash: gitResult.commitHash,
          prUrl: gitResult.prUrl,
          prNumber: gitResult.prNumber,
          previewUrl: previewResult.previewUrl,
          previewDeploymentId: previewResult.deploymentId,
        });

        console.log(`\n[Runner] ✅ Task completed and submitted for review`);
        if (gitResult.prUrl) {
          console.log(`[Runner] Pull Request: ${gitResult.prUrl}`);
        }
        if (previewResult.previewUrl) {
          console.log(`[Runner] Preview URL: ${previewResult.previewUrl}`);
        }
      } else if (gitResult.success) {
        // No changes to commit, mark as completed
        await updateTaskStatus(task.id, 'completed', {
          output: result.output,
        });
        console.log(`\n[Runner] ✅ Task completed (no changes to commit)`);
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

