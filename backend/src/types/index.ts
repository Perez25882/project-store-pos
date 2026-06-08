import type { Role } from '@prisma/client';

export interface TokenPayload {
  id: string;
  email: string;
  role: Role;
  storeId: string | null;
}

declare module 'fastify' {
  interface FastifyRequest {
    user: TokenPayload;
    storeFilter: { storeId?: string } | Record<string, never>;
  }
}
