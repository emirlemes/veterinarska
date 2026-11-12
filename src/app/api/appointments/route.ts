import { AppointmentStatus, Prisma, Role } from "@prisma/client";
import { NextRequest } from "next/server";
import { appointmentInputSchema } from "@/features/appointments/validation";
import { authorizeApiRequest } from "@/lib/auth/authorize-api-request";
import { clinicDateTimeToUtc } from "@/lib/dates";
import {
  checkAppointmentWorkingHours,
  defaultWorkingHours,
} from "@/features/settings/validation";
import { prisma } from "@/lib/db";

function isPrismaError(error: unknown, code: string) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

export async function POST(request: NextRequest) {
  const authorization = await authorizeApiRequest("appointments:write");
  if (authorization.response) return authorization.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Tijelo zahtjeva nije ispravan JSON." }, { status: 400 });
  }

  const parsed = appointmentInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Provjerite unesene podatke.", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const startsAt = clinicDateTimeToUtc(parsed.data.startsAt);
  const endsAt = clinicDateTimeToUtc(parsed.data.endsAt);
  if (!startsAt || !endsAt || startsAt >= endsAt) {
    return Response.json(
      { error: "Vrijeme nije ispravno za vremensku zonu ambulante." },
      { status: 400 },
    );
  }

  try {
    const result = await prisma.$transaction(
      async (transaction) => {
        const [client, animal, veterinarian, settings] = await Promise.all([
          transaction.client.findFirst({
            where: { id: parsed.data.clientId, isActive: true },
            select: { id: true },
          }),
          transaction.animal.findFirst({
            where: {
              id: parsed.data.animalId,
              ownerId: parsed.data.clientId,
              status: "ACTIVE",
            },
            select: { id: true },
          }),
          transaction.user.findFirst({
            where: { id: parsed.data.veterinarianId, role: Role.VETERINARIAN, isActive: true },
            select: { id: true },
          }),
          transaction.clinicSettings.findUnique({
            where: { id: "default" },
            select: { workingHours: true },
          }),
        ]);

        const workingHoursResult = checkAppointmentWorkingHours(
          parsed.data.startsAt,
          parsed.data.endsAt,
          settings?.workingHours ?? defaultWorkingHours,
        );
        if (workingHoursResult === "invalid-settings") {
          return {
            kind: "invalid" as const,
            error: "Radno vrijeme ambulante nije ispravno podešeno. Obratite se administratoru.",
          };
        }
        if (workingHoursResult === "closed") {
          return { kind: "invalid" as const, error: "Ambulanta ne radi na odabrani dan." };
        }
        if (workingHoursResult === "outside-hours") {
          return { kind: "invalid" as const, error: "Termin mora biti unutar radnog vremena ambulante i istog dana." };
        }

        if (!client) {
          return { kind: "invalid" as const, error: "Odabrani klijent ne postoji ili je arhiviran." };
        }
        if (!animal) {
          return {
            kind: "invalid" as const,
            error: "Životinja nije aktivna ili ne pripada odabranom klijentu.",
          };
        }
        if (!veterinarian) {
          return { kind: "invalid" as const, error: "Odabrani veterinar nije aktivan." };
        }

        const conflict = await transaction.appointment.findFirst({
          where: {
            veterinarianId: veterinarian.id,
            status: { notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW] },
            startsAt: { lt: endsAt },
            endsAt: { gt: startsAt },
          },
          select: { id: true },
        });
        if (conflict) {
          return { kind: "conflict" as const, error: "Veterinar već ima termin u odabranom vremenu." };
        }

        const appointment = await transaction.appointment.create({
          data: {
            clientId: client.id,
            animalId: animal.id,
            veterinarianId: veterinarian.id,
            startsAt,
            endsAt,
            reason: parsed.data.reason,
            notes: parsed.data.notes || null,
          },
          select: { id: true },
        });

        await transaction.auditLog.create({
          data: {
            userId: authorization.user.id,
            action: "APPOINTMENT_CREATED",
            entityType: "Appointment",
            entityId: appointment.id,
          },
        });

        return { kind: "created" as const, id: appointment.id };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (result.kind === "invalid") {
      return Response.json({ error: result.error }, { status: 400 });
    }
    if (result.kind === "conflict") {
      return Response.json({ error: result.error }, { status: 409 });
    }

    return Response.json({ id: result.id }, { status: 201 });
  } catch (error) {
    if (isPrismaError(error, "P2034")) {
      return Response.json(
        { error: "Termin je upravo zauzet. Osvježite raspored i pokušajte ponovo." },
        { status: 409 },
      );
    }
    throw error;
  }
}
