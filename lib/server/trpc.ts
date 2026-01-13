import { initTRPC } from '@trpc/server';
import { cache } from 'react';
import superjson from 'superjson';

// Create context
export const createContext = cache(async () => {
  return {
    // Add your context here (user, session, etc.)
    // For now, we'll keep it simple
  };
});

export type Context = Awaited<ReturnType<typeof createContext>>;

// Initialize tRPC
const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

// Export reusable router and procedure helpers
export const router = t.router;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;
