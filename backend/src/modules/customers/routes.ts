import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { addStoreScope } from '../../middleware/store-scope.js';

const createSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  storeId: z.string(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
});

export default async function customerRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', authenticate);

  fastify.post('/', async (request, reply) => {
    addStoreScope(request);
    const data = createSchema.parse(request.body);
    const customer = await prisma.customer.create({
      data: {
        name: data.name,
        phone: data.phone,
        email: data.email,
        address: data.address,
        storeId: data.storeId,
      },
    });
    return reply.status(201).send({ success: true, data: customer });
  });

  fastify.get('/', async (request, reply) => {
    addStoreScope(request);
    const filter = request.storeFilter;
    const customers = await prisma.customer.findMany({
      where: filter,
      orderBy: { name: 'asc' },
    });
    return reply.send({ success: true, data: customers });
  });

  fastify.get('/:id', async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: { sales: { orderBy: { createdAt: 'desc' }, take: 10 } },
    });
    if (!customer) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } });
    }
    return reply.send({ success: true, data: customer });
  });

  fastify.patch('/:id', async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const data = updateSchema.parse(request.body);
    const customer = await prisma.customer.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.address !== undefined && { address: data.address }),
      },
    });
    return reply.send({ success: true, data: customer });
  });
}
