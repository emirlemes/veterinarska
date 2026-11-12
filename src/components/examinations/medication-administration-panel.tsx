"use client";

import { useState, type FormEvent } from "react";
import { z } from "zod";

const administrationSchema = z.object({
  id: z.string().uuid(),
  medicationName: z.string(),
  unit: z.string(),
  batchNumber: z.string(),
  quantity: z.string(),
  notes: z.string().nullable(),
  administeredAt: z.string(),
});

type Administration = z.infer<typeof administrationSchema>;
type Batch = {
  id: string;
  medicationName: string;
  unit: string;
  batchNumber: string;
  quantityRemaining: string;
  expiresAt: string | null;
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
  return "Nije moguće sačuvati utrošak lijeka. Pokušajte ponovo.";
}

function formatQuantity(value: string) {
  return new Intl.NumberFormat("bs-BA", { maximumFractionDigits: 3 }).format(Number(value));
}

export function MedicationAdministrationPanel({
  examinationId,
  initialAdministrations,
  availableBatches,
  editable,
}: {
  examinationId: string;
  initialAdministrations: Administration[];
  availableBatches: Batch[];
  editable: boolean;
}) {
  const [administrations, setAdministrations] = useState(initialAdministrations);
  const [batches, setBatches] = useState(availableBatches);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function addAdministration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    const form = event.currentTarget;
    try {
      const response = await fetch(`/api/examinations/${examinationId}/administrations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(new FormData(form).entries())),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        setError(getErrorMessage(result));
        return;
      }

      if (typeof result !== "object" || result === null || !("administration" in result)) {
        setError("Server nije vratio podatke o utrošku. Osvježite stranicu.");
        return;
      }
      const parsed = administrationSchema.safeParse(result.administration);
      if (!parsed.success) {
        setError("Server nije vratio podatke o utrošku. Osvježite stranicu.");
        return;
      }
      const submittedBatchId = String(new FormData(form).get("batchId") ?? "");
      setAdministrations((current) => [parsed.data, ...current]);
      setBatches((current) =>
        current.flatMap((batch) => {
          if (batch.id !== submittedBatchId) return [batch];
          const remaining =
            Number(batch.quantityRemaining) - Number(parsed.data.quantity);
          return remaining > 0
            ? [{ ...batch, quantityRemaining: String(remaining) }]
            : [];
        }),
      );
      form.reset();
    } catch {
      setError("Nije moguće povezati se sa serverom. Pokušajte ponovo.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="mt-4 w-full max-w-[900px] rounded-xl border border-line bg-white p-4 shadow-[0_2px_6px_rgb(34_62_47_/_2%)] sm:p-6">
      <div className="mb-3">
        <h2 className="m-0 text-base font-bold">Primijenjeni lijekovi</h2>
        <p className="mb-0 mt-1 text-sm text-muted">
          Svaka primjena se evidentira i odmah umanjuje stanje odabrane serije.
        </p>
      </div>

      {administrations.length ? (
        <ul className="mb-4 mt-0 divide-y divide-[#eef1ef] border-y border-[#eef1ef] p-0">
          {administrations.map((item) => (
            <li className="flex items-start justify-between gap-3 py-3" key={item.id}>
              <div className="min-w-0">
                <h3 className="m-0 text-sm font-bold">{item.medicationName}</h3>
                <p className="mb-0 mt-1 text-xs text-muted">
                  Serija {item.batchNumber} ·{" "}
                  {new Intl.DateTimeFormat("bs-BA", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "Europe/Sarajevo",
                  }).format(new Date(item.administeredAt))}
                </p>
                {item.notes ? (
                  <p className="mb-0 mt-1 whitespace-pre-wrap text-sm text-[#53645a]">{item.notes}</p>
                ) : null}
              </div>
              <span className="shrink-0 text-sm font-bold tabular-nums">
                {formatQuantity(item.quantity)} {item.unit}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-4 rounded-lg bg-[#f7faf8] px-3 py-3 text-sm text-muted">
          Ovaj pregled nema evidentiranih primjena lijeka.
        </p>
      )}

      {editable ? (
        batches.length ? (
          <form className="grid grid-cols-1 gap-3 sm:grid-cols-2" onSubmit={addAdministration}>
            <label className="grid gap-1.5 text-xs font-semibold text-muted sm:col-span-2">
              Lijek i serija *
              <select className={inputClass} name="batchId" required defaultValue="">
                <option value="" disabled>Odaberite raspoloživu seriju</option>
                {batches.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.medicationName} · serija {batch.batchNumber} · stanje{" "}
                    {formatQuantity(batch.quantityRemaining)} {batch.unit}
                    {batch.expiresAt ? ` · rok ${batch.expiresAt}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-xs font-semibold text-muted">
              Utrošena količina *
              <input
                className={inputClass}
                name="quantity"
                type="number"
                min="0.001"
                step="0.001"
                required
              />
            </label>
            <label className="grid gap-1.5 text-xs font-semibold text-muted">
              Napomena
              <input className={inputClass} name="notes" maxLength={10000} />
            </label>
            {error ? (
              <p className="m-0 rounded-lg bg-[#fbefee] px-3 py-2.5 text-sm text-[#a43e3c] sm:col-span-2" role="alert">
                {error}
              </p>
            ) : null}
            <button
              className="min-h-11 rounded-lg bg-green px-4 text-sm font-bold text-white hover:bg-green-dark disabled:opacity-60 sm:col-span-2 sm:justify-self-end"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Evidentiranje..." : "Evidentiraj primjenu"}
            </button>
          </form>
        ) : (
          <p className="m-0 rounded-lg bg-[#fff4df] px-3 py-3 text-sm text-[#93631b]">
            Nema raspoloživih aktivnih serija. Unesite zalihu u modulu Lijekovi i zalihe.
          </p>
        )
      ) : error ? (
        <p className="m-0 rounded-lg bg-[#fbefee] px-3 py-2.5 text-sm text-[#a43e3c]" role="alert">{error}</p>
      ) : null}
    </section>
  );
}

const inputClass =
  "h-11 w-full rounded-lg border border-[#dce4de] bg-white px-3 text-sm text-ink outline-none focus:border-green focus:ring-2 focus:ring-green/15";
