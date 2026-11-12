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
  context: { params: Promise<{ id: string; serviceEntryId: string }> },
) {
  const authorization = await authorizeApiRequest("examinations:write");
  if (authorization.response) return authorization.response;

  const { id: examinationId, serviceEntryId } = await context.params;
  if (!idSchema.safeParse(examinationId).success || !idSchema.safeParse(serviceEntryId).success) {
    return Response.json({ error: "Neispravan identifikator usluge ili pregleda." }, { status: 400 });
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

        const entry = await transaction.examinationService.findFirst({
          where: { id: serviceEntryId, examinationId },
          select: { id: true, service: { select: { name: true } }, quantity: true, priceAtTime: true },
        });
        if (!entry) return "missing-entry" as const;

        const deleted = await transaction.examinationService.deleteMany({
          where: { id: entry.id, examinationId },
        });
        if (deleted.count !== 1) return "conflict" as const;

        await transaction.auditLog.create({
          data: {
            userId: authorization.user.id,
            action: "EXAMINATION_SERVICE_REMOVED",
            entityType: "ExaminationService",
            entityId: entry.id,
            details: {
              examinationId,
              serviceName: entry.service.name,
              quantity: entry.quantity.toString(),
              priceAtTime: entry.priceAtTime.toString(),
            },
          },
        });
        return "deleted" as const;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (outcome === "missing-examination") {
      return Response.json({ error: "Pregled nije pronađen." }, { status: 404 });
    }
    if (outcome === "missing-entry") {
      return Response.json({ error: "Izvršena usluga nije pronađena." }, { status: 404 });
    }
    if (outcome === "completed") {
      return Response.json({ error: "Usluge nije moguće mijenjati nakon završetka pregleda." }, { status: 409 });
    }
    if (outcome === "conflict") {
      return Response.json({ error: "Usluga je upravo izmijenjena. Osvježite stranicu." }, { status: 409 });
    }
    return Response.json({ success: true });
  } catch (error) {
    if (isPrismaError(error, "P2034")) {
      return Response.json({ error: "Pregled je upravo izmijenjen. Osvježite stranicu." }, { status: 409 });
    }
    throw error;
  }
}
