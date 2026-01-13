#!/usr/bin/env npx tsx
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './db/schema';
import { config } from 'dotenv';

config({ path: '.env.local' });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const client = postgres(DATABASE_URL);
const db = drizzle(client, { schema });

async function createTestTask() {
  try {
    const [task] = await db
      .insert(schema.agentTasks)
      .values({
        title: 'Test Review Workflow',
        prompt: 'Add a simple comment to the README file to test the review workflow',
        projectPath: '/home/zzula/projects/idea-factory-manager',
        status: 'review',
        branchName: 'test-review-branch',
        commitHash: 'abc1234',
        previewUrl: 'https://preview.example.com',
        previewDeploymentId: 'test-deployment-123',
      })
      .returning();
    
    console.log('Created test task:', task.id);
    console.log('Title:', task.title);
    console.log('Status:', task.status);
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
    process.exit(0);
  }
}

createTestTask();