"use client";

import { useState, type FormEvent } from "react";
import { z } from "zod";

const performedServiceSchema = z.object({
  id: z.string(),
  serviceId: z.string(),
  name: z.string(),
  quantity: z.string(),
  priceAtTime: z.string(),
});

type PerformedService = {
  id: string;
  serviceId: string;
  name: string;
  quantity: string;
  priceAtTime: string;
};

type AvailableService = {
  id: string;
  name: string;
  price: string;
};

function errorMessage(value: unknown) {
  return typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof value.error === "string"
    ? value.error
    : "Nije moguće sačuvati izvršenu uslugu.";
}

function money(value: string) {
  return new Intl.NumberFormat("bs-BA", {
    style: "currency",
    currency: "BAM",
  }).format(Number(value));
}

export function ExaminationServicePanel({
  examinationId,
  initialServices,
  availableServices,
  editable,
}: {
  examinationId: string;
  initialServices: PerformedService[];
  availableServices: AvailableService[];
  editable: boolean;
}) {
  const [services, setServices] = useState(initialServices);
  const [serviceId, setServiceId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState("");
  const selectedService = availableServices.find((service) => service.id === serviceId);

  async function addService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!serviceId || saving) return;
    setError("");
    setSaving(true);
    try {
      const response = await fetch(`/api/examinations/${examinationId}/services`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId, quantity }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        setError(errorMessage(result));
        return;
      }
      if (
        typeof result !== "object" ||
        result === null ||
        !("service" in result) ||
        typeof result.service !== "object" ||
        result.service === null
      ) {
        setError("Server nije vratio podatke o usluzi. Osvježite stranicu.");
        return;
      }
      const parsedService = performedServiceSchema.safeParse(result.service);
      if (!parsedService.success) {
        setError("Server nije vratio ispravne podatke o usluzi. Osvježite stranicu.");
        return;
      }
      setServices((current) => [...current, parsedService.data]);
      setServiceId("");
      setQuantity("1");
    } catch {
      setError("Nije moguće povezati se sa serverom. Pokušajte ponovo.");
    } finally {
      setSaving(false);
    }
  }

  async function removeService(entryId: string) {
    setError("");
    setRemovingId(entryId);
    try {
      const response = await fetch(
        `/api/examinations/${examinationId}/services/${entryId}`,
        { method: "DELETE" },
      );
      const result: unknown = await response.json();
      if (!response.ok) {
        setError(errorMessage(result));
        return;
      }
      setServices((current) => current.filter((entry) => entry.id !== entryId));
    } catch {
      setError("Nije moguće povezati se sa serverom. Pokušajte ponovo.");
    } finally {
      setRemovingId("");
    }
  }

  return (
    <section className="mt-4 w-full max-w-[900px] rounded-xl border border-line bg-white p-4 shadow-[0_2px_6px_rgb(34_62_47_/_2%)] sm:p-6">
      <div className="mb-3">
        <h2 className="m-0 text-base font-bold">Izvršene usluge</h2>
        <p className="mb-0 mt-1 text-sm text-muted">
          Cijena se bilježi prema cjenovniku u trenutku dodavanja i može se prenijeti na račun.
        </p>
      </div>
      {services.length ? (
        <ul className="mb-4 mt-0 divide-y divide-[#eef1ef] border-y border-[#eef1ef] p-0">
          {services.map((entry) => (
            <li className="flex items-start justify-between gap-3 py-3" key={entry.id}>
              <div className="min-w-0">
                <h3 className="m-0 text-sm font-bold">{entry.name}</h3>
                <p className="mb-0 mt-1 text-xs text-muted">
                  Količina {entry.quantity} · {money(entry.priceAtTime)} po jedinici · Ukupno{" "}
                  {money((Number(entry.quantity) * Number(entry.priceAtTime)).toFixed(2))}
                </p>
              </div>
              {editable ? (
                <button
                  className="inline-flex min-h-10 shrink-0 items-center rounded-lg border border-line px-3 text-xs font-semibold text-[#6a746e] hover:bg-[#f7faf8] disabled:opacity-60"
                  type="button"
                  onClick={() => removeService(entry.id)}
                  disabled={Boolean(removingId) || saving}
                >
                  {removingId === entry.id ? "Uklanjanje..." : "Ukloni"}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-4 rounded-lg bg-[#f7faf8] px-3 py-3 text-sm text-muted">
          Za ovaj pregled još nije evidentirana usluga.
        </p>
      )}
      {editable ? (
        <form className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_120px_auto] sm:items-end" onSubmit={addService}>
          <label className="grid gap-1.5 text-xs font-semibold text-muted">
            Usluga iz cjenovnika
            <select
              className={inputClass}
              value={serviceId}
              onChange={(event) => setServiceId(event.target.value)}
              required
            >
              <option value="">Odaberite uslugu</option>
              {availableServices.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name} · {money(service.price)}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-muted">
            Količina
            <input
              className={inputClass}
              type="number"
              min="0.01"
              step="0.01"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              required
            />
          </label>
          <button
            className="min-h-11 rounded-lg bg-green px-4 text-sm font-bold text-white hover:bg-green-dark disabled:opacity-60"
            type="submit"
            disabled={saving || Boolean(removingId) || !selectedService}
          >
            {saving ? "Dodavanje..." : "Dodaj uslugu"}
          </button>
          {!availableServices.length ? (
            <p className="m-0 text-xs text-muted sm:col-span-3">Nema aktivnih usluga u cjenovniku.</p>
          ) : null}
        </form>
      ) : null}
      {error ? <p className="mb-0 mt-3 rounded-lg bg-[#fbefee] px-3 py-2.5 text-sm text-[#a43e3c]" role="alert">{error}</p> : null}
    </section>
  );
}

const inputClass =
  "h-11 w-full rounded-lg border border-[#dce4de] bg-white px-3 text-sm text-ink outline-none focus:border-green focus:ring-2 focus:ring-green/15";
