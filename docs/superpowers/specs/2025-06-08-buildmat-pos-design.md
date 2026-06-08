# BuildMat POS — Design Document

**Date:** 2025-06-08
**Version:** 1.0
**Approach:** Single repo with `backend/` + `frontend/` folders

---

## 1. Problem Statement

A two-branch building materials business in Ghana needs a unified POS, inventory, and accounting system. Key constraints:
- Two stores operate independently with separate staff, inventory, and sales
- A Super Admin needs consolidated visibility across both stores
- Staff must be locked to their assigned store (IDOR prevention)
- Payments via Paystack (Mobile Money + Card)
- Invoices delivered as PDF downloads + WhatsApp share links

---

## 2. Architecture

### 2.1 Project Structure

```
projectt/
├── backend/
│   ├── src/
│   │   ├── config/          # env, constants
│   │   ├── modules/         # domain modules (auth, products, sales, etc.)
│   │   ├── lib/             # prisma client, utilities
│   │   ├── middleware/      # auth, store-scoping
│   │   ├── plugins/         # fastify plugins (jwt, swagger, static)
│   │   ├── types/           # shared TS types
│   │   └── server.ts        # entry point
│   ├── prisma/
│   │   └── schema.prisma    # full DB schema (per BuildMat_Engineering_Doc.md §5)
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/           # route pages
│   │   ├── components/      # reusable UI
│   │   ├── hooks/           # custom React hooks
│   │   ├── stores/          # Zustand global state
│   │   ├── lib/             # api client, utils
│   │   ├── types/           # frontend types
│   │   └── App.tsx          # router + layout
│   └── package.json
├── docs/superpowers/specs/  # this document
└── scripts/                 # deploy, seed, backup
```

### 2.2 Backend (Node.js 20 + Fastify 4)

**Entry:** `server.ts` registers plugins, hooks up all domain route prefixes.

**Domain modules** (each is a Fastify plugin):
- `auth` — login, refresh, logout, JWT validation
- `stores` — store CRUD, dashboard data
- `users` — admin-only staff management
- `products` — product CRUD with category, SKU, unit
- `inventory` — stock levels, adjustments, movements, low-stock alerts
- `sales` — sale creation, completion, voiding, invoice generation
- `customers` — customer CRUD + purchase history
- `suppliers` — supplier CRUD
- `procurement` — PO creation, goods receipt, cost price updates
- `expenses` — expense logging by category
- `reports` — P&L, sales summary, inventory valuation, top products, employee performance

**Auth pipeline:**
1. `POST /api/auth/login` → bcrypt compare → issue `accessToken` (15m) + `refreshToken` (7d)
2. `authenticate` hook validates access JWT, injects `req.user` (`{ id, role, storeId }`)
3. `authorize(roles)` hook checks `req.user.role`
4. Store-scoping hook adds `storeFilter` to request:
   - ADMIN: `{ storeId: query.storeId }` or `{}` (consolidated)
   - STAFF: `{ storeId: req.user.storeId }` (locked, no override)

**Stock transactions (Prisma $transaction):**
- **Sale:** Deduct `StockLevel.quantity` → Insert `StockMovement` (SALE, negative) → Create `SaleItem`s → Queue low-stock alert if below reorder
- **Procurement receipt:** Add to `StockLevel` → Insert `StockMovement` (PURCHASE, positive) → Update PO status → Update `product.costPrice` (weighted average)

**Background jobs (BullMQ + Redis):**
- PDF invoice generation (Puppeteer)
- Low-stock email alerts

### 2.3 Frontend (React 18 + Vite + shadcn/ui)

**State:**
- **Zustand** — auth (user, tokens, current store), UI sidebar state
- **TanStack Query v5** — all server data (products, sales, inventory, etc.)

**Routing:**
- `/login` — public
- Admin → `/dashboard` (store picker cards)
- Staff → `/:storeId/dashboard` (direct, no choice)
- Store-scoped: `/:storeId/inventory`, `/:storeId/sales`, `/:storeId/procurement`, etc.
- Admin-only: `/dashboard/consolidated`, `/settings`, `/:storeId/staff`

**Component patterns:**
- shadcn/ui base: Button, Table, Dialog, Card, Form, Input, Select, etc.
- Domain pages in `pages/`, layouts: `DashboardLayout` (sidebar + header), `StoreLayout`
- Data tables: TanStack Table with sorting/filtering
- Forms: React Hook Form + Zod (schemas mirror backend)
- PDF: `react-pdf` for inline invoice preview
- Charts: Recharts for dashboard metrics

---

## 3. Data Model

Full Prisma schema defined in `backend/prisma/schema.prisma` (see BuildMat_Engineering_Doc.md §5).

Key models: `Store`, `User` (role: ADMIN | STAFF, storeId null for admin), `Product`, `StockLevel`, `StockMovement`, `Sale`, `SaleItem`, `Payment`, `Invoice`, `Customer`, `Supplier`, `ProcurementOrder`, `ProcurementItem`, `Expense`, `RefreshToken`.

---

## 4. API Design

RESTful JSON API. All protected routes require `Authorization: Bearer <token>`.

Key routes (full list in BuildMat_Engineering_Doc.md §6):
- `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`
- `GET /api/stores`, `GET /api/stores/:id/dashboard`
- `GET /api/dashboard/consolidated` [ADMIN]
- `POST /api/users` [ADMIN]
- `POST /api/products`, `GET /api/products`, etc.
- `GET /api/inventory`, `POST /api/inventory/adjust`
- `POST /api/sales`, `GET /api/sales/:id/invoice`
- `POST /api/payments/verify` (Paystack webhook)
- `POST /api/procurement`, `PATCH /api/procurement/:id/receive`
- `GET /api/reports/*`

---

## 5. Security Design

- Passwords: bcrypt (rounds 12)
- JWT access: 15 min expiry; refresh: 7 days, rotated on every use, stored hashed in DB
- Every DB query scoped by `storeId` (IDOR prevention)
- Paystack webhook: HMAC-SHA512 signature verification
- Rate limiting: 5 attempts / 15 min on auth routes
- Input validation: Zod on all request bodies
- CORS locked to frontend origin
- Helmet.js for HTTP security headers
- Invoice PDFs outside web root, served via authenticated routes only

---

## 6. Design System

| Token | Value |
|---|---|
| Primary | `#3d6b52` (sage green) |
| Primary Light | `#e8f0eb` |
| Danger | `#dc2626` |
| Warning | `#d97706` |
| Success | `#16a34a` |
| UI Font | DM Sans |
| Mono / Numbers | Geist Mono |
| Border radius | `rounded-none` (sharp corners) |
| Style | Flat fills, no gradients |

---

## 7. Testing Strategy

- **Backend:** Vitest for unit tests (business logic), Fastify inject for integration tests (routes + auth + store-scoping)
- **Frontend:** Vitest + React Testing Library for components, MSW for API mocking
- Critical paths: auth flow, sale transaction atomicity, stock update, store-scoping enforcement

---

## 8. Deployment (Phase 8)

- DigitalOcean Droplet (Ubuntu 22.04, 4GB RAM / 2 vCPU)
- Node.js 20 + PostgreSQL 15 + Redis 7
- PM2 process manager + Nginx reverse proxy + Let's Encrypt SSL
- `/storage/invoices` directory + Nginx static config
- Daily backup: `pg_dump` + `/storage` rsync → Backblaze B2

---

## 9. Implementation Phases

| Phase | Focus | Duration |
|---|---|---|
| 1 | Foundation: scaffold, DB, auth, store model, admin staff mgmt, layout shell | Week 1–2 |
| 2 | Inventory: product CRUD, stock levels, adjustments, movements, low-stock alerts | Week 3 |
| 3 | Sales & Invoicing: sale flow, cash/MoMo/Card, Paystack, PDF, WhatsApp share | Week 4–5 |
| 4 | Procurement: suppliers, POs, goods receipt, cost price updates | Week 6 |
| 5 | Customers & Staff: customer CRUD, staff management, profiles | Week 7 |
| 6 | Accounting & Reports: expenses, P&L, sales summary, valuation, exports | Week 8 |
| 7 | Super Admin & Polish: consolidated dashboard, store switcher, settings, audit, UI QA | Week 9 |
| 8 | Deployment: DO droplet, PM2, Nginx, SSL, backups, smoke tests | Week 10 |

---

*End of Design Document — BuildMat POS v1.0*
