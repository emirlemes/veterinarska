import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Prisma, PrismaClient } from "@prisma/client";
import { updateExamination } from "../features/examinations/update";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

test("completion preserves findings, completes appointment and rejects duplicates", { skip: !testDatabaseUrl }, async () => {
  if (!testDatabaseUrl) throw new Error("TEST_DATABASE_URL is required");
  const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl } } });
  const rollback = new Error("INTENTIONAL_ROLLBACK");
  try {
    await assert.rejects(
      prisma.$transaction(async (tx) => {
        const user = await tx.user.create({ data: {
          firstName: "Test", lastName: "Vet", email: `${randomUUID()}@example.invalid`,
          passwordHash: "not-a-login", role: "VETERINARIAN",
        } });
        const client = await tx.client.create({ data: { firstName: "Test", lastName: "Client", phone: "0" } });
        const animal = await tx.animal.create({ data: { name: "Test", species: "Test", ownerId: client.id } });
        const appointment = await tx.appointment.create({ data: {
          clientId: client.id, animalId: animal.id, veterinarianId: user.id,
          startsAt: new Date("2026-01-01T10:00:00Z"), endsAt: new Date("2026-01-01T11:00:00Z"),
          reason: "Test", status: "IN_PROGRESS",
        } });
        const examination = await tx.examination.create({ data: {
          clientId: client.id, animalId: animal.id, veterinarianId: user.id,
          appointmentId: appointment.id, symptoms: "Sačuvani simptomi",
        } });
        const input = { id: examination.id, userId: user.id, status: "COMPLETED" as const };
        assert.equal(await updateExamination(tx, input), "missing-diagnosis");
        assert.equal((await tx.appointment.findUniqueOrThrow({ where: { id: appointment.id } })).status, "IN_PROGRESS");
        assert.equal(await updateExamination(tx, {
          ...input, clinical: { clientId: randomUUID(), animalId: animal.id, diagnosis: "Test" },
        }), "identity-immutable");
        await tx.examination.update({ where: { id: examination.id }, data: { diagnosis: "Test dijagnoza" } });
        assert.equal(await updateExamination(tx, input), "success");
        const saved = await tx.examination.findUniqueOrThrow({ where: { id: examination.id } });
        assert.equal(saved.status, "COMPLETED");
        assert.equal(saved.symptoms, "Sačuvani simptomi");
        assert.equal(saved.diagnosis, "Test dijagnoza");
        assert.equal((await tx.appointment.findUniqueOrThrow({ where: { id: appointment.id } })).status, "COMPLETED");
        assert.equal(await tx.auditLog.count({ where: { entityId: examination.id, action: "EXAMINATION_COMPLETED" } }), 1);
        assert.equal(await updateExamination(tx, input), "completed");
        const second = await tx.examination.create({ data: {
          clientId: client.id, animalId: animal.id, veterinarianId: user.id,
        } });
        assert.equal(await updateExamination(tx, {
          id: second.id, userId: user.id, status: "COMPLETED",
          clinical: { clientId: client.id, animalId: animal.id, diagnosis: "Nova dijagnoza", notes: "Bilješka" },
        }), "success");
        const edited = await tx.examination.findUniqueOrThrow({ where: { id: second.id } });
        assert.equal(edited.diagnosis, "Nova dijagnoza");
        assert.equal(edited.notes, "Bilješka");
        throw rollback;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 45000 }),
      (error) => error === rollback,
    );
  } finally {
    await prisma.$disconnect();
  }
});
