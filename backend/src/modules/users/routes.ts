import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { hashPassword } from '../auth/service.js';

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(8),
  role: z.enum(['ADMIN', 'STAFF']),
  storeId: z.string().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  role: z.enum(['ADMIN', 'STAFF']).optional(),
  storeId: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

export default async function userRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', authenticate);
  fastify.addHook('onRequest', authorize(['ADMIN']));

  fastify.post('/', async (request, reply) => {
    const data = createSchema.parse(request.body);
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      return reply.status(409).send({
        success: false,
        error: { code: 'EMAIL_EXISTS', message: 'Email already in use' },
      });
    }
    const passwordHash = await hashPassword(data.password);
    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        passwordHash,
        role: data.role,
        storeId: data.role === 'STAFF' ? data.storeId : null,
        createdById: request.user.id,
      },
    });
    return reply.status(201).send({
      success: true,
      data: { id: user.id, name: user.name, email: user.email, role: user.role, storeId: user.storeId },
    });
  });

  fastify.get('/', async (request, reply) => {
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        storeId: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return reply.send({ success: true, data: users });
  });

  fastify.patch('/:id', async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const data = updateSchema.parse(request.body);
    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.email && { email: data.email }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.role && { role: data.role }),
        ...(data.storeId !== undefined && { storeId: data.storeId }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
      select: { id: true, name: true, email: true, role: true, storeId: true, isActive: true },
    });
    return reply.send({ success: true, data: user });
  });

  fastify.delete('/:id', async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    await prisma.user.update({ where: { id }, data: { isActive: false } });
    return reply.send({ success: true, data: { message: 'User deactivated' } });
  });
}
