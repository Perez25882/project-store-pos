import type { Role } from '@prisma/client';

export interface TokenPayload {
  id: string;
  username: string;
  role: Role;
  storeId: string | null;
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: TokenPayload;
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    storeFilter: { storeId?: string } | Record<string, never>;
  }
}
