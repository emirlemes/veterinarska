import type { Metadata } from "next";
import Link from "next/link";
import { AppointmentStatus, Prisma } from "@prisma/client";
import { AppointmentCard } from "@/components/appointments/appointment-card";
import {
  AppointmentStatusBadge,
  AppointmentStatusControl,
} from "@/components/appointments/appointment-status-control";
import { appointmentListQuerySchema } from "@/features/appointments/validation";
import { hasPermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { getClinicDate, getClinicDateBounds } from "@/lib/dates";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Termini" };

const statusLabels: Record<AppointmentStatus, string> = {
  SCHEDULED: "Zakazan",
  CONFIRMED: "Potvrđen",
  IN_PROGRESS: "U toku",
  COMPLETED: "Završen",
  CANCELLED: "Otkazan",
  NO_SHOW: "Nije došao",
};

function formatDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("bs-BA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Sarajevo",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

function formatTime(value: Date) {
  return new Intl.DateTimeFormat("bs-BA", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Sarajevo",
  }).format(value);
}

function clientName(client: {
  companyName: string | null;
  firstName: string;
  lastName: string;
}) {
  return client.companyName || `${client.firstName} ${client.lastName}`;
}

function shiftDate(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
}

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; status?: string; search?: string }>;
}) {
  const user = await requirePermission("appointments:read");
  const canWrite = hasPermission(user.role, "appointments:write");
  const canWriteExaminations = hasPermission(user.role, "examinations:write");
  const params = await searchParams;
  const parsed = appointmentListQuerySchema.safeParse({
    date: params.date ?? getClinicDate(),
    status: params.status ?? "all",
    search: params.search ?? "",
  });
  const filters = parsed.success
    ? parsed.data
    : { date: getClinicDate(), status: "all" as const, search: "" };
  const bounds = getClinicDateBounds(filters.date);
  if (!bounds) throw new Error(`Neispravan datum termina: ${filters.date}`);

  const where: Prisma.AppointmentWhereInput = {
    startsAt: { gte: bounds.start, lt: bounds.end },
    ...(filters.status !== "all" ? { status: filters.status } : {}),
    ...(filters.search
      ? {
          OR: [
            { reason: { contains: filters.search, mode: "insensitive" } },
            {
              client: {
                is: {
                  OR: [
                    { firstName: { contains: filters.search, mode: "insensitive" } },
                    { lastName: { contains: filters.search, mode: "insensitive" } },
                    { companyName: { contains: filters.search, mode: "insensitive" } },
                    { phone: { contains: filters.search, mode: "insensitive" } },
                  ],
                },
              },
            },
            {
              animal: {
                is: {
                  OR: [
                    { name: { contains: filters.search, mode: "insensitive" } },
                    { species: { contains: filters.search, mode: "insensitive" } },
                  ],
                },
              },
            },
            {
              veterinarian: {
                is: {
                  OR: [
                    { firstName: { contains: filters.search, mode: "insensitive" } },
                    { lastName: { contains: filters.search, mode: "insensitive" } },
                  ],
                },
              },
            },
          ],
        }
      : {}),
  };

  const appointments = await prisma.appointment.findMany({
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
  });

  function dateHref(date: string) {
    const query = new URLSearchParams({ date, status: filters.status, search: filters.search });
    return `/appointments?${query.toString()}`;
  }

  return (
    <main className="mx-auto w-full max-w-[1440px] px-4 pb-8 pt-5 sm:px-[34px] sm:pb-[42px] sm:pt-[31px]">
      <div className="mb-5 flex flex-col gap-4 sm:mb-[25px] sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-[7px] text-[11px] font-[750] uppercase tracking-[0.7px] text-green">Raspored ambulante</p>
          <h1 className="m-0 text-[clamp(24px,3vw,30px)] tracking-[-0.9px]">Termini</h1>
          <p className="mt-2 text-sm text-muted">{formatDate(filters.date)}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-line bg-white px-4 text-sm font-bold text-[#53645a] hover:bg-[#f7faf8]"
            href={`/appointments/calendar?date=${encodeURIComponent(filters.date)}`}
          >
            Sedmični kalendar
          </Link>
          {canWrite ? (
            <Link
              className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-green px-4 text-sm font-bold text-white hover:bg-green-dark sm:w-auto"
              href={`/appointments/new?date=${encodeURIComponent(filters.date)}`}
            >
              + Zakaži termin
            </Link>
          ) : null}
        </div>
      </div>

      <section className="min-w-0 rounded-xl border border-line bg-white p-3 shadow-[0_2px_6px_rgb(34_62_47_/_2%)] sm:p-5">
        <form className="grid grid-cols-1 gap-3 border-b border-line pb-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_180px_auto] sm:items-end" action="/appointments" method="get">
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
          <label className="grid gap-1.5 text-xs font-semibold text-muted">
            Pretraga
            <input
              className="h-11 w-full rounded-lg border border-[#dce4de] bg-white px-3 text-sm text-ink focus:border-green focus:outline-none focus:ring-2 focus:ring-green/15"
              type="search"
              name="search"
              maxLength={100}
              placeholder="Pacijent, vlasnik, veterinar ili razlog"
              defaultValue={filters.search}
            />
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
            href={dateHref(shiftDate(filters.date, -1))}
          >
            ← <span className="ml-1 hidden sm:inline">Prethodni dan</span>
          </Link>
          <span className="text-xs font-medium text-muted">{appointments.length} termina</span>
          <Link
            className="inline-flex min-h-10 items-center rounded-lg border border-line px-3 text-sm font-semibold text-[#53645a] hover:bg-[#f7faf8]"
            href={dateHref(shiftDate(filters.date, 1))}
          >
            <span className="mr-1 hidden sm:inline">Sljedeći dan</span> →
          </Link>
        </div>

        {!parsed.success ? (
          <p className="mb-3 rounded-lg bg-[#fbefee] px-3 py-2.5 text-xs text-[#a43e3c]" role="alert">
            Datum ili filter nisu ispravni. Prikazan je današnji raspored.
          </p>
        ) : null}

        {appointments.length ? (
          <>
            <div className="space-y-3 md:hidden">
              {appointments.map((appointment) => (
                <AppointmentCard
                  key={appointment.id}
                  appointment={appointment}
                  canWrite={canWrite}
                  canWriteExaminations={canWriteExaminations}
                />
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr>
                    {["Vrijeme", "Životinja", "Vlasnik", "Veterinar", "Razlog", "Status", ...(canWriteExaminations ? ["Pregled"] : [])].map((heading) => (
                      <th
                        className="whitespace-nowrap border-b border-line px-3 py-3 text-[10px] font-bold uppercase tracking-[0.55px] text-[#8a968e]"
                        key={heading}
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {appointments.map((appointment) => (
                    <tr key={appointment.id}>
                      <td className="whitespace-nowrap border-b border-[#eef1ef] px-3 py-3 text-sm font-semibold tabular-nums last:border-0">
                        {formatTime(appointment.startsAt)}–{formatTime(appointment.endsAt)}
                      </td>
                      <td className="whitespace-nowrap border-b border-[#eef1ef] px-3 py-3 text-sm last:border-0">
                        <Link className="font-semibold text-green-dark hover:underline" href={`/animals/${appointment.animal.id}`}>
                          {appointment.animal.name}
                        </Link>
                        <span className="ml-1 text-xs text-muted">{appointment.animal.species}</span>
                      </td>
                      <td className="whitespace-nowrap border-b border-[#eef1ef] px-3 py-3 text-sm last:border-0">
                        <Link className="hover:text-green hover:underline" href={`/clients/${appointment.client.id}`}>
                          {clientName(appointment.client)}
                        </Link>
                        <a className="ml-2 text-xs text-green-dark hover:underline" href={`tel:${appointment.client.phone}`}>
                          {appointment.client.phone}
                        </a>
                      </td>
                      <td className="whitespace-nowrap border-b border-[#eef1ef] px-3 py-3 text-sm last:border-0">
                        Dr. {appointment.veterinarian.firstName} {appointment.veterinarian.lastName}
                      </td>
                      <td className="border-b border-[#eef1ef] px-3 py-3 text-sm last:border-0">{appointment.reason}</td>
                      <td className="border-b border-[#eef1ef] px-3 py-3 text-sm last:border-0">
                        {canWrite ? (
                          <div className="space-y-2">
                            <AppointmentStatusControl appointmentId={appointment.id} status={appointment.status} />
                            {(appointment.status === "SCHEDULED" || appointment.status === "CONFIRMED") &&
                            !appointment.examination ? (
                              <Link
                                className="block text-xs font-semibold text-green-dark hover:underline"
                                href={`/appointments/${appointment.id}/edit`}
                              >
                                Uredi termin
                              </Link>
                            ) : null}
                          </div>
                        ) : (
                          <AppointmentStatusBadge status={appointment.status} />
                        )}
                      </td>
                      {canWriteExaminations ? (
                        <td className="border-b border-[#eef1ef] px-3 py-3 text-sm last:border-0">
                          {appointment.status === "CANCELLED" || appointment.status === "NO_SHOW" ? null : (
                            <Link
                              className="whitespace-nowrap font-semibold text-green-dark underline-offset-2 hover:underline"
                              href={
                                appointment.examination
                                  ? `/examinations/${appointment.examination.id}`
                                  : `/examinations/new?appointmentId=${encodeURIComponent(appointment.id)}`
                              }
                            >
                              {appointment.examination ? "Otvori pregled" : "Započni pregled"}
                            </Link>
                          )}
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="px-3 py-12 text-center">
            <p className="mb-1 text-sm font-semibold">Nema termina za odabrani dan.</p>
            <p className="m-0 text-sm text-muted">
              {filters.search
                ? "Provjerite pojam pretrage ili promijenite filtere."
                : filters.status === "all"
                  ? "Odaberite drugi datum ili zakažite novi termin."
                  : "Pokušajte promijeniti filter statusa."}
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
