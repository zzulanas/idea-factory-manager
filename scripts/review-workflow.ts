#!/usr/bin/env npx tsx
/**
 * Review Workflow Handler - Handles approval/rejection of tasks in review
 * 
 * This script can be called by webhooks or scheduled jobs to:
 * - Deploy approved tasks to production
 * - Clean up rejected preview deployments
 * - Merge approved branches to main
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

const DOKPLOY_API_KEY = process.env.DOKPLOY_API_KEY || '';
const DOKPLOY_URL = process.env.DOKPLOY_URL || 'http://localhost:3000';

// Map project paths to Dokploy application IDs
const PROJECT_APP_IDS: Record<string, string> = {
  '/home/zzula/projects/idea-factory-manager': 'VmkFm8AScDwiiX0KNyNKL',
  '/home/zzula/projects/idea-factory-template': 'HAZQTYfaNCUmsMVi4lBDu',
};

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

async function mergeToMain(task: schema.AgentTask): Promise<{ success: boolean; error?: string }> {
  if (!task.branchName || !task.commitHash) {
    return { success: false, error: 'No branch or commit hash available' };
  }

  const cwd = task.projectPath;
  console.log(`[Git] Merging ${task.branchName} to main in ${cwd}`);

  // Switch to main branch
  const checkoutResult = await runGitCommand(['checkout', 'main'], cwd);
  if (!checkoutResult.success) {
    return { success: false, error: `Failed to checkout main: ${checkoutResult.output}` };
  }

  // Pull latest changes
  const pullResult = await runGitCommand(['pull', 'origin', 'main'], cwd);
  if (!pullResult.success) {
    return { success: false, error: `Failed to pull main: ${pullResult.output}` };
  }

  // Merge the feature branch
  const mergeResult = await runGitCommand(['merge', task.branchName, '--no-ff', '-m', `Merge: ${task.title} (#${task.id})`], cwd);
  if (!mergeResult.success) {
    return { success: false, error: `Failed to merge: ${mergeResult.output}` };
  }

  // Push to main
  const pushResult = await runGitCommand(['push', 'origin', 'main'], cwd);
  if (!pushResult.success) {
    return { success: false, error: `Failed to push main: ${pushResult.output}` };
  }

  // Delete the feature branch
  await runGitCommand(['branch', '-d', task.branchName], cwd);
  await runGitCommand(['push', 'origin', '--delete', task.branchName], cwd);

  console.log(`[Git] ✅ Successfully merged ${task.branchName} to main`);
  return { success: true };
}

async function deployToProduction(projectPath: string): Promise<{ success: boolean; error?: string }> {
  const appId = PROJECT_APP_IDS[projectPath];
  if (!appId) {
    console.log(`[Deploy] No Dokploy app ID mapped for ${projectPath}`);
    return { success: true };
  }

  if (!DOKPLOY_API_KEY) {
    console.log('[Deploy] DOKPLOY_API_KEY not set, skipping deployment');
    return { success: true };
  }

  console.log(`[Deploy] Triggering production deployment for app ${appId}`);

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

    console.log('[Deploy] ✅ Production deployment triggered successfully');
    return { success: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Deploy error: ${errorMsg}` };
  }
}

async function cleanupPreviewDeployment(deploymentId: string): Promise<{ success: boolean; error?: string }> {
  if (!DOKPLOY_API_KEY) {
    console.log('[Cleanup] DOKPLOY_API_KEY not set, skipping cleanup');
    return { success: true };
  }

  console.log(`[Cleanup] Deleting preview deployment ${deploymentId}`);

  try {
    const response = await fetch(`${DOKPLOY_URL}/api/trpc/application.deletePreview`, {
      method: 'POST',
      headers: {
        'x-api-key': DOKPLOY_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ json: { deploymentId } }),
    });

    if (!response.ok) {
      const text = await response.text();
      return { success: false, error: `Cleanup failed: ${response.status} ${text}` };
    }

    console.log('[Cleanup] ✅ Preview deployment deleted successfully');
    return { success: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Cleanup error: ${errorMsg}` };
  }
}

async function processApprovedTask(task: schema.AgentTask) {
  console.log(`[Workflow] Processing approved task: ${task.id} - ${task.title}`);

  // Merge to main branch
  const mergeResult = await mergeToMain(task);
  if (!mergeResult.success) {
    console.error(`[Workflow] Failed to merge task ${task.id}: ${mergeResult.error}`);
    return;
  }

  // Deploy to production
  const deployResult = await deployToProduction(task.projectPath);
  if (!deployResult.success) {
    console.error(`[Workflow] Failed to deploy task ${task.id}: ${deployResult.error}`);
    return;
  }

  // Clean up preview deployment
  if (task.previewDeploymentId) {
    await cleanupPreviewDeployment(task.previewDeploymentId);
  }

  console.log(`[Workflow] ✅ Task ${task.id} successfully deployed to production`);
}

async function processRejectedTask(task: schema.AgentTask) {
  console.log(`[Workflow] Processing rejected task: ${task.id} - ${task.title}`);

  // Clean up preview deployment
  if (task.previewDeploymentId) {
    await cleanupPreviewDeployment(task.previewDeploymentId);
  }

  // Delete the feature branch
  if (task.branchName) {
    const cwd = task.projectPath;
    await runGitCommand(['push', 'origin', '--delete', task.branchName], cwd);
    console.log(`[Workflow] Deleted branch ${task.branchName}`);
  }

  console.log(`[Workflow] ✅ Task ${task.id} cleanup completed`);
}

async function main() {
  console.log('[Workflow] Review workflow handler started');

  // Process approved tasks (status changed from 'review' to 'completed')
  const approvedTasks = await db.query.agentTasks.findMany({
    where: eq(schema.agentTasks.status, 'completed'),
    // In a real implementation, you'd want to track which tasks have been processed
    // For now, we'll assume all completed tasks need processing
  });

  for (const task of approvedTasks) {
    if (task.branchName && task.commitHash) {
      await processApprovedTask(task);
    }
  }

  // Process rejected tasks (status changed from 'review' to 'failed')
  const rejectedTasks = await db.query.agentTasks.findMany({
    where: eq(schema.agentTasks.status, 'failed'),
    // Similar to above, in a real implementation you'd track processed tasks
  });

  for (const task of rejectedTasks) {
    if (task.previewDeploymentId || task.branchName) {
      await processRejectedTask(task);
    }
  }

  console.log('[Workflow] Review workflow handler completed');
  process.exit(0);
}

if (require.main === module) {
  main().catch(console.error);
}

export { processApprovedTask, processRejectedTask };