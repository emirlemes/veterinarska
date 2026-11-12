import type { Metadata } from "next";
import Link from "next/link";
import { Role } from "@prisma/client";
import { AppointmentForm } from "@/components/appointments/appointment-form";
import { appointmentListQuerySchema } from "@/features/appointments/validation";
import { defaultWorkingHours, workingHoursSchema } from "@/features/settings/validation";
import { requirePermission } from "@/lib/auth/require-permission";
import { getClinicDate } from "@/lib/dates";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Novi termin" };

function formatDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("bs-BA", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Sarajevo",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

export default async function NewAppointmentPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  await requirePermission("appointments:write");
  const params = await searchParams;
  const parsed = appointmentListQuerySchema.safeParse({
    date: params.date ?? getClinicDate(),
    status: "all",
  });
  const date = parsed.success ? parsed.data.date : getClinicDate();

  const [clients, animals, veterinarians, settings] = await Promise.all([
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
  ]);

  return (
    <main className="mx-auto w-full max-w-[1440px] px-4 pb-8 pt-5 sm:px-[34px] sm:pb-[42px] sm:pt-[31px]">
      <div className="mb-5 flex items-start justify-between gap-4 sm:mb-[25px] sm:items-end">
        <div>
          <p className="mb-[7px] text-[11px] font-[750] uppercase tracking-[0.7px] text-green">Raspored ambulante</p>
          <h1 className="m-0 text-[clamp(24px,3vw,30px)] tracking-[-0.9px]">Zakaži termin</h1>
          <p className="mt-2 text-sm text-muted">{formatDate(date)}</p>
        </div>
        <Link
          className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg border border-line bg-white px-3 text-sm font-semibold text-[#53645a] hover:bg-[#f7faf8]"
          href={`/appointments?date=${encodeURIComponent(date)}`}
        >
          Nazad
        </Link>
      </div>

      {!clients.length || !animals.length || !veterinarians.length ? (
        <section className="max-w-[760px] rounded-xl border border-line bg-white p-5 text-sm text-muted shadow-[0_2px_6px_rgb(34_62_47_/_2%)]">
          <h2 className="m-0 text-base font-semibold text-ink">Nedostaju podaci za zakazivanje</h2>
          <ul className="mb-0 mt-3 list-disc space-y-1 pl-5">
            {!clients.length ? <li>Nema aktivnih klijenata.</li> : null}
            {!animals.length ? <li>Nema aktivnih životinja povezanih s aktivnim klijentom.</li> : null}
            {!veterinarians.length ? <li>Nema aktivnih korisnika s ulogom veterinara.</li> : null}
          </ul>
        </section>
      ) : (
        <AppointmentForm
          clients={clients}
          animals={animals}
          veterinarians={veterinarians}
          date={date}
          durationMinutes={settings?.appointmentDurationMinutes ?? 30}
          workingHours={settings?.workingHours && workingHoursSchema.safeParse(settings.workingHours).success
            ? workingHoursSchema.parse(settings.workingHours)
            : defaultWorkingHours}
        />
      )}
    </main>
  );
}
