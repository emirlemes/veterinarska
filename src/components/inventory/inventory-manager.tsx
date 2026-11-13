"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { getInventoryListDetails, matchesInventoryStatus, selectInventoryPage, type InventoryListItem, type InventoryStatus } from "@/features/inventory/list";
import { ClickableRow } from "@/components/clickable-row";
import { tableActionClass } from "@/components/table-action-styles";

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

function InventoryDialog({ title, description, busy, editable = false, onDismiss, children }: {
  title: string;
  description: string;
  busy: boolean;
  editable?: boolean;
  onDismiss: () => void;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [dirty, setDirty] = useState(false);

  function dismiss() {
    if (busy) return;
    if (dirty && !window.confirm("Imate nesačuvane izmjene. Želite li ih odbaciti?")) return;
    onDismiss();
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onChange={() => { if (editable) setDirty(true); }}
      onInput={() => { if (editable) setDirty(true); }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          dismiss();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        dismiss();
      }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-xl border border-line bg-white p-4 text-ink shadow-xl backdrop:bg-black/40 sm:p-6"
    >
      <div className="flex items-start justify-between gap-4 border-b border-line pb-3">
        <div><h2 id={titleId} className="m-0 text-lg font-bold">{title}</h2><p id={descriptionId} className="mb-0 mt-1 text-sm text-muted">{description}</p></div>
        <button type="button" aria-label="Zatvori prozor" onClick={dismiss} disabled={busy} className="grid size-11 shrink-0 place-items-center rounded-lg border border-line text-xl text-muted disabled:opacity-50">×</button>
      </div>
      <fieldset disabled={busy} className="m-0 min-w-0 border-0 p-0">{children}</fieldset>
      {editable ? <button type="button" onClick={dismiss} disabled={busy} className="mt-4 min-h-11 rounded-lg border border-line px-4 text-sm font-bold disabled:opacity-50">Odustani</button> : null}
    </dialog>
  );
}

export function InventoryManager({
  medications,
  canWrite,
  canViewHistory,
  initialStatus,
  today,
}: {
  medications: InventoryListItem[];
  canWrite: boolean;
  canViewHistory: boolean;
  initialStatus: InventoryStatus;
  today: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [activeEndpoint, setActiveEndpoint] = useState("");
  const [dialog, setDialog] = useState<{ type: "add" } | { type: "details" | "edit" | "receipt" | "adjust"; id: string } | null>(null);
  const [selectedBatch, setSelectedBatch] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState<"name" | "quantity">("name");
  const [page, setPage] = useState(1);
  const items = medications.map((medication) => ({
    medication,
    details: getInventoryListDetails(medication, today),
  }));
  const resultPage = selectInventoryPage(items, { status: initialStatus, search, category, sort, page, pageSize: 20 });
  const { items: visible, page: currentPage, pageCount } = resultPage;
  const stats: { label: string; value: number; status: InventoryStatus }[] = [
    { label: "Ukupno lijekova", value: items.length, status: "all" },
    { label: "Lijekovi na stanju", value: items.filter(({ details }) => matchesInventoryStatus(details, "in-stock")).length, status: "in-stock" },
    { label: "Na minimumu ili ispod", value: items.filter(({ details }) => details.low).length, status: "low" },
    { label: "Pred istekom (90 dana)", value: items.filter(({ details }) => details.expiring).length, status: "expiring" },
  ];

  function openDialog(next: NonNullable<typeof dialog>) {
    setError("");
    setSuccess("");
    setSelectedBatch("");
    setDialog(next);
  }

  async function submit(
    event: FormEvent<HTMLFormElement>,
    endpoint: string,
    method: "POST" | "PUT",
    successMessage: string,
  ) {
    event.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
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
      setDialog(null);
      setSuccess(successMessage);
      form.reset();
      router.refresh();
    } catch {
      setError("Nije moguće povezati se sa serverom. Pokušajte ponovo.");
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <nav className="flex flex-wrap gap-2" aria-label="Brze radnje za lijekove">
        {canWrite ? <button type="button" aria-haspopup="dialog" onClick={() => openDialog({ type: "add" })} className="rounded-lg bg-green px-4 py-3 text-sm font-bold text-white">Dodaj lijek</button> : null}
        {canViewHistory ? <Link href="/reports/inventory/movements" className="rounded-lg border border-line bg-white px-4 py-3 text-sm font-bold text-[#53645a]">Istorija prometa</Link> : null}
      </nav>
      {success ? <p role="status" className="rounded-lg bg-green-soft px-3 py-2.5 text-sm font-semibold text-green-dark">{success}</p> : null}
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Pregled zaliha">
        {stats.map((stat) => (
          <Link key={stat.status} href={`/inventory?status=${stat.status}`} aria-current={initialStatus === stat.status ? "page" : undefined} className={`rounded-xl border bg-white p-3 transition hover:shadow-md focus-visible:outline-2 focus-visible:outline-green ${initialStatus === stat.status ? "border-green" : "border-line"}`}>
            <span className="block text-xs text-muted">{stat.label}</span>
            <span className="mt-2 block text-xl font-bold">{stat.value}</span>
          </Link>
        ))}
      </section>
      {canWrite && dialog?.type === "add" ? (
        <InventoryDialog title="Dodaj lijek" description="Unesite podatke o lijeku. Dodavanje lijeka ne mijenja stanje zaliha." busy={isSubmitting} editable onDismiss={() => setDialog(null)}>
          <form
            className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
            onSubmit={(event) => submit(event, "/api/inventory/medications", "POST", "Lijek je dodan u registar.")}
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
            <label className="grid gap-1.5 text-xs font-semibold text-muted">Kategorija
              <input className={inputClass} name="category" maxLength={100} />
            </label>
            <label className="grid gap-1.5 text-xs font-semibold text-muted">Proizvođač
              <input className={inputClass} name="manufacturer" maxLength={180} />
            </label>
            <label className="grid gap-1.5 text-xs font-semibold text-muted">Prodajna cijena (KM)
              <input className={inputClass} name="sellingPrice" type="number" min="0" step="0.01" />
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
        </InventoryDialog>
      ) : null}

      <section className="rounded-xl border border-line bg-white p-3 shadow-[0_2px_6px_rgb(34_62_47_/_2%)] sm:p-5">
        <div className="mb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_180px_180px_180px]">
          <label className="grid gap-1 text-xs font-semibold text-muted">Pretraga naziva, proizvođača ili aktivne supstance
            <input className={inputClass} type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-muted">Kategorija
            <select className={inputClass} value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }}>
              <option value="">Sve kategorije</option>
              {[...new Set(medications.map((medication) => medication.category).filter((value): value is string => !!value))].sort((a, b) => a.localeCompare(b, "bs")).map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold text-muted">Status zalihe
            <select className={inputClass} value={initialStatus} onChange={(event) => router.push(`/inventory?status=${encodeURIComponent(event.target.value)}`)}>
              <option value="all">Svi lijekovi</option><option value="in-stock">Na stanju</option><option value="low">Na minimumu ili ispod</option><option value="out">Nema na stanju</option><option value="expiring">Pred istekom</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold text-muted">Sortiranje
            <select className={inputClass} value={sort} onChange={(event) => { setSort(event.target.value === "quantity" ? "quantity" : "name"); setPage(1); }}>
              <option value="name">Naziv</option><option value="quantity">Raspoloživa količina</option>
            </select>
          </label>
        </div>
        {visible.length ? (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead><tr>{["Naziv lijeka", "Kategorija", "Proizvođač", "Jedinica", "Na stanju", "Minimalna zaliha", "Najbliži rok isteka", "Prodajna cijena", "Status", "Akcije"].map((heading) => <th key={heading} className="whitespace-nowrap border-b border-line px-3 py-3 text-xs text-muted">{heading}</th>)}</tr></thead>
          {visible.map(({ medication, details }) => {
            const batchForAdjustment = medication.batches.find((batch) => batch.id === selectedBatch);
            const status = details.state === "OUT_OF_STOCK"
              ? { label: "Nema na stanju", style: "bg-[#fbefee] text-[#a43e3c]" }
              : details.state === "LOW_STOCK"
                ? { label: "Niske zalihe", style: "bg-[#fff4df] text-[#93631b]" }
                : { label: "Na stanju", style: "bg-[#edf4ef] text-[#587362]" };
            return (
              <tbody key={medication.id} className="border-b border-line">
                <ClickableRow onActivate={() => openDialog({ type: "details", id: medication.id })}>
                  <td className="min-w-[180px] px-3 py-3"><strong>{medication.name}</strong><p className="mb-0 mt-1 text-xs text-muted">{[medication.activeIngredient, medication.form, medication.strength].filter(Boolean).join(" · ")}</p></td>
                  <td className="px-3 py-3">{medication.category || "—"}</td>
                  <td className="px-3 py-3">{medication.manufacturer || "—"}</td>
                  <td className="px-3 py-3">{medication.unit}</td>
                  <td className="px-3 py-3 tabular-nums">{formatQuantity(medication.availableQuantity)}</td>
                  <td className="px-3 py-3 tabular-nums">{formatQuantity(medication.minimumStock)}</td>
                  <td className="whitespace-nowrap px-3 py-3">{formatDate(details.nearestExpiry)}</td>
                  <td className="whitespace-nowrap px-3 py-3">{medication.sellingPrice === null ? "—" : new Intl.NumberFormat("bs-BA", { style: "currency", currency: "BAM" }).format(Number(medication.sellingPrice))}</td>
                  <td className="px-3 py-3"><span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${status.style}`}>{status.label}</span></td>
                  <td className="min-w-[220px] px-3 py-3">
                    <div className="flex max-w-[380px] flex-wrap gap-2">
                      <button type="button" aria-haspopup="dialog" className={tableActionClass} onClick={() => openDialog({ type: "details", id: medication.id })}>Detalji</button>
                      {canWrite ? <>
                        <button type="button" aria-haspopup="dialog" className={tableActionClass} onClick={() => openDialog({ type: "edit", id: medication.id })}>Uredi lijek</button>
                        <button type="button" aria-haspopup="dialog" className={tableActionClass} onClick={() => openDialog({ type: "receipt", id: medication.id })}>Prijem serije</button>
                        {medication.batches.length ? <button type="button" aria-haspopup="dialog" className={tableActionClass} onClick={() => openDialog({ type: "adjust", id: medication.id })}>Korekcija zaliha</button> : null}
                      </> : null}
                      {canViewHistory ? <Link className={tableActionClass} href={`/reports/inventory/movements?medicationId=${encodeURIComponent(medication.id)}`}>Istorija</Link> : null}
                    </div>
                {canWrite && dialog?.type === "edit" && dialog.id === medication.id ? (
                  <InventoryDialog title={`Uredi lijek — ${medication.name}`} description="Izmijenite podatke o lijeku; jedinica mjere se ne može mijenjati." busy={isSubmitting} editable onDismiss={() => setDialog(null)}>
                    <form
                      className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
                      onSubmit={(event) => submit(event, `/api/inventory/medications/${medication.id}`, "PUT", "Podaci o lijeku su sačuvani.")}
                    >
                      <label className="grid gap-1.5 text-xs font-semibold text-muted">Naziv lijeka *<input className={inputClass} name="name" maxLength={180} defaultValue={medication.name} required /></label>
                      <label className="grid gap-1.5 text-xs font-semibold text-muted">Aktivna supstanca<input className={inputClass} name="activeIngredient" maxLength={180} defaultValue={medication.activeIngredient ?? ""} /></label>
                      <label className="grid gap-1.5 text-xs font-semibold text-muted">Oblik<input className={inputClass} name="form" maxLength={100} defaultValue={medication.form ?? ""} /></label>
                      <label className="grid gap-1.5 text-xs font-semibold text-muted">Jačina<input className={inputClass} name="strength" maxLength={100} defaultValue={medication.strength ?? ""} /></label>
                      <label className="grid gap-1.5 text-xs font-semibold text-muted">Kategorija<input className={inputClass} name="category" maxLength={100} defaultValue={medication.category ?? ""} /></label>
                      <label className="grid gap-1.5 text-xs font-semibold text-muted">Proizvođač<input className={inputClass} name="manufacturer" maxLength={180} defaultValue={medication.manufacturer ?? ""} /></label>
                      <label className="grid gap-1.5 text-xs font-semibold text-muted">Prodajna cijena (KM)<input className={inputClass} name="sellingPrice" type="number" min="0" step="0.01" defaultValue={medication.sellingPrice ?? ""} /></label>
                      <label className="grid gap-1.5 text-xs font-semibold text-muted">Minimalna zaliha<input className={inputClass} name="minimumStock" type="number" min="0" step="0.001" defaultValue={medication.minimumStock} required /></label>
                      <div className="grid gap-1.5 text-xs font-semibold text-muted">Jedinica mjere <span className="flex h-11 items-center text-sm text-ink">{medication.unit}</span><input type="hidden" name="unit" value={medication.unit} /></div>
                      {error && activeEndpoint === `/api/inventory/medications/${medication.id}` ? <p className="m-0 text-sm text-[#a43e3c] sm:col-span-2" role="alert">{error}</p> : null}
                      <button className="min-h-11 rounded-lg border border-line px-4 text-sm font-bold text-[#53645a] hover:bg-[#f7faf8] disabled:opacity-60 sm:col-span-2 sm:justify-self-end" type="submit" disabled={isSubmitting}>{isSubmitting && activeEndpoint === `/api/inventory/medications/${medication.id}` ? "Čuvanje..." : "Sačuvaj lijek"}</button>
                    </form>
                  </InventoryDialog>
                ) : null}
                {dialog?.type === "details" && dialog.id === medication.id ? (
                <InventoryDialog title={`Detalji i serije — ${medication.name}`} description="Pregled evidentiranih serija i njihovog stanja." busy={isSubmitting} onDismiss={() => setDialog(null)}>
                  <p className="mb-2 mt-4 text-sm font-semibold">Serije ({medication.batches.length})</p>
                  {Number(medication.expiredQuantity) > 0 ? <p className="text-xs text-[#a43e3c]">Istekle serije: {formatQuantity(medication.expiredQuantity)} {medication.unit}</p> : null}
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
                </InventoryDialog>
                ) : null}
                {canWrite && dialog?.type === "receipt" && dialog.id === medication.id ? (
                  <InventoryDialog title={`Prijem serije — ${medication.name}`} description="Prijem kreira novu seriju i odmah povećava zalihu." busy={isSubmitting} editable onDismiss={() => setDialog(null)}>
                      <form
                        className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2"
                        onSubmit={(event) =>
                          submit(event, `/api/inventory/medications/${medication.id}/batches`, "POST", "Nova serija je primljena i zaliha je ažurirana.")
                        }
                      >
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
                  </InventoryDialog>
                ) : null}
                {canWrite && dialog?.type === "adjust" && dialog.id === medication.id ? (
                  <InventoryDialog title={`Korekcija zaliha — ${medication.name}`} description="Odaberite seriju, smjer i količinu korekcije. Promjena se evidentira u historiji." busy={isSubmitting} editable onDismiss={() => setDialog(null)}>
                      <label className="mt-4 grid gap-1.5 text-xs font-semibold text-muted">Serija *
                        <select className={inputClass} value={selectedBatch} onChange={(event) => { setSelectedBatch(event.target.value); setError(""); }}>
                          <option value="" disabled>Odaberite seriju</option>
                          {medication.batches.map((batch) => <option key={batch.id} value={batch.id}>{batch.batchNumber} — {formatQuantity(batch.quantityRemaining)} {medication.unit}</option>)}
                        </select>
                      </label>
                      {batchForAdjustment ? (
                        <form
                          className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2"
                          onSubmit={(event) =>
                            submit(
                              event,
                              `/api/inventory/medications/${medication.id}/batches/${batchForAdjustment.id}/adjustments`,
                              "POST",
                              "Korekcija zaliha je sačuvana.",
                            )
                          }
                        >
                          <h3 className="m-0 text-sm font-bold sm:col-span-2">
                            Korekcija serije {batchForAdjustment.batchNumber} · raspoloživo{" "}
                            {formatQuantity(batchForAdjustment.quantityRemaining)} {medication.unit}
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
                          {error && activeEndpoint === `/api/inventory/medications/${medication.id}/batches/${batchForAdjustment.id}/adjustments` ? (
                            <p className="m-0 text-sm text-[#a43e3c] sm:col-span-2" role="alert">{error}</p>
                          ) : null}
                          <button
                            className="min-h-11 rounded-lg border border-line px-4 text-sm font-bold text-[#53645a] hover:bg-[#f7faf8] disabled:opacity-60 sm:col-span-2 sm:justify-self-end"
                            type="submit"
                            disabled={isSubmitting}
                          >
                            {isSubmitting && activeEndpoint.endsWith(`${batchForAdjustment.id}/adjustments`)
                              ? "Čuvanje..."
                              : "Sačuvaj korekciju"}
                          </button>
                        </form>
                      ) : null}
                  </InventoryDialog>
                ) : null}
                  </td>
                </ClickableRow>
              </tbody>
            );
          })}
          </table>
        </div>
      ) : (
        <div className="px-4 py-12 text-center">
          <p className="mb-1 text-sm font-semibold">{medications.length ? "Nema lijekova za odabrane filtere." : "Registar lijekova je prazan."}</p>
          <p className="m-0 text-sm text-muted">
            {medications.length ? "Promijenite filter ili pojam pretrage." : canWrite ? "Dodajte lijek i zatim evidentirajte njegovu prvu seriju." : "Nema lijekova za prikaz."}
          </p>
        </div>
      )}
        {pageCount > 1 ? <div className="mt-4 flex items-center justify-between gap-3 text-sm"><span>Stranica {currentPage} od {pageCount}</span><div className="flex gap-2"><button type="button" className="min-h-11 rounded-lg border border-line px-3 disabled:opacity-40" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Prethodna</button><button type="button" className="min-h-11 rounded-lg border border-line px-3 disabled:opacity-40" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>Sljedeća</button></div></div> : null}
      </section>
    </div>
  );
}

const inputClass =
  "h-11 w-full rounded-lg border border-[#dce4de] bg-white px-3 text-sm text-ink outline-none focus:border-green focus:ring-2 focus:ring-green/15";
