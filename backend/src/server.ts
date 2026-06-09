import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { env } from './config/env.js';
import authRoutes from './modules/auth/routes.js';
import storeRoutes from './modules/stores/routes.js';
import userRoutes from './modules/users/routes.js';
import categoryRoutes from './modules/categories/routes.js';
import productRoutes from './modules/products/routes.js';
import inventoryRoutes from './modules/inventory/routes.js';
import customerRoutes from './modules/customers/routes.js';
import salesRoutes from './modules/sales/routes.js';
import supplierRoutes from './modules/suppliers/routes.js';
import procurementRoutes from './modules/procurement/routes.js';

const app = Fastify({ logger: env.NODE_ENV === 'development' });

async function start() {
  await app.register(cors, { origin: env.FRONTEND_URL, credentials: true });
  await app.register(helmet);
  await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });
  await app.register(jwt, { secret: env.JWT_ACCESS_SECRET });

  app.setErrorHandler((error, request, reply) => {
    app.log.error(error);
    if (error.validation) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.message },
      });
    }
    return reply.status(500).send({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  });

  app.register(authRoutes, { prefix: '/api/auth' });
  app.register(storeRoutes, { prefix: '/api/stores' });
  app.register(userRoutes, { prefix: '/api/users' });
  app.register(categoryRoutes, { prefix: '/api/categories' });
  app.register(productRoutes, { prefix: '/api/products' });
  app.register(inventoryRoutes, { prefix: '/api/inventory' });
  app.register(customerRoutes, { prefix: '/api/customers' });
  app.register(salesRoutes, { prefix: '/api/sales' });
  app.register(supplierRoutes, { prefix: '/api/suppliers' });
  app.register(procurementRoutes, { prefix: '/api/procurement' });

  app.get('/health', async () => ({ status: 'ok' }));

  await app.listen({ port: env.PORT, host: '0.0.0.0' });
  app.log.info(`Server listening on port ${env.PORT}`);
}

start().catch((err) => {
  app.log.error(err);
  process.exit(1);
});
