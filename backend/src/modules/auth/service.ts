import bcrypt from 'bcrypt';
import { prisma } from '../../lib/prisma.js';

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createRefreshToken(userId: string): Promise<string> {
  const crypto = await import('crypto');
  const token = crypto.randomBytes(64).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  await prisma.refreshToken.create({
    data: {
      token: tokenHash,
      userId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
  return token;
}

export async function rotateRefreshToken(
  oldToken: string
): Promise<{ newToken: string; userId: string } | null> {
  const crypto = await import('crypto');
  const oldHash = crypto.createHash('sha256').update(oldToken).digest('hex');
  const existing = await prisma.refreshToken.findUnique({
    where: { token: oldHash },
    include: { user: true },
  });
  if (!existing || existing.revoked || existing.expiresAt < new Date()) return null;
  await prisma.refreshToken.update({ where: { id: existing.id }, data: { revoked: true } });
  const newToken = await createRefreshToken(existing.userId);
  return { newToken, userId: existing.userId };
}

export async function revokeRefreshToken(token: string): Promise<void> {
  const crypto = await import('crypto');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  await prisma.refreshToken.updateMany({ where: { token: hash }, data: { revoked: true } });
}
