import { AnimalStatus, Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { animalInputSchema, animalListQuerySchema } from "@/features/animals/validation";
import { authorizeApiRequest } from "@/lib/auth/authorize-api-request";
import { hasPermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const authorization = await authorizeApiRequest("animals:read");
  if (authorization.response) return authorization.response;

  const parsed = animalListQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return Response.json({ error: "Neispravan upit za pretragu ili stranicu." }, { status: 400 });
  }
  const filters = parsed.data;
  const statusFilter: Record<"active" | "inactive" | "deceased", AnimalStatus> = {
    active: AnimalStatus.ACTIVE,
    inactive: AnimalStatus.INACTIVE,
    deceased: AnimalStatus.DECEASED,
  };
  const where: Prisma.AnimalWhereInput = {};
  if (filters.status !== "all") where.status = statusFilter[filters.status];
  if (filters.species) where.species = { contains: filters.species, mode: "insensitive" };
  if (filters.ownerId) where.ownerId = filters.ownerId;
  if (filters.q) {
    where.OR = [
      { name: { contains: filters.q, mode: "insensitive" } },
      { species: { contains: filters.q, mode: "insensitive" } },
      { breed: { contains: filters.q, mode: "insensitive" } },
      { microchipNumber: { contains: filters.q, mode: "insensitive" } },
      { passportNumber: { contains: filters.q, mode: "insensitive" } },
      {
        owner: {
          OR: [
            { firstName: { contains: filters.q, mode: "insensitive" } },
            { lastName: { contains: filters.q, mode: "insensitive" } },
            { companyName: { contains: filters.q, mode: "insensitive" } },
            { phone: { contains: filters.q } },
          ],
        },
      },
    ];
  }
  const total = await prisma.animal.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / 20));
  const page = Math.min(filters.page, pageCount);
  const animals = await prisma.animal.findMany({
    where,
    select: {
      id: true, name: true, species: true, breed: true, sex: true, microchipNumber: true, status: true,
      owner: { select: { id: true, firstName: true, lastName: true, companyName: true, phone: true } },
    },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    skip: (page - 1) * 20,
    take: 20,
  });
  return Response.json({ animals, total, page, pageCount }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

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
