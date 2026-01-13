# Idea Factory Template - Claude Code Guide

This template provides a complete full-stack development environment for rapid prototyping with Next.js 15, designed for seamless AI-assisted development.

## Tech Stack

### Frontend
- **Next.js 15** (App Router) - React framework with server components
- **TypeScript** - Full type safety
- **Tailwind CSS** - Utility-first styling
- **Shadcn/ui** - Beautiful, accessible components built on Radix UI
- **tRPC** - End-to-end type-safe APIs

### Backend & Infrastructure
- **PostgreSQL 16** - Relational database (`devdb` on port 5432)
- **Drizzle ORM** - Type-safe, lightweight ORM with great DX
- **Redis 7** - Caching, sessions, pub/sub (`redis://` on port 6379)
- **MinIO** - S3-compatible object storage (API: 9000, Console: 9001)

### Development Tools
- **Drizzle Kit** - Database migrations and schema management
- **React Query** - Data fetching and caching (via tRPC)
- **Zod** - Runtime type validation

## Project Structure

```
idea-factory-template/
├── app/                      # Next.js App Router
│   ├── api/
│   │   └── trpc/[trpc]/     # tRPC API endpoint
│   ├── layout.tsx           # Root layout with providers
│   ├── page.tsx             # Home page
│   └── globals.css          # Global styles
├── components/              # React components
│   └── ui/                  # Shadcn/ui components
├── lib/                     # Utility libraries
│   ├── db.ts                # Drizzle database client
│   ├── redis.ts             # Redis client with helpers
│   ├── storage.ts           # S3/MinIO client with helpers
│   ├── utils.ts             # General utilities
│   ├── server/              # Server-only code
│   │   ├── trpc.ts          # tRPC initialization
│   │   └── routers/         # tRPC routers
│   │       ├── _app.ts      # Main app router
│   │       └── posts.ts     # Example posts router
│   └── trpc/                # Client-side tRPC
│       ├── client.ts        # tRPC client setup
│       └── Provider.tsx     # React Query + tRPC provider
├── db/                      # Database schema and migrations
│   ├── schema.ts            # Drizzle schema definitions
│   └── migrations/          # Generated migration files
├── drizzle.config.ts        # Drizzle Kit configuration
├── .env.local               # Environment variables (not in git)
└── .env.example             # Example environment variables
```

## Getting Started

### 1. Environment Setup

Copy `.env.example` to `.env.local` and update values if needed:

```bash
cp .env.example .env.local
```

Default values work with the local infrastructure:
- Database: `postgresql://devuser:devpass123@192.168.1.197:5432/devdb`
- Redis: `redis://:devpass123@192.168.1.197:6379`
- MinIO: `http://192.168.1.197:9000`

### 2. Create MinIO Bucket

Before using storage features, create a bucket in MinIO:

1. Visit http://192.168.1.197:9001
2. Login with `minioadmin` / `minioadmin`
3. Create a bucket named `idea-factory` (or whatever you set in S3_BUCKET)

### 3. Push Database Schema

Initialize the database with the schema:

```bash
npm run db:push
```

This creates the `users` and `posts` tables defined in `db/schema.ts`.

### 4. Start Development Server

```bash
npm run dev
```

Visit http://localhost:3000

## Working with the Database (Drizzle ORM)

### Defining Schema

Edit `db/schema.ts` to define your tables:

```typescript
import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';

export const products = pgTable('products', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  price: integer('price').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
```

### Pushing Schema Changes

After modifying schema, push changes to the database:

```bash
npm run db:push
```

For production, generate and run migrations:

```bash
npm run db:generate  # Generate migration SQL
npm run db:migrate   # Apply migrations
```

### Querying Data

The database client is available at `@/lib/db`:

```typescript
import { db } from '@/lib/db';
import { users, posts } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

// Select all
const allUsers = await db.select().from(users);

// Select with where clause
const user = await db.query.users.findFirst({
  where: eq(users.email, 'user@example.com'),
});

// Select with relations
const userWithPosts = await db.query.users.findFirst({
  where: eq(users.id, userId),
  with: {
    posts: true,
  },
});

// Insert
const [newUser] = await db.insert(users).values({
  email: 'new@example.com',
  name: 'New User',
}).returning();

// Update
await db.update(users)
  .set({ name: 'Updated Name' })
  .where(eq(users.id, userId));

// Delete
await db.delete(users).where(eq(users.id, userId));
```

### Drizzle Studio

Launch the visual database browser:

```bash
npm run db:studio
```

Visit http://localhost:4983 to browse and edit data.

## Building APIs with tRPC

### Creating a New Router

1. Create a new router file in `lib/server/routers/`:

```typescript
// lib/server/routers/products.ts
import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { db } from '@/lib/db';
import { products } from '@/db/schema';

export const productsRouter = router({
  list: publicProcedure.query(async () => {
    return await db.select().from(products);
  }),

  getById: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      return await db.query.products.findFirst({
        where: eq(products.id, input.id),
      });
    }),

  create: publicProcedure
    .input(z.object({
      name: z.string().min(1),
      price: z.number().positive(),
      description: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const [product] = await db.insert(products)
        .values(input)
        .returning();
      return product;
    }),
});
```

2. Add to main router in `lib/server/routers/_app.ts`:

```typescript
import { productsRouter } from './products';

export const appRouter = router({
  posts: postsRouter,
  products: productsRouter, // Add new router
});
```

### Using tRPC in Components

```typescript
'use client';

import { trpc } from '@/lib/trpc/client';

export function ProductList() {
  const { data: products, isLoading } = trpc.products.list.useQuery();
  const createProduct = trpc.products.create.useMutation({
    onSuccess: () => {
      // Invalidate and refetch
      trpc.useUtils().products.list.invalidate();
    },
  });

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      {products?.map((product) => (
        <div key={product.id}>{product.name}</div>
      ))}
      <button onClick={() => createProduct.mutate({
        name: 'New Product',
        price: 1999,
      })}>
        Add Product
      </button>
    </div>
  );
}
```

## Working with Redis

The Redis client is available at `@/lib/redis` with helper functions:

```typescript
import { cache } from '@/lib/redis';

// Store data with 1 hour TTL
await cache.set('user:123', userData, 3600);

// Retrieve data
const userData = await cache.get<User>('user:123');

// Delete data
await cache.del('user:123');

// Increment counter
await cache.incr('page:views');

// Check existence
const exists = await cache.exists('user:123');

// Pattern matching
const keys = await cache.keys('user:*');
```

### Caching Patterns

Cache expensive database queries:

```typescript
async function getUser(userId: string) {
  // Try cache first
  const cached = await cache.get<User>(`user:${userId}`);
  if (cached) return cached;

  // Fetch from database
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  // Cache for 5 minutes
  if (user) {
    await cache.set(`user:${userId}`, user, 300);
  }

  return user;
}
```

## Working with Storage (S3/MinIO)

The storage client is available at `@/lib/storage`:

```typescript
import { storage } from '@/lib/storage';

// Upload a file
const key = await storage.upload(
  'uploads/image.jpg',
  fileBuffer,
  'image/jpeg'
);

// Get a file
const fileData = await storage.get('uploads/image.jpg');

// Delete a file
await storage.delete('uploads/image.jpg');

// List files
const files = await storage.list('uploads/');

// Get presigned upload URL (for direct browser uploads)
const uploadUrl = await storage.getUploadUrl('uploads/image.jpg', 3600);

// Get presigned download URL
const downloadUrl = await storage.getDownloadUrl('uploads/image.jpg', 3600);

// Check if file exists
const exists = await storage.exists('uploads/image.jpg');
```

### File Upload Pattern

Server-side upload:

```typescript
// In a tRPC mutation
uploadImage: publicProcedure
  .input(z.object({
    filename: z.string(),
    content: z.string(), // base64 encoded
    contentType: z.string(),
  }))
  .mutation(async ({ input }) => {
    const buffer = Buffer.from(input.content, 'base64');
    const key = `uploads/${Date.now()}-${input.filename}`;

    await storage.upload(key, buffer, input.contentType);

    return { key };
  }),
```

Client-side direct upload (better for large files):

```typescript
// Get presigned URL from server
const { uploadUrl } = await trpc.storage.getUploadUrl.query({
  filename: 'image.jpg',
});

// Upload directly to MinIO/S3 from browser
await fetch(uploadUrl, {
  method: 'PUT',
  body: file,
  headers: {
    'Content-Type': file.type,
  },
});
```

## Adding Authentication with Clerk

1. **Install Clerk**:

```bash
npm install @clerk/nextjs
```

2. **Add Environment Variables** (`.env.local`):

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

3. **Wrap App with ClerkProvider** (`app/layout.tsx`):

```typescript
import { ClerkProvider } from '@clerk/nextjs';

export default function RootLayout({ children }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>
          <TRPCProvider>{children}</TRPCProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
```

4. **Add Auth to tRPC Context** (`lib/server/trpc.ts`):

```typescript
import { auth } from '@clerk/nextjs/server';

export const createContext = cache(async () => {
  const { userId } = await auth();

  return {
    userId,
  };
});
```

5. **Create Protected Procedure**:

```typescript
import { TRPCError } from '@trpc/server';

export const protectedProcedure = publicProcedure.use(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({
    ctx: {
      userId: ctx.userId,
    },
  });
});
```

6. **Use in Components**:

```typescript
import { SignInButton, SignOutButton, useUser } from '@clerk/nextjs';

export function Header() {
  const { isSignedIn, user } = useUser();

  return (
    <header>
      {isSignedIn ? (
        <>
          <span>Hello, {user.firstName}</span>
          <SignOutButton />
        </>
      ) : (
        <SignInButton />
      )}
    </header>
  );
}
```

## Shadcn/ui Components

Components are pre-installed. To add more:

```bash
npx shadcn@latest add dropdown-menu
```

Available components: https://ui.shadcn.com/docs/components

Example usage:

```typescript
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export function MyComponent() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Hello World</CardTitle>
      </CardHeader>
      <CardContent>
        <Input placeholder="Enter text..." />
        <Button>Submit</Button>
      </CardContent>
    </Card>
  );
}
```

## Deployment

### Local Deployment with Dokploy

1. Access Dokploy at http://192.168.1.197:3000
2. Create a new project
3. Create an application linked to your git repository
4. Add environment variables and build args
5. Add domains (e.g., `devhub.taile34b62.ts.net` for Tailscale Funnel access)
6. Deploy!

Dokploy will:
- Build your Next.js app via Docker
- Set up automatic deployments on git push
- Route traffic via Traefik reverse proxy
- Support multiple domains per application

**Public Access via Tailscale Funnel:**
Your app is publicly accessible at https://devhub.taile34b62.ts.net/ via Tailscale Funnel (HTTPS, no ports to open).

### Cloud Deployment

The template is designed for zero-code migration to cloud providers.

**Vercel Deployment**:
1. Connect your GitHub repo to Vercel
2. Add environment variables (update URLs to cloud services)
3. Deploy

**Database Migration**:
- Local PostgreSQL → **Neon** (or Supabase, AWS RDS)
- Local Redis → **Upstash** (or AWS ElastiCache)
- Local MinIO → **Cloudflare R2** (or AWS S3)

Just update environment variables - no code changes needed!

## Common Patterns

### Form Handling with React Hook Form

```typescript
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';

const formSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  content: z.string().optional(),
});

export function PostForm() {
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      content: '',
    },
  });

  const createPost = trpc.posts.create.useMutation();

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    await createPost.mutateAsync({
      ...data,
      userId: 'current-user-id', // Get from auth
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Create Post</Button>
      </form>
    </Form>
  );
}
```

### Loading States

```typescript
export function PostsList() {
  const { data, isLoading, error } = trpc.posts.list.useQuery();

  if (isLoading) return <div>Loading posts...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!data?.length) return <div>No posts yet</div>;

  return (
    <div>
      {data.map((post) => (
        <div key={post.id}>{post.title}</div>
      ))}
    </div>
  );
}
```

### Optimistic Updates

```typescript
const utils = trpc.useUtils();
const deletePost = trpc.posts.delete.useMutation({
  onMutate: async (variables) => {
    // Cancel outgoing refetches
    await utils.posts.list.cancel();

    // Snapshot previous value
    const previous = utils.posts.list.getData();

    // Optimistically update
    utils.posts.list.setData(undefined, (old) =>
      old?.filter((post) => post.id !== variables.id)
    );

    return { previous };
  },
  onError: (err, variables, context) => {
    // Rollback on error
    utils.posts.list.setData(undefined, context?.previous);
  },
  onSettled: () => {
    // Refetch after mutation
    utils.posts.list.invalidate();
  },
});
```

## Troubleshooting

### Database Connection Issues

```bash
# Check PostgreSQL is running
docker ps | grep postgres

# Test connection
psql postgresql://devuser:devpass123@192.168.1.197:5432/devdb
```

### Redis Connection Issues

```bash
# Check Redis is running
docker ps | grep redis

# Test connection
redis-cli -h 192.168.1.197 -p 6379 -a devpass123 ping
```

### MinIO Connection Issues

```bash
# Check MinIO is running
docker ps | grep minio

# Visit console
open http://192.168.1.197:9001
```

### Type Errors

If you see type errors after schema changes:

```bash
# Regenerate types
npm run db:push

# Restart TypeScript server in VS Code
Cmd+Shift+P → "TypeScript: Restart TS Server"
```

## Best Practices

1. **Always use Zod schemas** for input validation in tRPC procedures
2. **Use transactions** for multi-table operations with Drizzle
3. **Cache expensive queries** in Redis with reasonable TTLs
4. **Use presigned URLs** for file uploads to reduce server load
5. **Index database columns** that are frequently queried
6. **Validate environment variables** at startup (already done in lib files)
7. **Use optimistic updates** for better UX in mutations
8. **Keep routers focused** - one router per resource/domain

## Resources

- Next.js Docs: https://nextjs.org/docs
- Drizzle ORM Docs: https://orm.drizzle.team/docs/overview
- tRPC Docs: https://trpc.io/docs
- Shadcn/ui Docs: https://ui.shadcn.com
- Clerk Auth Docs: https://clerk.com/docs
- Redis Commands: https://redis.io/commands

## Support

For infrastructure issues, check:
- `~/docker-stacks/INFRASTRUCTURE.md` - Complete infrastructure documentation
- Dokploy logs: Check the Dokploy dashboard at http://192.168.1.197:3000
- Docker logs: `docker logs <container-name>`

Happy building! 🚀
