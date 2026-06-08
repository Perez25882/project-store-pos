import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { addStoreScope } from '../../middleware/store-scope.js';

const itemSchema = z.object({
  productId: z.string(),
  quantity: z.coerce.number().min(0.01),
  unitPrice: z.coerce.number().min(0),
  discount: z.coerce.number().min(0).default(0),
});

const createSaleSchema = z.object({
  storeId: z.string(),
  customerId: z.string().optional(),
  items: z.array(itemSchema).min(1),
  discount: z.coerce.number().min(0).default(0),
  tax: z.coerce.number().min(0).default(0),
  amountPaid: z.coerce.number().min(0).default(0),
  note: z.string().optional(),
});

const paymentSchema = z.object({
  method: z.enum(['CASH', 'MOMO', 'CARD', 'BANK_TRANSFER']),
  amount: z.coerce.number().min(0.01),
  reference: z.string().optional(),
});

function generateInvoiceNumber(storeId: string): string {
  const prefix = storeId.substring(0, 3).toUpperCase();
  const date = new Date();
  const yyyymm = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
  const random = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${yyyymm}-${random}`;
}

export default async function salesRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', authenticate);

  fastify.post('/', async (request, reply) => {
    addStoreScope(request);
    const data = createSaleSchema.parse(request.body);

    const products = await prisma.product.findMany({
      where: { id: { in: data.items.map((i) => i.productId) }, storeId: data.storeId },
      include: { stockLevel: true },
    });

    for (const item of data.items) {
      const product = products.find((p) => p.id === item.productId);
      if (!product) {
        return reply.status(404).send({
          success: false,
          error: { code: 'PRODUCT_NOT_FOUND', message: `Product ${item.productId} not found` },
        });
      }
      const available = Number(product.stockLevel?.quantity ?? 0);
      if (available < item.quantity) {
        return reply.status(400).send({
          success: false,
          error: { code: 'INSUFFICIENT_STOCK', message: `Insufficient stock for ${product.name}. Available: ${available}` },
        });
      }
    }

    const subtotal = data.items.reduce((sum, item) => sum + item.quantity * item.unitPrice - item.discount, 0);
    const total = Math.max(0, subtotal - data.discount + data.tax);
    const changeDue = Math.max(0, data.amountPaid - total);

    const invoiceNumber = generateInvoiceNumber(data.storeId);

    const sale = await prisma.$transaction(async (tx) => {
      const newSale = await tx.sale.create({
        data: {
          invoiceNumber,
          storeId: data.storeId,
          customerId: data.customerId,
          employeeId: request.user.id,
          subtotal,
          discount: data.discount,
          tax: data.tax,
          total,
          amountPaid: data.amountPaid,
          changeDue,
          status: total <= data.amountPaid ? 'COMPLETED' : 'DRAFT',
          note: data.note,
        },
      });

      for (const item of data.items) {
        const product = products.find((p) => p.id === item.productId)!;
        await tx.saleItem.create({
          data: {
            saleId: newSale.id,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount,
            total: item.quantity * item.unitPrice - item.discount,
          },
        });

        const newQty = Number(product.stockLevel!.quantity) - item.quantity;
        await tx.stockLevel.update({
          where: { productId: item.productId },
          data: { quantity: newQty },
        });

        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            storeId: data.storeId,
            type: 'SALE',
            quantity: -item.quantity,
            balanceAfter: newQty,
            reference: newSale.id,
            performedBy: request.user.id,
          },
        });
      }

      if (data.amountPaid > 0) {
        await tx.payment.create({
          data: {
            saleId: newSale.id,
            method: 'CASH',
            amount: data.amountPaid,
            status: 'PAID',
          },
        });
      }

      await tx.invoice.create({
        data: { saleId: newSale.id },
      });

      if (data.customerId) {
        await tx.customer.update({
          where: { id: data.customerId },
          data: { totalSpent: { increment: total } },
        });
      }

      return newSale;
    });

    const fullSale = await prisma.sale.findUnique({
      where: { id: sale.id },
      include: { items: { include: { product: true } }, customer: true, payments: true },
    });

    return reply.status(201).send({ success: true, data: fullSale });
  });

  fastify.get('/', async (request, reply) => {
    addStoreScope(request);
    const filter = request.storeFilter;
    const { status } = request.query as Record<string, string>;
    const sales = await prisma.sale.findMany({
      where: { ...filter, ...(status && { status }) },
      include: { items: { include: { product: { select: { name: true, sku: true } } } }, customer: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return reply.send({ success: true, data: sales });
  });

  fastify.get('/:id', async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const sale = await prisma.sale.findUnique({
      where: { id },
      include: {
        items: { include: { product: true } },
        customer: true,
        payments: true,
        employee: { select: { name: true } },
        invoice: true,
      },
    });
    if (!sale) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Sale not found' } });
    }
    return reply.send({ success: true, data: sale });
  });

  fastify.patch('/:id/void', async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const sale = await prisma.sale.findUnique({
      where: { id },
      include: { items: true, customer: true },
    });
    if (!sale) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Sale not found' } });
    }
    if (sale.status === 'VOIDED') {
      return reply.status(400).send({ success: false, error: { code: 'ALREADY_VOIDED', message: 'Sale already voided' } });
    }

    await prisma.$transaction(async (tx) => {
      await tx.sale.update({ where: { id }, data: { status: 'VOIDED' } });

      for (const item of sale.items) {
        const stock = await tx.stockLevel.findUnique({ where: { productId: item.productId } });
        const newQty = Number(stock?.quantity ?? 0) + Number(item.quantity);
        await tx.stockLevel.update({ where: { productId: item.productId }, data: { quantity: newQty } });
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            storeId: sale.storeId,
            type: 'RETURN',
            quantity: Number(item.quantity),
            balanceAfter: newQty,
            reference: `VOID-${sale.id}`,
            note: 'Sale voided - stock returned',
            performedBy: request.user.id,
          },
        });
      }

      if (sale.customerId) {
        await tx.customer.update({
          where: { id: sale.customerId },
          data: { totalSpent: { decrement: Number(sale.total) } },
        });
      }
    });

    return reply.send({ success: true, data: { message: 'Sale voided and stock restored' } });
  });

  fastify.post('/:id/payments', async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const data = paymentSchema.parse(request.body);

    const sale = await prisma.sale.findUnique({ where: { id }, include: { payments: true } });
    if (!sale) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Sale not found' } });
    }
    if (sale.status === 'VOIDED') {
      return reply.status(400).send({ success: false, error: { code: 'VOIDED_SALE', message: 'Cannot add payment to voided sale' } });
    }

    const totalPaid = Number(sale.amountPaid) + data.amount;
    const changeDue = Math.max(0, totalPaid - Number(sale.total));

    const [payment] = await prisma.$transaction([
      prisma.payment.create({
        data: { saleId: id, method: data.method, amount: data.amount, reference: data.reference, status: 'PAID' },
      }),
      prisma.sale.update({
        where: { id },
        data: { amountPaid: totalPaid, changeDue, status: totalPaid >= Number(sale.total) ? 'COMPLETED' : 'DRAFT' },
      }),
    ]);

    return reply.status(201).send({ success: true, data: payment });
  });
}
