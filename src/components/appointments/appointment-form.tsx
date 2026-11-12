"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import type { WorkingHours } from "@/features/settings/validation";

type ClientOption = {
  id: string;
  firstName: string;
  lastName: string;
  companyName: string | null;
  inactive?: boolean;
};

type AnimalOption = {
  id: string;
  name: string;
  species: string;
  ownerId: string;
  inactive?: boolean;
};

type VeterinarianOption = {
  id: string;
  firstName: string;
  lastName: string;
};

type AppointmentValues = {
  id: string;
  clientId: string;
  animalId: string;
  veterinarianId: string;
  startsAt: string;
  endsAt: string;
  reason: string;
  notes: string | null;
};

function getErrorMessage(value: unknown) {
  if (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof value.error === "string"
  ) {
    return value.error;
  }
  return "Termin nije moguće sačuvati. Provjerite podatke i pokušajte ponovo.";
}

export function AppointmentForm({
  clients,
  animals,
  veterinarians,
  date,
  durationMinutes,
  workingHours,
  appointment,
}: {
  clients: ClientOption[];
  animals: AnimalOption[];
  veterinarians: VeterinarianOption[];
  date: string;
  durationMinutes: number;
  workingHours: WorkingHours;
  appointment?: AppointmentValues;
}) {
  const router = useRouter();
  const [clientId, setClientId] = useState(appointment?.clientId ?? "");
  const [animalId, setAnimalId] = useState(appointment?.animalId ?? "");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const clientAnimals = useMemo(
    () => animals.filter((animal) => animal.ownerId === clientId),
    [animals, clientId],
  );
  const [year, month, day] = date.split("-").map(Number);
  const weekdayNumber = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const daySchedule = workingHours[String(weekdayNumber === 0 ? 7 : weekdayNumber) as keyof WorkingHours];
  const defaultStart = appointment?.startsAt ?? `${date}T${daySchedule.enabled ? daySchedule.start : "09:00"}`;
  const startAsUtc = new Date(`${defaultStart}:00Z`);
  const defaultEnd = appointment?.endsAt ?? new Date(startAsUtc.getTime() + durationMinutes * 60_000)
      .toISOString()
      .slice(0, 16);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const body = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const submittedDate =
        typeof body.startsAt === "string" ? body.startsAt.slice(0, 10) : date;
      const response = await fetch(
        appointment ? `/api/appointments/${appointment.id}` : "/api/appointments",
        {
        method: appointment ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        },
      );
      const result: unknown = await response.json();

      if (!response.ok) {
        setError(getErrorMessage(result));
        return;
      }

      router.push(`/appointments?date=${encodeURIComponent(submittedDate)}`);
      router.refresh();
    } catch {
      setError("Nije moguće povezati se sa serverom. Pokušajte ponovo.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      className="w-full max-w-[760px] rounded-[11px] border border-line bg-white p-4 shadow-[0_2px_6px_rgb(34_62_47_/_2%)] sm:p-6"
      onSubmit={handleSubmit}
    >
      <div className="grid grid-cols-1 gap-x-5 sm:grid-cols-2">
        <Field label="Klijent" required>
          <select
            className={selectClass}
            name="clientId"
            value={clientId}
            onChange={(event) => {
              setClientId(event.target.value);
              setAnimalId("");
            }}
            required
          >
            <option value="">Odaberite klijenta</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.companyName || `${client.firstName} ${client.lastName}`}
                {client.inactive ? " (arhiviran)" : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Životinja" required>
          <select
            className={selectClass}
            name="animalId"
            required
            disabled={!clientId || !clientAnimals.length}
            value={animalId}
            onChange={(event) => setAnimalId(event.target.value)}
          >
            <option value="">
              {!clientId
                ? "Prvo odaberite klijenta"
                : clientAnimals.length
                  ? "Odaberite životinju"
                  : "Klijent nema aktivnih životinja"}
            </option>
            {clientAnimals.map((animal) => (
              <option key={animal.id} value={animal.id}>
                {animal.name} · {animal.species}{animal.inactive ? " (neaktivna)" : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Veterinar" required>
          <select
            className={selectClass}
            name="veterinarianId"
            defaultValue={appointment?.veterinarianId ?? ""}
            required
          >
            <option value="">Odaberite veterinara</option>
            {veterinarians.map((veterinarian) => (
              <option key={veterinarian.id} value={veterinarian.id}>
                {veterinarian.firstName} {veterinarian.lastName}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Razlog dolaska" required>
          <input
            className={inputClass}
            name="reason"
            maxLength={240}
            placeholder="Npr. kontrolni pregled"
            defaultValue={appointment?.reason}
            required
          />
        </Field>
        <Field label="Početak" required>
          <input
            className={inputClass}
            name="startsAt"
            type="datetime-local"
            min={!appointment && daySchedule.enabled ? `${date}T${daySchedule.start}` : undefined}
            max={!appointment && daySchedule.enabled ? `${date}T${daySchedule.end}` : undefined}
            defaultValue={defaultStart}
            required
          />
        </Field>
        <Field label="Završetak" required>
          <input
            className={inputClass}
            name="endsAt"
            type="datetime-local"
            min={!appointment && daySchedule.enabled ? `${date}T${daySchedule.start}` : undefined}
            max={!appointment && daySchedule.enabled ? `${date}T${daySchedule.end}` : undefined}
            defaultValue={defaultEnd}
            required
          />
        </Field>
        <Field label="Napomena" className="sm:col-span-2">
          <textarea
            className="min-h-24 w-full resize-y rounded-[7px] border border-[#dce4de] bg-white px-3 py-2.5 outline-none focus:border-green focus:ring-[3px] focus:ring-[rgb(46_118_88_/_12%)]"
            name="notes"
            maxLength={5000}
            placeholder="Dodatne informacije za tim (opcionalno)"
            defaultValue={appointment?.notes ?? ""}
          />
        </Field>
      </div>
      {appointment ? (
        <p className="mb-3 text-xs text-muted">
          Radno vrijeme i zauzetost veterinara ponovo se provjeravaju pri čuvanju.
        </p>
      ) : daySchedule.enabled ? (
        <p className="mb-3 text-xs text-muted">
          Radno vrijeme za odabrani dan: {daySchedule.start}–{daySchedule.end}.
        </p>
      ) : (
        <p className="mb-3 rounded-lg bg-[#fff4df] px-3 py-2.5 text-sm text-[#93631b]" role="status">
          Ambulanta je zatvorena na odabrani dan. Odaberite drugi datum.
        </p>
      )}
      {error ? (
        <p className="rounded-[7px] bg-[#fbefee] px-3 py-2.5 text-xs text-[#a43e3c]" role="alert">
          {error}
        </p>
      ) : null}
      <div className="mt-4 flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
        <button
          className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center rounded-[7px] border border-transparent bg-green px-4 text-sm font-bold text-white hover:bg-green-dark disabled:cursor-wait disabled:opacity-65 sm:w-auto"
          type="submit"
          disabled={isSubmitting || !clients.length || !animals.length || !veterinarians.length}
        >
          {isSubmitting ? "Čuvanje..." : appointment ? "Sačuvaj izmjene" : "Zakaži termin"}
        </button>
      </div>
    </form>
  );
}

const inputClass =
  "h-11 w-full rounded-[7px] border border-[#dce4de] bg-white px-3 text-ink outline-none focus:border-green focus:ring-[3px] focus:ring-[rgb(46_118_88_/_12%)]";

const selectClass =
  "h-11 w-full rounded-[7px] border border-[#dce4de] bg-white px-3 text-ink outline-none focus:border-green focus:ring-[3px] focus:ring-[rgb(46_118_88_/_12%)] disabled:bg-[#f7faf8] disabled:text-muted";

function Field({
  label,
  required = false,
  className = "",
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`my-3 grid min-w-0 gap-2 ${className}`}>
      <span className="text-sm font-semibold">
        {label}{required ? " *" : ""}
      </span>
      {children}
    </label>
  );
}
