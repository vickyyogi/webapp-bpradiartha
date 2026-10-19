import { Prisma, PrismaClient } from '@prisma/client'

// Tahap 6 (P0.6): nominal tetap Decimal di database, tetapi serialisasi JSON
// (API/server component) mengirim number agar kontrak UI lama tidak berubah.
// ponytail: aman sampai 2^53-1 rupiah; ganti ke string/mapper eksplisit bila
// nominal suatu saat bisa melewati batas itu.
(Prisma.Decimal.prototype as unknown as { toJSON: () => number }).toJSON = function (this: Prisma.Decimal) {
  return this.toNumber()
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
