import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';

export default async function categoryRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', authenticate);

  fastify.post('/', async (request, reply) => {
    const { name } = z.object({ name: z.string().min(1) }).parse(request.body);
    const existing = await prisma.category.findUnique({ where: { name } });
    if (existing) {
      return reply.status(409).send({
        success: false,
        error: { code: 'CATEGORY_EXISTS', message: 'Category already exists' },
      });
    }
    const category = await prisma.category.create({ data: { name } });
    return reply.status(201).send({ success: true, data: category });
  });

  fastify.get('/', async (_request, reply) => {
    const categories = await prisma.category.findMany({ orderBy: { name: 'asc' } });
    return reply.send({ success: true, data: categories });
  });

  fastify.patch('/:id', async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const { name } = z.object({ name: z.string().min(1) }).parse(request.body);
    const category = await prisma.category.update({ where: { id }, data: { name } });
    return reply.send({ success: true, data: category });
  });

  fastify.delete('/:id', async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const productsCount = await prisma.product.count({ where: { categoryId: id } });
    if (productsCount > 0) {
      return reply.status(409).send({
        success: false,
        error: { code: 'CATEGORY_IN_USE', message: 'Cannot delete category with products' },
      });
    }
    await prisma.category.delete({ where: { id } });
    return reply.send({ success: true, data: { message: 'Category deleted' } });
  });
}
