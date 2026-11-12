import { Prisma } from "@prisma/client";
import { z } from "zod";
import {
  appointmentUpdateSchema,
  appointmentStatusSchema,
  canTransitionAppointment,
  type AppointmentStatusValue,
} from "@/features/appointments/validation";
import { authorizeApiRequest } from "@/lib/auth/authorize-api-request";
import { clinicDateTimeToUtc } from "@/lib/dates";
import {
  checkAppointmentWorkingHours,
  defaultWorkingHours,
} from "@/features/settings/validation";
import { prisma } from "@/lib/db";

const idSchema = z.string().uuid();

function isPrismaError(error: unknown, code: string) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authorization = await authorizeApiRequest("appointments:write");
  if (authorization.response) return authorization.response;

  const { id } = await context.params;
  if (!idSchema.safeParse(id).success) {
    return Response.json({ error: "Neispravan identifikator termina." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Tijelo zahtjeva nije ispravan JSON." }, { status: 400 });
  }

  const statusParsed = appointmentStatusSchema.safeParse(body);
  if (!statusParsed.success) {
    const updateParsed = appointmentUpdateSchema.safeParse(body);
    if (!updateParsed.success) {
      return Response.json(
        { error: "Provjerite unesene podatke.", details: updateParsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const startsAt = clinicDateTimeToUtc(updateParsed.data.startsAt);
    const endsAt = clinicDateTimeToUtc(updateParsed.data.endsAt);
    if (!startsAt || !endsAt || startsAt >= endsAt) {
      return Response.json(
        { error: "Vrijeme nije ispravno za vremensku zonu ambulante." },
        { status: 400 },
      );
    }

    try {
      const outcome = await prisma.$transaction(
        async (transaction) => {
          const appointment = await transaction.appointment.findUnique({
            where: { id },
            select: {
              id: true,
              status: true,
              startsAt: true,
              endsAt: true,
              updatedAt: true,
              clientId: true,
              animalId: true,
              veterinarianId: true,
              reason: true,
              notes: true,
              examination: { select: { id: true } },
            },
          });
          if (!appointment) return { kind: "missing" as const };
          if (
            appointment.status !== "SCHEDULED" &&
            appointment.status !== "CONFIRMED"
          ) {
            return { kind: "locked" as const };
          }
          if (appointment.examination) return { kind: "has-examination" as const };

          const [client, animal, veterinarian, settings] = await Promise.all([
            transaction.client.findFirst({
              where: { id: updateParsed.data.clientId, isActive: true },
              select: { id: true },
            }),
            transaction.animal.findFirst({
              where: {
                id: updateParsed.data.animalId,
                ownerId: updateParsed.data.clientId,
                status: "ACTIVE",
              },
              select: { id: true },
            }),
            transaction.user.findFirst({
              where: {
                id: updateParsed.data.veterinarianId,
                role: "VETERINARIAN",
                isActive: true,
              },
              select: { id: true },
            }),
            transaction.clinicSettings.findUnique({
              where: { id: "default" },
              select: { workingHours: true },
            }),
          ]);

          const workingHoursResult = checkAppointmentWorkingHours(
            updateParsed.data.startsAt,
            updateParsed.data.endsAt,
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
            return {
              kind: "invalid" as const,
              error: "Termin mora biti unutar radnog vremena ambulante i istog dana.",
            };
          }
          if (!client) {
            return {
              kind: "invalid" as const,
              error: "Odabrani klijent ne postoji ili je arhiviran.",
            };
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
              id: { not: id },
              veterinarianId: veterinarian.id,
              status: { notIn: ["CANCELLED", "NO_SHOW"] },
              startsAt: { lt: endsAt },
              endsAt: { gt: startsAt },
            },
            select: { id: true },
          });
          if (conflict) return { kind: "conflict" as const };

          const changed = await transaction.appointment.updateMany({
            where: {
              id,
              status: appointment.status,
              updatedAt: appointment.updatedAt,
            },
            data: {
              clientId: client.id,
              animalId: animal.id,
              veterinarianId: veterinarian.id,
              startsAt,
              endsAt,
              reason: updateParsed.data.reason,
              notes: updateParsed.data.notes || null,
            },
          });
          if (changed.count !== 1) return { kind: "stale" as const };

          await transaction.auditLog.create({
            data: {
              userId: authorization.user.id,
              action: "APPOINTMENT_UPDATED",
              entityType: "Appointment",
              entityId: id,
              details: {
                previous: {
                  clientId: appointment.clientId,
                  animalId: appointment.animalId,
                  veterinarianId: appointment.veterinarianId,
                  startsAt: appointment.startsAt.toISOString(),
                  endsAt: appointment.endsAt.toISOString(),
                  reason: appointment.reason,
                  notes: appointment.notes,
                },
                next: {
                  clientId: client.id,
                  animalId: animal.id,
                  veterinarianId: veterinarian.id,
                  startsAt: startsAt.toISOString(),
                  endsAt: endsAt.toISOString(),
                  reason: updateParsed.data.reason,
                  notes: updateParsed.data.notes || null,
                },
              },
            },
          });
          return { kind: "updated" as const };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      if (outcome.kind === "missing") {
        return Response.json({ error: "Termin nije pronađen." }, { status: 404 });
      }
      if (outcome.kind === "locked") {
        return Response.json(
          { error: "Moguće je uređivati samo zakazane ili potvrđene termine." },
          { status: 409 },
        );
      }
      if (outcome.kind === "has-examination") {
        return Response.json(
          { error: "Termin s otvorenim pregledom nije moguće uređivati." },
          { status: 409 },
        );
      }
      if (outcome.kind === "invalid") {
        return Response.json({ error: outcome.error }, { status: 400 });
      }
      if (outcome.kind === "conflict") {
        return Response.json(
          { error: "Veterinar već ima termin u odabranom vremenu." },
          { status: 409 },
        );
      }
      if (outcome.kind === "stale") {
        return Response.json({ error: "Termin je u međuvremenu izmijenjen." }, { status: 409 });
      }
      return Response.json({ success: true });
    } catch (error) {
      if (isPrismaError(error, "P2034")) {
        return Response.json(
          { error: "Termin je upravo izmijenjen. Osvježite raspored i pokušajte ponovo." },
          { status: 409 },
        );
      }
      throw error;
    }
  }

  try {
    const outcome = await prisma.$transaction(
      async (transaction) => {
        const appointment = await transaction.appointment.findUnique({
          where: { id },
          select: { id: true, status: true },
        });
        if (!appointment) return "missing";

        if (
          !canTransitionAppointment(
            appointment.status as AppointmentStatusValue,
            statusParsed.data.status,
          )
        ) {
          return "invalid-transition";
        }

        const changed = await transaction.appointment.updateMany({
          where: { id, status: appointment.status },
          data: { status: statusParsed.data.status },
        });
        if (changed.count !== 1) return "conflict";

        await transaction.auditLog.create({
          data: {
            userId: authorization.user.id,
            action: `APPOINTMENT_${statusParsed.data.status}`,
            entityType: "Appointment",
            entityId: id,
            details: { previousStatus: appointment.status, newStatus: statusParsed.data.status },
          },
        });
        return "updated";
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (outcome === "missing") {
      return Response.json({ error: "Termin nije pronađen." }, { status: 404 });
    }
    if (outcome === "invalid-transition") {
      return Response.json({ error: "Ova promjena statusa nije dozvoljena." }, { status: 409 });
    }
    if (outcome === "conflict") {
      return Response.json({ error: "Termin je u međuvremenu izmijenjen." }, { status: 409 });
    }
    return Response.json({ success: true });
  } catch (error) {
    if (isPrismaError(error, "P2034")) {
      return Response.json({ error: "Termin je u međuvremenu izmijenjen." }, { status: 409 });
    }
    throw error;
  }
}
