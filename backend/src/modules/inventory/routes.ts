import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { addStoreScope } from '../../middleware/store-scope.js';

const adjustSchema = z.object({
  productId: z.string(),
  quantity: z.coerce.number(),
  note: z.string().optional(),
});

export default async function inventoryRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', authenticate);

  fastify.get('/', async (request, reply) => {
    addStoreScope(request);
    const filter = request.storeFilter;
    const stockLevels = await prisma.stockLevel.findMany({
      where: filter,
      include: { product: { include: { category: true } } },
      orderBy: { updatedAt: 'desc' },
    });
    return reply.send({ success: true, data: stockLevels });
  });

  fastify.post('/adjust', async (request, reply) => {
    addStoreScope(request);
    const data = adjustSchema.parse(request.body);
    const stock = await prisma.stockLevel.findUnique({
      where: { productId: data.productId },
      include: { product: true },
    });
    if (!stock) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Stock level not found for this product' },
      });
    }
    const newQuantity = Number(stock.quantity) + data.quantity;
    if (newQuantity < 0) {
      return reply.status(400).send({
        success: false,
        error: { code: 'NEGATIVE_STOCK', message: 'Adjustment would result in negative stock' },
      });
    }

    const [updated, movement] = await prisma.$transaction([
      prisma.stockLevel.update({
        where: { productId: data.productId },
        data: { quantity: newQuantity },
      }),
      prisma.stockMovement.create({
        data: {
          productId: data.productId,
          storeId: stock.storeId,
          type: 'ADJUSTMENT',
          quantity: data.quantity,
          balanceAfter: newQuantity,
          note: data.note,
          performedBy: request.user.id,
        },
      }),
    ]);

    return reply.send({ success: true, data: { stock: updated, movement } });
  });

  fastify.get('/movements', async (request, reply) => {
    addStoreScope(request);
    const filter = request.storeFilter;
    const { productId } = request.query as Record<string, string>;
    const movements = await prisma.stockMovement.findMany({
      where: { ...filter, ...(productId && { productId }) },
      include: { product: true, employee: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return reply.send({ success: true, data: movements });
  });
}
