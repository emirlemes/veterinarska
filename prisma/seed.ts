import "dotenv/config";
import { PrismaClient, Role } from "@prisma/client";
import { hash } from "bcryptjs";
import { z } from "zod";

const environmentSchema = z.object({
  ADMIN_EMAIL: z.string().email().max(254),
  ADMIN_PASSWORD: z.string().min(12).max(128),
});

const environment = environmentSchema.parse(process.env);

const prisma = new PrismaClient();

async function main() {
  const email = environment.ADMIN_EMAIL.toLowerCase();
  const passwordHash = await hash(environment.ADMIN_PASSWORD, 12);

  await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      role: Role.ADMIN,
      isActive: true,
    },
    create: {
      email,
      firstName: "Sistem",
      lastName: "Administrator",
      passwordHash,
      role: Role.ADMIN,
    },
  });

  await prisma.clinicSettings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });

  console.info(`Administratorski račun je spreman: ${email}`);
}

main()
  .catch((error: unknown) => {
    console.error("Seed baze nije uspio:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
