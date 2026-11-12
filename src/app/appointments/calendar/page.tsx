import type { Metadata } from "next";
import Link from "next/link";
import { AppointmentStatus, Prisma, Role } from "@prisma/client";
import { AppointmentCard } from "@/components/appointments/appointment-card";
import { AppointmentStatusBadge } from "@/components/appointments/appointment-status-control";
import { appointmentCalendarQuerySchema } from "@/features/appointments/validation";
import {
  getAppointmentMonthDates,
  getAppointmentWeekDates,
} from "@/features/appointments/calendar";
import { hasPermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { getClinicDate, getClinicDateBounds } from "@/lib/dates";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Kalendar termina" };

const statusLabels: Record<AppointmentStatus, string> = {
  SCHEDULED: "Zakazan",
  CONFIRMED: "Potvrđen",
  IN_PROGRESS: "U toku",
  COMPLETED: "Završen",
  CANCELLED: "Otkazan",
  NO_SHOW: "Nije došao",
};

const dateKeyFormatter = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Sarajevo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function shiftDate(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
}

function shiftMonth(date: string, months: number) {
  const [year, month] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1 + months, 1)).toISOString().slice(0, 10);
}

function formatTime(value: Date) {
  return new Intl.DateTimeFormat("bs-BA", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Sarajevo",
  }).format(value);
}

function formatDay(date: string, options: Intl.DateTimeFormatOptions) {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("bs-BA", {
    ...options,
    timeZone: "Europe/Sarajevo",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

export default async function AppointmentCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; status?: string; veterinarianId?: string; view?: string }>;
}) {
  const user = await requirePermission("appointments:read");
  const canWrite = hasPermission(user.role, "appointments:write");
  const canWriteExaminations = hasPermission(user.role, "examinations:write");
  const params = await searchParams;
  const parsed = appointmentCalendarQuerySchema.safeParse({
    date: params.date ?? getClinicDate(),
    status: params.status ?? "all",
    veterinarianId: params.veterinarianId ?? "all",
    view: params.view ?? "week",
  });
  const filters = parsed.success
    ? parsed.data
    : {
        date: getClinicDate(),
        status: "all" as const,
        veterinarianId: "all",
        search: "",
        view: "week" as const,
      };
  const weekDates = getAppointmentWeekDates(filters.date);
  if (!weekDates) throw new Error(`Neispravan datum kalendara: ${filters.date}`);
  const monthDates = filters.view === "month" ? getAppointmentMonthDates(filters.date) : null;
  if (filters.view === "month" && !monthDates) {
    throw new Error(`Neispravan mjesec kalendara: ${filters.date}`);
  }
  const calendarDates = monthDates ?? weekDates;

  const firstDay = getClinicDateBounds(calendarDates[0]);
  const afterLastDay = getClinicDateBounds(shiftDate(calendarDates[calendarDates.length - 1], 1));
  if (!firstDay || !afterLastDay) throw new Error("Nije moguće odrediti granice kalendara.");

  const where: Prisma.AppointmentWhereInput = {
    startsAt: { gte: firstDay.start, lt: afterLastDay.start },
  };
  if (filters.status !== "all") where.status = filters.status;
  if (filters.veterinarianId !== "all") where.veterinarianId = filters.veterinarianId;

  const [appointments, veterinarians] = await Promise.all([
    prisma.appointment.findMany({
      where,
      include: {
        client: {
          select: { id: true, firstName: true, lastName: true, companyName: true, phone: true },
        },
        animal: { select: { id: true, name: true, species: true } },
        veterinarian: { select: { firstName: true, lastName: true } },
        examination: { select: { id: true } },
      },
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
    }),
    prisma.user.findMany({
      where: { role: Role.VETERINARIAN, isActive: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true },
    }),
  ]);

  const appointmentsByDate = new Map<string, typeof appointments>();
  for (const appointment of appointments) {
    const date = dateKeyFormatter.format(appointment.startsAt);
    const items = appointmentsByDate.get(date) ?? [];
    items.push(appointment);
    appointmentsByDate.set(date, items);
  }

  function calendarHref(date: string, view = filters.view) {
    const query = new URLSearchParams({
      date,
      status: filters.status,
      veterinarianId: filters.veterinarianId,
      view,
    });
    return `/appointments/calendar?${query.toString()}`;
  }

  const rangeLabel = filters.view === "month"
    ? formatDay(filters.date, { month: "long", year: "numeric" })
    : `${formatDay(weekDates[0], { day: "numeric", month: "long" })} – ${formatDay(
        weekDates[6],
        { day: "numeric", month: "long", year: "numeric" },
      )}`;
  const previousPeriod = filters.view === "month"
    ? shiftMonth(filters.date, -1)
    : shiftDate(weekDates[0], -7);
  const nextPeriod = filters.view === "month"
    ? shiftMonth(filters.date, 1)
    : shiftDate(weekDates[0], 7);
  const monthKey = filters.date.slice(0, 7);

  return (
    <main className="mx-auto w-full max-w-[1440px] px-4 pb-8 pt-5 sm:px-[34px] sm:pb-[42px] sm:pt-[31px]">
      <div className="mb-5 flex flex-col gap-4 sm:mb-[25px] sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-[7px] text-[11px] font-[750] uppercase tracking-[0.7px] text-green">Raspored ambulante</p>
          <h1 className="m-0 text-[clamp(24px,3vw,30px)] tracking-[-0.9px]">
            {filters.view === "month" ? "Mjesečni kalendar" : "Sedmični kalendar"}
          </h1>
          <p className="mt-2 text-sm capitalize text-muted">{rangeLabel}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-line bg-white px-4 text-sm font-bold text-[#53645a] hover:bg-[#f7faf8]"
            href={calendarHref(filters.date, filters.view === "week" ? "month" : "week")}
          >
            {filters.view === "month" ? "Sedmični prikaz" : "Mjesečni prikaz"}
          </Link>
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-line bg-white px-4 text-sm font-bold text-[#53645a] hover:bg-[#f7faf8]"
            href={`/appointments?date=${encodeURIComponent(filters.date)}`}
          >
            Dnevni raspored
          </Link>
          {canWrite ? (
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-green px-4 text-sm font-bold text-white hover:bg-green-dark"
              href={`/appointments/new?date=${encodeURIComponent(filters.date)}`}
            >
              + Zakaži termin
            </Link>
          ) : null}
        </div>
      </div>

      <section className="min-w-0 rounded-xl border border-line bg-white p-3 shadow-[0_2px_6px_rgb(34_62_47_/_2%)] sm:p-5">
        <form
          className="grid grid-cols-1 gap-3 border-b border-line pb-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
          action="/appointments/calendar"
          method="get"
        >
          <label className="grid gap-1.5 text-xs font-semibold text-muted">
            Datum
            <input
              className="h-11 w-full rounded-lg border border-[#dce4de] bg-white px-3 text-sm text-ink focus:border-green focus:outline-none focus:ring-2 focus:ring-green/15"
              type="date"
              name="date"
              defaultValue={filters.date}
              required
            />
          </label>
          <input type="hidden" name="view" value={filters.view} />
          <label className="grid gap-1.5 text-xs font-semibold text-muted">
            Veterinar
            <select
              className="h-11 w-full rounded-lg border border-[#dce4de] bg-white px-3 text-sm text-ink focus:border-green focus:outline-none focus:ring-2 focus:ring-green/15"
              name="veterinarianId"
              defaultValue={filters.veterinarianId}
            >
              <option value="all">Svi veterinari</option>
              {veterinarians.map((veterinarian) => (
                <option key={veterinarian.id} value={veterinarian.id}>
                  Dr. {veterinarian.firstName} {veterinarian.lastName}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-muted">
            Status
            <select
              className="h-11 w-full rounded-lg border border-[#dce4de] bg-white px-3 text-sm text-ink focus:border-green focus:outline-none focus:ring-2 focus:ring-green/15"
              name="status"
              defaultValue={filters.status}
            >
              <option value="all">Svi statusi</option>
              {Object.entries(statusLabels).map(([status, label]) => (
                <option key={status} value={status}>{label}</option>
              ))}
            </select>
          </label>
          <button className="h-11 rounded-lg border border-line bg-white px-4 text-sm font-bold text-[#53645a] hover:bg-[#f7faf8]" type="submit">
            Prikaži
          </button>
        </form>

        <div className="flex items-center justify-between gap-3 py-4">
          <Link
            className="inline-flex min-h-10 items-center rounded-lg border border-line px-3 text-sm font-semibold text-[#53645a] hover:bg-[#f7faf8]"
            href={calendarHref(previousPeriod)}
          >
            ← <span className="ml-1 hidden sm:inline">
              {filters.view === "month" ? "Prethodni mjesec" : "Prethodna sedmica"}
            </span>
          </Link>
          <span className="text-xs font-medium text-muted">{appointments.length} termina</span>
          <Link
            className="inline-flex min-h-10 items-center rounded-lg border border-line px-3 text-sm font-semibold text-[#53645a] hover:bg-[#f7faf8]"
            href={calendarHref(nextPeriod)}
          >
            <span className="mr-1 hidden sm:inline">
              {filters.view === "month" ? "Sljedeći mjesec" : "Sljedeća sedmica"}
            </span> →
          </Link>
        </div>

        {!parsed.success ? (
          <p className="mb-3 rounded-lg bg-[#fbefee] px-3 py-2.5 text-xs text-[#a43e3c]" role="alert">
            Filter nije ispravan. Prikazana je aktuelna sedmica.
          </p>
        ) : null}

        <div className="space-y-4 md:hidden">
          {calendarDates.map((date) => {
            if (filters.view === "month" && date.slice(0, 7) !== monthKey) return null;
            const dayAppointments = appointmentsByDate.get(date) ?? [];
            return (
              <section className="rounded-lg border border-line p-3" key={date}>
                <div className="mb-3 flex items-baseline justify-between gap-3">
                  <h2 className="m-0 text-sm font-bold capitalize">{formatDay(date, { weekday: "long", day: "numeric", month: "long" })}</h2>
                  <Link className="text-xs font-semibold text-green-dark hover:underline" href={`/appointments?date=${date}`}>
                    Dnevni prikaz
                  </Link>
                </div>
                {dayAppointments.length ? (
                  <div className="space-y-3">
                    {dayAppointments.map((appointment) => (
                      <AppointmentCard
                        key={appointment.id}
                        appointment={appointment}
                        canWrite={canWrite}
                        canWriteExaminations={canWriteExaminations}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="m-0 py-2 text-sm text-muted">Nema termina.</p>
                )}
              </section>
            );
          })}
        </div>

        <div
          className={`hidden grid-cols-7 gap-2 md:grid ${
            filters.view === "month"
              ? calendarDates.length === 35
                ? "grid-rows-5"
                : "grid-rows-6"
              : ""
          }`}
        >
          {calendarDates.map((date) => {
            const dayAppointments = appointmentsByDate.get(date) ?? [];
            return (
              <section
                className={`min-w-0 rounded-lg border p-2 ${
                  filters.view === "month" && date.slice(0, 7) !== monthKey
                    ? "border-[#eef1ef] bg-[#f7f8f7] text-muted"
                    : "border-line bg-[#fbfcfb]"
                }`}
                key={date}
              >
                <div className="mb-2 min-h-12 border-b border-line pb-2">
                  {filters.view === "week" ? (
                    <>
                      <h2 className="m-0 text-xs font-bold capitalize">{formatDay(date, { weekday: "short" })}</h2>
                      <p className="m-0 text-xs text-muted">{formatDay(date, { day: "numeric", month: "short" })}</p>
                    </>
                  ) : (
                    <Link
                      className="text-xs font-bold text-inherit hover:text-green-dark"
                      href={`/appointments?date=${date}`}
                    >
                      {formatDay(date, { day: "numeric" })}
                    </Link>
                  )}
                </div>
                <div className="space-y-2">
                  {dayAppointments.length ? dayAppointments.map((appointment) => (
                    <article className="min-w-0 rounded-md border border-line bg-white p-2" key={appointment.id}>
                      <p className="m-0 text-[11px] font-bold tabular-nums text-green">
                        {formatTime(appointment.startsAt)}–{formatTime(appointment.endsAt)}
                      </p>
                      <Link
                        className="mt-1 block truncate text-xs font-bold text-green-dark hover:underline"
                        href={`/animals/${appointment.animal.id}`}
                      >
                        {appointment.animal.name}
                      </Link>
                      <p className="my-1 line-clamp-2 text-[11px] leading-4 text-ink">{appointment.reason}</p>
                      <p className="mb-2 mt-0 truncate text-[10px] text-muted">
                        Dr. {appointment.veterinarian.firstName} {appointment.veterinarian.lastName}
                      </p>
                      <AppointmentStatusBadge status={appointment.status} />
                      {canWriteExaminations && appointment.status !== "CANCELLED" && appointment.status !== "NO_SHOW" ? (
                        <Link
                          className="mt-2 block text-[10px] font-semibold text-green-dark underline-offset-2 hover:underline"
                          href={
                            appointment.examination
                              ? `/examinations/${appointment.examination.id}`
                              : `/examinations/new?appointmentId=${encodeURIComponent(appointment.id)}`
                          }
                        >
                          {appointment.examination ? "Otvori pregled" : "Započni pregled"}
                        </Link>
                      ) : null}
                      {canWrite &&
                      (appointment.status === "SCHEDULED" || appointment.status === "CONFIRMED") &&
                      !appointment.examination ? (
                        <Link
                          className="mt-2 block text-[10px] font-semibold text-[#53645a] underline-offset-2 hover:underline"
                          href={`/appointments/${appointment.id}/edit`}
                        >
                          Uredi termin
                        </Link>
                      ) : null}
                    </article>
                  )) : <p className="m-0 py-2 text-xs text-muted">Nema termina</p>}
                </div>
              </section>
            );
          })}
        </div>
      </section>
    </main>
  );
}
