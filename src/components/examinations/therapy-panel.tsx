"use client";

import { useState, type FormEvent } from "react";
import { z } from "zod";

const therapySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  dosage: z.string().nullable(),
  frequency: z.string().nullable(),
  duration: z.string().nullable(),
  instructions: z.string().nullable(),
});

type Therapy = z.infer<typeof therapySchema>;

function getErrorMessage(value: unknown) {
  if (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof value.error === "string"
  ) {
    return value.error;
  }
  return "Nije moguće sačuvati promjenu. Pokušajte ponovo.";
}

export function TherapyPanel({
  examinationId,
  initialTherapies,
  editable,
}: {
  examinationId: string;
  initialTherapies: Therapy[];
  editable: boolean;
}) {
  const [therapies, setTherapies] = useState(initialTherapies);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState("");

  async function addTherapy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const form = event.currentTarget;
      const formData = new FormData(form);
      const response = await fetch(`/api/examinations/${examinationId}/therapies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(formData.entries())),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        setError(getErrorMessage(result));
        return;
      }

      if (
        typeof result !== "object" ||
        result === null ||
        !("therapy" in result)
      ) {
        setError("Server nije vratio podatke o terapiji. Osvježite stranicu.");
        return;
      }

      const parsedTherapy = therapySchema.safeParse(result.therapy);
      if (!parsedTherapy.success) {
        setError("Server nije vratio podatke o terapiji. Osvježite stranicu.");
        return;
      }

      setTherapies((current) => [...current, parsedTherapy.data]);
      form.reset();
    } catch {
      setError("Nije moguće povezati se sa serverom. Pokušajte ponovo.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function removeTherapy(therapyId: string) {
    setError("");
    setDeletingId(therapyId);
    try {
      const response = await fetch(
        `/api/examinations/${examinationId}/therapies/${therapyId}`,
        { method: "DELETE" },
      );
      const result: unknown = await response.json();
      if (!response.ok) {
        setError(getErrorMessage(result));
        return;
      }
      setTherapies((current) => current.filter((therapy) => therapy.id !== therapyId));
    } catch {
      setError("Nije moguće povezati se sa serverom. Pokušajte ponovo.");
    } finally {
      setDeletingId("");
    }
  }

  return (
    <section className="mt-4 w-full max-w-[900px] rounded-xl border border-line bg-white p-4 shadow-[0_2px_6px_rgb(34_62_47_/_2%)] sm:p-6">
      <div className="mb-3">
        <h2 className="m-0 text-base font-bold">Terapije i preporuke</h2>
        <p className="mb-0 mt-1 text-sm text-muted">
          Propisane terapije i upute za nastavak liječenja.
        </p>
      </div>

      {therapies.length ? (
        <ul className="mb-4 mt-0 divide-y divide-[#eef1ef] border-y border-[#eef1ef] p-0">
          {therapies.map((therapy) => (
            <li className="flex items-start justify-between gap-3 py-3" key={therapy.id}>
              <div className="min-w-0">
                <h3 className="m-0 text-sm font-bold">{therapy.name}</h3>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
                  {therapy.dosage ? <span>Doza: {therapy.dosage}</span> : null}
                  {therapy.frequency ? <span>Učestalost: {therapy.frequency}</span> : null}
                  {therapy.duration ? <span>Trajanje: {therapy.duration}</span> : null}
                </div>
                {therapy.instructions ? (
                  <p className="mb-0 mt-2 whitespace-pre-wrap text-sm leading-5 text-[#53645a]">
                    {therapy.instructions}
                  </p>
                ) : null}
              </div>
              {editable ? (
                <button
                  className="inline-flex min-h-10 shrink-0 items-center rounded-lg border border-line px-3 text-xs font-semibold text-[#6a746e] hover:bg-[#f7faf8] disabled:opacity-60"
                  type="button"
                  onClick={() => removeTherapy(therapy.id)}
                  disabled={Boolean(deletingId) || isSubmitting}
                  aria-label={`Ukloni terapiju ${therapy.name}`}
                >
                  {deletingId === therapy.id ? "Uklanjanje..." : "Ukloni"}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-4 rounded-lg bg-[#f7faf8] px-3 py-3 text-sm text-muted">
          Za ovaj pregled još nije unesena terapija.
        </p>
      )}

      {editable ? (
        <form className="grid grid-cols-1 gap-3 sm:grid-cols-2" onSubmit={addTherapy}>
          <label className="grid gap-1.5 text-xs font-semibold text-muted sm:col-span-2">
            Naziv terapije *
            <input
              className={inputClass}
              name="name"
              maxLength={180}
              required
              placeholder="Npr. kontrola ishrane"
            />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-muted">
            Doza
            <input className={inputClass} name="dosage" maxLength={160} placeholder="Doziranje" />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-muted">
            Učestalost
            <input className={inputClass} name="frequency" maxLength={160} placeholder="Npr. dva puta dnevno" />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-muted">
            Trajanje
            <input className={inputClass} name="duration" maxLength={160} placeholder="Npr. 7 dana" />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-muted">
            Upute
            <textarea
              className={`${inputClass} min-h-11 resize-y py-2`}
              name="instructions"
              rows={2}
              maxLength={10000}
              placeholder="Dodatne upute za vlasnika"
            />
          </label>
          {error ? (
            <p className="m-0 rounded-lg bg-[#fbefee] px-3 py-2.5 text-sm text-[#a43e3c] sm:col-span-2" role="alert">
              {error}
            </p>
          ) : null}
          <button
            className="min-h-11 rounded-lg bg-green px-4 text-sm font-bold text-white hover:bg-green-dark disabled:opacity-60 sm:col-span-2 sm:justify-self-end"
            type="submit"
            disabled={isSubmitting || Boolean(deletingId)}
          >
            {isSubmitting ? "Čuvanje..." : "Dodaj terapiju"}
          </button>
        </form>
      ) : error ? (
        <p className="m-0 rounded-lg bg-[#fbefee] px-3 py-2.5 text-sm text-[#a43e3c]" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

const inputClass =
  "h-11 w-full rounded-lg border border-[#dce4de] bg-white px-3 text-sm text-ink outline-none focus:border-green focus:ring-2 focus:ring-green/15";
