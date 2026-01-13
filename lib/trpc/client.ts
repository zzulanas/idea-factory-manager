import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
import type { AppRouter } from '@/lib/server/routers/_app';

export const trpc = createTRPCReact<AppRouter>();

// Next.js basePath - must match next.config.ts
const basePath = '/manager';

export function getBaseUrl() {
  if (typeof window !== 'undefined') {
    // browser should use the basePath
    return basePath;
  }
  if (process.env.VERCEL_URL) {
    // reference for vercel.com
    return `https://${process.env.VERCEL_URL}${basePath}`;
  }
  // assume localhost
  return `http://localhost:${process.env.PORT ?? 3000}${basePath}`;
}

export function getTRPCClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: `${getBaseUrl()}/api/trpc`,
        transformer: superjson,
      }),
    ],
  });
}
