import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { addStoreScope } from '../../middleware/store-scope.js';

const createSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  categoryId: z.string(),
  unit: z.string().min(1),
  sellingPrice: z.coerce.number().min(0),
  costPrice: z.coerce.number().min(0),
  reorderLevel: z.coerce.number().int().min(0).default(10),
  storeId: z.string(),
});

const updateSchema = z.object({
  sku: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  categoryId: z.string().optional(),
  unit: z.string().min(1).optional(),
  sellingPrice: z.coerce.number().min(0).optional(),
  costPrice: z.coerce.number().min(0).optional(),
  reorderLevel: z.coerce.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export default async function productRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', authenticate);

  fastify.post('/', async (request, reply) => {
    addStoreScope(request);
    const data = createSchema.parse(request.body);
    const existing = await prisma.product.findUnique({
      where: { sku_storeId: { sku: data.sku, storeId: data.storeId } },
    });
    if (existing) {
      return reply.status(409).send({
        success: false,
        error: { code: 'SKU_EXISTS', message: 'SKU already exists in this store' },
      });
    }
    const product = await prisma.product.create({
      data: {
        sku: data.sku,
        name: data.name,
        description: data.description,
        categoryId: data.categoryId,
        unit: data.unit,
        sellingPrice: data.sellingPrice,
        costPrice: data.costPrice,
        reorderLevel: data.reorderLevel,
        storeId: data.storeId,
      },
    });
    await prisma.stockLevel.create({
      data: { productId: product.id, storeId: data.storeId, quantity: 0 },
    });
    return reply.status(201).send({ success: true, data: product });
  });

  fastify.get('/', async (request, reply) => {
    addStoreScope(request);
    const { storeId } = request.query as Record<string, string>;
    const filter = request.user.role === 'ADMIN' && storeId ? { storeId } : request.storeFilter;
    const products = await prisma.product.findMany({
      where: { ...filter, isActive: true },
      include: { category: true, stockLevel: true },
      orderBy: { createdAt: 'desc' },
    });
    return reply.send({ success: true, data: products });
  });

  fastify.get('/low-stock', async (request, reply) => {
    addStoreScope(request);
    const filter = request.storeFilter;
    const products = await prisma.product.findMany({
      where: { ...filter, isActive: true },
      include: { category: true, stockLevel: true },
    });
    const lowStock = products.filter(
      (p: typeof products[0]) => p.stockLevel && Number(p.stockLevel.quantity) < Number(p.reorderLevel)
    );
    return reply.send({ success: true, data: lowStock });
  });

  fastify.patch('/:id', async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const data = updateSchema.parse(request.body);
    const product = await prisma.product.update({
      where: { id },
      data: {
        ...(data.sku && { sku: data.sku }),
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.categoryId && { categoryId: data.categoryId }),
        ...(data.unit && { unit: data.unit }),
        ...(data.sellingPrice !== undefined && { sellingPrice: data.sellingPrice }),
        ...(data.costPrice !== undefined && { costPrice: data.costPrice }),
        ...(data.reorderLevel !== undefined && { reorderLevel: data.reorderLevel }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
      include: { category: true, stockLevel: true },
    });
    return reply.send({ success: true, data: product });
  });

  fastify.delete('/:id', async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    await prisma.product.update({ where: { id }, data: { isActive: false } });
    return reply.send({ success: true, data: { message: 'Product deactivated' } });
  });
}
