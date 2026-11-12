import { ExaminationStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { medicationAdministrationSchema } from "@/features/examinations/validation";
import { authorizeApiRequest } from "@/lib/auth/authorize-api-request";
import { getClinicDate } from "@/lib/dates";
import { prisma } from "@/lib/db";

const idSchema = z.string().uuid();

function isPrismaError(error: unknown, code: string) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authorization = await authorizeApiRequest("therapies:write");
  if (authorization.response) return authorization.response;
  const { id: examinationId } = await context.params;
  if (!idSchema.safeParse(examinationId).success) {
    return Response.json({ error: "Neispravan identifikator pregleda." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Tijelo zahtjeva nije ispravan JSON." }, { status: 400 });
  }
  const parsed = medicationAdministrationSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Provjerite unesene podatke.", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const outcome = await prisma.$transaction(
      async (transaction) => {
        const examination = await transaction.examination.findUnique({
          where: { id: examinationId },
          select: { status: true },
        });
        if (!examination) return { kind: "missing-examination" as const };
        if (examination.status !== ExaminationStatus.IN_PROGRESS) {
          return { kind: "completed" as const };
        }

        const batch = await transaction.medicationBatch.findUnique({
          where: { id: parsed.data.batchId },
          include: { medication: { select: { id: true, name: true, unit: true, isActive: true } } },
        });
        if (!batch || !batch.medication.isActive) return { kind: "missing-batch" as const };
        const today = new Date(`${getClinicDate()}T00:00:00.000Z`);
        if (batch.expiresAt && batch.expiresAt < today) return { kind: "expired" as const };

        const quantity = new Prisma.Decimal(parsed.data.quantity);
        const updated = await transaction.medicationBatch.updateMany({
          where: {
            id: batch.id,
            quantityRemaining: { gte: quantity },
          },
          data: { quantityRemaining: { decrement: quantity } },
        });
        if (updated.count !== 1) return { kind: "insufficient-stock" as const };

        const administration = await transaction.medicationAdministration.create({
          data: {
            examinationId,
            medicationId: batch.medicationId,
            batchId: batch.id,
            quantity,
            notes: parsed.data.notes || null,
          },
          select: { id: true, administeredAt: true },
        });
        await transaction.stockMovement.create({
          data: {
            batchId: batch.id,
            userId: authorization.user.id,
            administrationId: administration.id,
            type: "ADMINISTRATION",
            quantity: quantity.negated(),
            reason: `Primjena u pregledu`,
          },
        });
        await transaction.auditLog.create({
          data: {
            userId: authorization.user.id,
            action: "MEDICATION_ADMINISTERED",
            entityType: "MedicationAdministration",
            entityId: administration.id,
            details: {
              examinationId,
              medicationId: batch.medicationId,
              batchId: batch.id,
              quantity: parsed.data.quantity,
            },
          },
        });
        return {
          kind: "administered" as const,
          administration: {
            id: administration.id,
            medicationName: batch.medication.name,
            unit: batch.medication.unit,
            batchNumber: batch.batchNumber,
            quantity: parsed.data.quantity,
            notes: parsed.data.notes || null,
            administeredAt: administration.administeredAt.toISOString(),
          },
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (outcome.kind === "missing-examination") {
      return Response.json({ error: "Pregled nije pronađen." }, { status: 404 });
    }
    if (outcome.kind === "completed") {
      return Response.json({ error: "Lijek nije moguće evidentirati nakon završetka pregleda." }, { status: 409 });
    }
    if (outcome.kind === "missing-batch") {
      return Response.json({ error: "Serija lijeka nije pronađena ili lijek nije aktivan." }, { status: 404 });
    }
    if (outcome.kind === "expired") {
      return Response.json({ error: "Nije moguće evidentirati lijek iz serije kojoj je istekao rok." }, { status: 400 });
    }
    if (outcome.kind === "insufficient-stock") {
      return Response.json({ error: "Zaliha serije nije dovoljna za ovu količinu." }, { status: 409 });
    }
    return Response.json({ administration: outcome.administration }, { status: 201 });
  } catch (error) {
    if (isPrismaError(error, "P2034")) {
      return Response.json(
        { error: "Zaliha ili pregled su upravo izmijenjeni. Osvježite i pokušajte ponovo." },
        { status: 409 },
      );
    }
    throw error;
  }
}
