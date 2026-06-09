import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { addStoreScope } from '../../middleware/store-scope.js';

const createSchema = z.object({
  storeId: z.string(),
  category: z.enum(['RENT', 'UTILITIES', 'SALARIES', 'TRANSPORT', 'MAINTENANCE', 'MARKETING', 'MISCELLANEOUS']),
  amount: z.coerce.number().min(0.01),
  description: z.string().min(1),
  date: z.string().optional(),
});

const updateSchema = z.object({
  category: z.enum(['RENT', 'UTILITIES', 'SALARIES', 'TRANSPORT', 'MAINTENANCE', 'MARKETING', 'MISCELLANEOUS']).optional(),
  amount: z.coerce.number().min(0.01).optional(),
  description: z.string().min(1).optional(),
  date: z.string().optional(),
});

export default async function expenseRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', authenticate);

  fastify.post('/', async (request, reply) => {
    addStoreScope(request);
    const data = createSchema.parse(request.body);
    const expense = await prisma.expense.create({
      data: {
        storeId: data.storeId,
        category: data.category,
        amount: data.amount,
        description: data.description,
        employeeId: request.user.id,
        date: data.date ? new Date(data.date) : undefined,
      },
    });
    return reply.status(201).send({ success: true, data: expense });
  });

  fastify.get('/', async (request, reply) => {
    addStoreScope(request);
    const filter = request.storeFilter;
    const { from, to, category } = request.query as Record<string, string>;

    const where: any = { ...filter };
    if (category) where.category = category;
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to) where.date.lte = new Date(to);
    }

    const expenses = await prisma.expense.findMany({
      where,
      include: { employee: { select: { name: true } } },
      orderBy: { date: 'desc' },
      take: 200,
    });

    const total = await prisma.expense.aggregate({
      where,
      _sum: { amount: true },
    });

    return reply.send({ success: true, data: expenses, meta: { total: total._sum.amount || 0 } });
  });

  fastify.patch('/:id', async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const data = updateSchema.parse(request.body);
    const expense = await prisma.expense.update({
      where: { id },
      data: {
        ...(data.category && { category: data.category }),
        ...(data.amount && { amount: data.amount }),
        ...(data.description && { description: data.description }),
        ...(data.date && { date: new Date(data.date) }),
      },
    });
    return reply.send({ success: true, data: expense });
  });

  fastify.delete('/:id', async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    await prisma.expense.delete({ where: { id } });
    return reply.send({ success: true, data: { message: 'Expense deleted' } });
  });
}
