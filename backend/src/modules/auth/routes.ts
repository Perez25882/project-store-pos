import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import {
  verifyPassword,
  createRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
} from './service.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export default async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/login', async (request, reply) => {
    const { email, password } = loginSchema.parse(request.body);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive || !(await verifyPassword(password, user.passwordHash))) {
      return reply.status(401).send({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
      });
    }
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const accessToken = await reply.jwtSign(
      { id: user.id, email: user.email, role: user.role, storeId: user.storeId },
      { expiresIn: '15m' }
    );
    const refreshToken = await createRefreshToken(user.id);
    return reply.send({
      success: true,
      data: {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          storeId: user.storeId,
        },
      },
    });
  });

  fastify.post('/refresh', async (request, reply) => {
    const { refreshToken } = z.object({ refreshToken: z.string() }).parse(request.body);
    const result = await rotateRefreshToken(refreshToken);
    if (!result) {
      return reply.status(401).send({
        success: false,
        error: { code: 'INVALID_REFRESH_TOKEN', message: 'Invalid or expired refresh token' },
      });
    }
    const user = await prisma.user.findUnique({ where: { id: result.userId } });
    if (!user) {
      return reply.status(401).send({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' },
      });
    }
    const accessToken = await reply.jwtSign(
      { id: user.id, email: user.email, role: user.role, storeId: user.storeId },
      { expiresIn: '15m' }
    );
    return reply.send({ success: true, data: { accessToken, refreshToken: result.newToken } });
  });

  fastify.post('/logout', async (request, reply) => {
    const { refreshToken } = z.object({ refreshToken: z.string() }).parse(request.body);
    await revokeRefreshToken(refreshToken);
    return reply.send({ success: true, data: { message: 'Logged out successfully' } });
  });
}
