import { AppointmentStatus, Prisma, Role } from "@prisma/client";
import { NextRequest } from "next/server";
import {
  examinationInputSchema,
  examinationUpdateSchema,
} from "@/features/examinations/validation";
import { examinationConflictResponse, examinationUpdateResponse, updateExamination } from "@/features/examinations/update";
import { authorizeApiRequest } from "@/lib/auth/authorize-api-request";
import { prisma } from "@/lib/db";

function isPrismaError(error: unknown, code: string) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

export async function POST(request: NextRequest) {
  const authorization = await authorizeApiRequest("examinations:write");
  if (authorization.response) return authorization.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Tijelo zahtjeva nije ispravan JSON." }, { status: 400 });
  }

  const parsed = examinationInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Provjerite unesene podatke.", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const input = parsed.data;
  try {
    const outcome = await prisma.$transaction(
      async (transaction) => {
        const client = await transaction.client.findFirst({
          where: { id: input.clientId, isActive: true },
          select: { id: true },
        });
        if (!client) {
          return { kind: "invalid" as const, error: "Klijent ne postoji ili je arhiviran." };
        }

        const animal = await transaction.animal.findFirst({
          where: {
            id: input.animalId,
            ownerId: client.id,
            status: "ACTIVE",
          },
          select: { id: true },
        });
        if (!animal) {
          return {
            kind: "invalid" as const,
            error: "Životinja nije aktivna ili ne pripada odabranom klijentu.",
          };
        }

        let veterinarianId = input.veterinarianId || authorization.user.id;
        if (input.appointmentId) {
          const appointment = await transaction.appointment.findUnique({
            where: { id: input.appointmentId },
            select: {
              id: true,
              clientId: true,
              animalId: true,
              veterinarianId: true,
              status: true,
              examination: { select: { id: true } },
            },
          });
          if (!appointment) {
            return { kind: "missing-appointment" as const };
          }
          if (
            appointment.clientId !== client.id ||
            appointment.animalId !== animal.id ||
            ![
              AppointmentStatus.SCHEDULED,
              AppointmentStatus.CONFIRMED,
              AppointmentStatus.IN_PROGRESS,
            ].some((status) => status === appointment.status)
          ) {
            return {
              kind: "invalid" as const,
              error: "Termin ne odgovara odabranom klijentu/životinji ili nije aktivan.",
            };
          }
          if (appointment.examination) {
            return { kind: "duplicate" as const, examinationId: appointment.examination.id };
          }
          veterinarianId = appointment.veterinarianId;
        }

        const veterinarian = await transaction.user.findFirst({
          where: { id: veterinarianId, role: Role.VETERINARIAN, isActive: true },
          select: { id: true },
        });
        if (!veterinarian) {
          return { kind: "invalid" as const, error: "Odabrani veterinar nije aktivan." };
        }

        if (input.appointmentId) {
          const appointment = await transaction.appointment.findUniqueOrThrow({
            where: { id: input.appointmentId },
            select: { status: true },
          });
          if (appointment.status === AppointmentStatus.SCHEDULED || appointment.status === AppointmentStatus.CONFIRMED) {
            const moved = await transaction.appointment.updateMany({
              where: {
                id: input.appointmentId,
                status: { in: [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED] },
              },
              data: { status: AppointmentStatus.IN_PROGRESS },
            });
            if (moved.count !== 1) return { kind: "conflict" as const };
          }
        }

        const examination = await transaction.examination.create({
          data: {
            clientId: client.id,
            animalId: animal.id,
            appointmentId: input.appointmentId || null,
            veterinarianId: veterinarian.id,
            chiefComplaint: input.chiefComplaint || null,
            symptoms: input.symptoms || null,
            diagnosis: input.diagnosis || null,
            treatmentPlan: input.treatmentPlan || null,
            notes: input.notes || null,
          },
          select: { id: true },
        });

        await transaction.auditLog.create({
          data: {
            userId: authorization.user.id,
            action: "EXAMINATION_CREATED",
            entityType: "Examination",
            entityId: examination.id,
            details: { appointmentId: input.appointmentId || null },
          },
        });
        return { kind: "created" as const, id: examination.id };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (outcome.kind === "invalid") {
      return Response.json({ error: outcome.error }, { status: 400 });
    }
    if (outcome.kind === "missing-appointment") {
      return Response.json({ error: "Termin nije pronađen." }, { status: 404 });
    }
    if (outcome.kind === "duplicate") {
      return Response.json(
        {
          error: "Za ovaj termin pregled već postoji.",
          id: outcome.examinationId,
        },
        { status: 409 },
      );
    }
    if (outcome.kind === "conflict") {
      return Response.json(
        { error: "Status termina je upravo izmijenjen. Osvježite stranicu." },
        { status: 409 },
      );
    }
    return Response.json({ id: outcome.id }, { status: 201 });
  } catch (error) {
    if (isPrismaError(error, "P2002")) {
      return Response.json({ error: "Za ovaj termin pregled već postoji." }, { status: 409 });
    }
    if (isPrismaError(error, "P2034")) {
      return Response.json(
        { error: "Podaci su upravo izmijenjeni. Osvježite stranicu i pokušajte ponovo." },
        { status: 409 },
      );
    }
    throw error;
  }
}

export async function PATCH(request: NextRequest) {
  const authorization = await authorizeApiRequest("examinations:write");
  if (authorization.response) return authorization.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Tijelo zahtjeva nije ispravan JSON." }, { status: 400 });
  }

  const parsed = examinationUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Provjerite unesene podatke.", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  if (parsed.data.appointmentId) {
    return Response.json(
      { error: "Postojeći pregled ne može se povezati s drugim terminom." },
      { status: 400 },
    );
  }

  const { id } = parsed.data;
  const input = parsed.data;
  try {
    const outcome = await prisma.$transaction(
      (transaction) => updateExamination(transaction, {
        id,
        userId: authorization.user.id,
        status: input.status,
        clinical: input,
      }),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return examinationUpdateResponse(outcome);
  } catch (error) {
    return examinationConflictResponse(error);
  }
}
