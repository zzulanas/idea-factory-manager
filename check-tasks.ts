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

async function checkTasks() {
  try {
    const tasks = await db.query.agentTasks.findMany();
    console.log('Total tasks:', tasks.length);
    
    const statusCounts: Record<string, number> = {};
    tasks.forEach(task => {
      statusCounts[task.status] = (statusCounts[task.status] || 0) + 1;
    });
    console.log('Tasks by status:', statusCounts);
    
    const reviewTasks = tasks.filter(t => t.status === 'review');
    console.log('\nReview tasks:', reviewTasks.length);
    if (reviewTasks.length > 0) {
      console.log('Review task details:');
      reviewTasks.forEach(t => {
        console.log(`- ${t.id}: ${t.title} (${t.status})`);
        console.log(`  Branch: ${t.branchName || 'none'}`);
        console.log(`  Preview: ${t.previewUrl || 'none'}`);
      });
    }
    
    // Show recent tasks
    console.log('\nRecent tasks (last 5):');
    const recentTasks = tasks
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 5);
    
    recentTasks.forEach(t => {
      console.log(`- ${t.title} (${t.status}) - ${new Date(t.updatedAt).toLocaleString()}`);
    });
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
    process.exit(0);
  }
}

checkTasks();