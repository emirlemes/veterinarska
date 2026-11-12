"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { getMedicationStockState } from "@/features/inventory/validation";

type Medication = {
  id: string;
  name: string;
  activeIngredient: string | null;
  form: string | null;
  strength: string | null;
  unit: string;
  minimumStock: string;
  quantity: string;
  expiredQuantity: string;
  batches: {
    id: string;
    batchNumber: string;
    expiresAt: string | null;
    quantityRemaining: string;
    isExpired: boolean;
  }[];
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
  return "Nije moguće sačuvati podatke. Pokušajte ponovo.";
}

function formatQuantity(value: string) {
  return new Intl.NumberFormat("bs-BA", { maximumFractionDigits: 3 }).format(Number(value));
}

function formatDate(value: string | null) {
  if (!value) return "Bez roka";
  return new Intl.DateTimeFormat("bs-BA", { dateStyle: "medium", timeZone: "Europe/Sarajevo" })
    .format(new Date(`${value}T00:00:00.000Z`));
}

export function InventoryManager({
  medications,
  canWrite,
}: {
  medications: Medication[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeEndpoint, setActiveEndpoint] = useState("");

  async function submit(
    event: FormEvent<HTMLFormElement>,
    endpoint: string,
    method: "POST",
    onSuccess?: () => void,
  ) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    const form = event.currentTarget;
    setActiveEndpoint(endpoint);
    try {
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(new FormData(form).entries())),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        setError(getErrorMessage(result));
        return;
      }
      onSuccess?.();
      form.reset();
      router.refresh();
    } catch {
      setError("Nije moguće povezati se sa serverom. Pokušajte ponovo.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {canWrite ? (
        <section className="rounded-xl border border-line bg-white p-4 shadow-[0_2px_6px_rgb(34_62_47_/_2%)] sm:p-5">
          <h2 className="m-0 text-base font-bold">Dodaj lijek u registar</h2>
          <form
            className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
            onSubmit={(event) => submit(event, "/api/inventory/medications", "POST")}
          >
            <label className="grid gap-1.5 text-xs font-semibold text-muted">Naziv lijeka *
              <input className={inputClass} name="name" maxLength={180} required />
            </label>
            <label className="grid gap-1.5 text-xs font-semibold text-muted">Aktivna supstanca
              <input className={inputClass} name="activeIngredient" maxLength={180} />
            </label>
            <label className="grid gap-1.5 text-xs font-semibold text-muted">Oblik
              <input className={inputClass} name="form" maxLength={100} placeholder="Tableta, rastvor..." />
            </label>
            <label className="grid gap-1.5 text-xs font-semibold text-muted">Jačina
              <input className={inputClass} name="strength" maxLength={100} placeholder="Npr. 50 mg" />
            </label>
            <label className="grid gap-1.5 text-xs font-semibold text-muted">Jedinica mjere *
              <input className={inputClass} name="unit" maxLength={40} required placeholder="kom, ml, g..." />
            </label>
            <label className="grid gap-1.5 text-xs font-semibold text-muted">Minimalna zaliha
              <input className={inputClass} name="minimumStock" type="number" min="0" step="0.001" defaultValue="0" required />
            </label>
            {error && activeEndpoint === "/api/inventory/medications" ? (
              <p className="m-0 text-sm text-[#a43e3c] sm:col-span-2 lg:col-span-3" role="alert">{error}</p>
            ) : null}
            <button
              className="min-h-11 rounded-lg bg-green px-4 text-sm font-bold text-white hover:bg-green-dark disabled:opacity-60 sm:col-span-2 lg:col-span-3 lg:justify-self-end"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Čuvanje..." : "Dodaj lijek"}
            </button>
          </form>
        </section>
      ) : null}

      {medications.length ? (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {medications.map((medication) => {
            const quantity = Number(medication.quantity);
            const minimum = Number(medication.minimumStock);
            const expired = Number(medication.expiredQuantity);
            const usableQuantity = Math.max(0, quantity - expired);
            const stockState = getMedicationStockState(usableQuantity, minimum);
            const status = expired >= quantity && quantity > 0
              ? { label: "Samo istekle serije", style: "bg-[#fbefee] text-[#a43e3c]" }
              : stockState === "OUT_OF_STOCK"
                ? { label: "Nema zalihe", style: "bg-[#fbefee] text-[#a43e3c]" }
                : stockState === "LOW_STOCK"
                  ? { label: "Niska zaliha", style: "bg-[#fff4df] text-[#93631b]" }
                  : { label: "Dostupno", style: "bg-[#edf4ef] text-[#587362]" };
            return (
              <article className="min-w-0 rounded-xl border border-line bg-white p-4 shadow-[0_2px_6px_rgb(34_62_47_/_2%)] sm:p-5" key={medication.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="m-0 break-words text-base font-bold">{medication.name}</h2>
                    <p className="mb-0 mt-1 text-sm text-muted">
                      {[medication.activeIngredient, medication.form, medication.strength].filter(Boolean).join(" · ") || "Bez dodatnih detalja"}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${status.style}`}>
                    {status.label}
                  </span>
                </div>
                <div className="mt-4 flex items-baseline gap-2 border-b border-[#eef1ef] pb-3">
                  <span className="text-2xl font-bold tabular-nums">{formatQuantity(medication.quantity)}</span>
                  <span className="text-sm text-muted">{medication.unit} ukupno</span>
                  <span className="ml-auto text-xs text-muted">
                    Minimum: {formatQuantity(medication.minimumStock)}
                  </span>
                </div>
                {expired > 0 ? (
                  <p className="mb-0 mt-2 text-xs font-medium text-[#a43e3c]">
                    Istekle serije: {formatQuantity(medication.expiredQuantity)} {medication.unit}
                  </p>
                ) : null}
                <details className="mt-3">
                  <summary className="min-h-10 cursor-pointer py-2 text-sm font-semibold text-green-dark">
                    Serije ({medication.batches.length})
                  </summary>
                  {medication.batches.length ? (
                    <ul className="m-0 divide-y divide-[#eef1ef] p-0">
                      {medication.batches.map((batch) => (
                        <li className="flex flex-wrap justify-between gap-2 py-2 text-sm" key={batch.id}>
                          <span>
                            Serija {batch.batchNumber} · Istek: {formatDate(batch.expiresAt)}
                            {batch.isExpired ? " · ISTEKLA" : ""}
                          </span>
                          <span className="font-semibold tabular-nums">
                            {formatQuantity(batch.quantityRemaining)} {medication.unit}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="m-0 py-2 text-sm text-muted">Nema evidentiranih serija.</p>
                  )}
                  {canWrite ? (
                    <div className="mt-3 grid grid-cols-1 gap-4 border-t border-line pt-3">
                      <form
                        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
                        onSubmit={(event) =>
                          submit(event, `/api/inventory/medications/${medication.id}/batches`, "POST")
                        }
                      >
                        <h3 className="m-0 text-sm font-bold sm:col-span-2">Prijem serije</h3>
                        <label className="grid gap-1.5 text-xs font-semibold text-muted">Broj serije *
                          <input className={inputClass} name="batchNumber" maxLength={100} required />
                        </label>
                        <label className="grid gap-1.5 text-xs font-semibold text-muted">Količina *
                          <input className={inputClass} name="quantity" type="number" min="0.001" step="0.001" required />
                        </label>
                        <label className="grid gap-1.5 text-xs font-semibold text-muted">Rok trajanja
                          <input className={inputClass} name="expiresAt" type="date" />
                        </label>
                        <label className="grid gap-1.5 text-xs font-semibold text-muted">Nabavna cijena
                          <input className={inputClass} name="purchasePrice" type="number" min="0" step="0.01" />
                        </label>
                        <label className="grid gap-1.5 text-xs font-semibold text-muted sm:col-span-2">Napomena
                          <input className={inputClass} name="reason" maxLength={240} placeholder="Dobavljač ili detalji prijema" />
                        </label>
                        {error && activeEndpoint === `/api/inventory/medications/${medication.id}/batches` ? (
                          <p className="m-0 text-sm text-[#a43e3c] sm:col-span-2" role="alert">{error}</p>
                        ) : null}
                        <button
                          className="min-h-11 rounded-lg border border-line px-4 text-sm font-bold text-[#53645a] hover:bg-[#f7faf8] disabled:opacity-60 sm:col-span-2 sm:justify-self-end"
                          type="submit"
                          disabled={isSubmitting}
                        >
                          {isSubmitting && activeEndpoint === `/api/inventory/medications/${medication.id}/batches`
                            ? "Čuvanje..."
                            : "Primiti novu seriju"}
                        </button>
                      </form>
                      {medication.batches.map((batch) => (
                        <form
                          className="grid grid-cols-1 gap-3 border-t border-[#eef1ef] pt-3 sm:grid-cols-2"
                          key={batch.id}
                          onSubmit={(event) =>
                            submit(
                              event,
                              `/api/inventory/medications/${medication.id}/batches/${batch.id}/adjustments`,
                              "POST",
                            )
                          }
                        >
                          <h3 className="m-0 text-sm font-bold sm:col-span-2">
                            Korekcija serije {batch.batchNumber} · raspoloživo{" "}
                            {formatQuantity(batch.quantityRemaining)} {medication.unit}
                          </h3>
                          <label className="grid gap-1.5 text-xs font-semibold text-muted">Vrsta korekcije *
                            <select className={inputClass} name="direction" defaultValue="REMOVE">
                              <option value="REMOVE">Umanji zalihu</option>
                              <option value="ADD">Uvećaj zalihu</option>
                            </select>
                          </label>
                          <label className="grid gap-1.5 text-xs font-semibold text-muted">Količina *
                            <input className={inputClass} name="quantity" type="number" min="0.001" step="0.001" required />
                          </label>
                          <label className="grid gap-1.5 text-xs font-semibold text-muted sm:col-span-2">Razlog korekcije *
                            <input className={inputClass} name="reason" maxLength={240} required placeholder="Npr. inventura, oštećenje, ispravka prijema" />
                          </label>
                          {error && activeEndpoint === `/api/inventory/medications/${medication.id}/batches/${batch.id}/adjustments` ? (
                            <p className="m-0 text-sm text-[#a43e3c] sm:col-span-2" role="alert">{error}</p>
                          ) : null}
                          <button
                            className="min-h-11 rounded-lg border border-line px-4 text-sm font-bold text-[#53645a] hover:bg-[#f7faf8] disabled:opacity-60 sm:col-span-2 sm:justify-self-end"
                            type="submit"
                            disabled={isSubmitting}
                          >
                            {isSubmitting && activeEndpoint.endsWith(`${batch.id}/adjustments`)
                              ? "Čuvanje..."
                              : "Sačuvaj korekciju"}
                          </button>
                        </form>
                      ))}
                    </div>
                  ) : null}
                </details>
              </article>
            );
          })}
        </div>
      ) : (
        <section className="rounded-xl border border-line bg-white px-4 py-12 text-center shadow-[0_2px_6px_rgb(34_62_47_/_2%)]">
          <p className="mb-1 text-sm font-semibold">Registar lijekova je prazan.</p>
          <p className="m-0 text-sm text-muted">
            {canWrite ? "Dodajte lijek i zatim evidentirajte njegovu prvu seriju." : "Nema lijekova za prikaz."}
          </p>
        </section>
      )}
    </div>
  );
}

const inputClass =
  "h-11 w-full rounded-lg border border-[#dce4de] bg-white px-3 text-sm text-ink outline-none focus:border-green focus:ring-2 focus:ring-green/15";
