// src/shared/utils/prisma.ts
import { PrismaClient } from '@prisma/client';

// Previene l'esaurimento delle connessioni durante il reload in fase di sviluppo
const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;