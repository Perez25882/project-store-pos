# BuildMat POS — Engineering Documentation
**Client Project | Building Materials Sales Store (2 Branches)**
**Version 1.0 | Confidential**

---

## 1. Project Overview

A multi-store inventory and point-of-sale system for a two-branch building materials business. The Super Admin has consolidated visibility across both stores. Each store operates independently with its own employees, inventory, sales, and procurement — all data is store-scoped at the database level.

---

## 2. Decision Log

| Decision | Choice | Rationale |
|---|---|---|
| Platform | Web app (responsive) | Works on desktop + tablet at counter |
| Offline support | None in v1 | Adds major complexity; stable internet assumed |
| Payments | Paystack (MoMo + Card) | Dominant rails in Ghana |
| Barcode scanning | Not in v1 (hooks in place) | Manual SKU entry at launch |
| Invoice delivery | PDF download + WhatsApp share | Zero friction for client and customer |
| Multi-store model | Store-scoped schema | Every record carries `storeId`; no retrofitting |
| Auth | JWT (access + refresh) + RBAC | Stateless, scales horizontally |
| Deployment | DigitalOcean Droplet | Simple VPS, flat pricing, no IAM complexity |
| File storage | Local filesystem | PDFs served directly, daily offsite backup |

---

## 3. Tech Stack

### Backend
| Layer | Technology |
|---|---|
| Runtime | Node.js 20 (LTS) |
| Framework | Fastify 4 |
| ORM | Prisma 5 |
| Database | PostgreSQL 15 |
| Queue / Background jobs | BullMQ 5 + Redis 7 |
| Auth | JWT (`@fastify/jwt`) — access (15m) + refresh (7d) |
| Payments | Paystack Node SDK |
| PDF generation | Puppeteer (headless Chrome) |
| File storage | Local filesystem (`/storage/invoices`) served via `@fastify/static` |
| Email | Resend |
| Validation | Zod |

### Frontend
| Layer | Technology |
|---|---|
| Framework | React 18 + Vite |
| UI components | shadcn/ui |
| Styling | Tailwind CSS |
| Data fetching | TanStack Query v5 |
| Global state | Zustand |
| Charts | Recharts |
| PDF viewer | react-pdf |
| Forms | React Hook Form + Zod |
| Icons | Lucide React |

### Infrastructure
| Service | Provider |
|---|---|
| Compute | DigitalOcean Droplet (4GB RAM / 2 vCPU — ~$24/mo) |
| Database | PostgreSQL on same Droplet |
| File storage | Local disk — `/storage/invoices` (auto-backed up via cron) |
| Cache / Queue broker | Redis 7 (same Droplet) |
| Process manager | PM2 |
| Reverse proxy | Nginx |
| SSL | Let's Encrypt (Certbot) |
| Backups | Daily `pg_dump` + `/storage` rsync → offsite (Backblaze B2 or SFTP) |

---

## 4. User Roles & Permissions

Two roles only. No granular sub-roles within staff.

```
ADMIN (1 account)
  └── Full access to both stores
  └── Can switch between Store A and Store B dashboards
  └── Can view consolidated reports across both stores
  └── Creates and deactivates all staff accounts
  └── Full access: sales, inventory, procurement, accounting,
      reports, customers, suppliers, settings

STAFF (many accounts, store-scoped)
  └── Assigned to exactly one store — cannot see the other
  └── Full operational access within their store:
        · Create sales & invoices
        · Manage inventory (view + adjust)
        · Manage procurement orders
        · Manage customers & suppliers
        · View reports for their store
        · Log expenses
  └── Cannot: access the other store, manage other staff
      accounts, change system settings, or view consolidated data
```

**Key rules:**
- Admin's `storeId` is `null` in the DB — this is the gate for cross-store access
- Staff's `storeId` is always set — every query is auto-scoped to it
- Only Admin can create, deactivate, or reassign staff accounts

---

## 5. Database Schema (Prisma)

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── ENUMS ─────────────────────────────────────────────────────────────────

enum Role {
  ADMIN   // one account, null storeId, cross-store access
  STAFF   // many accounts, storeId required, single-store scoped
}

enum PaymentMethod {
  CASH
  MOMO
  CARD
  BANK_TRANSFER
}

enum PaymentStatus {
  PENDING
  PAID
  FAILED
  REFUNDED
}

enum SaleStatus {
  DRAFT
  COMPLETED
  VOIDED
  REFUNDED
}

enum ProcurementStatus {
  DRAFT
  SENT
  PARTIALLY_RECEIVED
  FULLY_RECEIVED
  CANCELLED
}

enum StockMovementType {
  PURCHASE        // Stock in from procurement
  SALE            // Stock out from sale
  ADJUSTMENT      // Manual correction
  TRANSFER        // Between stores (future)
  RETURN          // Customer return
  DAMAGE          // Write-off
}

enum ExpenseCategory {
  RENT
  UTILITIES
  SALARIES
  TRANSPORT
  MAINTENANCE
  MARKETING
  MISCELLANEOUS
}

// ─── CORE ──────────────────────────────────────────────────────────────────

model Store {
  id        String   @id @default(cuid())
  name      String
  address   String
  phone     String
  email     String?
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  users              User[]
  products           Product[]
  stockLevels        StockLevel[]
  stockMovements     StockMovement[]
  sales              Sale[]
  customers          Customer[]
  suppliers          Supplier[]
  procurementOrders  ProcurementOrder[]
  expenses           Expense[]

  @@map("stores")
}

model User {
  id           String    @id @default(cuid())
  name         String
  email        String    @unique
  phone        String?
  passwordHash String
  role         Role
  isActive     Boolean   @default(true)
  storeId      String?   // null = ADMIN (access all stores); required for STAFF
  lastLoginAt  DateTime?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  store              Store?             @relation(fields: [storeId], references: [id])
  refreshTokens      RefreshToken[]
  sales              Sale[]
  procurementOrders  ProcurementOrder[]
  stockMovements     StockMovement[]
  expenses           Expense[]
  createdBy          User?              @relation("UserCreatedBy", fields: [createdById], references: [id])
  createdById        String?
  createdUsers       User[]             @relation("UserCreatedBy")

  @@map("users")
}

model RefreshToken {
  id        String   @id @default(cuid())
  token     String   @unique
  userId    String
  expiresAt DateTime
  revoked   Boolean  @default(false)
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("refresh_tokens")
}

// ─── PRODUCT & INVENTORY ───────────────────────────────────────────────────

model Category {
  id        String    @id @default(cuid())
  name      String    @unique
  createdAt DateTime  @default(now())

  products  Product[]

  @@map("categories")
}

model Product {
  id           String   @id @default(cuid())
  sku          String
  name         String
  description  String?
  categoryId   String
  unit         String   // e.g. "bag", "piece", "ton", "metre"
  sellingPrice Decimal  @db.Decimal(12, 2)
  costPrice    Decimal  @db.Decimal(12, 2)
  reorderLevel Int      @default(10)
  storeId      String
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  store              Store              @relation(fields: [storeId], references: [id])
  category           Category           @relation(fields: [categoryId], references: [id])
  stockLevel         StockLevel?
  stockMovements     StockMovement[]
  saleItems          SaleItem[]
  procurementItems   ProcurementItem[]

  @@unique([sku, storeId])
  @@map("products")
}

model StockLevel {
  id        String   @id @default(cuid())
  productId String   @unique
  storeId   String
  quantity  Decimal  @db.Decimal(12, 2) @default(0)
  updatedAt DateTime @updatedAt

  product Product @relation(fields: [productId], references: [id])
  store   Store   @relation(fields: [storeId], references: [id])

  @@map("stock_levels")
}

model StockMovement {
  id          String            @id @default(cuid())
  productId   String
  storeId     String
  type        StockMovementType
  quantity    Decimal           @db.Decimal(12, 2)  // positive = in, negative = out
  balanceAfter Decimal          @db.Decimal(12, 2)
  unitCost    Decimal?          @db.Decimal(12, 2)
  reference   String?           // saleId, procurementId, or manual ref
  note        String?
  performedBy String
  createdAt   DateTime          @default(now())

  product  Product @relation(fields: [productId], references: [id])
  store    Store   @relation(fields: [storeId], references: [id])
  employee User    @relation(fields: [performedBy], references: [id])

  @@index([productId, storeId])
  @@index([createdAt])
  @@map("stock_movements")
}

// ─── SALES & INVOICES ──────────────────────────────────────────────────────

model Customer {
  id           String   @id @default(cuid())
  name         String
  phone        String?
  email        String?
  address      String?
  storeId      String
  totalSpent   Decimal  @db.Decimal(14, 2) @default(0)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  store  Store  @relation(fields: [storeId], references: [id])
  sales  Sale[]

  @@map("customers")
}

model Sale {
  id             String        @id @default(cuid())
  invoiceNumber  String        @unique
  storeId        String
  customerId     String?
  employeeId     String
  subtotal       Decimal       @db.Decimal(14, 2)
  discount       Decimal       @db.Decimal(14, 2) @default(0)
  tax            Decimal       @db.Decimal(14, 2) @default(0)
  total          Decimal       @db.Decimal(14, 2)
  amountPaid     Decimal       @db.Decimal(14, 2)
  changeDue      Decimal       @db.Decimal(14, 2) @default(0)
  status         SaleStatus    @default(COMPLETED)
  note           String?
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt

  store    Store     @relation(fields: [storeId], references: [id])
  customer Customer? @relation(fields: [customerId], references: [id])
  employee User      @relation(fields: [employeeId], references: [id])
  items    SaleItem[]
  payments Payment[]
  invoice  Invoice?

  @@index([storeId, createdAt])
  @@index([invoiceNumber])
  @@map("sales")
}

model SaleItem {
  id         String  @id @default(cuid())
  saleId     String
  productId  String
  quantity   Decimal @db.Decimal(12, 2)
  unitPrice  Decimal @db.Decimal(12, 2)
  discount   Decimal @db.Decimal(12, 2) @default(0)
  total      Decimal @db.Decimal(12, 2)

  sale    Sale    @relation(fields: [saleId], references: [id], onDelete: Cascade)
  product Product @relation(fields: [productId], references: [id])

  @@map("sale_items")
}

model Payment {
  id             String        @id @default(cuid())
  saleId         String
  method         PaymentMethod
  amount         Decimal       @db.Decimal(14, 2)
  reference      String?       // Paystack ref or MoMo transaction ID
  paystackRef    String?
  status         PaymentStatus @default(PAID)
  paidAt         DateTime      @default(now())

  sale Sale @relation(fields: [saleId], references: [id])

  @@map("payments")
}

model Invoice {
  id        String   @id @default(cuid())
  saleId    String   @unique
  filename  String?  // e.g. KSI-202506-00142.pdf stored in /storage/invoices/
  createdAt DateTime @default(now())

  sale Sale @relation(fields: [saleId], references: [id])

  @@map("invoices")
}

// ─── PROCUREMENT ────────────────────────────────────────────────────────────

model Supplier {
  id          String   @id @default(cuid())
  name        String
  contactName String?
  phone       String?
  email       String?
  address     String?
  storeId     String
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  store              Store              @relation(fields: [storeId], references: [id])
  procurementOrders  ProcurementOrder[]

  @@map("suppliers")
}

model ProcurementOrder {
  id          String            @id @default(cuid())
  orderNumber String            @unique
  storeId     String
  supplierId  String
  employeeId  String
  status      ProcurementStatus @default(DRAFT)
  subtotal    Decimal           @db.Decimal(14, 2)
  tax         Decimal           @db.Decimal(14, 2) @default(0)
  total       Decimal           @db.Decimal(14, 2)
  note        String?
  expectedAt  DateTime?
  receivedAt  DateTime?
  createdAt   DateTime          @default(now())
  updatedAt   DateTime          @updatedAt

  store    Store             @relation(fields: [storeId], references: [id])
  supplier Supplier          @relation(fields: [supplierId], references: [id])
  employee User              @relation(fields: [employeeId], references: [id])
  items    ProcurementItem[]

  @@index([storeId, createdAt])
  @@map("procurement_orders")
}

model ProcurementItem {
  id               String  @id @default(cuid())
  orderId          String
  productId        String
  quantityOrdered  Decimal @db.Decimal(12, 2)
  quantityReceived Decimal @db.Decimal(12, 2) @default(0)
  unitCost         Decimal @db.Decimal(12, 2)
  total            Decimal @db.Decimal(12, 2)

  order   ProcurementOrder @relation(fields: [orderId], references: [id], onDelete: Cascade)
  product Product          @relation(fields: [productId], references: [id])

  @@map("procurement_items")
}

// ─── ACCOUNTING ─────────────────────────────────────────────────────────────

model Expense {
  id          String          @id @default(cuid())
  storeId     String
  category    ExpenseCategory
  amount      Decimal         @db.Decimal(14, 2)
  description String
  employeeId  String
  date        DateTime        @default(now())
  createdAt   DateTime        @default(now())

  store    Store @relation(fields: [storeId], references: [id])
  employee User  @relation(fields: [employeeId], references: [id])

  @@index([storeId, date])
  @@map("expenses")
}
```

---

## 6. API Route Structure

```
POST   /api/auth/login
POST   /api/auth/refresh
POST   /api/auth/logout

GET    /api/stores                          [SUPER_ADMIN]
GET    /api/stores/:id/dashboard            [SUPER_ADMIN, STORE_MANAGER]
GET    /api/dashboard/consolidated          [SUPER_ADMIN]

POST   /api/users                           [ADMIN only]
GET    /api/users                           [ADMIN only]
PATCH  /api/users/:id                       [ADMIN only]
DELETE /api/users/:id (soft deactivate)     [ADMIN only]

POST   /api/products
GET    /api/products
GET    /api/products/:id
PATCH  /api/products/:id
DELETE /api/products/:id

GET    /api/inventory                        // stock levels
POST   /api/inventory/adjust                 // manual adjustment
GET    /api/inventory/low-stock             // below reorder level
GET    /api/inventory/movements             // audit trail

POST   /api/sales
GET    /api/sales
GET    /api/sales/:id
POST   /api/sales/:id/void
GET    /api/sales/:id/invoice               // PDF download
GET    /api/sales/:id/invoice/share         // WhatsApp link

POST   /api/payments/verify                 // Paystack webhook

GET    /api/customers
POST   /api/customers
PATCH  /api/customers/:id
GET    /api/customers/:id/history

GET    /api/suppliers
POST   /api/suppliers
PATCH  /api/suppliers/:id

POST   /api/procurement
GET    /api/procurement
GET    /api/procurement/:id
PATCH  /api/procurement/:id/receive         // receive goods, auto-update stock

POST   /api/expenses
GET    /api/expenses

GET    /api/reports/profit-loss             // date range
GET    /api/reports/sales-summary
GET    /api/reports/inventory-valuation
GET    /api/reports/top-products
GET    /api/reports/employee-performance
GET    /api/reports/export/:type            // CSV or PDF
```

---

## 7. Multi-Store Security Rules

Every repository query must enforce store-scoping:

```javascript
// ✅ CORRECT — always scope by storeId
const sales = await prisma.sale.findMany({
  where: { storeId: req.user.storeId }
});

// ✅ ADMIN — can pass storeId as query param, or omit for consolidated view
const storeFilter = req.user.role === 'ADMIN'
  ? (req.query.storeId ? { storeId: req.query.storeId } : {})
  : { storeId: req.user.storeId };  // STAFF always locked to their store

// ❌ NEVER — unscoped query
const sales = await prisma.sale.findMany();
```

Auth middleware injects `req.user` on every protected route:
```javascript
// Admin
{ id: "usr_abc123", role: "ADMIN",  storeId: null }

// Staff
{ id: "usr_xyz789", role: "STAFF",  storeId: "str_branchA" }
```

---

## 8. Frontend Route Structure

```
/login

/dashboard                          → Admin: store picker (Store A / Store B)
/dashboard/consolidated             → Admin only: combined view

/[storeId]/dashboard                → Staff lands here directly after login
/[storeId]/inventory
/[storeId]/inventory/adjust
/[storeId]/inventory/movements

/[storeId]/sales
/[storeId]/sales/new
/[storeId]/sales/:id

/[storeId]/customers
/[storeId]/customers/:id

/[storeId]/procurement
/[storeId]/procurement/new
/[storeId]/procurement/:id/receive

/[storeId]/suppliers

/[storeId]/staff                    → Admin only (manage staff for this store)

/[storeId]/accounting/expenses
/[storeId]/accounting/profit-loss

/[storeId]/reports
/settings                           → Admin only
```

**Post-login routing logic:**
- Admin → `/dashboard` (store picker)
- Staff → `/[their storeId]/dashboard` (direct, no choice)

---

## 9. Key Business Logic

### Invoice Number Generation
```
Format: [STORE_CODE]-[YEAR][MONTH]-[SEQUENCE]
Example: KSI-202506-00142

Generated atomically via PostgreSQL sequence per store to prevent duplicates.
```

### Stock Updates (Transactional)
```
Sale completed →
  BEGIN TRANSACTION
    1. Deduct quantity from StockLevel
    2. Insert StockMovement (type: SALE, quantity: -n)
    3. Create SaleItem records
    4. If quantity < reorderLevel → queue low-stock alert
  COMMIT

Procurement received →
  BEGIN TRANSACTION
    1. Add quantity to StockLevel
    2. Insert StockMovement (type: PURCHASE, quantity: +n)
    3. Update ProcurementOrder status
    4. Update product costPrice (weighted average)
  COMMIT
```

### Profit & Loss Calculation
```
Revenue      = SUM(sales.total) WHERE status = COMPLETED
COGS         = SUM(saleItem.quantity × product.costPrice at time of sale)
Gross Profit = Revenue - COGS
Expenses     = SUM(expenses.amount)
Net Profit   = Gross Profit - Expenses
```

### WhatsApp Invoice Share
```
1. Sale completed → queue PDF generation job (BullMQ)
2. PDF generated via Puppeteer → saved to /storage/invoices/{filename}.pdf
3. Served via Fastify static: GET /invoices/{filename}.pdf
4. Share URL: https://wa.me/?text=Your+invoice+https://yourdomain.com/invoices/{filename}.pdf
5. Frontend opens WhatsApp with pre-filled message
```

---

## 10. Implementation Phases

### Phase 1 — Foundation (Week 1–2)
- [ ] Project scaffolding (Fastify + React + Prisma)
- [ ] PostgreSQL schema migration
- [ ] Auth: login, JWT, refresh token, role middleware (ADMIN / STAFF)
- [ ] Store model + seed (2 stores)
- [ ] Admin: staff management (create, deactivate, assign to store)
- [ ] Frontend: login screen, post-login redirect logic, layout shell

### Phase 2 — Inventory Core (Week 3)
- [ ] Product CRUD (with category, SKU, unit)
- [ ] Stock level seeding on product creation
- [ ] Manual stock adjustment with movement log
- [ ] Low-stock alert flag
- [ ] Inventory dashboard page + movements audit trail

### Phase 3 — Sales & Invoicing (Week 4–5)
- [ ] Sale creation flow (add items, apply discount)
- [ ] Cash payment (change calculation)
- [ ] Paystack integration (MoMo + Card)
- [ ] Payment verification webhook
- [ ] Invoice PDF generation (Puppeteer)
- [ ] PDF upload to S3
- [ ] WhatsApp share link
- [ ] Sales history + filter

### Phase 4 — Procurement (Week 6)
- [ ] Supplier CRUD
- [ ] Procurement order creation
- [ ] Goods receipt flow (partial + full)
- [ ] Auto stock update on receipt
- [ ] Weighted average cost price update

### Phase 5 — Customers & Staff Management (Week 7)
- [ ] Customer CRUD + purchase history
- [ ] Admin: staff account creation, deactivation, store assignment
- [ ] Staff profile page (self view only)

### Phase 6 — Accounting & Reports (Week 8)
- [ ] Expense logging
- [ ] P&L report (date range)
- [ ] Sales summary report
- [ ] Inventory valuation report
- [ ] Top-selling products
- [ ] Employee performance report
- [ ] CSV export

### Phase 7 — Super Admin & Polish (Week 9)
- [ ] Consolidated dashboard (both stores)
- [ ] Store switcher
- [ ] System settings
- [ ] Audit log viewer
- [ ] UI polish + responsive QA
- [ ] Security hardening (rate limiting, input sanitization, HTTPS)

### Phase 8 — Deployment (Week 10)
- [ ] DigitalOcean Droplet provisioning (Ubuntu 22.04)
- [ ] Node.js 20 + PostgreSQL 15 + Redis 7 install
- [ ] PM2 config + Nginx + SSL (Let's Encrypt)
- [ ] `/storage/invoices` directory setup + Nginx static config
- [ ] Environment secrets (`.env`, secure permissions)
- [ ] Daily backup cron: `pg_dump` + `/storage` rsync → Backblaze B2 or SFTP
- [ ] Smoke testing + handover

---

## 11. Security Checklist

- [ ] Passwords hashed with bcrypt (rounds: 12)
- [ ] JWT access tokens expire in 15 minutes
- [ ] Refresh tokens rotated on every use (rotation attack prevention)
- [ ] Refresh tokens stored hashed in DB
- [ ] All routes protected by `authenticate` + `authorize(roles)` hooks
- [ ] Admin-only routes (`/users`, `/settings`, `/consolidated`) reject STAFF with 403
- [ ] Every DB query scoped by `storeId` (IDOR prevention — Staff cannot access other store's data)
- [ ] Paystack webhook signature verified (HMAC-SHA512)
- [ ] Rate limiting on auth routes (5 attempts / 15min per IP)
- [ ] Input validation via Zod on all request bodies
- [ ] SQL injection impossible via Prisma parameterized queries
- [ ] Invoice PDFs stored outside web root, served only via authenticated routes
- [ ] `/storage/invoices` not directly browseable (Nginx deny directory listing)
- [ ] Sensitive routes log to audit trail
- [ ] CORS locked to frontend origin
- [ ] Helmet.js for HTTP security headers

---

## 12. Design System

| Token | Value |
|---|---|
| Primary | `#3d6b52` (sage green) |
| Primary Light | `#e8f0eb` |
| Danger | `#dc2626` |
| Warning | `#d97706` |
| Success | `#16a34a` |
| UI Font | DM Sans |
| Mono / Numbers | Geist Mono |
| Border radius | `rounded-none` (sharp) |
| Corner style | No gradients, flat fills only |

Dashboard follows shadcn/ui conventions. All monetary values rendered in Geist Mono. No rounded corners on card containers.

---

## 13. Environment Variables

```env
# App
NODE_ENV=production
PORT=3000
FRONTEND_URL=https://yourdomain.com

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/buildmat

# Auth
JWT_ACCESS_SECRET=<32-byte-random>
JWT_REFRESH_SECRET=<32-byte-random>

# Redis
REDIS_URL=redis://localhost:6379

# File Storage
STORAGE_PATH=/storage/invoices

# Paystack
PAYSTACK_SECRET_KEY=sk_live_...
PAYSTACK_WEBHOOK_SECRET=

# Email
RESEND_API_KEY=
```

---

*End of Document — BuildMat POS v1.0 Engineering Spec*
