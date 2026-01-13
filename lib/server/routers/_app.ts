import { router } from '../trpc';
import { postsRouter } from './posts';
import { tasksRouter } from './tasks';

export const appRouter = router({
  posts: postsRouter,
  tasks: tasksRouter,
});

export type AppRouter = typeof appRouter;
