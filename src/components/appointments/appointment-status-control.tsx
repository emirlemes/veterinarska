"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  getAppointmentTransitions,
  type AppointmentStatusValue,
} from "@/features/appointments/validation";

const statusLabels: Record<AppointmentStatusValue, string> = {
  SCHEDULED: "Zakazan",
  CONFIRMED: "Potvrđen",
  IN_PROGRESS: "U toku",
  COMPLETED: "Završen",
  CANCELLED: "Otkazan",
  NO_SHOW: "Nije došao",
};

export function AppointmentStatusControl({
  appointmentId,
  status,
}: {
  appointmentId: string;
  status: AppointmentStatusValue;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<AppointmentStatusValue | "">("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const transitions = getAppointmentTransitions(status);

  async function updateStatus() {
    if (!selected || isSaving) return;
    setError("");
    setIsSaving(true);
    try {
      const response = await fetch(`/api/appointments/${appointmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: selected }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        setError(
          typeof result === "object" &&
            result !== null &&
            "error" in result &&
            typeof result.error === "string"
            ? result.error
            : "Status termina nije moguće promijeniti.",
        );
        return;
      }
      setSelected("");
      router.refresh();
    } catch {
      setError("Nije moguće povezati se sa serverom. Pokušajte ponovo.");
    } finally {
      setIsSaving(false);
    }
  }

  if (!transitions.length) {
    return <AppointmentStatusBadge status={status} />;
  }

  return (
    <div className="flex min-w-0 flex-col gap-1.5 sm:min-w-[180px]">
      <div className="flex min-w-0 gap-1.5">
        <select
          className="h-10 min-w-0 flex-1 rounded-[7px] border border-line bg-white px-2 text-xs text-ink focus:border-green focus:outline-none focus:ring-2 focus:ring-green/15"
          aria-label="Promijeni status termina"
          value={selected}
          onChange={(event) =>
            setSelected(
              transitions.find((nextStatus) => nextStatus === event.target.value) ?? "",
            )
          }
          disabled={isSaving}
        >
          <option value="">Status: {statusLabels[status]}</option>
          {transitions.map((nextStatus) => (
            <option key={nextStatus} value={nextStatus}>{statusLabels[nextStatus]}</option>
          ))}
        </select>
        <button
          className="min-h-10 shrink-0 rounded-[7px] bg-green px-3 text-xs font-bold text-white hover:bg-green-dark disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
          onClick={updateStatus}
          disabled={!selected || isSaving}
        >
          {isSaving ? "..." : "Sačuvaj"}
        </button>
      </div>
      {error ? <span className="text-[11px] text-[#a43e3c]" role="alert">{error}</span> : null}
    </div>
  );
}

export function AppointmentStatusBadge({ status }: { status: AppointmentStatusValue }) {
  const colors: Record<AppointmentStatusValue, string> = {
    SCHEDULED: "bg-[#eef1ef] text-[#67736b]",
    CONFIRMED: "bg-[#e8f4ec] text-[#2f7657]",
    IN_PROGRESS: "bg-[#fff4df] text-[#94641e]",
    COMPLETED: "bg-[#e8f4ec] text-[#2f7657]",
    CANCELLED: "bg-[#fbefee] text-[#a43e3c]",
    NO_SHOW: "bg-[#eef1ef] text-[#67736b]",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${colors[status]}`}>
      {statusLabels[status]}
    </span>
  );
}
