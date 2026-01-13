import { router } from '../trpc';
import { postsRouter } from './posts';
import { tasksRouter } from './tasks';
import { dokployRouter } from './dokploy';

export const appRouter = router({
  posts: postsRouter,
  tasks: tasksRouter,
  dokploy: dokployRouter,
});

export type AppRouter = typeof appRouter;
