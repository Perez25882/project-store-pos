# BuildMat POS

BuildMat POS is a full-stack point-of-sale and inventory management system for building material retailers. It supports multi-store operations, staff roles, sales, procurement, inventory control, customer records, reporting, and deployment-ready production builds.

## What It Includes

- Secure admin and staff authentication with JWT refresh tokens
- Multi-store product catalogs, categories, stock levels, and low-stock tracking
- Sales workflows with payments, invoices, voiding, and stock movement history
- Supplier and procurement order management with goods receipt support
- Customer records, expenses, accounting summaries, and ledger reporting
- Staff management, audit logs, store switching, and dashboard views
- React frontend, Fastify API, Prisma data model, PostgreSQL, Redis, Docker, PM2, and Nginx support

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18, Vite, TypeScript, Tailwind CSS, TanStack Query, Zustand |
| Backend | Node.js 20, Fastify, TypeScript, Prisma, Zod, JWT, bcrypt |
| Data | PostgreSQL 15, Redis |
| Deployment | Docker, PM2, Nginx, Certbot |

## Project Structure

```text
backend/        Fastify API, Prisma schema, migrations, seed script, tests
frontend/       React application and Vite build configuration
docker-compose.yml
nginx.conf
package.json    Root scripts for running, building, and testing the app
```

## Requirements

- Node.js 20 or newer
- npm
- Docker and Docker Compose
- PostgreSQL and Redis, either through Docker or managed services

## Local Setup

Install dependencies:

```bash
npm install
cd backend && npm install
cd ../frontend && npm install
```

Start local services:

```bash
docker compose up -d postgres redis
```

Create the backend environment file:

```bash
cd backend
cp .env.example .env
```

For the bundled Docker database, use this `DATABASE_URL`:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/buildmat
```

Generate Prisma Client, apply the schema, and seed the database:

```bash
npx prisma generate
npx prisma migrate dev
npm run db:seed
```

Start the app from the repository root:

```bash
npm run dev
```

The frontend runs at `http://localhost:5173`, and the API runs at `http://localhost:3000`.

## Seeded Local Accounts

The seed script creates two stores and local test users. For local development, the default admin password is:

```text
Username: admin
Password: Admin123!
```

Production seeding is protected. Set `ALLOW_PROD_SEED=true` and provide `ADMIN_SEED_USERNAME`, `ADMIN_SEED_PASSWORD`, and `ADMIN_SEED_EMAIL` before running the seed script in production.

## Environment Variables

Backend variables live in `backend/.env`:

```env
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:5173
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/buildmat
JWT_ACCESS_SECRET=change-me-32-chars-minimum!!!
JWT_REFRESH_SECRET=change-me-too-32-chars!!!
REDIS_URL=redis://localhost:6379
STORAGE_PATH=./storage/invoices
PAYSTACK_SECRET_KEY=
PAYSTACK_WEBHOOK_SECRET=
RESEND_API_KEY=
ADMIN_SEED_USERNAME=admin
ADMIN_SEED_PASSWORD=ChangeMe123!
ADMIN_SEED_EMAIL=admin@buildmat.gh
```

Frontend variables live in `frontend/.env` when needed:

```env
VITE_API_URL=http://localhost:3000
```

If `VITE_API_URL` is not set, the frontend uses `/api`, which works with the local Vite proxy and common reverse-proxy deployments.

## Useful Commands

Run both apps in development:

```bash
npm run dev
```

Build the backend and frontend:

```bash
npm run build
```

Run backend tests:

```bash
npm test
```

Open Prisma Studio:

```bash
npm run db:studio
```

## Production Notes

1. Install dependencies with `npm ci` in both `backend/` and `frontend/`.
2. Set strong production values for all secrets in `backend/.env`.
3. Run `npx prisma generate` and `npx prisma migrate deploy` from `backend/`.
4. Build the app with `npm run build` from the repository root.
5. Serve the frontend build with Nginx and run the backend with PM2 or Docker.
6. Use the included `nginx.conf` as a starting point and replace the placeholder domain values before deployment.

The backend health check is available at:

```bash
curl http://localhost:3000/api/health
```

## License

MIT
