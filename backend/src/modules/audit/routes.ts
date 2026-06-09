import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { addStoreScope } from '../../middleware/store-scope.js';

export default async function auditRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', authenticate);

  fastify.get('/', async (request, reply) => {
    addStoreScope(request);
    const filter = request.storeFilter;
    const { action, entity, from, to } = request.query as Record<string, string>;

    const where: any = { ...filter };
    if (action) where.action = action;
    if (entity) where.entity = entity;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to + 'T23:59:59.999Z');
    }

    const logs = await prisma.auditLog.findMany({
      where,
      include: { user: { select: { name: true, username: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return reply.send({ success: true, data: logs });
  });
}
