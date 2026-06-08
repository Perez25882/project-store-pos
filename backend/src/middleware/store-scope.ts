import { FastifyRequest } from 'fastify';

export function addStoreScope(request: FastifyRequest) {
  if (request.user.role === 'ADMIN') {
    const storeId = (request.query as Record<string, string>)?.storeId;
    request.storeFilter = storeId ? { storeId } : {};
  } else {
    request.storeFilter = { storeId: request.user.storeId! };
  }
}
