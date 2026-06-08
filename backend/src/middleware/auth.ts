import { FastifyReply, FastifyRequest } from 'fastify';
import { Role } from '@prisma/client';

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Access token required' },
      });
    }

    const decoded = await request.jwtVerify<{
      id: string;
      username: string;
      role: Role;
      storeId: string | null;
    }>();

    request.user = {
      id: decoded.id,
      username: decoded.username,
      role: decoded.role,
      storeId: decoded.storeId,
    };
  } catch {
    return reply.status(401).send({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' },
    });
  }
}

export function authorize(allowedRoles: Role[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!allowedRoles.includes(request.user.role)) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Insufficient permissions' },
      });
    }
  };
}
