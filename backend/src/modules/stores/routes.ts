import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';

export default async function storeRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', authenticate);

  fastify.get('/', async (request, reply) => {
    const stores = await prisma.store.findMany({ where: { isActive: true } });
    return reply.send({ success: true, data: stores });
  });

  fastify.get('/:id/dashboard', async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const store = await prisma.store.findUnique({ where: { id, isActive: true } });
    if (!store) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Store not found' },
      });
    }
    const [totalProducts, totalSales, totalCustomers] = await Promise.all([
      prisma.product.count({ where: { storeId: id } }),
      prisma.sale.count({ where: { storeId: id, status: 'COMPLETED' } }),
      prisma.customer.count({ where: { storeId: id } }),
    ]);
    return reply.send({
      success: true,
      data: { store, stats: { totalProducts, totalSales, totalCustomers } },
    });
  });
}
