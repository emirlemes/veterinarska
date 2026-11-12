"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";

type ClientOption = {
  id: string;
  firstName: string;
  lastName: string;
  companyName: string | null;
};

type AnimalOption = {
  id: string;
  name: string;
  species: string;
  ownerId: string;
};

type VeterinarianOption = {
  id: string;
  firstName: string;
  lastName: string;
};

type AppointmentContext = {
  id: string;
  startsAt: Date;
  reason: string;
  client: ClientOption;
  animal: AnimalOption;
  veterinarian: VeterinarianOption;
};

type ExaminationValues = {
  id: string;
  clientId: string;
  animalId: string;
  veterinarianId: string;
  chiefComplaint: string | null;
  symptoms: string | null;
  diagnosis: string | null;
  treatmentPlan: string | null;
  notes: string | null;
  client: ClientOption;
  animal: AnimalOption;
  veterinarian: VeterinarianOption;
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
  return "Pregled nije moguće sačuvati. Provjerite podatke i pokušajte ponovo.";
}

function displayClient(client: ClientOption) {
  return client.companyName || `${client.firstName} ${client.lastName}`;
}

export function ExaminationForm({
  clients,
  animals,
  veterinarians,
  appointment,
  examination,
  defaultClientId,
  defaultAnimalId,
  currentUserId,
}: {
  clients: ClientOption[];
  animals: AnimalOption[];
  veterinarians: VeterinarianOption[];
  appointment?: AppointmentContext;
  examination?: ExaminationValues;
  defaultClientId?: string;
  defaultAnimalId?: string;
  currentUserId: string;
}) {
  const router = useRouter();
  const [clientId, setClientId] = useState(
    appointment?.client.id ?? examination?.clientId ?? defaultClientId ?? "",
  );
  const [animalId, setAnimalId] = useState(
    appointment?.animal.id ?? examination?.animalId ?? defaultAnimalId ?? "",
  );
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const linkedContext = Boolean(appointment || examination);
  const clientAnimals = useMemo(
    () => animals.filter((animal) => animal.ownerId === clientId),
    [animals, clientId],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const formData = new FormData(
      event.currentTarget,
      submitter instanceof HTMLElement ? submitter : undefined,
    );
    const body = Object.fromEntries(formData.entries());
    const isEditing = Boolean(examination);
    try {
      const response = await fetch("/api/examinations", {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result: unknown = await response.json();

      if (!response.ok) {
        setError(getErrorMessage(result));
        if (
          response.status === 409 &&
          typeof result === "object" &&
          result !== null &&
          "id" in result &&
          typeof result.id === "string"
        ) {
          router.push(`/examinations/${result.id}`);
        }
        return;
      }

      const targetId = examination?.id ??
        (typeof result === "object" &&
        result !== null &&
        "id" in result &&
        typeof result.id === "string"
          ? result.id
          : null);
      if (targetId) {
        router.push(`/examinations/${targetId}`);
      } else {
        router.push("/examinations");
      }
      router.refresh();
    } catch {
      setError("Nije moguće povezati se sa serverom. Pokušajte ponovo.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const currentVeterinarian = examination
    ? examination.veterinarian
    : appointment?.veterinarian;
  const linkedClient = appointment?.client ?? examination?.client;
  const linkedAnimal = appointment?.animal ?? examination?.animal;

  return (
    <form
      className="w-full max-w-[820px] rounded-xl border border-line bg-white p-4 pb-36 shadow-[0_2px_6px_rgb(34_62_47_/_2%)] sm:p-6"
      onSubmit={handleSubmit}
    >
      {appointment ? (
        <section className="mb-4 rounded-lg border border-green/15 bg-green-soft/50 p-3 sm:p-4">
          <div className="text-xs font-bold uppercase tracking-wide text-green-dark">Termin</div>
          <div className="mt-1 text-sm font-semibold">
            {new Intl.DateTimeFormat("bs-BA", {
              dateStyle: "medium",
              timeStyle: "short",
              timeZone: "Europe/Sarajevo",
            }).format(appointment.startsAt)}
          </div>
          <div className="mt-1 text-sm text-muted">{appointment.reason}</div>
          <input type="hidden" name="appointmentId" value={appointment.id} />
        </section>
      ) : (
        <input type="hidden" name="appointmentId" value="" />
      )}

      {linkedContext ? (
        <div className="grid grid-cols-[90px_minmax(0,1fr)] gap-x-3 gap-y-2 rounded-lg bg-[#f7faf8] p-3 text-sm sm:mb-4 sm:grid-cols-[110px_minmax(0,1fr)]">
          <span className="text-xs text-muted">Klijent</span>
          <span className="min-w-0 font-medium">
            {linkedClient ? displayClient(linkedClient) : "Klijent"}
          </span>
          <span className="text-xs text-muted">Životinja</span>
          <span className="min-w-0 font-medium">
            {linkedAnimal?.name ?? "Životinja"}
            {linkedAnimal?.species ? ` · ${linkedAnimal.species}` : ""}
          </span>
          <span className="text-xs text-muted">Veterinar</span>
          <span className="min-w-0 font-medium">
            {currentVeterinarian
              ? `Dr. ${currentVeterinarian.firstName} ${currentVeterinarian.lastName}`
              : "Dodijeljeni veterinar"}
          </span>
          <input type="hidden" name="clientId" value={clientId} />
          <input type="hidden" name="animalId" value={animalId} />
          <input
            type="hidden"
            name="veterinarianId"
            value={appointment?.veterinarian.id ?? examination?.veterinarianId ?? ""}
          />
        </div>
      ) : (
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
                <option key={client.id} value={client.id}>{displayClient(client)}</option>
              ))}
            </select>
          </Field>
          <Field label="Životinja" required>
            <select
              className={selectClass}
              name="animalId"
              value={animalId}
              onChange={(event) => setAnimalId(event.target.value)}
              disabled={!clientId || !clientAnimals.length}
              required
            >
              <option value="">
                {!clientId
                  ? "Prvo odaberite klijenta"
                  : clientAnimals.length
                    ? "Odaberite životinju"
                    : "Nema aktivnih životinja"}
              </option>
              {clientAnimals.map((animal) => (
                <option key={animal.id} value={animal.id}>
                  {animal.name} · {animal.species}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Veterinar" required>
            <select
              className={selectClass}
              name="veterinarianId"
              defaultValue={
                examination?.veterinarianId ??
                (veterinarians.some((veterinarian) => veterinarian.id === currentUserId)
                  ? currentUserId
                  : "")
              }
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
        </div>
      )}

      <div className="mt-4 border-t border-line pt-4">
        <h2 className="mb-3 text-base font-semibold">Klinički zapis</h2>
        <div className="grid grid-cols-1 gap-x-5 sm:grid-cols-2">
          <Field label="Glavni razlog dolaska" className="sm:col-span-2">
            <textarea
              className={textareaClass}
              name="chiefComplaint"
              rows={3}
              maxLength={10000}
              defaultValue={examination?.chiefComplaint ?? appointment?.reason ?? ""}
              placeholder="Šta je razlog pregleda?"
            />
          </Field>
          <Field label="Simptomi">
            <textarea
              className={textareaClass}
              name="symptoms"
              rows={4}
              maxLength={10000}
              defaultValue={examination?.symptoms ?? ""}
              placeholder="Uočeni simptomi"
            />
          </Field>
          <Field label="Dijagnoza">
            <textarea
              className={textareaClass}
              name="diagnosis"
              rows={4}
              maxLength={10000}
              defaultValue={examination?.diagnosis ?? ""}
              placeholder="Radna ili konačna dijagnoza"
            />
          </Field>
          <Field label="Plan terapije" className="sm:col-span-2">
            <textarea
              className={textareaClass}
              name="treatmentPlan"
              rows={4}
              maxLength={10000}
              defaultValue={examination?.treatmentPlan ?? ""}
              placeholder="Preporučena terapija i upute za vlasnika"
            />
          </Field>
          <Field label="Dodatna napomena" className="sm:col-span-2">
            <textarea
              className={textareaClass}
              name="notes"
              rows={3}
              maxLength={10000}
              defaultValue={examination?.notes ?? ""}
            />
          </Field>
        </div>
      </div>

      {examination ? <input type="hidden" name="id" value={examination.id} /> : null}
      {error ? (
        <p className="rounded-lg bg-[#fbefee] px-3 py-2.5 text-sm text-[#a43e3c]" role="alert">
          {error}
        </p>
      ) : null}
      <div className="mt-4 flex flex-col-reverse gap-2 border-t border-line pt-4 max-[639px]:hidden sm:flex-row sm:justify-between">
        <Link
          className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-line px-4 text-sm font-semibold text-[#53645a] hover:bg-[#f7faf8] sm:w-auto"
          href={examination ? `/examinations/${examination.id}` : "/examinations"}
        >
          Odustani
        </Link>
        {examination ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              className="min-h-11 w-full rounded-lg border border-line bg-white px-4 text-sm font-bold text-[#53645a] hover:bg-[#f7faf8] disabled:opacity-60 sm:w-auto"
              type="submit"
              name="status"
              value="IN_PROGRESS"
              disabled={isSubmitting}
            >
              Sačuvaj zapis
            </button>
            <button
              className="min-h-11 w-full rounded-lg bg-green px-4 text-sm font-bold text-white hover:bg-green-dark disabled:opacity-60 sm:w-auto"
              type="submit"
              name="status"
              value="COMPLETED"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Čuvanje..." : "Završi pregled"}
            </button>
          </div>
        ) : (
          <button
            className="min-h-11 w-full rounded-lg bg-green px-4 text-sm font-bold text-white hover:bg-green-dark disabled:opacity-60 sm:w-auto"
            type="submit"
            disabled={isSubmitting || !clients.length || !animals.length || !veterinarians.length}
          >
            {isSubmitting ? "Čuvanje..." : "Započni pregled"}
          </button>
        )}
      </div>
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 grid grid-cols-2 gap-2 border-t border-line bg-white/95 p-3 shadow-[0_-4px_16px_rgb(34_62_47_/_10%)] backdrop-blur sm:hidden">
        {examination ? (
          <>
            <button
              className="min-h-12 rounded-lg border border-line bg-white px-3 text-sm font-bold text-[#53645a] disabled:opacity-60"
              type="submit"
              name="status"
              value="IN_PROGRESS"
              disabled={isSubmitting}
            >
              Sačuvaj
            </button>
            <button
              className="min-h-12 rounded-lg bg-green px-3 text-sm font-bold text-white disabled:opacity-60"
              type="submit"
              name="status"
              value="COMPLETED"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Čuvanje..." : "Završi pregled"}
            </button>
          </>
        ) : (
          <button
            className="col-span-2 min-h-12 rounded-lg bg-green px-4 text-sm font-bold text-white disabled:opacity-60"
            type="submit"
            disabled={isSubmitting || !clients.length || !animals.length || !veterinarians.length}
          >
            {isSubmitting ? "Čuvanje..." : "Započni pregled"}
          </button>
        )}
      </div>
    </form>
  );
}

const selectClass =
  "h-11 w-full rounded-lg border border-[#dce4de] bg-white px-3 text-sm text-ink outline-none focus:border-green focus:ring-2 focus:ring-green/15 disabled:bg-[#f7faf8] disabled:text-muted";

const textareaClass =
  "min-h-24 w-full resize-y rounded-lg border border-[#dce4de] bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-green focus:ring-2 focus:ring-green/15";

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
    <label className={`my-2 grid min-w-0 gap-1.5 ${className}`}>
      <span className="text-sm font-semibold">
        {label}{required ? " *" : ""}
      </span>
      {children}
    </label>
  );
}
