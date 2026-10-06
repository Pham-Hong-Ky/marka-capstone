import { PrismaClient } from '@prisma/client';
import env from './env.js';
import softDeleteExtension from './prismaExtensions.js';

const basePrisma = new PrismaClient({
  log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

const prisma = basePrisma.$extends(softDeleteExtension);

export { basePrisma };
export default prisma;
