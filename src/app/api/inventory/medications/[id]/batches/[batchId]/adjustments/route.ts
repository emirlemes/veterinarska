import { Prisma } from "@prisma/client";
import { z } from "zod";
import { stockAdjustmentSchema } from "@/features/inventory/validation";
import { authorizeApiRequest } from "@/lib/auth/authorize-api-request";
import { prisma } from "@/lib/db";

const idSchema = z.string().uuid();

function isPrismaError(error: unknown, code: string) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; batchId: string }> },
) {
  const authorization = await authorizeApiRequest("inventory:write");
  if (authorization.response) return authorization.response;
  const { id: medicationId, batchId } = await context.params;
  if (!idSchema.safeParse(medicationId).success || !idSchema.safeParse(batchId).success) {
    return Response.json({ error: "Neispravan identifikator lijeka ili serije." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Tijelo zahtjeva nije ispravan JSON." }, { status: 400 });
  }
  const parsed = stockAdjustmentSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Provjerite unesene podatke.", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const outcome = await prisma.$transaction(
      async (transaction) => {
        const batch = await transaction.medicationBatch.findFirst({
          where: { id: batchId, medicationId, medication: { isActive: true } },
          select: { id: true },
        });
        if (!batch) return "missing" as const;

        const quantity = new Prisma.Decimal(parsed.data.quantity);
        const signedQuantity =
          parsed.data.direction === "ADD" ? quantity : quantity.negated();
        const changed = await transaction.medicationBatch.updateMany({
          where: {
            id: batch.id,
            ...(parsed.data.direction === "REMOVE"
              ? { quantityRemaining: { gte: quantity } }
              : {}),
          },
          data: { quantityRemaining: { increment: signedQuantity } },
        });
        if (changed.count !== 1) return "insufficient" as const;

        await transaction.stockMovement.create({
          data: {
            batchId: batch.id,
            userId: authorization.user.id,
            type: "ADJUSTMENT",
            quantity: signedQuantity,
            reason: parsed.data.reason,
          },
        });
        await transaction.auditLog.create({
          data: {
            userId: authorization.user.id,
            action: "MEDICATION_STOCK_ADJUSTED",
            entityType: "MedicationBatch",
            entityId: batch.id,
            details: {
              medicationId,
              direction: parsed.data.direction,
              quantity: parsed.data.quantity,
              reason: parsed.data.reason,
            },
          },
        });
        return "adjusted" as const;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (outcome === "missing") {
      return Response.json({ error: "Aktivna serija lijeka nije pronađena." }, { status: 404 });
    }
    if (outcome === "insufficient") {
      return Response.json({ error: "Korekcija bi smanjila zalihu ispod nule." }, { status: 409 });
    }
    return Response.json({ success: true });
  } catch (error) {
    if (isPrismaError(error, "P2034")) {
      return Response.json(
        { error: "Zaliha je upravo izmijenjena. Osvježite i pokušajte ponovo." },
        { status: 409 },
      );
    }
    throw error;
  }
}
