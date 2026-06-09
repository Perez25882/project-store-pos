import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { addStoreScope } from '../../middleware/store-scope.js';

function startOfDay(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function endOfDay(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999); }

export default async function accountingRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', authenticate);

  fastify.get('/summary', async (request, reply) => {
    addStoreScope(request);
    const filter = request.storeFilter;
    const { from, to } = request.query as Record<string, string>;

    const dateFilter: any = {};
    if (from || to) {
      dateFilter.gte = from ? new Date(from) : undefined;
      dateFilter.lte = to ? endOfDay(new Date(to)) : undefined;
    }

    const whereSales: Prisma.SaleWhereInput = { ...filter, status: { not: 'VOIDED' } };
    if (Object.keys(dateFilter).length > 0) (whereSales as any).createdAt = dateFilter;
    const whereExpenses: Prisma.ExpenseWhereInput = { ...filter };
    if (Object.keys(dateFilter).length > 0) (whereExpenses as any).date = dateFilter;

    const [salesAgg, expensesAgg, salesCount, paymentsAgg] = await Promise.all([
      prisma.sale.aggregate({ where: whereSales, _sum: { total: true, subtotal: true, tax: true, discount: true } }),
      prisma.expense.aggregate({ where: whereExpenses, _sum: { amount: true } }),
      prisma.sale.count({ where: whereSales }),
      prisma.payment.aggregate({ where: { sale: whereSales as any }, _sum: { amount: true } }),
    ]);

    const revenue = Number(salesAgg._sum?.total ?? 0);
    const costOfGoods = 0;
    const expenses = Number(expensesAgg._sum?.amount ?? 0);
    const grossProfit = revenue - costOfGoods;
    const netProfit = grossProfit - expenses;

    return reply.send({
      success: true,
      data: {
        revenue,
        costOfGoods,
        grossProfit,
        expenses,
        netProfit,
        salesCount,
        totalPayments: Number(paymentsAgg._sum.amount ?? 0),
      },
    });
  });

  fastify.get('/daily', async (request, reply) => {
    addStoreScope(request);
    const filter = request.storeFilter;
    const { date } = request.query as Record<string, string>;
    const targetDate = date ? new Date(date) : new Date();
    const start = startOfDay(targetDate);
    const end = endOfDay(targetDate);

    const [sales, expenses, payments] = await Promise.all([
      prisma.sale.findMany({
        where: { ...filter, status: { not: 'VOIDED' }, createdAt: { gte: start, lte: end } },
        include: { items: { include: { product: { select: { name: true } } } }, customer: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.expense.findMany({
        where: { ...filter, date: { gte: start, lte: end } },
        include: { employee: { select: { name: true } } },
        orderBy: { date: 'desc' },
      }),
      prisma.payment.findMany({
        where: { sale: { ...filter, status: { not: 'VOIDED' } }, paidAt: { gte: start, lte: end } },
        include: { sale: { select: { invoiceNumber: true } } },
        orderBy: { paidAt: 'desc' },
      }),
    ]);

    const salesTotal = sales.reduce((s, sale) => s + Number(sale.total), 0);
    const expensesTotal = expenses.reduce((s, e) => s + Number(e.amount), 0);
    const paymentsTotal = payments.reduce((s, p) => s + Number(p.amount), 0);

    return reply.send({
      success: true,
      data: {
        date: start.toISOString().split('T')[0],
        sales: { count: sales.length, total: salesTotal, items: sales },
        expenses: { count: expenses.length, total: expensesTotal, items: expenses },
        payments: { count: payments.length, total: paymentsTotal, items: payments },
        net: salesTotal - expensesTotal,
      },
    });
  });

  fastify.get('/ledger', async (request, reply) => {
    addStoreScope(request);
    const filter = request.storeFilter;
    const { from, to } = request.query as Record<string, string>;

    const dateFilter: any = {};
    if (from || to) {
      dateFilter.gte = from ? new Date(from) : undefined;
      dateFilter.lte = to ? endOfDay(new Date(to)) : undefined;
    }

    const [sales, expenses, procurement] = await Promise.all([
      prisma.sale.findMany({
        where: { ...filter, status: { not: 'VOIDED' }, ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}) },
        select: { id: true, invoiceNumber: true, total: true, amountPaid: true, createdAt: true, status: true },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      prisma.expense.findMany({
        where: { ...filter, ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {}) },
        select: { id: true, category: true, amount: true, description: true, date: true },
        orderBy: { date: 'desc' },
        take: 100,
      }),
      prisma.procurementOrder.findMany({
        where: { ...filter, status: { not: 'CANCELLED' }, ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}) },
        select: { id: true, orderNumber: true, total: true, status: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ]);

    const entries = [
      ...sales.map((s) => ({ type: 'SALE' as const, date: s.createdAt, reference: s.invoiceNumber, amount: Number(s.total), status: s.status })),
      ...expenses.map((e) => ({ type: 'EXPENSE' as const, date: e.date, reference: e.description, amount: -Number(e.amount), status: 'COMPLETED' })),
      ...procurement.map((p) => ({ type: 'PURCHASE' as const, date: p.createdAt, reference: p.orderNumber, amount: -Number(p.total), status: p.status })),
    ];

    entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    let balance = 0;
    const running = entries.map((e) => {
      balance += e.amount;
      return { ...e, balance: Number(balance.toFixed(2)) };
    });

    return reply.send({ success: true, data: running });
  });
}
