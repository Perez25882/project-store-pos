# Phase 1 — Foundation Implementation Plan

> **Goal:** Scaffold backend + frontend, Prisma schema, auth system (JWT + RBAC), store model, admin staff management, frontend shell with login + dashboard.

## Tasks

| # | Task | Files Created / Modified |
|---|---|---|
| 1 | Root `package.json` + `.gitignore` | `package.json`, `.gitignore` |
| 2 | Backend `package.json` + `tsconfig.json` | `backend/package.json`, `backend/tsconfig.json` |
| 3 | Prisma Schema | `backend/prisma/schema.prisma` |
| 4 | Env Config + Prisma Client | `backend/.env.example`, `backend/src/config/env.ts`, `backend/src/lib/prisma.ts` |
| 5 | Auth + Store-Scope Middleware | `backend/src/types/index.ts`, `backend/src/middleware/auth.ts`, `backend/src/middleware/store-scope.ts` |
| 6 | Auth Module (login, refresh, logout) | `backend/src/modules/auth/service.ts`, `backend/src/modules/auth/routes.ts` |
| 7 | Stores Module | `backend/src/modules/stores/routes.ts` |
| 8 | Users Module (admin staff mgmt) | `backend/src/modules/users/routes.ts` |
| 9 | Server Entry Point | `backend/src/server.ts` |
| 10 | DB Migration + Seed | `backend/scripts/seed.ts` (run `prisma migrate dev --name init`) |
| 11 | Auth Integration Test | `backend/src/modules/auth/auth.test.ts` |
| 12 | Frontend Scaffold | `frontend/package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `index.html`, `tailwind.config.js`, `postcss.config.js`, `components.json` |
| 13 | Frontend Core Files | `frontend/src/index.css`, `main.tsx`, `App.tsx`, `lib/utils.ts`, `types/index.ts` |
| 14 | Frontend API Client + Auth Store | `frontend/src/lib/api.ts`, `frontend/src/stores/auth-store.ts` |
| 15 | Frontend Login Page | `frontend/src/pages/Login.tsx` |
| 16 | Frontend Dashboard + Layout | `frontend/src/pages/Dashboard.tsx`, `frontend/src/components/Layout.tsx`, `frontend/src/components/Sidebar.tsx`, `frontend/src/components/Header.tsx` |
| 17 | Frontend Store Picker + Staff Pages | `frontend/src/pages/staff/Staff.tsx`, `frontend/src/components/StoreSwitcher.tsx` |
| 18 | Verify dev servers | Run `npm run dev` (backend + frontend concurrently) |
