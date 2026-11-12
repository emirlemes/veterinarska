"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { getInitialInvoiceItems } from "@/features/invoices/initial-items";

type Client = {
  id: string;
  firstName: string;
  lastName: string;
  companyName: string | null;
};

type Service = {
  id: string;
  name: string;
  price: string;
};

type DraftItem = {
  key: number;
  serviceId: string;
  description: string;
  quantity: string;
  unitPrice: string;
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
  return "Račun nije moguće sačuvati. Provjerite unesene podatke.";
}

function clientName(client: Client) {
  return client.companyName || `${client.firstName} ${client.lastName}`;
}

function toCents(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

export function InvoiceForm({
  clients,
  services,
  selectedClientId,
  examination,
  defaultTaxRate,
}: {
  clients: Client[];
  services: Service[];
  selectedClientId?: string;
  examination?: {
    id: string;
    clientId: string;
    animalName: string;
    diagnosis: string | null;
    services: { description: string; quantity: string; unitPrice: string }[];
    administeredMedications: { name: string; quantity: string; unit: string }[];
  };
  defaultTaxRate: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState<DraftItem[]>(() => {
    return getInitialInvoiceItems(examination?.services ?? [], examination?.diagnosis ?? null)
      .map((item, index) => ({
        key: index + 1,
        serviceId: "",
        ...item,
      }));
  });
  const [taxRate, setTaxRate] = useState(defaultTaxRate);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nextKey, setNextKey] = useState(2);
  const [clientId, setClientId] = useState(examination?.clientId ?? selectedClientId ?? "");

  const subtotalCents = useMemo(
    () => items.reduce((total, item) => total + Math.round(toCents(item.unitPrice) * Number(item.quantity || 0)), 0),
    [items],
  );
  const taxCents = Math.round(subtotalCents * Number(taxRate || 0) / 100);
  const totalCents = subtotalCents + taxCents;
  const money = (cents: number) =>
    new Intl.NumberFormat("bs-BA", { style: "currency", currency: "BAM" }).format(cents / 100);

  function updateItem(key: number, patch: Partial<DraftItem>) {
    setItems((current) => current.map((item) => item.key === key ? { ...item, ...patch } : item));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      const formData = new FormData(event.currentTarget);
      const payload = {
        clientId,
        examinationId: examination?.id ?? "",
        taxRate,
        dueAt: String(formData.get("dueAt") ?? ""),
        notes: String(formData.get("notes") ?? ""),
        items: items.map(({ serviceId, description, quantity, unitPrice }) => ({
          serviceId,
          description,
          quantity,
          unitPrice,
        })),
      };
      const response = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        setError(getErrorMessage(result));
        return;
      }
      if (
        typeof result !== "object" ||
        result === null ||
        !("id" in result) ||
        typeof result.id !== "string"
      ) {
        setError("Server nije vratio račun. Osvježite stranicu.");
        return;
      }
      router.push(`/invoices/${result.id}`);
      router.refresh();
    } catch {
      setError("Nije moguće povezati se sa serverom. Pokušajte ponovo.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      className="w-full max-w-[980px] rounded-xl border border-line bg-white p-4 shadow-[0_2px_6px_rgb(34_62_47_/_2%)] sm:p-6"
      onSubmit={handleSubmit}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-xs font-semibold text-muted">
          Klijent *
          <select
            className={inputClass}
            value={clientId}
            onChange={(event) => setClientId(event.target.value)}
            disabled={Boolean(examination)}
            required
          >
            <option value="">Odaberite klijenta</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>{clientName(client)}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-xs font-semibold text-muted">
          Datum dospijeća
          <input className={inputClass} name="dueAt" type="date" />
        </label>
      </div>
      {examination ? (
        <div className="mt-3 space-y-2">
          <p className="m-0 rounded-lg bg-[#f7faf8] p-3 text-sm text-[#53645a]">
            Povezano s pregledom životinje <strong>{examination.animalName}</strong>
            {examination.diagnosis ? ` · ${examination.diagnosis}` : ""}
          </p>
          {examination.services.length ? (
            <p className="m-0 rounded-lg bg-[#edf4ef] p-3 text-sm text-[#53645a]">
              Stavke su popunjene izvršenim uslugama i cijenama zabilježenim na pregledu.
            </p>
          ) : null}
          {examination.administeredMedications.length ? (
            <p className="m-0 rounded-lg bg-[#fff4df] p-3 text-sm text-[#76551f]">
              Na pregledu su primijenjeni lijekovi (
              {examination.administeredMedications.map((entry) =>
                `${entry.name} ${entry.quantity} ${entry.unit}`,
              ).join(", ")}).
              Nisu automatski dodani na račun jer katalog lijekova nema prodajnu cijenu; po potrebi ih dodajte kao ručne stavke.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-5 border-t border-line pt-4">
        <h2 className="m-0 text-base font-bold">Stavke računa</h2>
        <div className="mt-3 space-y-3">
          {items.map((item, index) => (
            <div className="grid grid-cols-1 gap-3 rounded-lg border border-[#eef1ef] p-3 sm:grid-cols-[minmax(0,1fr)_100px_140px_auto] sm:items-end" key={item.key}>
              <label className="grid gap-1.5 text-xs font-semibold text-muted sm:col-span-4">
                Cjenovnik
                <select
                  className={inputClass}
                  value={item.serviceId}
                  onChange={(event) => {
                    const service = services.find((entry) => entry.id === event.target.value);
                    updateItem(item.key, {
                      serviceId: service?.id ?? "",
                      ...(service ? { description: service.name, unitPrice: service.price } : {}),
                    });
                  }}
                >
                  <option value="">Ručna stavka</option>
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name} · {new Intl.NumberFormat("bs-BA", { style: "currency", currency: "BAM" }).format(Number(service.price))}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5 text-xs font-semibold text-muted">
                Opis *
                <input
                  className={inputClass}
                  value={item.description}
                  onChange={(event) => updateItem(item.key, { serviceId: "", description: event.target.value })}
                  maxLength={240}
                  required
                />
              </label>
              <label className="grid gap-1.5 text-xs font-semibold text-muted">
                Količina *
                <input
                  className={inputClass}
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={item.quantity}
                  onChange={(event) => updateItem(item.key, { quantity: event.target.value })}
                  required
                />
              </label>
              <label className="grid gap-1.5 text-xs font-semibold text-muted">
                Cijena po jedinici (KM) *
                <input
                  className={inputClass}
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.unitPrice}
                  onChange={(event) => updateItem(item.key, { serviceId: "", unitPrice: event.target.value })}
                  required
                />
              </label>
              <button
                className="min-h-11 rounded-lg border border-line px-3 text-xs font-semibold text-[#6a746e] hover:bg-[#f7faf8] disabled:opacity-50"
                type="button"
                onClick={() => setItems((current) => current.filter((entry) => entry.key !== item.key))}
                disabled={items.length === 1}
                aria-label={`Ukloni stavku ${index + 1}`}
              >
                Ukloni
              </button>
            </div>
          ))}
        </div>
        <button
          className="mt-3 min-h-10 rounded-lg border border-line px-3 text-sm font-semibold text-green-dark hover:bg-[#f7faf8]"
          type="button"
          onClick={() => {
            setItems((current) => [...current, { key: nextKey, serviceId: "", description: "", quantity: "1", unitPrice: "" }]);
            setNextKey((current) => current + 1);
          }}
        >
          + Dodaj stavku
        </button>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 border-t border-line pt-4 sm:grid-cols-2">
        <label className="grid max-w-[220px] gap-1.5 text-xs font-semibold text-muted">
          Porezna stopa (%)
          <input
            className={inputClass}
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={taxRate}
            onChange={(event) => setTaxRate(event.target.value)}
            required
          />
        </label>
        <label className="grid gap-1.5 text-xs font-semibold text-muted">
          Napomena
          <textarea className={`${inputClass} min-h-11 resize-y py-2`} name="notes" rows={2} maxLength={10000} />
        </label>
      </div>

      <dl className="ml-auto mt-4 grid w-full max-w-[360px] grid-cols-[1fr_auto] gap-x-6 gap-y-2 border-t border-line pt-4 text-sm">
        <dt className="text-muted">Međuzbir</dt><dd className="m-0 text-right tabular-nums">{money(subtotalCents)}</dd>
        <dt className="text-muted">Porez</dt><dd className="m-0 text-right tabular-nums">{money(taxCents)}</dd>
        <dt className="font-bold">Ukupno</dt><dd className="m-0 text-right font-bold tabular-nums">{money(totalCents)}</dd>
      </dl>

      {error ? <p className="mt-4 rounded-lg bg-[#fbefee] px-3 py-2.5 text-sm text-[#a43e3c]" role="alert">{error}</p> : null}
      <div className="mt-5 flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-between">
        <button
          className="min-h-11 rounded-lg border border-line px-4 text-sm font-semibold text-[#53645a] hover:bg-[#f7faf8]"
          type="button"
          onClick={() => router.back()}
        >
          Odustani
        </button>
        <button
          className="min-h-11 rounded-lg bg-green px-4 text-sm font-bold text-white hover:bg-green-dark disabled:opacity-60"
          type="submit"
          disabled={isSubmitting || !clientId || !items.length || totalCents <= 0}
        >
          {isSubmitting ? "Izdavanje..." : "Izdaj račun"}
        </button>
      </div>
    </form>
  );
}

const inputClass =
  "h-11 w-full rounded-lg border border-[#dce4de] bg-white px-3 text-sm text-ink outline-none focus:border-green focus:ring-2 focus:ring-green/15 disabled:bg-[#f7faf8]";
