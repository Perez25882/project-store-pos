# BuildMat POS

Point-of-sale and inventory management system for building material retailers in Ghana.

## Tech Stack

- **Backend:** Node.js 20, Fastify 4, Prisma 5, PostgreSQL 15, JWT auth, bcrypt, Zod
- **Frontend:** React 18, Vite, Tailwind CSS, Zustand, TanStack Query
- **Infra:** Docker, PM2, Nginx, SSL (Let's Encrypt)

## Features

| Phase | Feature |
|-------|---------|
| 1 | Multi-store auth, roles (Admin/Staff), seeded data |
| 2 | Products, categories, stock levels, adjustments, low-stock alerts |
| 3 | Sales flow, payments (cash/MoMo/card), void/refund, PDF invoices |
| 4 | Suppliers, purchase orders, goods receipt, weighted average cost |
| 5 | Customers, expenses, accounting (P&L, daily summary, ledger) |
| 6 | Reports: top products, sales trends, employee performance, store comparison, category breakdown |
| 7 | Staff management, audit log, store switcher, enhanced dashboard, settings |
| 8 | Deployment: Docker, PM2, Nginx, SSL |

## Quick Start (Local Dev)

```bash
# 1. Start Postgres & Redis
docker-compose up -d postgres redis

# 2. Backend
cd backend
cp .env.example .env
# Edit DATABASE_URL in .env
npm install
npx prisma db push
npx prisma db seed   # creates admin + sample stores
npm run dev

# 3. Frontend
cd ../frontend
npm install
npm run dev
```

## Environment Variables (Backend `.env`)

```
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/buildmat
JWT_ACCESS_SECRET=your-strong-secret
JWT_REFRESH_SECRET=another-strong-secret
FRONTEND_URL=http://localhost:5173
```

## Production Deployment (Ubuntu + DigitalOcean)

1. **Provision droplet** (Ubuntu 22.04, 2GB RAM+)
2. **Install Node 20, PM2, Nginx, Certbot:**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt install -y nodejs nginx certbot python3-certbot-nginx
   sudo npm install -g pm2
   ```
3. **Clone repo & build:**
   ```bash
   git clone <repo> /var/www/buildmat
   cd /var/www/buildmat/backend
   npm ci
   npx prisma generate
   npx prisma migrate deploy
   npm run build
   mkdir -p logs
   ```
4. **Start with PM2:**
   ```bash
   pm2 start ecosystem.config.cjs --env production
   pm2 save
   pm2 startup
   ```
5. **Configure Nginx** (see `nginx.conf`, replace `YOUR_DOMAIN`)
6. **SSL:**
   ```bash
   sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
   ```
7. **Build frontend:**
   ```bash
   cd /var/www/buildmat/frontend
   npm ci
   npm run build
   # Copy dist to /var/www/buildmat/dist
   ```

## Default Login

- **Username:** `admin`
- **Password:** `Admin123!`

## API Health Check

```bash
curl https://yourdomain.com/api/health
```

## License

MIT
