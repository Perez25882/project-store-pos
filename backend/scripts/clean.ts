import { prisma } from '../src/lib/prisma.js';

async function main() {
  await prisma.user.deleteMany();
  await prisma.store.deleteMany();
  console.log('Database cleared');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
