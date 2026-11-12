import { ExaminationStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { therapyInputSchema } from "@/features/examinations/validation";
import { authorizeApiRequest } from "@/lib/auth/authorize-api-request";
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

  const parsed = therapyInputSchema.safeParse(body);
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
          select: { id: true, status: true },
        });
        if (!examination) return { kind: "missing" as const };
        if (examination.status !== ExaminationStatus.IN_PROGRESS) {
          return { kind: "completed" as const };
        }

        const therapy = await transaction.therapy.create({
          data: {
            examinationId,
            name: parsed.data.name,
            dosage: parsed.data.dosage || null,
            frequency: parsed.data.frequency || null,
            duration: parsed.data.duration || null,
            instructions: parsed.data.instructions || null,
          },
        });
        await transaction.auditLog.create({
          data: {
            userId: authorization.user.id,
            action: "THERAPY_CREATED",
            entityType: "Therapy",
            entityId: therapy.id,
            details: { examinationId },
          },
        });
        return { kind: "created" as const, therapy };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (outcome.kind === "missing") {
      return Response.json({ error: "Pregled nije pronađen." }, { status: 404 });
    }
    if (outcome.kind === "completed") {
      return Response.json({ error: "Terapiju nije moguće mijenjati nakon završetka pregleda." }, { status: 409 });
    }
    return Response.json({ therapy: outcome.therapy }, { status: 201 });
  } catch (error) {
    if (isPrismaError(error, "P2034")) {
      return Response.json(
        { error: "Pregled je upravo izmijenjen. Osvježite stranicu i pokušajte ponovo." },
        { status: 409 },
      );
    }
    throw error;
  }
}
