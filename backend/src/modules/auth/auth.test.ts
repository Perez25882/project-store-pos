import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import authRoutes from './routes.js';
import { prisma } from '../../lib/prisma.js';
import { hashPassword } from './service.js';

const app = Fastify({ logger: false });

beforeAll(async () => {
  await app.register(jwt, { secret: 'test-secret-32-chars-minimum!!!' });
  await app.register(authRoutes, { prefix: '/api/auth' });
  await prisma.$connect();

  // Clean slate
  await prisma.user.deleteMany({ where: { email: { in: ['test@example.com'] } } });
  await prisma.user.create({
    data: {
      name: 'Test User',
      email: 'test@example.com',
      passwordHash: await hashPassword('Password123!'),
      role: 'ADMIN',
      isActive: true,
    },
  });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: ['test@example.com'] } } });
  await app.close();
  await prisma.$disconnect();
});

describe('POST /api/auth/login', () => {
  it('returns 401 for invalid credentials', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'test@example.com', password: 'wrongpassword' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns tokens for valid credentials', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'test@example.com', password: 'Password123!' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.accessToken).toBeDefined();
    expect(body.data.refreshToken).toBeDefined();
    expect(body.data.user.email).toBe('test@example.com');
  });
});
