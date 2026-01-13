import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { db } from '@/lib/db';
import { posts } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

export const postsRouter = router({
  // Get all posts
  list: publicProcedure.query(async () => {
    return await db.query.posts.findMany({
      orderBy: [desc(posts.createdAt)],
      with: {
        author: true,
      },
    });
  }),

  // Get a single post by ID
  getById: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      const post = await db.query.posts.findFirst({
        where: eq(posts.id, input.id),
        with: {
          author: true,
        },
      });
      return post;
    }),

  // Create a new post
  create: publicProcedure
    .input(
      z.object({
        title: z.string().min(1),
        content: z.string().optional(),
        userId: z.string().uuid(),
        published: z.boolean().default(false),
      })
    )
    .mutation(async ({ input }) => {
      const [post] = await db
        .insert(posts)
        .values({
          title: input.title,
          content: input.content,
          userId: input.userId,
          published: input.published,
        })
        .returning();
      return post;
    }),

  // Update a post
  update: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        title: z.string().min(1).optional(),
        content: z.string().optional(),
        published: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      const [post] = await db
        .update(posts)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(posts.id, id))
        .returning();
      return post;
    }),

  // Delete a post
  delete: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      await db.delete(posts).where(eq(posts.id, input.id));
      return { success: true };
    }),
});
