import { ExaminationStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { examinationServiceInputSchema } from "@/features/examinations/validation";
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
  const authorization = await authorizeApiRequest("examinations:write");
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
  const parsed = examinationServiceInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Odaberite uslugu i unesite ispravnu količinu.", details: parsed.error.flatten().fieldErrors },
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
        if (!examination) return { kind: "missing-examination" as const };
        if (examination.status !== ExaminationStatus.IN_PROGRESS) {
          return { kind: "completed" as const };
        }

        const service = await transaction.service.findFirst({
          where: { id: parsed.data.serviceId, isActive: true },
          select: { id: true, name: true, price: true },
        });
        if (!service) return { kind: "missing-service" as const };

        const entry = await transaction.examinationService.create({
          data: {
            examinationId,
            serviceId: service.id,
            priceAtTime: service.price,
            quantity: new Prisma.Decimal(parsed.data.quantity),
          },
          select: { id: true, quantity: true, priceAtTime: true },
        });
        await transaction.auditLog.create({
          data: {
            userId: authorization.user.id,
            action: "EXAMINATION_SERVICE_ADDED",
            entityType: "ExaminationService",
            entityId: entry.id,
            details: {
              examinationId,
              serviceId: service.id,
              serviceName: service.name,
              quantity: entry.quantity.toString(),
              priceAtTime: entry.priceAtTime.toString(),
            },
          },
        });
        return {
          kind: "created" as const,
          service: {
            id: entry.id,
            serviceId: service.id,
            name: service.name,
            quantity: entry.quantity.toString(),
            priceAtTime: entry.priceAtTime.toString(),
          },
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (outcome.kind === "missing-examination") {
      return Response.json({ error: "Pregled nije pronađen." }, { status: 404 });
    }
    if (outcome.kind === "completed") {
      return Response.json({ error: "Usluge nije moguće mijenjati nakon završetka pregleda." }, { status: 409 });
    }
    if (outcome.kind === "missing-service") {
      return Response.json({ error: "Odabrana usluga nije aktivna. Osvježite cjenovnik." }, { status: 404 });
    }
    return Response.json({ service: outcome.service }, { status: 201 });
  } catch (error) {
    if (isPrismaError(error, "P2034")) {
      return Response.json({ error: "Pregled je upravo izmijenjen. Osvježite stranicu." }, { status: 409 });
    }
    throw error;
  }
}
