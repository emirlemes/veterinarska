import { Prisma } from "@prisma/client";
import { z } from "zod";
import { medicationBatchInputSchema } from "@/features/inventory/validation";
import { authorizeApiRequest } from "@/lib/auth/authorize-api-request";
import { prisma } from "@/lib/db";

const idSchema = z.string().uuid();
const calendarDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day;
});

function isPrismaError(error: unknown, code: string) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authorization = await authorizeApiRequest("inventory:write");
  if (authorization.response) return authorization.response;
  const { id: medicationId } = await context.params;
  if (!idSchema.safeParse(medicationId).success) {
    return Response.json({ error: "Neispravan identifikator lijeka." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Tijelo zahtjeva nije ispravan JSON." }, { status: 400 });
  }
  const parsed = medicationBatchInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Provjerite unesene podatke.", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const input = parsed.data;
  if (input.expiresAt && !calendarDateSchema.safeParse(input.expiresAt).success) {
    return Response.json({ error: "Datum isteka nije ispravan." }, { status: 400 });
  }

  try {
    const outcome = await prisma.$transaction(async (transaction) => {
      const medication = await transaction.medication.findFirst({
        where: { id: medicationId, isActive: true },
        select: { id: true },
      });
      if (!medication) return { kind: "missing" as const };

      const batch = await transaction.medicationBatch.create({
        data: {
          medicationId,
          batchNumber: input.batchNumber,
          expiresAt: input.expiresAt ? new Date(`${input.expiresAt}T00:00:00.000Z`) : null,
          quantityReceived: new Prisma.Decimal(input.quantity),
          quantityRemaining: new Prisma.Decimal(input.quantity),
          purchasePrice: input.purchasePrice ? new Prisma.Decimal(input.purchasePrice) : null,
        },
        select: { id: true },
      });
      await transaction.stockMovement.create({
        data: {
          batchId: batch.id,
          userId: authorization.user.id,
          type: "RECEIPT",
          quantity: new Prisma.Decimal(input.quantity),
          reason: input.reason || "Prijem nove serije",
        },
      });
      await transaction.auditLog.create({
        data: {
          userId: authorization.user.id,
          action: "MEDICATION_BATCH_RECEIVED",
          entityType: "MedicationBatch",
          entityId: batch.id,
          details: { medicationId, quantity: input.quantity, batchNumber: input.batchNumber },
        },
      });
      return { kind: "created" as const, id: batch.id };
    });
    if (outcome.kind === "missing") {
      return Response.json({ error: "Aktivni lijek nije pronađen." }, { status: 404 });
    }
    return Response.json({ id: outcome.id }, { status: 201 });
  } catch (error) {
    if (isPrismaError(error, "P2002")) {
      return Response.json({ error: "Broj serije već postoji za ovaj lijek." }, { status: 409 });
    }
    throw error;
  }
}
