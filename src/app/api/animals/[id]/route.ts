import { AnimalStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { animalInputSchema } from "@/features/animals/validation";
import { authorizeApiRequest } from "@/lib/auth/authorize-api-request";
import { hasPermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";

const idSchema = z.string().uuid();

function isPrismaError(error: unknown, code: string) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authorization = await authorizeApiRequest("animals:write");
  if (authorization.response) return authorization.response;

  const { id } = await context.params;
  if (!idSchema.safeParse(id).success) {
    return Response.json({ error: "Neispravan identifikator životinje." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Tijelo zahtjeva nije ispravan JSON." }, { status: 400 });
  }

  const parsed = animalInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Provjerite unesene podatke.", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const input = parsed.data;
  try {
    const updated = await prisma.$transaction(
      async (transaction) => {
        const existing = await transaction.animal.findUnique({
          where: { id },
          select: {
            id: true,
            ownerId: true,
            allergies: true,
            chronicConditions: true,
            notes: true,
          },
        });
        if (!existing) return "missing";

        const owner = await transaction.client.findFirst({
          where: {
            id: input.ownerId,
            OR: [{ isActive: true }, { id: existing.ownerId }],
          },
          select: { id: true },
        });
        if (!owner) return "invalid-owner";

        const changedOwner = existing.ownerId !== input.ownerId;
        const result = await transaction.animal.updateMany({
          where: { id },
          data: {
            name: input.name,
            species: input.species,
            breed: input.breed || null,
            sex: input.sex || null,
            dateOfBirth: input.dateOfBirth
              ? new Date(`${input.dateOfBirth}T00:00:00.000Z`)
              : null,
            color: input.color || null,
            weightKg: input.weightKg ? new Prisma.Decimal(input.weightKg) : null,
            microchipNumber: input.microchipNumber || null,
            passportNumber: input.passportNumber || null,
            identificationNumber: input.identificationNumber || null,
            ownerId: input.ownerId,
            allergies: hasPermission(authorization.user.role, "examinations:write")
              ? input.allergies || null
              : existing.allergies,
            chronicConditions: hasPermission(authorization.user.role, "examinations:write")
              ? input.chronicConditions || null
              : existing.chronicConditions,
            notes: hasPermission(authorization.user.role, "examinations:write")
              ? input.notes || null
              : existing.notes,
            status: input.status,
          },
        });
        if (result.count === 0) return "missing";

        if (changedOwner) {
          const history = await transaction.animalOwnerHistory.updateMany({
            where: { animalId: id, validUntil: null },
            data: { validUntil: new Date() },
          });
          if (history.count !== 1) {
            throw new Error(
              `Za životinju ${id} očekivan je jedan aktivni zapis vlasništva, pronađeno: ${history.count}.`,
            );
          }

          await transaction.animalOwnerHistory.create({
            data: { animalId: id, ownerId: input.ownerId },
          });
        }

        await transaction.auditLog.create({
          data: {
            userId: authorization.user.id,
            action: changedOwner ? "ANIMAL_AND_OWNER_UPDATED" : "ANIMAL_UPDATED",
            entityType: "Animal",
            entityId: id,
            details: changedOwner
              ? { previousOwnerId: existing.ownerId, newOwnerId: input.ownerId }
              : undefined,
          },
        });

        return "updated";
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (updated === "missing") {
      return Response.json({ error: "Životinja nije pronađena." }, { status: 404 });
    }
    if (updated === "invalid-owner") {
      return Response.json(
        { error: "Novi vlasnik ne postoji ili je arhiviran." },
        { status: 400 },
      );
    }
    return Response.json({ success: true });
  } catch (error) {
    if (isPrismaError(error, "P2002")) {
      return Response.json(
        { error: "Broj mikročipa je već evidentiran za drugu životinju." },
        { status: 409 },
      );
    }
    throw error;
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authorization = await authorizeApiRequest("animals:write");
  if (authorization.response) return authorization.response;

  const { id } = await context.params;
  if (!idSchema.safeParse(id).success) {
    return Response.json({ error: "Neispravan identifikator životinje." }, { status: 400 });
  }

  const archived = await prisma.$transaction(async (transaction) => {
    const result = await transaction.animal.updateMany({
      where: { id, status: AnimalStatus.ACTIVE },
      data: { status: AnimalStatus.INACTIVE },
    });

    if (result.count > 0) {
      await transaction.auditLog.create({
        data: {
          userId: authorization.user.id,
          action: "ANIMAL_ARCHIVED",
          entityType: "Animal",
          entityId: id,
        },
      });
    }

    return result.count;
  });

  if (archived === 0) {
    return Response.json({ error: "Životinja nije pronađena ili je već arhivirana." }, { status: 404 });
  }
  return Response.json({ success: true });
}
