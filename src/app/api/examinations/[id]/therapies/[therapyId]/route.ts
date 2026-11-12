import { ExaminationStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { authorizeApiRequest } from "@/lib/auth/authorize-api-request";
import { prisma } from "@/lib/db";

const idSchema = z.string().uuid();

function isPrismaError(error: unknown, code: string) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; therapyId: string }> },
) {
  const authorization = await authorizeApiRequest("therapies:write");
  if (authorization.response) return authorization.response;

  const { id: examinationId, therapyId } = await context.params;
  if (!idSchema.safeParse(examinationId).success || !idSchema.safeParse(therapyId).success) {
    return Response.json({ error: "Neispravan identifikator terapije ili pregleda." }, { status: 400 });
  }

  try {
    const outcome = await prisma.$transaction(
      async (transaction) => {
        const examination = await transaction.examination.findUnique({
          where: { id: examinationId },
          select: { status: true },
        });
        if (!examination) return "missing-examination" as const;
        if (examination.status !== ExaminationStatus.IN_PROGRESS) return "completed" as const;

        const therapy = await transaction.therapy.findFirst({
          where: { id: therapyId, examinationId },
          select: { id: true, name: true },
        });
        if (!therapy) return "missing-therapy" as const;

        const deleted = await transaction.therapy.deleteMany({
          where: { id: therapy.id, examinationId },
        });
        if (deleted.count !== 1) return "conflict" as const;

        await transaction.auditLog.create({
          data: {
            userId: authorization.user.id,
            action: "THERAPY_DELETED",
            entityType: "Therapy",
            entityId: therapy.id,
            details: { examinationId, name: therapy.name },
          },
        });
        return "deleted" as const;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (outcome === "missing-examination") {
      return Response.json({ error: "Pregled nije pronađen." }, { status: 404 });
    }
    if (outcome === "missing-therapy") {
      return Response.json({ error: "Terapija nije pronađena." }, { status: 404 });
    }
    if (outcome === "completed") {
      return Response.json({ error: "Terapiju nije moguće mijenjati nakon završetka pregleda." }, { status: 409 });
    }
    if (outcome === "conflict") {
      return Response.json({ error: "Terapija je upravo izmijenjena. Osvježite stranicu." }, { status: 409 });
    }
    return Response.json({ success: true });
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
