import { Prisma } from "@prisma/client";
import { z } from "zod";
import { examinationConflictResponse, examinationUpdateResponse, updateExamination } from "@/features/examinations/update";
import { authorizeApiRequest } from "@/lib/auth/authorize-api-request";
import { prisma } from "@/lib/db";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const authorization = await authorizeApiRequest("examinations:write");
  if (authorization.response) return authorization.response;
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) {
    return Response.json({ error: "Neispravan identifikator pregleda." }, { status: 400 });
  }
  const examination = await prisma.examination.findUnique({
    where: { id },
    select: {
      status: true,
      examinationDate: true,
      diagnosis: true,
      animal: { select: { id: true, name: true } },
      client: { select: { firstName: true, lastName: true, companyName: true } },
      veterinarian: { select: { firstName: true, lastName: true } },
      therapies: { select: { name: true }, orderBy: { createdAt: "asc" } },
      administrations: {
        select: { quantity: true, medication: { select: { name: true, unit: true } } },
        orderBy: { administeredAt: "asc" },
      },
      services: { select: { quantity: true, service: { select: { name: true } } } },
      invoice: { select: { id: true } },
    },
  });
  if (!examination) return Response.json({ error: "Pregled nije pronađen." }, { status: 404 });
  if (examination.status !== "IN_PROGRESS") {
    return Response.json({ error: "Pregled je već završen. Osvježite stranicu." }, { status: 409 });
  }
  return Response.json({
    animalId: examination.animal.id,
    animal: examination.animal.name,
    client: examination.client.companyName || `${examination.client.firstName} ${examination.client.lastName}`,
    veterinarian: `${examination.veterinarian.firstName} ${examination.veterinarian.lastName}`,
    date: examination.examinationDate.toISOString(),
    diagnosis: examination.diagnosis,
    therapies: examination.therapies.map((therapy) => therapy.name),
    medications: examination.administrations.map((entry) => `${entry.medication.name} — ${entry.quantity.toString()} ${entry.medication.unit}`),
    services: examination.services.map((entry) => `${entry.service.name} — ${entry.quantity.toString()}`),
    invoiceId: examination.invoice?.id ?? null,
  });
}

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const authorization = await authorizeApiRequest("examinations:write");
  if (authorization.response) return authorization.response;

  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) {
    return Response.json({ error: "Neispravan identifikator pregleda." }, { status: 400 });
  }
  try {
    const outcome = await prisma.$transaction(
      (transaction) => updateExamination(transaction, {
        id,
        userId: authorization.user.id,
        status: "COMPLETED",
      }),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return examinationUpdateResponse(outcome);
  } catch (error) {
    return examinationConflictResponse(error);
  }
}
