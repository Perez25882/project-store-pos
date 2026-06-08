import { prisma } from '../src/lib/prisma.js';
import { hashPassword } from '../src/modules/auth/service.js';

async function main() {
  const storeA = await prisma.store.create({
    data: {
      name: 'Kumasi Central',
      address: 'Prempeh II St, Kumasi, Ghana',
      phone: '+233 20 000 0001',
      email: 'kumasi@buildmat.gh',
    },
  });

  const storeB = await prisma.store.create({
    data: {
      name: 'Accra Branch',
      address: 'Oxford St, Accra, Ghana',
      phone: '+233 20 000 0002',
      email: 'accra@buildmat.gh',
    },
  });

  const admin = await prisma.user.create({
    data: {
      name: 'Super Admin',
      email: 'admin@buildmat.gh',
      passwordHash: await hashPassword('Admin123!'),
      role: 'ADMIN',
      isActive: true,
    },
  });

  await prisma.user.create({
    data: {
      name: 'Kumasi Staff',
      email: 'kumasi.staff@buildmat.gh',
      passwordHash: await hashPassword('Staff123!'),
      role: 'STAFF',
      storeId: storeA.id,
      isActive: true,
    },
  });

  await prisma.user.create({
    data: {
      name: 'Accra Staff',
      email: 'accra.staff@buildmat.gh',
      passwordHash: await hashPassword('Staff123!'),
      role: 'STAFF',
      storeId: storeB.id,
      isActive: true,
    },
  });

  console.log('Seed completed:');
  console.log(`  Stores: ${storeA.name}, ${storeB.name}`);
  console.log(`  Admin: ${admin.email}`);
  console.log(`  Staff: kumasi.staff@buildmat.gh, accra.staff@buildmat.gh`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
