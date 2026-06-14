import { prisma } from '../src/lib/prisma.js';
import { hashPassword } from '../src/modules/auth/service.js';
import { env } from '../src/config/env.js';

async function main() {
  if (env.NODE_ENV === 'production') {
    const allowSeed = process.env.ALLOW_PROD_SEED === 'true';
    if (!allowSeed) {
      console.error('ERROR: Seed script is disabled in production. Set ALLOW_PROD_SEED=true to override.');
      process.exit(1);
    }
    console.warn('WARNING: Running seed script in production. Ensure this is intentional.');
  }

  const adminPassword = env.ADMIN_SEED_PASSWORD ?? (env.NODE_ENV === 'production' ? undefined : 'Admin123!');
  if (!adminPassword) {
    console.error('ERROR: ADMIN_SEED_PASSWORD not set. Please set a strong password for the admin user.');
    process.exit(1);
  }

  const adminUsername = env.ADMIN_SEED_USERNAME || 'admin';
  const adminEmail = env.ADMIN_SEED_EMAIL || 'admin@buildmat.gh';

  if (adminPassword.length < 10 || !/(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])/.test(adminPassword)) {
    console.error('ERROR: ADMIN_SEED_PASSWORD does not meet complexity requirements (min 10 chars, upper/lower/number/special).');
    process.exit(1);
  }

  const storeA = await prisma.store.upsert({
    where: { id: 'seed-store-kumasi' },
    update: {},
    create: {
      id: 'seed-store-kumasi',
      name: 'Kumasi Central',
      address: 'Prempeh II St, Kumasi, Ghana',
      phone: '+233 20 000 0001',
      email: 'kumasi@buildmat.gh',
    },
  });

  const storeB = await prisma.store.upsert({
    where: { id: 'seed-store-accra' },
    update: {},
    create: {
      id: 'seed-store-accra',
      name: 'Accra Branch',
      address: 'Oxford St, Accra, Ghana',
      phone: '+233 20 000 0002',
      email: 'accra@buildmat.gh',
    },
  });

  const admin = await prisma.user.upsert({
    where: { username: adminUsername },
    update: {},
    create: {
      username: adminUsername,
      name: 'Super Admin',
      email: adminEmail,
      passwordHash: await hashPassword(adminPassword),
      role: 'ADMIN',
      isActive: true,
    },
  });

  if (env.NODE_ENV !== 'production') {
    await prisma.user.upsert({
      where: { username: 'kumasi.staff' },
      update: {},
      create: {
        username: 'kumasi.staff',
        name: 'Kumasi Staff',
        email: 'kumasi.staff@buildmat.gh',
        passwordHash: await hashPassword('Staff123!'),
        role: 'STAFF',
        storeId: storeA.id,
        isActive: true,
      },
    });

    await prisma.user.upsert({
      where: { username: 'accra.staff' },
      update: {},
      create: {
        username: 'accra.staff',
        name: 'Accra Staff',
        email: 'accra.staff@buildmat.gh',
        passwordHash: await hashPassword('Staff123!'),
        role: 'STAFF',
        storeId: storeB.id,
        isActive: true,
      },
    });
  }

  console.log('Seed completed:');
  console.log(`  Stores: ${storeA.name}, ${storeB.name}`);
  console.log(`  Admin: ${admin.username} (${admin.email ?? 'no email'})`);
  if (env.NODE_ENV !== 'production') {
    console.log('  Staff: kumasi.staff, accra.staff');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
