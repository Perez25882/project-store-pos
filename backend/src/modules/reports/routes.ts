import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { addStoreScope } from '../../middleware/store-scope.js';

function startOfDay(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function endOfDay(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999); }
function addDays(d: Date, n: number) {
  const nd = new Date(d);
  nd.setDate(nd.getDate() + n);
  return nd;
}

interface TrendItem { date: string; sales: number; revenue: number }
interface TopProduct { productId: string; name: string; sku: string; quantity: number; revenue: number }
interface EmployeePerf { employeeId: string; name: string; salesCount: number; revenue: number; itemsSold: number }
interface CategoryBreakdown { categoryId: string; name: string; quantity: number; revenue: number }
interface StoreComparison { storeId: string; storeName: string; revenue: number; salesCount: number; expenses: number; stockQuantity: number; netProfit: number }

function fillDateRange(items: TrendItem[], from: Date, to: Date): TrendItem[] {
  const map = new Map(items.map((i) => [i.date, i]));
  const result: TrendItem[] = [];
  for (let d = new Date(from); d <= to; d = addDays(d, 1)) {
    const key = d.toISOString().split('T')[0];
    result.push(map.get(key) ?? { date: key, sales: 0, revenue: 0 });
  }
  return result;
}

export default async function reportRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', authenticate);

  fastify.get('/top-products', async (request, reply) => {
    addStoreScope(request);
    const filter = request.storeFilter;
    const { from, to } = request.query as Record<string, string>;

    const dateFilter: any = {};
    if (from || to) {
      dateFilter.gte = from ? new Date(from) : undefined;
      dateFilter.lte = to ? endOfDay(new Date(to)) : undefined;
    }

    const items: any[] = await prisma.saleItem.findMany({
      where: {
        sale: { ...filter, status: { not: 'VOIDED' }, ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}) },
      },
      include: { product: { select: { name: true, sku: true, sellingPrice: true } } },
    });

    const grouped = items.reduce<Map<string, TopProduct>>((acc, item: any) => {
      const key = item.productId;
      if (!acc.has(key)) {
        acc.set(key, { productId: key, name: item.product.name, sku: item.product.sku, quantity: 0, revenue: 0 });
      }
      const g = acc.get(key)!;
      g.quantity += Number(item.quantity);
      g.revenue += Number(item.total);
      return acc;
    }, new Map());

    const sorted = Array.from(grouped.values()).sort((a: TopProduct, b: TopProduct) => b.revenue - a.revenue).slice(0, 20);
    return reply.send({ success: true, data: sorted });
  });

  fastify.get('/sales-trend', async (request, reply) => {
    addStoreScope(request);
    const filter = request.storeFilter;
    const { from, to } = request.query as Record<string, string>;

    const fromDate = from ? new Date(from) : addDays(new Date(), -29);
    const toDate = to ? new Date(to) : new Date();

    const sales: any[] = await prisma.sale.findMany({
      where: { ...filter, status: { not: 'VOIDED' }, createdAt: { gte: startOfDay(fromDate), lte: endOfDay(toDate) } },
      select: { createdAt: true, total: true },
    });

    const grouped = sales.reduce<Map<string, TrendItem>>((acc, s: any) => {
      const key = s.createdAt.toISOString().split('T')[0];
      if (!acc.has(key)) acc.set(key, { date: key, sales: 0, revenue: 0 });
      const g = acc.get(key)!;
      g.sales += 1;
      g.revenue += Number(s.total);
      return acc;
    }, new Map());

    const filled = fillDateRange(Array.from(grouped.values()), fromDate, toDate);
    return reply.send({ success: true, data: filled });
  });

  fastify.get('/employee-performance', async (request, reply) => {
    addStoreScope(request);
    const filter = request.storeFilter;
    const { from, to } = request.query as Record<string, string>;

    const dateFilter: any = {};
    if (from || to) {
      dateFilter.gte = from ? new Date(from) : undefined;
      dateFilter.lte = to ? endOfDay(new Date(to)) : undefined;
    }

    const sales: any[] = await prisma.sale.findMany({
      where: { ...filter, status: { not: 'VOIDED' }, ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}) },
      include: { employee: { select: { name: true } }, items: { select: { quantity: true, total: true } } },
    });

    const grouped = sales.reduce<Map<string, EmployeePerf>>((acc, s: any) => {
      const key = s.employeeId;
      if (!acc.has(key)) {
        acc.set(key, { employeeId: key, name: s.employee.name, salesCount: 0, revenue: 0, itemsSold: 0 });
      }
      const g = acc.get(key)!;
      g.salesCount += 1;
      g.revenue += Number(s.total);
      g.itemsSold += s.items.reduce((sum: number, i: any) => sum + Number(i.quantity), 0);
      return acc;
    }, new Map());

    const sorted = Array.from(grouped.values()).sort((a: EmployeePerf, b: EmployeePerf) => b.revenue - a.revenue);
    return reply.send({ success: true, data: sorted });
  });

  fastify.get('/store-comparison', { preHandler: authorize(['ADMIN']) }, async (request, reply) => {
    const { from, to } = request.query as Record<string, string>;

    const dateFilter: any = {};
    if (from || to) {
      dateFilter.gte = from ? new Date(from) : undefined;
      dateFilter.lte = to ? endOfDay(new Date(to)) : undefined;
    }

    const stores = await prisma.store.findMany({ where: { isActive: true } });

    const results: StoreComparison[] = await Promise.all(
      stores.map(async (store: { id: string; name: string }) => {
        const [salesAgg, expensesAgg, stockAgg] = await Promise.all([
          prisma.sale.aggregate({
            where: { storeId: store.id, status: { not: 'VOIDED' }, ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}) },
            _sum: { total: true },
            _count: true,
          }),
          prisma.expense.aggregate({
            where: { storeId: store.id, ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {}) },
            _sum: { amount: true },
          }),
          prisma.stockLevel.aggregate({
            where: { storeId: store.id },
            _sum: { quantity: true },
          }),
        ]);

        return {
          storeId: store.id,
          storeName: store.name,
          revenue: Number(salesAgg._sum?.total ?? 0),
          salesCount: salesAgg._count as unknown as number,
          expenses: Number(expensesAgg._sum?.amount ?? 0),
          stockQuantity: Number(stockAgg._sum?.quantity ?? 0),
          netProfit: Number(salesAgg._sum?.total ?? 0) - Number(expensesAgg._sum?.amount ?? 0),
        };
      })
    );

    return reply.send({ success: true, data: results });
  });

  fastify.get('/category-breakdown', async (request, reply) => {
    addStoreScope(request);
    const filter = request.storeFilter;
    const { from, to } = request.query as Record<string, string>;

    const dateFilter: any = {};
    if (from || to) {
      dateFilter.gte = from ? new Date(from) : undefined;
      dateFilter.lte = to ? endOfDay(new Date(to)) : undefined;
    }

    const items: any[] = await prisma.saleItem.findMany({
      where: {
        sale: { ...filter, status: { not: 'VOIDED' }, ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}) },
      },
      include: { product: { include: { category: true } } },
    });

    const grouped = items.reduce<Map<string, CategoryBreakdown>>((acc, item: any) => {
      const key = item.product.categoryId;
      if (!acc.has(key)) {
        acc.set(key, { categoryId: key, name: item.product.category.name, quantity: 0, revenue: 0 });
      }
      const g = acc.get(key)!;
      g.quantity += Number(item.quantity);
      g.revenue += Number(item.total);
      return acc;
    }, new Map());

    const sorted = Array.from(grouped.values()).sort((a: CategoryBreakdown, b: CategoryBreakdown) => b.revenue - a.revenue);
    return reply.send({ success: true, data: sorted });
  });

  fastify.get('/inventory-valuation', async (request, reply) => {
    addStoreScope(request);
    const filter = request.storeFilter;

    const products: any[] = await prisma.product.findMany({
      where: { ...filter, isActive: true },
      include: { category: { select: { name: true } }, stockLevel: { select: { quantity: true } } },
    });

    const items = products.map((p: any) => ({
      productId: p.id,
      name: p.name,
      sku: p.sku,
      category: p.category?.name || '-',
      unit: p.unit,
      costPrice: Number(p.costPrice),
      quantity: Number(p.stockLevel?.quantity ?? 0),
      value: Number(p.stockLevel?.quantity ?? 0) * Number(p.costPrice),
    }));

    const totalValue = items.reduce((s: number, i: any) => s + i.value, 0);
    const totalQuantity = items.reduce((s: number, i: any) => s + i.quantity, 0);

    return reply.send({ success: true, data: { items, totalValue, totalQuantity, productCount: items.length } });
  });
}
