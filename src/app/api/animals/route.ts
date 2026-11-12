import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { animalInputSchema } from "@/features/animals/validation";
import { authorizeApiRequest } from "@/lib/auth/authorize-api-request";
import { hasPermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";

function isPrismaError(error: unknown, code: string) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

export async function POST(request: NextRequest) {
  const authorization = await authorizeApiRequest("animals:write");
  if (authorization.response) return authorization.response;

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
    const result = await prisma.$transaction(
      async (transaction) => {
        const owner = await transaction.client.findFirst({
          where: { id: input.ownerId, isActive: true },
          select: { id: true },
        });
        if (!owner) return { invalidOwner: true as const };

      const created = await transaction.animal.create({
        data: {
          name: input.name,
          species: input.species,
          breed: input.breed || null,
          sex: input.sex || null,
          dateOfBirth: input.dateOfBirth ? new Date(`${input.dateOfBirth}T00:00:00.000Z`) : null,
          color: input.color || null,
          weightKg: input.weightKg ? new Prisma.Decimal(input.weightKg) : null,
          microchipNumber: input.microchipNumber || null,
          passportNumber: input.passportNumber || null,
          identificationNumber: input.identificationNumber || null,
          ownerId: input.ownerId,
          allergies: hasPermission(authorization.user.role, "examinations:write")
            ? input.allergies || null
            : null,
          chronicConditions: hasPermission(authorization.user.role, "examinations:write")
            ? input.chronicConditions || null
            : null,
          notes: hasPermission(authorization.user.role, "examinations:write")
            ? input.notes || null
            : null,
          status: input.status,
        },
        select: { id: true },
      });

      await transaction.animalOwnerHistory.create({
        data: {
          animalId: created.id,
          ownerId: input.ownerId,
        },
      });

      await transaction.auditLog.create({
        data: {
          userId: authorization.user.id,
          action: "ANIMAL_CREATED",
          entityType: "Animal",
          entityId: created.id,
        },
      });

        return { id: created.id, invalidOwner: false as const };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (result.invalidOwner) {
      return Response.json(
        { error: "Odabrani vlasnik ne postoji ili je arhiviran." },
        { status: 400 },
      );
    }

    return Response.json({ id: result.id }, { status: 201 });
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
