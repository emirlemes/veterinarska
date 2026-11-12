"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

function getErrorMessage(value: unknown) {
  if (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof value.error === "string"
  ) {
    return value.error;
  }
  return "Uplatu nije moguće evidentirati. Pokušajte ponovo.";
}

export function InvoicePaymentPanel({
  invoiceId,
  remaining,
  payable,
}: {
  invoiceId: string;
  remaining: string;
  payable: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    const form = event.currentTarget;
    try {
      const formData = new FormData(form);
      const response = await fetch(`/api/invoices/${invoiceId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(formData.entries())),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        setError(getErrorMessage(result));
        return;
      }
      form.reset();
      router.refresh();
    } catch {
      setError("Nije moguće povezati se sa serverom. Pokušajte ponovo.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!payable) {
    return <p className="m-0 text-sm text-muted">Račun nema preostalo dugovanje za uplatu.</p>;
  }

  return (
    <form className="grid grid-cols-1 gap-3 sm:grid-cols-2" onSubmit={handleSubmit}>
      <label className="grid gap-1.5 text-xs font-semibold text-muted">
        Iznos uplate (KM) *
        <input
          className={inputClass}
          name="amount"
          type="number"
          min="0.01"
          max={remaining}
          step="0.01"
          required
        />
      </label>
      <label className="grid gap-1.5 text-xs font-semibold text-muted">
        Način plaćanja *
        <select className={inputClass} name="method" defaultValue="CASH" required>
          <option value="CASH">Gotovina</option>
          <option value="CARD">Kartica</option>
          <option value="BANK_TRANSFER">Bankovni transfer</option>
          <option value="OTHER">Ostalo</option>
        </select>
      </label>
      <label className="grid gap-1.5 text-xs font-semibold text-muted sm:col-span-2">
        Referenca / napomena
        <input className={inputClass} name="reference" maxLength={120} />
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
        {isSubmitting ? "Evidentiranje..." : "Evidentiraj uplatu"}
      </button>
    </form>
  );
}

const inputClass =
  "h-11 w-full rounded-lg border border-[#dce4de] bg-white px-3 text-sm text-ink outline-none focus:border-green focus:ring-2 focus:ring-green/15";
