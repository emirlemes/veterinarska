import Link from "next/link";
import type { AppointmentStatusValue } from "@/features/appointments/validation";
import {
  AppointmentStatusBadge,
  AppointmentStatusControl,
} from "./appointment-status-control";

export type AppointmentCardData = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  reason: string;
  notes: string | null;
  status: AppointmentStatusValue;
  examination: { id: string } | null;
  client: {
    id: string;
    firstName: string;
    lastName: string;
    companyName: string | null;
    phone: string;
  };
  animal: { id: string; name: string; species: string };
  veterinarian: { firstName: string; lastName: string };
};

function formatTime(value: Date) {
  return new Intl.DateTimeFormat("bs-BA", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Sarajevo",
  }).format(value);
}

function clientName(client: AppointmentCardData["client"]) {
  return client.companyName || `${client.firstName} ${client.lastName}`;
}

export function AppointmentCard({
  appointment,
  canWrite,
  canWriteExaminations,
}: {
  appointment: AppointmentCardData;
  canWrite: boolean;
  canWriteExaminations: boolean;
}) {
  return (
    <article className="rounded-xl border border-line bg-white p-4 shadow-[0_2px_6px_rgb(34_62_47_/_2%)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-lg font-bold tabular-nums text-green">
            {formatTime(appointment.startsAt)}–{formatTime(appointment.endsAt)}
          </div>
          <div className="mt-1 text-sm font-semibold">{appointment.reason}</div>
        </div>
        {canWrite ? (
          <AppointmentStatusControl appointmentId={appointment.id} status={appointment.status} />
        ) : (
          <AppointmentStatusBadge status={appointment.status} />
        )}
      </div>

      <dl className="mt-4 grid grid-cols-[90px_minmax(0,1fr)] gap-x-3 gap-y-2 border-t border-[#eef1ef] pt-3 text-sm">
        <dt className="text-xs text-muted">Pacijent</dt>
        <dd className="m-0 min-w-0">
          <Link className="font-semibold text-green-dark underline-offset-2 hover:underline" href={`/animals/${appointment.animal.id}`}>
            {appointment.animal.name}
          </Link>
          <span className="ml-1 text-xs text-muted">{appointment.animal.species}</span>
        </dd>
        <dt className="text-xs text-muted">Vlasnik</dt>
        <dd className="m-0 min-w-0">
          <Link className="font-medium underline-offset-2 hover:text-green hover:underline" href={`/clients/${appointment.client.id}`}>
            {clientName(appointment.client)}
          </Link>
          <a className="ml-2 whitespace-nowrap text-xs text-green-dark underline-offset-2 hover:underline" href={`tel:${appointment.client.phone}`}>
            {appointment.client.phone}
          </a>
        </dd>
        <dt className="text-xs text-muted">Veterinar</dt>
        <dd className="m-0">Dr. {appointment.veterinarian.firstName} {appointment.veterinarian.lastName}</dd>
      </dl>
      {appointment.notes ? (
        <p className="mb-0 mt-3 whitespace-pre-wrap border-t border-[#eef1ef] pt-3 text-sm leading-6 text-muted">
          {appointment.notes}
        </p>
      ) : null}
      {canWrite &&
      (appointment.status === "SCHEDULED" || appointment.status === "CONFIRMED") &&
      !appointment.examination ? (
        <div className="mt-3 border-t border-[#eef1ef] pt-3">
          <Link
            className="inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-line px-3 text-sm font-semibold text-[#53645a] hover:bg-[#f7faf8]"
            href={`/appointments/${appointment.id}/edit`}
          >
            Uredi termin
          </Link>
        </div>
      ) : null}
      {canWriteExaminations && appointment.status !== "CANCELLED" && appointment.status !== "NO_SHOW" ? (
        <div className="mt-3 border-t border-[#eef1ef] pt-3">
          <Link
            className="inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-green/25 px-3 text-sm font-bold text-green-dark hover:bg-green-soft"
            href={
              appointment.examination
                ? `/examinations/${appointment.examination.id}`
                : `/examinations/new?appointmentId=${encodeURIComponent(appointment.id)}`
            }
          >
            {appointment.examination ? "Otvori pregled" : "Započni pregled"}
          </Link>
        </div>
      ) : null}
    </article>
  );
}
