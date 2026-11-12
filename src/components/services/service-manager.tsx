"use client";

import { useState, type FormEvent } from "react";

type Service = {
  id: string;
  name: string;
  description: string | null;
  price: string;
  isActive: boolean;
};

const emptyDraft = { name: "", description: "", price: "" };

function getErrorMessage(value: unknown) {
  if (typeof value === "object" && value !== null && "error" in value && typeof value.error === "string") {
    return value.error;
  }
  return "Uslugu nije moguće sačuvati. Provjerite unesene podatke.";
}

function formatCurrency(value: string) {
  return new Intl.NumberFormat("bs-BA", { style: "currency", currency: "BAM" }).format(Number(value));
}

export function ServiceManager({
  services: initialServices,
  canWrite,
}: {
  services: Service[];
  canWrite: boolean;
}) {
  const [services, setServices] = useState(initialServices);
  const [draft, setDraft] = useState(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function startEditing(service: Service) {
    setEditingId(service.id);
    setDraft({
      name: service.name,
      description: service.description ?? "",
      price: service.price,
    });
    setError("");
  }

  function cancelEditing() {
    setEditingId(null);
    setDraft(emptyDraft);
    setError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      const response = await fetch(editingId ? `/api/services/${editingId}` : "/api/services", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        setError(getErrorMessage(result));
        return;
      }
      if (editingId) {
        setServices((current) => current.map((service) => service.id === editingId
          ? { ...service, ...draft, description: draft.description || null }
          : service));
      } else if (typeof result === "object" && result !== null && "id" in result && typeof result.id === "string") {
        const createdId = result.id;
        setServices((current) => [...current, {
          ...draft,
          id: createdId,
          description: draft.description || null,
          isActive: true,
        }].sort((a, b) => a.name.localeCompare(b.name, "bs")));
      } else {
        setError("Server nije vratio sačuvanu uslugu. Osvježite stranicu.");
        return;
      }
      cancelEditing();
    } catch {
      setError("Nije moguće povezati se sa serverom. Pokušajte ponovo.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function toggleActive(service: Service) {
    setError("");
    try {
      const response = await fetch(`/api/services/${service.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !service.isActive }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        setError(getErrorMessage(result));
        return;
      }
      setServices((current) => current.map((item) => item.id === service.id
        ? { ...item, isActive: !item.isActive }
        : item));
    } catch {
      setError("Nije moguće povezati se sa serverom. Pokušajte ponovo.");
    }
  }

  const activeServices = services.filter((service) => service.isActive);
  const archivedServices = services.filter((service) => !service.isActive);

  function serviceRows(rows: Service[]) {
    return rows.map((service) => (
      <article className="flex flex-col gap-3 rounded-lg border border-[#eef1ef] p-3 sm:flex-row sm:items-center sm:justify-between sm:px-4" key={service.id}>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="m-0 text-sm font-bold">{service.name}</h3>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${service.isActive ? "bg-green-soft text-green-dark" : "bg-[#f1f3f2] text-muted"}`}>
              {service.isActive ? "Aktivna" : "Arhivirana"}
            </span>
          </div>
          {service.description ? <p className="mb-0 mt-1 text-xs text-muted">{service.description}</p> : null}
        </div>
        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <span className="text-sm font-bold tabular-nums">{formatCurrency(service.price)}</span>
          {canWrite ? (
            <div className="flex gap-2">
              <button
                className="min-h-10 rounded-lg border border-line px-3 text-xs font-semibold text-[#53645a] hover:bg-[#f7faf8]"
                type="button"
                onClick={() => startEditing(service)}
              >
                Uredi
              </button>
              <button
                className="min-h-10 rounded-lg border border-line px-3 text-xs font-semibold text-[#53645a] hover:bg-[#f7faf8]"
                type="button"
                onClick={() => void toggleActive(service)}
              >
                {service.isActive ? "Arhiviraj" : "Aktiviraj"}
              </button>
            </div>
          ) : null}
        </div>
      </article>
    ));
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(300px,0.7fr)]">
      <section className="min-w-0 rounded-xl border border-line bg-white p-3 shadow-[0_2px_6px_rgb(34_62_47_/_2%)] sm:p-5">
        <h2 className="m-0 text-base font-bold">Aktivne usluge ({activeServices.length})</h2>
        <div className="mt-3 space-y-2">
          {activeServices.length ? serviceRows(activeServices) : (
            <p className="m-0 rounded-lg bg-[#f7faf8] p-4 text-sm text-muted">Nema aktivnih usluga u cjenovniku.</p>
          )}
        </div>
        {archivedServices.length ? (
          <details className="mt-5 border-t border-line pt-4">
            <summary className="cursor-pointer text-sm font-semibold text-[#53645a]">
              Arhivirane usluge ({archivedServices.length})
            </summary>
            <div className="mt-3 space-y-2">{serviceRows(archivedServices)}</div>
          </details>
        ) : null}
      </section>

      {canWrite ? (
        <section className="h-fit rounded-xl border border-line bg-white p-4 shadow-[0_2px_6px_rgb(34_62_47_/_2%)] sm:p-5">
          <h2 className="m-0 text-base font-bold">{editingId ? "Uredi uslugu" : "Dodaj uslugu"}</h2>
          <form className="mt-4 grid gap-3" onSubmit={submit}>
            <label className="grid gap-1.5 text-xs font-semibold text-muted">
              Naziv *
              <input
                className={inputClass}
                value={draft.name}
                onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                maxLength={180}
                required
              />
            </label>
            <label className="grid gap-1.5 text-xs font-semibold text-muted">
              Opis
              <textarea
                className={`${inputClass} min-h-20 resize-y py-2`}
                value={draft.description}
                onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                maxLength={10000}
                rows={3}
              />
            </label>
            <label className="grid gap-1.5 text-xs font-semibold text-muted">
              Cijena (KM) *
              <input
                className={inputClass}
                type="number"
                min="0"
                step="0.01"
                value={draft.price}
                onChange={(event) => setDraft((current) => ({ ...current, price: event.target.value }))}
                required
              />
            </label>
            {error ? <p className="m-0 rounded-lg bg-[#fbefee] px-3 py-2.5 text-sm text-[#a43e3c]" role="alert">{error}</p> : null}
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              {editingId ? (
                <button className="min-h-11 rounded-lg border border-line px-4 text-sm font-semibold text-[#53645a]" type="button" onClick={cancelEditing}>
                  Odustani
                </button>
              ) : null}
              <button
                className="min-h-11 flex-1 rounded-lg bg-green px-4 text-sm font-bold text-white hover:bg-green-dark disabled:opacity-60"
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Čuvanje..." : editingId ? "Sačuvaj izmjene" : "Dodaj uslugu"}
              </button>
            </div>
          </form>
        </section>
      ) : null}
    </div>
  );
}

const inputClass =
  "min-h-11 w-full rounded-lg border border-[#dce4de] bg-white px-3 text-sm text-ink outline-none focus:border-green focus:ring-2 focus:ring-green/15";
