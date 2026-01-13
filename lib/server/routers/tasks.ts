import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { db } from '@/lib/db';
import { agentTasks } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

export const tasksRouter = router({
  // Get all tasks
  list: publicProcedure.query(async () => {
    return await db.query.agentTasks.findMany({
      orderBy: [desc(agentTasks.createdAt)],
    });
  }),

  // Get a single task by ID
  getById: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      const task = await db.query.agentTasks.findFirst({
        where: eq(agentTasks.id, input.id),
      });
      return task;
    }),

  // Create a new task
  create: publicProcedure
    .input(
      z.object({
        title: z.string().min(1),
        prompt: z.string().min(1),
        projectPath: z.string().min(1),
        model: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const [task] = await db
        .insert(agentTasks)
        .values({
          title: input.title,
          prompt: input.prompt,
          projectPath: input.projectPath,
          model: input.model,
        })
        .returning();
      return task;
    }),

  // Update task status
  updateStatus: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.enum(['pending', 'running', 'completed', 'failed', 'cancelled']),
        output: z.string().optional(),
        error: z.string().optional(),
        branchName: z.string().optional(),
        commitHash: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, status, ...data } = input;
      const updateData: Record<string, unknown> = { 
        status, 
        ...data, 
        updatedAt: new Date() 
      };
      
      if (status === 'running') {
        updateData.startedAt = new Date();
      }
      if (status === 'completed' || status === 'failed') {
        updateData.completedAt = new Date();
      }
      
      const [task] = await db
        .update(agentTasks)
        .set(updateData)
        .where(eq(agentTasks.id, id))
        .returning();
      return task;
    }),

  // Get next pending task (for agent runner)
  getNextPending: publicProcedure.query(async () => {
    const task = await db.query.agentTasks.findFirst({
      where: eq(agentTasks.status, 'pending'),
      orderBy: [agentTasks.createdAt],
    });
    return task;
  }),

  // Cancel a task
  cancel: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const [task] = await db
        .update(agentTasks)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(eq(agentTasks.id, input.id))
        .returning();
      return task;
    }),

  // Delete a task
  delete: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      await db.delete(agentTasks).where(eq(agentTasks.id, input.id));
      return { success: true };
    }),
});

