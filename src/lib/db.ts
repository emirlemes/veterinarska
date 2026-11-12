import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

function createPrismaClient() {
  const client = new PrismaClient({
    log: [
      ...(process.env.PERFORMANCE_LOGGING === "true"
        ? [{ emit: "event" as const, level: "query" as const }]
        : []),
      "error",
      ...(process.env.NODE_ENV === "development" ? ["warn" as const] : []),
    ],
  });

  if (process.env.PERFORMANCE_LOGGING === "true") {
    client.$on("query", (event) => {
      console.log("[VetCare performance] Database query", { durationMs: event.duration });
    });
  }
  return client;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
