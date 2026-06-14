import { FastifyRequest } from 'fastify';

// Valid sources for storeId to prevent query parameter injection 
function extractStoreId(request: FastifyRequest): string | undefined {
  // Check body first for mutations
  if (request.body && typeof request.body === 'object') {
    const body = request.body as Record<string, any>;
    if (body.storeId) return String(body.storeId);
  }
  // Check URL params for specific routes
  if (request.params && typeof request.params === 'object') {
    const params = request.params as Record<string, any>;
    if (params.storeId) return String(params.storeId);
  }
  // Finally, check query (read-only operations)
  if (request.query && typeof request.query === 'object') {
    const query = request.query as Record<string, any>;
    if (query.storeId) return String(query.storeId);
  }
  return undefined;
}

export function addStoreScope(request: FastifyRequest) {
  if (!request.user) {
    throw new Error('Authentication required before store scope can be applied');
  }

  if (request.user.role === 'ADMIN') {
    const storeId = extractStoreId(request);
    request.storeFilter = storeId ? { storeId } : {};
  } else {
    // Enforce strict store scoping for non-admin users
    request.storeFilter = { storeId: request.user.storeId! };
  }
}
