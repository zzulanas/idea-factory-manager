# Idea Factory Template

A modern, full-stack Next.js template for rapid prototyping, designed for seamless cloud portability and AI-assisted development.

## ✨ Features

- **Next.js 15** with App Router and Server Components
- **TypeScript** for full type safety
- **tRPC** for end-to-end type-safe APIs
- **Drizzle ORM** with PostgreSQL
- **Redis** for caching and sessions
- **MinIO** (S3-compatible) for object storage
- **Shadcn/ui** for beautiful, accessible components
- **Tailwind CSS** for utility-first styling
- **Zero-config** local development environment

## 🚀 Quick Start

### Prerequisites

Ensure the infrastructure services are running:

```bash
# Start PostgreSQL
cd ~/docker-stacks/postgres && docker compose up -d

# Start Redis
cd ~/docker-stacks/redis && docker compose up -d

# Start MinIO
cd ~/docker-stacks/minio && docker compose up -d
```

### Setup

1. **Install dependencies**:

```bash
npm install
```

2. **Configure environment**:

```bash
cp .env.example .env.local
# Edit .env.local if needed (defaults work with local infrastructure)
```

3. **Create MinIO bucket**:

- Visit http://192.168.1.197:9001
- Login: `minioadmin` / `minioadmin`
- Create bucket: `idea-factory`

4. **Initialize database**:

```bash
npm run db:push
```

5. **Start development server**:

```bash
npm run dev
```

Visit http://localhost:3000 🎉

## 📚 Documentation

See [CLAUDE_CODE.md](./CLAUDE_CODE.md) for comprehensive documentation including:

- Database operations with Drizzle ORM
- Building type-safe APIs with tRPC
- Working with Redis caching
- File storage with S3/MinIO
- Authentication setup (Clerk)
- Deployment guides
- Common patterns and best practices

## 🛠 Available Commands

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint

npm run db:push      # Push schema changes to database
npm run db:generate  # Generate migration files
npm run db:migrate   # Run migrations
npm run db:studio    # Launch Drizzle Studio (database GUI)
```

## 🗄 Infrastructure Services

| Service | Local URL | Cloud Alternative |
|---------|-----------|-------------------|
| PostgreSQL | `192.168.1.197:5432` | Neon, Supabase, AWS RDS |
| Redis | `192.168.1.197:6379` | Upstash, AWS ElastiCache |
| MinIO | `192.168.1.197:9000` | Cloudflare R2, AWS S3 |
| pgAdmin | http://192.168.1.197:5050 | - |
| Redis Commander | http://192.168.1.197:8082 | - |
| MinIO Console | http://192.168.1.197:9001 | - |
| Dokploy | http://192.168.1.197:3000 | Vercel, Railway, Fly.io |

## 📁 Project Structure

```
├── app/                 # Next.js App Router
│   ├── api/trpc/       # tRPC API endpoint
│   ├── layout.tsx      # Root layout
│   └── page.tsx        # Home page
├── components/         # React components
│   └── ui/            # Shadcn/ui components
├── lib/               # Utilities
│   ├── db.ts          # Database client
│   ├── redis.ts       # Redis client
│   ├── storage.ts     # S3/MinIO client
│   ├── server/        # Server-only code
│   │   ├── trpc.ts    # tRPC setup
│   │   └── routers/   # tRPC routers
│   └── trpc/          # Client tRPC setup
├── db/                # Database schema
│   ├── schema.ts      # Drizzle schema
│   └── migrations/    # Migration files
└── drizzle.config.ts  # Drizzle configuration
```

## 🌐 Cloud Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Import project in Vercel
3. Add environment variables (update URLs to cloud services)
4. Deploy

### Environment Variables for Production

```bash
DATABASE_URL=postgresql://user:pass@your-cloud-db
REDIS_URL=redis://your-cloud-redis
S3_ENDPOINT=https://your-r2-endpoint
S3_BUCKET=your-bucket
S3_ACCESS_KEY=your-key
S3_SECRET_KEY=your-secret
```

### Cloud Services Setup

**Database (Neon)**:
1. Create database at https://neon.tech
2. Copy connection string to `DATABASE_URL`

**Redis (Upstash)**:
1. Create Redis database at https://upstash.com
2. Copy connection string to `REDIS_URL`

**Storage (Cloudflare R2)**:
1. Create R2 bucket at Cloudflare
2. Generate API keys
3. Update `S3_*` variables

## 🔐 Authentication

Add Clerk authentication:

```bash
npm install @clerk/nextjs
```

See [CLAUDE_CODE.md](./CLAUDE_CODE.md#adding-authentication-with-clerk) for detailed setup instructions.

## 🤝 Working with Claude Code

This template is optimized for AI-assisted development. When working with Claude Code:

1. **Reference CLAUDE_CODE.md** for patterns and examples
2. **Use type-safe APIs** with tRPC for predictable code generation
3. **Leverage Drizzle schema** for database operations
4. **Follow established patterns** in the template

Claude Code can help you:
- Create new database schemas and migrations
- Build tRPC routers and procedures
- Design and implement UI components
- Add caching strategies
- Implement file upload flows

## 📊 Database Management

**Drizzle Studio** (Visual Database Browser):

```bash
npm run db:studio
```

Visit http://localhost:4983

**pgAdmin** (Full-featured DB Client):

Visit http://192.168.1.197:5050
- Login: `admin@localhost.com` / `admin123`

## 💾 Storage Management

**MinIO Console**:

Visit http://192.168.1.197:9001
- Login: `minioadmin` / `minioadmin`

Manage buckets, files, and access policies through the web UI.

## 🐛 Troubleshooting

### Can't connect to database

```bash
# Check PostgreSQL is running
docker ps | grep postgres

# If not running, start it
cd ~/docker-stacks/postgres && docker compose up -d
```

### Can't connect to Redis

```bash
# Check Redis is running
docker ps | grep redis

# Start if needed
cd ~/docker-stacks/redis && docker compose up -d
```

### Can't connect to MinIO

```bash
# Check MinIO is running
docker ps | grep minio

# Start if needed
cd ~/docker-stacks/minio && docker compose up -d
```

### Type errors after schema changes

```bash
npm run db:push
# Restart your IDE's TypeScript server
```

## 🎯 What to Build

This template is perfect for:

- SaaS MVPs
- Internal tools
- Content management systems
- E-commerce prototypes
- API-first applications
- Full-stack dashboards

## 📝 License

MIT

## 🙏 Acknowledgments

Built with:
- [Next.js](https://nextjs.org/)
- [Drizzle ORM](https://orm.drizzle.team/)
- [tRPC](https://trpc.io/)
- [Shadcn/ui](https://ui.shadcn.com/)
- [Tailwind CSS](https://tailwindcss.com/)

---

**Ready to build?** Check out [CLAUDE_CODE.md](./CLAUDE_CODE.md) for detailed documentation and start creating! 🚀
