"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { z } from "zod";
import { completionSummarySchema } from "@/features/examinations/completion-summary";

type Summary = z.infer<typeof completionSummarySchema>;

function responseError(value: unknown) {
  if (typeof value === "object" && value !== null && "error" in value && typeof value.error === "string") {
    return value.error;
  }
  return "Operaciju nije moguće izvršiti. Pokušajte ponovo.";
}

function CompletionDialog({ id, canReadAnimals, canWriteInvoices, canReadInvoices, onClose }: {
  id: string;
  canReadAnimals: boolean;
  canWriteInvoices: boolean;
  canReadInvoices: boolean;
  onClose: (completed: boolean) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(`/api/examinations/${id}/complete`, { signal: controller.signal, cache: "no-store" });
        const value: unknown = await response.json();
        if (!response.ok) {
          setError(responseError(value));
          return;
        }
        const parsed = completionSummarySchema.safeParse(value);
        if (!parsed.success) {
          setError("Server nije vratio ispravne podatke pregleda. Osvježite i pokušajte ponovo.");
          return;
        }
        setSummary(parsed.data);
      } catch {
        if (!controller.signal.aborted) setError("Nije moguće povezati se sa serverom. Pokušajte ponovo.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [id]);

  function dismiss() {
    if (!saving) onClose(completed);
  }

  async function complete() {
    if (submitting.current) return;
    submitting.current = true;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/examinations/${id}/complete`, { method: "POST" });
      const result: unknown = await response.json();
      if (!response.ok) {
        setError(responseError(result));
        return;
      }
      setCompleted(true);
    } catch {
      setError("Nije moguće povezati se sa serverom. Osvježite pregled i provjerite status prije ponovnog pokušaja.");
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => { event.preventDefault(); dismiss(); }}
      onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); dismiss(); } }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-xl border border-line bg-white p-4 text-ink shadow-xl backdrop:bg-black/40 sm:p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <h2 id={titleId} className="m-0 text-lg font-bold">{completed ? "Pregled je uspješno završen" : "Završi pregled"}</h2>
        <button type="button" aria-label="Zatvori prozor" onClick={dismiss} disabled={saving} className="grid size-11 shrink-0 place-items-center rounded-lg border border-line text-xl disabled:opacity-50">×</button>
      </div>
      {completed && summary ? (
        <>
          <p className="text-sm text-muted">Pregled je sačuvan u medicinskom kartonu životinje.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {canReadAnimals ? <Link href={`/animals/${summary.animalId}`} onClick={() => onClose(true)} className={secondaryClass}>Pregledaj karton</Link> : null}
            {summary.invoiceId && canReadInvoices ? <Link href={`/invoices/${summary.invoiceId}`} onClick={() => onClose(true)} className={secondaryClass}>Pregledaj račun</Link> : null}
            {!summary.invoiceId && canWriteInvoices ? <Link href={`/invoices/new?examinationId=${encodeURIComponent(id)}`} onClick={() => onClose(true)} className={secondaryClass}>Kreiraj račun</Link> : null}
            <Link href="/examinations" onClick={() => onClose(true)} className={secondaryClass}>Nazad na preglede</Link>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-muted">Da li ste sigurni da želite završiti ovaj pregled?</p>
          {loading ? <p role="status" className="text-sm text-muted">Učitavanje podataka pregleda...</p> : null}
          {summary ? (
            <dl className="grid grid-cols-[minmax(90px,auto)_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
              <dt className="text-muted">Životinja</dt><dd className="m-0 break-words">{summary.animal}</dd>
              <dt className="text-muted">Klijent</dt><dd className="m-0 break-words">{summary.client}</dd>
              <dt className="text-muted">Veterinar</dt><dd className="m-0 break-words">{summary.veterinarian}</dd>
              <dt className="text-muted">Datum</dt><dd className="m-0">{new Intl.DateTimeFormat("bs-BA", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Sarajevo" }).format(new Date(summary.date))}</dd>
              <dt className="text-muted">Dijagnoza</dt><dd className="m-0 break-words whitespace-pre-wrap">{summary.diagnosis?.trim() ? summary.diagnosis : "Nije unesena"}</dd>
              <dt className="text-muted">Terapija</dt><dd className="m-0 break-words">{summary.therapies.join(", ") || "Nije evidentirana"}</dd>
              <dt className="text-muted">Lijekovi</dt><dd className="m-0 break-words">{summary.medications.join(", ") || "Nisu evidentirani"}</dd>
              <dt className="text-muted">Usluge</dt><dd className="m-0 break-words">{summary.services.join(", ") || "Nisu evidentirane"}</dd>
            </dl>
          ) : null}
          {summary && !summary.diagnosis?.trim() ? <p role="alert" className="text-sm text-[#a43e3c]">Pregled nije moguće završiti jer dijagnoza nije unesena. <Link className="font-bold underline" href={`/examinations/${id}/edit`}>Dopuni pregled</Link></p> : null}
          {error ? <p role="alert" className="text-sm text-[#a43e3c]">{error} {summary && error.includes("dijagnoza") ? <Link className="font-bold underline" href={`/examinations/${id}/edit`}>Dopuni pregled</Link> : null}</p> : null}
          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={dismiss} disabled={saving} className={secondaryClass}>Odustani</button>
            <button type="button" onClick={() => { void complete(); }} disabled={saving || loading || !summary || !summary.diagnosis?.trim()} className="min-h-11 rounded-lg bg-green px-4 text-sm font-bold text-white disabled:opacity-50">{saving ? "Završavanje..." : "Završi pregled"}</button>
          </div>
        </>
      )}
    </dialog>
  );
}

const secondaryClass = "inline-flex min-h-11 items-center justify-center rounded-lg border border-line px-4 text-sm font-semibold text-green-dark disabled:opacity-50";

export function CompleteExaminationButton({ id, canReadAnimals, canWriteInvoices, canReadInvoices, className }: {
  id: string;
  canReadAnimals: boolean;
  canWriteInvoices: boolean;
  canReadInvoices: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  return (
    <>
      <button type="button" aria-haspopup="dialog" className={className ?? "min-h-11 rounded-lg bg-green px-4 text-sm font-bold text-white hover:bg-green-dark"} onClick={() => setOpen(true)}>Završi pregled</button>
      {open ? <CompletionDialog id={id} canReadAnimals={canReadAnimals} canWriteInvoices={canWriteInvoices} canReadInvoices={canReadInvoices} onClose={(completed) => { setOpen(false); if (completed) router.refresh(); }} /> : null}
    </>
  );
}
