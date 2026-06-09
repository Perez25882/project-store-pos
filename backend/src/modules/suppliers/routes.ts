import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { addStoreScope } from '../../middleware/store-scope.js';

const createSchema = z.object({
  name: z.string().min(1),
  contactName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  storeId: z.string(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  contactName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  isActive: z.boolean().optional(),
});

export default async function supplierRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', authenticate);

  fastify.post('/', async (request, reply) => {
    addStoreScope(request);
    const data = createSchema.parse(request.body);
    const supplier = await prisma.supplier.create({
      data: {
        name: data.name,
        contactName: data.contactName,
        phone: data.phone,
        email: data.email,
        address: data.address,
        storeId: data.storeId,
      },
    });
    return reply.status(201).send({ success: true, data: supplier });
  });

  fastify.get('/', async (request, reply) => {
    addStoreScope(request);
    const filter = request.storeFilter;
    const suppliers = await prisma.supplier.findMany({
      where: { ...filter, isActive: true },
      orderBy: { name: 'asc' },
    });
    return reply.send({ success: true, data: suppliers });
  });

  fastify.get('/:id', async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: { procurementOrders: { orderBy: { createdAt: 'desc' }, take: 10 } },
    });
    if (!supplier) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Supplier not found' } });
    }
    return reply.send({ success: true, data: supplier });
  });

  fastify.patch('/:id', async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const data = updateSchema.parse(request.body);
    const supplier = await prisma.supplier.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.contactName !== undefined && { contactName: data.contactName }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.address !== undefined && { address: data.address }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });
    return reply.send({ success: true, data: supplier });
  });

  fastify.delete('/:id', async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    await prisma.supplier.update({ where: { id }, data: { isActive: false } });
    return reply.send({ success: true, data: { message: 'Supplier deactivated' } });
  });
}
