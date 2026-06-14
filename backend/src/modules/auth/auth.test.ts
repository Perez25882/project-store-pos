import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import authRoutes from './routes.js';
import { prisma } from '../../lib/prisma.js';
import { hashPassword } from './service.js';

const TEST_JWT_SECRET = process.env.TEST_JWT_SECRET || 'test-secret-32-chars-minimum!!!';

const app = Fastify({ logger: false });

beforeAll(async () => {
  await app.register(jwt, { secret: TEST_JWT_SECRET });
  await app.register(authRoutes, { prefix: '/api/auth' });
  await prisma.$connect();

  // Clean slate
  await prisma.user.deleteMany({ where: { username: 'testuser' } });
  await prisma.user.create({
    data: {
      username: 'testuser',
      name: 'Test User',
      email: 'test@example.com',
      passwordHash: await hashPassword('Password123!'),
      role: 'ADMIN',
      isActive: true,
    },
  });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { username: 'testuser' } });
  await app.close();
  await prisma.$disconnect();
});

describe('POST /api/auth/login', () => {
  it('returns 401 for invalid credentials', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'testuser', password: 'wrongpassword' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns tokens for valid credentials', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'testuser', password: 'Password123!' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.accessToken).toBeDefined();
    expect(body.data.refreshToken).toBeDefined();
    expect(body.data.user.username).toBe('testuser');
  });
});
