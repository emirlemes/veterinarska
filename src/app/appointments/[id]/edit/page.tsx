import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Role } from "@prisma/client";
import { AppointmentForm } from "@/components/appointments/appointment-form";
import { defaultWorkingHours, workingHoursSchema } from "@/features/settings/validation";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Uredi termin" };

const clinicDateTimeFormatter = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Sarajevo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function formatClinicDateTime(value: Date) {
  const parts = Object.fromEntries(
    clinicDateTimeFormatter
      .formatToParts(value)
      .map(({ type, value: partValue }) => [type, partValue]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export default async function EditAppointmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("appointments:write");
  const { id } = await params;
  const appointment = await prisma.appointment.findUnique({
    where: { id },
    include: {
      client: {
        select: { id: true, firstName: true, lastName: true, companyName: true, isActive: true },
      },
      animal: { select: { id: true, name: true, species: true, ownerId: true, status: true } },
      veterinarian: { select: { id: true, firstName: true, lastName: true, isActive: true } },
      examination: { select: { id: true } },
    },
  });
  if (!appointment) notFound();

  const canEdit =
    (appointment.status === "SCHEDULED" || appointment.status === "CONFIRMED") &&
    !appointment.examination;
  const [activeClients, activeAnimals, activeVeterinarians, settings] = canEdit
    ? await Promise.all([
        prisma.client.findMany({
          where: { isActive: true },
          orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
          select: { id: true, firstName: true, lastName: true, companyName: true },
        }),
        prisma.animal.findMany({
          where: { status: "ACTIVE", owner: { isActive: true } },
          orderBy: [{ name: "asc" }, { id: "asc" }],
          select: { id: true, name: true, species: true, ownerId: true },
        }),
        prisma.user.findMany({
          where: { role: Role.VETERINARIAN, isActive: true },
          orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
          select: { id: true, firstName: true, lastName: true },
        }),
        prisma.clinicSettings.findUnique({
          where: { id: "default" },
          select: { appointmentDurationMinutes: true, workingHours: true },
        }),
      ])
    : [[], [], [], null];

  const clients = activeClients.some((client) => client.id === appointment.clientId)
    ? activeClients
    : [
        ...activeClients,
        {
          id: appointment.client.id,
          firstName: appointment.client.firstName,
          lastName: appointment.client.lastName,
          companyName: appointment.client.companyName,
          inactive: true,
        },
      ];
  const animals = activeAnimals.some((animal) => animal.id === appointment.animalId)
    ? activeAnimals
    : [
        ...activeAnimals,
        {
          id: appointment.animal.id,
          name: appointment.animal.name,
          species: appointment.animal.species,
          ownerId: appointment.animal.ownerId,
          inactive: true,
        },
      ];
  const veterinarians = activeVeterinarians.some(
    (veterinarian) => veterinarian.id === appointment.veterinarianId,
  )
    ? activeVeterinarians
    : [
        ...activeVeterinarians,
        {
          id: appointment.veterinarian.id,
          firstName: appointment.veterinarian.firstName,
          lastName: appointment.veterinarian.lastName,
        },
      ];

  return (
    <main className="mx-auto w-full max-w-[1440px] px-4 pb-8 pt-5 sm:px-[34px] sm:pb-[42px] sm:pt-[31px]">
      <div className="mb-5 flex items-start justify-between gap-4 sm:mb-[25px] sm:items-end">
        <div>
          <p className="mb-[7px] text-[11px] font-[750] uppercase tracking-[0.7px] text-green">Raspored ambulante</p>
          <h1 className="m-0 text-[clamp(24px,3vw,30px)] tracking-[-0.9px]">Uredi termin</h1>
          <p className="mt-2 text-sm text-muted">
            {appointment.animal.name} · {formatClinicDateTime(appointment.startsAt).replace("T", " ")}
          </p>
        </div>
        <Link
          className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg border border-line bg-white px-3 text-sm font-semibold text-[#53645a] hover:bg-[#f7faf8]"
          href={`/appointments?date=${encodeURIComponent(formatClinicDateTime(appointment.startsAt).slice(0, 10))}`}
        >
          Nazad
        </Link>
      </div>

      {canEdit ? (
        <AppointmentForm
          clients={clients}
          animals={animals}
          veterinarians={veterinarians}
          date={formatClinicDateTime(appointment.startsAt).slice(0, 10)}
          durationMinutes={settings?.appointmentDurationMinutes ?? 30}
          workingHours={settings?.workingHours && workingHoursSchema.safeParse(settings.workingHours).success
            ? workingHoursSchema.parse(settings.workingHours)
            : defaultWorkingHours}
          appointment={{
            id: appointment.id,
            clientId: appointment.clientId,
            animalId: appointment.animalId,
            veterinarianId: appointment.veterinarianId,
            startsAt: formatClinicDateTime(appointment.startsAt),
            endsAt: formatClinicDateTime(appointment.endsAt),
            reason: appointment.reason,
            notes: appointment.notes,
          }}
        />
      ) : (
        <section className="max-w-[760px] rounded-xl border border-line bg-white p-5 text-sm text-muted">
          <h2 className="m-0 text-base font-semibold text-ink">Ovaj termin nije moguće uređivati</h2>
          <p className="mb-0 mt-2">
            Uređivati se mogu samo zakazani ili potvrđeni termini bez povezanog pregleda.
          </p>
        </section>
      )}
    </main>
  );
}
