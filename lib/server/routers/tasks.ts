import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { db } from '@/lib/db';
import { agentTasks } from '@/db/schema';
import { eq, desc, or, ilike } from 'drizzle-orm';

export const tasksRouter = router({
  // Get all tasks
  list: publicProcedure.query(async () => {
    return await db.query.agentTasks.findMany({
      orderBy: [desc(agentTasks.createdAt)],
    });
  }),

  // Search tasks
  search: publicProcedure
    .input(z.object({ 
      query: z.string().min(1),
      projectPath: z.string().optional()
    }))
    .query(async ({ input }) => {
      const searchTerm = `%${input.query}%`;
      
      let whereConditions = or(
        ilike(agentTasks.title, searchTerm),
        ilike(agentTasks.prompt, searchTerm)
      );

      // If projectPath is provided, add it to the search conditions
      if (input.projectPath) {
        whereConditions = or(
          whereConditions,
          eq(agentTasks.projectPath, input.projectPath)
        );
      }

      return await db.query.agentTasks.findMany({
        where: whereConditions,
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
        status: z.enum(['pending', 'running', 'completed', 'failed', 'cancelled', 'review']),
        output: z.string().optional(),
        error: z.string().optional(),
        branchName: z.string().optional(),
        commitHash: z.string().optional(),
        previewUrl: z.string().optional(),
        previewDeploymentId: z.string().optional(),
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

  // Submit task for review (creates preview deployment)
  submitForReview: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        applicationId: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const task = await db.query.agentTasks.findFirst({
        where: eq(agentTasks.id, input.id),
      });
      
      if (!task || !task.branchName) {
        throw new Error('Task not found or no branch available');
      }

      // This would typically call the Dokploy API to create a preview deployment
      // For now, we'll just update the status to 'review'
      const [updatedTask] = await db
        .update(agentTasks)
        .set({ 
          status: 'review',
          updatedAt: new Date()
        })
        .where(eq(agentTasks.id, input.id))
        .returning();
      
      return updatedTask;
    }),

  // Approve task (merge to main and deploy)
  approve: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const [task] = await db
        .update(agentTasks)
        .set({ 
          status: 'completed',
          completedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(agentTasks.id, input.id))
        .returning();
      return task;
    }),

  // Reject task (close preview and mark as failed)
  reject: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const [task] = await db
        .update(agentTasks)
        .set({ 
          status: 'failed',
          error: input.reason || 'Task rejected during review',
          completedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(agentTasks.id, input.id))
        .returning();
      return task;
    }),

  // Get tasks in review
  getReviewTasks: publicProcedure.query(async () => {
    return await db.query.agentTasks.findMany({
      where: eq(agentTasks.status, 'review'),
      orderBy: [desc(agentTasks.updatedAt)],
    });
  }),
});

