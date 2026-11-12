"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

function getErrorMessage(value: unknown) {
  if (typeof value === "object" && value !== null && "error" in value && typeof value.error === "string") {
    return value.error;
  }
  return "Račun nije moguće stornirati. Pokušajte ponovo.";
}

export function InvoiceVoidPanel({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      const form = event.currentTarget;
      const response = await fetch(`/api/invoices/${invoiceId}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(new FormData(form).entries())),
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

  return (
    <details className="mt-5 border-t border-line pt-4">
      <summary className="w-fit cursor-pointer text-sm font-semibold text-[#a43e3c]">
        Storniraj račun
      </summary>
      <p className="mb-2 mt-2 text-xs text-muted">
        Račun se ne briše. Storno se evidentira u historiji, a sve uplate moraju prethodno biti stornirane.
      </p>
      <form className="grid gap-2 sm:grid-cols-[minmax(180px,1fr)_auto]" onSubmit={submit}>
        <label className="grid gap-1 text-[11px] font-semibold text-muted">
          Razlog *
          <input
            className={inputClass}
            name="reason"
            maxLength={240}
            required
          />
        </label>
        <button
          className="min-h-10 self-end rounded-lg border border-[#e8c9c7] px-3 text-xs font-bold text-[#a43e3c] hover:bg-[#fbefee] disabled:opacity-60"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Čuvanje..." : "Potvrdi storno računa"}
        </button>
        {error ? <p className="m-0 text-xs text-[#a43e3c] sm:col-span-2" role="alert">{error}</p> : null}
      </form>
    </details>
  );
}

const inputClass =
  "h-10 w-full rounded-lg border border-[#dce4de] bg-white px-2.5 text-sm text-ink outline-none focus:border-green focus:ring-2 focus:ring-green/15";
