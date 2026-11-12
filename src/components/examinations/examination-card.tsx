import Link from "next/link";
import type { ExaminationStatus } from "@prisma/client";

const statusLabels: Record<ExaminationStatus, string> = {
  IN_PROGRESS: "U toku",
  COMPLETED: "Završen",
};

export function ExaminationCard({
  examination,
}: {
  examination: {
    id: string;
    examinationDate: Date;
    status: ExaminationStatus;
    chiefComplaint: string | null;
    diagnosis: string | null;
    client: {
      id: string;
      firstName: string;
      lastName: string;
      companyName: string | null;
    };
    animal: { id: string; name: string; species: string };
    veterinarian: { firstName: string; lastName: string };
  };
}) {
  const clientName =
    examination.client.companyName ||
    `${examination.client.firstName} ${examination.client.lastName}`;

  return (
    <article className="rounded-xl border border-line bg-white p-4 shadow-[0_2px_6px_rgb(34_62_47_/_2%)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            className="text-base font-bold text-green-dark underline-offset-2 hover:underline"
            href={`/examinations/${examination.id}`}
          >
            {examination.animal.name}
          </Link>
          <p className="mb-0 mt-1 text-sm text-muted">
            {examination.animal.species} · {clientName}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
            examination.status === "COMPLETED"
              ? "bg-[#edf4ef] text-[#587362]"
              : "bg-[#fff4df] text-[#93631b]"
          }`}
        >
          {statusLabels[examination.status]}
        </span>
      </div>
      <dl className="mt-4 grid grid-cols-[90px_minmax(0,1fr)] gap-x-3 gap-y-2 border-t border-[#eef1ef] pt-3 text-sm">
        <dt className="text-xs text-muted">Datum</dt>
        <dd className="m-0">
          {new Intl.DateTimeFormat("bs-BA", {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: "Europe/Sarajevo",
          }).format(examination.examinationDate)}
        </dd>
        <dt className="text-xs text-muted">Veterinar</dt>
        <dd className="m-0">Dr. {examination.veterinarian.firstName} {examination.veterinarian.lastName}</dd>
        {examination.chiefComplaint ? (
          <>
            <dt className="text-xs text-muted">Razlog</dt>
            <dd className="m-0 min-w-0 whitespace-pre-wrap">{examination.chiefComplaint}</dd>
          </>
        ) : null}
        {examination.diagnosis ? (
          <>
            <dt className="text-xs text-muted">Dijagnoza</dt>
            <dd className="m-0 min-w-0 whitespace-pre-wrap">{examination.diagnosis}</dd>
          </>
        ) : null}
      </dl>
    </article>
  );
}
