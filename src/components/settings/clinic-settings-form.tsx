"use client";

import { useState, type FormEvent } from "react";
import type { WorkingHours } from "@/features/settings/validation";

const weekdays: { key: keyof WorkingHours; label: string }[] = [
  { key: "1", label: "Ponedjeljak" },
  { key: "2", label: "Utorak" },
  { key: "3", label: "Srijeda" },
  { key: "4", label: "Četvrtak" },
  { key: "5", label: "Petak" },
  { key: "6", label: "Subota" },
  { key: "7", label: "Nedjelja" },
];

type Settings = {
  clinicName: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  taxIdentificationNumber: string;
  invoicePrefix: string;
  defaultTaxRate: string;
  appointmentDurationMinutes: number;
  nextInvoiceNumber: number;
  workingHours: WorkingHours;
};

function getErrorMessage(value: unknown) {
  if (typeof value === "object" && value !== null && "error" in value && typeof value.error === "string") {
    return value.error;
  }
  return "Postavke nije moguće sačuvati. Provjerite unesene podatke.";
}

export function ClinicSettingsForm({ settings }: { settings: Settings }) {
  const [workingHours, setWorkingHours] = useState(settings.workingHours);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaved(false);
    setIsSubmitting(true);
    try {
      const body = Object.fromEntries(new FormData(event.currentTarget).entries());
      const response = await fetch("/api/settings/clinic", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...body,
          appointmentDurationMinutes: Number(body.appointmentDurationMinutes),
          workingHours,
        }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        setError(getErrorMessage(result));
        return;
      }
      setSaved(true);
    } catch {
      setError("Nije moguće povezati se sa serverom. Pokušajte ponovo.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="max-w-[900px] rounded-xl border border-line bg-white p-4 shadow-[0_2px_6px_rgb(34_62_47_/_2%)] sm:p-6" onSubmit={submit}>
      <section>
        <h2 className="m-0 text-base font-bold">Podaci ambulante</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-xs font-semibold text-muted sm:col-span-2">
            Naziv ambulante *
            <input className={inputClass} name="clinicName" defaultValue={settings.clinicName} maxLength={180} required />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-muted sm:col-span-2">
            Adresa
            <input className={inputClass} name="address" defaultValue={settings.address} maxLength={240} />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-muted">
            Grad
            <input className={inputClass} name="city" defaultValue={settings.city} maxLength={120} />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-muted">
            Telefon
            <input className={inputClass} name="phone" type="tel" defaultValue={settings.phone} maxLength={40} />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-muted">
            E-mail
            <input className={inputClass} name="email" type="email" defaultValue={settings.email} maxLength={254} />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-muted">
            Porezni identifikacioni broj
            <input className={inputClass} name="taxIdentificationNumber" defaultValue={settings.taxIdentificationNumber} maxLength={80} />
          </label>
        </div>
      </section>

      <section className="mt-6 border-t border-line pt-5">
        <h2 className="m-0 text-base font-bold">Početne postavke</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-xs font-semibold text-muted">
            Prefiks broja računa *
            <input className={inputClass} name="invoicePrefix" defaultValue={settings.invoicePrefix} pattern="[A-Z0-9-]{1,12}" maxLength={12} required />
            <span className="font-normal">Velika slova, brojevi i crtica; postojeći računi se ne mijenjaju.</span>
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-muted">
            Standardna porezna stopa (%)
            <input className={inputClass} name="defaultTaxRate" type="number" min="0" max="100" step="0.01" defaultValue={settings.defaultTaxRate} required />
            <span className="font-normal">Može se promijeniti na pojedinačnom računu.</span>
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-muted">
            Standardno trajanje termina (minute)
            <input className={inputClass} name="appointmentDurationMinutes" type="number" min="5" max="480" step="5" defaultValue={settings.appointmentDurationMinutes} required />
          </label>
          <div className="grid gap-1.5 text-xs font-semibold text-muted">
            Valuta
            <div className={`${inputClass} flex items-center bg-[#f7faf8]`}>BAM (KM)</div>
            <span className="font-normal">Valuta je trenutno fiksirana na KM.</span>
          </div>
        </div>
        <p className="mb-0 mt-4 rounded-lg bg-[#f7faf8] p-3 text-xs text-[#53645a]">
          Sljedeći broj računa: <strong>{settings.invoicePrefix}-{String(settings.nextInvoiceNumber).padStart(6, "0")}</strong>.
          Brojač se uvećava automatski i nije moguće ručno ga mijenjati.
        </p>
      </section>

      <section className="mt-6 border-t border-line pt-5">
        <h2 className="m-0 text-base font-bold">Sedmično radno vrijeme</h2>
        <p className="mb-0 mt-1 text-xs text-muted">
          Novi termini moraju početi i završiti unutar navedenog vremena. Vremenska zona: Europe/Sarajevo.
        </p>
        <div className="mt-3 divide-y divide-[#eef1ef] rounded-lg border border-[#eef1ef]">
          {weekdays.map(({ key, label }) => {
            const day = workingHours[key];
            return (
              <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-[minmax(120px,1fr)_100px_1fr_1fr] sm:items-center" key={key}>
                <span className="text-sm font-semibold">{label}</span>
                <label className="flex min-h-10 items-center gap-2 text-xs font-semibold text-muted">
                  <input
                    checked={day.enabled}
                    className="size-4 accent-green"
                    type="checkbox"
                    onChange={(event) => setWorkingHours((current) => ({
                      ...current,
                      [key]: { ...current[key], enabled: event.target.checked },
                    }))}
                  />
                  Otvoreno
                </label>
                <label className="grid grid-cols-[48px_minmax(0,1fr)] items-center gap-2 text-xs font-semibold text-muted">
                  Od
                  <input
                    className={inputClass}
                    disabled={!day.enabled}
                    type="time"
                    value={day.start}
                    onChange={(event) => setWorkingHours((current) => ({
                      ...current,
                      [key]: { ...current[key], start: event.target.value },
                    }))}
                  />
                </label>
                <label className="grid grid-cols-[48px_minmax(0,1fr)] items-center gap-2 text-xs font-semibold text-muted">
                  Do
                  <input
                    className={inputClass}
                    disabled={!day.enabled}
                    type="time"
                    value={day.end}
                    onChange={(event) => setWorkingHours((current) => ({
                      ...current,
                      [key]: { ...current[key], end: event.target.value },
                    }))}
                  />
                </label>
              </div>
            );
          })}
        </div>
      </section>

      {error ? <p className="mt-4 rounded-lg bg-[#fbefee] px-3 py-2.5 text-sm text-[#a43e3c]" role="alert">{error}</p> : null}
      {saved ? <p className="mt-4 rounded-lg bg-green-soft px-3 py-2.5 text-sm font-semibold text-green-dark" role="status">Postavke su sačuvane.</p> : null}
      <button className="mt-5 min-h-11 w-full rounded-lg bg-green px-4 text-sm font-bold text-white hover:bg-green-dark disabled:opacity-60 sm:w-auto" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Čuvanje..." : "Sačuvaj postavke"}
      </button>
    </form>
  );
}

const inputClass =
  "min-h-11 w-full rounded-lg border border-[#dce4de] bg-white px-3 text-sm text-ink outline-none focus:border-green focus:ring-2 focus:ring-green/15";
