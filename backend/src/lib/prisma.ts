import { PrismaClient } from '@prisma/client';

const LOG_LEVELS: any = {
  development: ['query', 'info', 'warn', 'error'],
  production: ['warn', 'error'],
  test: [],
};

const ENV = (process.env.NODE_ENV as 'development' | 'production' | 'test') || 'development';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: LOG_LEVELS[ENV] || ['warn', 'error'],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (ENV !== 'production') {
  globalForPrisma.prisma = prisma; // Reuse instance in development to prevent connection leaks during hot reloads
}
