import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { addStoreScope } from '../../middleware/store-scope.js';

const itemSchema = z.object({
  productId: z.string(),
  quantityOrdered: z.coerce.number().min(0.01),
  unitCost: z.coerce.number().min(0),
});

const createSchema = z.object({
  storeId: z.string(),
  supplierId: z.string(),
  items: z.array(itemSchema).min(1),
  tax: z.coerce.number().min(0).default(0),
  note: z.string().optional(),
  expectedAt: z.string().optional(),
});

const receiveSchema = z.object({
  items: z.array(z.object({
    productId: z.string(),
    quantityReceived: z.coerce.number().min(0),
  })),
});

function generateOrderNumber(storeId: string): string {
  const prefix = storeId.substring(0, 3).toUpperCase();
  const date = new Date();
  const yyyymm = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
  const random = Math.floor(1000 + Math.random() * 9000);
  return `PO-${prefix}-${yyyymm}-${random}`;
}

export default async function procurementRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', authenticate);

  fastify.post('/', async (request, reply) => {
    addStoreScope(request);
    const data = createSchema.parse(request.body);

    const subtotal = data.items.reduce((sum, item) => sum + item.quantityOrdered * item.unitCost, 0);
    const total = subtotal + data.tax;

    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.procurementOrder.create({
        data: {
          orderNumber: generateOrderNumber(data.storeId),
          storeId: data.storeId,
          supplierId: data.supplierId,
          employeeId: request.user.id,
          subtotal,
          tax: data.tax,
          total,
          note: data.note,
          expectedAt: data.expectedAt ? new Date(data.expectedAt) : null,
        },
      });

      for (const item of data.items) {
        await tx.procurementItem.create({
          data: {
            orderId: newOrder.id,
            productId: item.productId,
            quantityOrdered: item.quantityOrdered,
            unitCost: item.unitCost,
            total: item.quantityOrdered * item.unitCost,
          },
        });
      }

      return newOrder;
    });

    const fullOrder = await prisma.procurementOrder.findUnique({
      where: { id: order.id },
      include: { items: { include: { product: true } }, supplier: true, employee: { select: { name: true } } },
    });

    return reply.status(201).send({ success: true, data: fullOrder });
  });

  fastify.get('/', async (request, reply) => {
    addStoreScope(request);
    const filter = request.storeFilter;
    const { status } = request.query as Record<string, string>;
    const where: any = { ...filter };
    if (status) where.status = status;
    const orders = await prisma.procurementOrder.findMany({
      where,
      include: { supplier: { select: { name: true } }, items: { include: { product: { select: { name: true } } } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return reply.send({ success: true, data: orders });
  });

  fastify.get('/:id', async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const order = await prisma.procurementOrder.findUnique({
      where: { id },
      include: {
        items: { include: { product: true } },
        supplier: true,
        employee: { select: { name: true } },
        store: { select: { name: true } },
      },
    });
    if (!order) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Procurement order not found' } });
    }
    return reply.send({ success: true, data: order });
  });

  fastify.patch('/:id/receive', async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const data = receiveSchema.parse(request.body);

    const order = await prisma.procurementOrder.findUnique({
      where: { id },
      include: { items: { include: { product: true } } },
    });
    if (!order) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } });
    }
    if (order.status === 'CANCELLED') {
      return reply.status(400).send({ success: false, error: { code: 'CANCELLED_ORDER', message: 'Cannot receive cancelled order' } });
    }

    const receiveMap = new Map(data.items.map((i) => [i.productId, i.quantityReceived]));

    await prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        const received = receiveMap.get(item.productId) ?? 0;
        if (received <= 0) continue;

        const newReceived = Number(item.quantityReceived) + received;
        await tx.procurementItem.update({
          where: { id: item.id },
          data: { quantityReceived: newReceived },
        });

        const stock = await tx.stockLevel.findUnique({ where: { productId: item.productId } });
        const newQty = Number(stock?.quantity ?? 0) + received;
        await tx.stockLevel.update({
          where: { productId: item.productId },
          data: { quantity: newQty },
        });

        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            storeId: order.storeId,
            type: 'PURCHASE',
            quantity: received,
            balanceAfter: newQty,
            unitCost: item.unitCost,
            reference: order.id,
            note: `Goods receipt for PO ${order.orderNumber}`,
            performedBy: request.user.id,
          },
        });

        const product = await tx.product.findUnique({ where: { id: item.productId } });
        const oldCost = Number(product?.costPrice ?? 0);
        const oldQty = Number(stock?.quantity ?? 0);
        const totalValue = oldCost * oldQty + Number(item.unitCost) * received;
        const newCost = totalValue / (oldQty + received);
        await tx.product.update({
          where: { id: item.productId },
          data: { costPrice: newCost },
        });
      }

      const allItems = await tx.procurementItem.findMany({ where: { orderId: id } });
      const fullyReceived = allItems.every((i) => Number(i.quantityReceived) >= Number(i.quantityOrdered));
      const partiallyReceived = allItems.some((i) => Number(i.quantityReceived) > 0);

      let newStatus: 'DRAFT' | 'SENT' | 'PARTIALLY_RECEIVED' | 'FULLY_RECEIVED' | 'CANCELLED' = order.status as any;
      if (fullyReceived) newStatus = 'FULLY_RECEIVED';
      else if (partiallyReceived) newStatus = 'PARTIALLY_RECEIVED';

      await tx.procurementOrder.update({
        where: { id },
        data: { status: newStatus, receivedAt: new Date() },
      });
    });

    return reply.send({ success: true, data: { message: 'Goods received and stock updated' } });
  });

  fastify.patch('/:id/cancel', async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const order = await prisma.procurementOrder.findUnique({ where: { id } });
    if (!order) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } });
    }
    if (order.status === 'CANCELLED') {
      return reply.status(400).send({ success: false, error: { code: 'ALREADY_CANCELLED', message: 'Order already cancelled' } });
    }
    await prisma.procurementOrder.update({ where: { id }, data: { status: 'CANCELLED' } });
    return reply.send({ success: true, data: { message: 'Order cancelled' } });
  });
}
