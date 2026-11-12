import type { Metadata } from "next";
import Link from "next/link";
import { Prisma } from "@prisma/client";
import { getMedicationStockState } from "@/features/inventory/validation";
import { requirePermission } from "@/lib/auth/require-permission";
import { getClinicDate } from "@/lib/dates";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Izvještaj zaliha" };

function formatQuantity(value: Prisma.Decimal | number) {
  return new Intl.NumberFormat("bs-BA", { maximumFractionDigits: 3 }).format(Number(value));
}

function formatDate(value: string | null) {
  if (!value) return "Bez roka";
  return new Intl.DateTimeFormat("bs-BA", {
    dateStyle: "medium",
    timeZone: "Europe/Sarajevo",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function getDateAfterDays(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export default async function InventoryReportPage() {
  await requirePermission("reports:inventory");
  const today = getClinicDate();
  const expiryLimit = getDateAfterDays(today, 90);
  const medications = await prisma.medication.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      activeIngredient: true,
      form: true,
      strength: true,
      unit: true,
      minimumStock: true,
      isActive: true,
      batches: {
        orderBy: [{ expiresAt: "asc" }, { batchNumber: "asc" }],
        select: {
          id: true,
          batchNumber: true,
          expiresAt: true,
          quantityRemaining: true,
        },
      },
    },
  });

  const inventory = medications.map((medication) => {
    const quantity = medication.batches.reduce(
      (total, batch) => total.add(batch.quantityRemaining),
      new Prisma.Decimal(0),
    );
    const expiredQuantity = medication.batches.reduce((total, batch) => (
      batch.expiresAt && batch.expiresAt.toISOString().slice(0, 10) < today
        ? total.add(batch.quantityRemaining)
        : total
    ), new Prisma.Decimal(0));
    const expiringQuantity = medication.batches.reduce((total, batch) => {
      const expiry = batch.expiresAt?.toISOString().slice(0, 10);
      return expiry && expiry >= today && expiry <= expiryLimit
        ? total.add(batch.quantityRemaining)
        : total;
    }, new Prisma.Decimal(0));
    const usableQuantity = quantity.minus(expiredQuantity);
    const state = medication.isActive
      ? getMedicationStockState(usableQuantity.toNumber(), medication.minimumStock.toNumber())
      : "ARCHIVED";
    return {
      ...medication,
      quantity,
      expiredQuantity,
      expiringQuantity,
      usableQuantity,
      state,
      batches: medication.batches.map((batch) => ({
        ...batch,
        expiresAt: batch.expiresAt?.toISOString().slice(0, 10) ?? null,
        isExpired: batch.expiresAt !== null && batch.expiresAt.toISOString().slice(0, 10) < today,
      })),
    };
  });

  const active = inventory.filter((medication) => medication.isActive);
  const lowStockCount = active.filter((medication) => medication.state === "LOW_STOCK").length;
  const outOfStockCount = active.filter((medication) => medication.state === "OUT_OF_STOCK").length;
  const expiredBatchCount = inventory.reduce(
    (count, medication) => count + medication.batches.filter((batch) => batch.isExpired && batch.quantityRemaining.greaterThan(0)).length,
    0,
  );
  const expiringSoonCount = inventory.reduce(
    (count, medication) => count + medication.batches.filter((batch) => {
      const expiry = batch.expiresAt;
      return expiry !== null && expiry >= today && expiry <= expiryLimit && batch.quantityRemaining.greaterThan(0);
    }).length,
    0,
  );
  const exportHref = "/api/reports/inventory";
  const statusLabel = (state: string) => ({
    IN_STOCK: "Dostupno",
    LOW_STOCK: "Niska zaliha",
    OUT_OF_STOCK: "Nema upotrebljive zalihe",
    ARCHIVED: "Arhiviran",
  }[state] ?? state);
  const statusClass = (state: string) => (
    state === "OUT_OF_STOCK" ? "bg-[#fbefee] text-[#a43e3c]"
      : state === "LOW_STOCK" ? "bg-[#fff4df] text-[#93631b]"
        : state === "ARCHIVED" ? "bg-[#f1f3f2] text-muted"
          : "bg-[#edf4ef] text-[#587362]"
  );

  return (
    <main className="mx-auto w-full max-w-[1440px] px-4 pb-8 pt-5 sm:px-[34px] sm:pb-[42px] sm:pt-[31px]">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-[7px] text-[11px] font-[750] uppercase tracking-[0.7px] text-green">Ambulantna apoteka</p>
          <h1 className="m-0 text-[clamp(24px,3vw,30px)] tracking-[-0.9px]">Izvještaj zaliha</h1>
          <p className="mt-2 text-sm text-muted">Stanje upotrebljivih zaliha, minimalne količine i rokovi trajanja na dan {formatDate(today)}.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link className="inline-flex min-h-11 items-center justify-center rounded-lg border border-line bg-white px-4 text-sm font-bold text-[#53645a] hover:bg-[#f7faf8]" href="/reports/inventory/movements">
            Historija kretanja
          </Link>
          <Link className="inline-flex min-h-11 items-center justify-center rounded-lg border border-line bg-white px-4 text-sm font-bold text-[#53645a] hover:bg-[#f7faf8]" href={exportHref}>
            Preuzmi CSV
          </Link>
          <Link className="inline-flex min-h-11 items-center justify-center rounded-lg bg-green px-4 text-sm font-bold text-white hover:bg-green-dark" href="/inventory">
            Otvori zalihe
          </Link>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <SummaryCard title="Aktivni lijekovi" value={String(active.length)} detail="U registru" />
        <SummaryCard title="Niska zaliha" value={String(lowStockCount)} detail="Iznad nule, na ili ispod minimuma" />
        <SummaryCard title="Bez upotrebljive zalihe" value={String(outOfStockCount)} detail="Aktivni lijekovi" />
        <SummaryCard title="Serije za provjeru" value={String(expiredBatchCount + expiringSoonCount)} detail={`${expiredBatchCount} isteklo · ${expiringSoonCount} ističe u 90 dana`} />
      </section>

      <section className="mt-4 space-y-3">
        {inventory.length ? inventory.map((medication) => (
          <article className="rounded-xl border border-line bg-white p-3 shadow-[0_2px_6px_rgb(34_62_47_/_2%)] sm:p-4" key={medication.id}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="m-0 text-base font-bold">{medication.name}</h2>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${statusClass(medication.state)}`}>
                    {statusLabel(medication.state)}
                  </span>
                  {!medication.isActive ? <span className="text-[10px] text-muted">Arhiviran lijek</span> : null}
                </div>
                <p className="mb-0 mt-1 text-xs text-muted">
                  {[medication.activeIngredient, medication.form, medication.strength].filter(Boolean).join(" · ") || "Bez dodatnih detalja"}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-x-5 gap-y-1 text-xs sm:min-w-[280px]">
                <span className="text-muted">Upotrebljivo</span><strong className="text-right tabular-nums">{formatQuantity(medication.usableQuantity)} {medication.unit}</strong>
                <span className="text-muted">Ukupno fizički</span><span className="text-right tabular-nums">{formatQuantity(medication.quantity)} {medication.unit}</span>
                <span className="text-muted">Minimalna zaliha</span><span className="text-right tabular-nums">{formatQuantity(medication.minimumStock)} {medication.unit}</span>
                <span className="text-muted">Isteklo / ističe</span><span className="text-right tabular-nums">{formatQuantity(medication.expiredQuantity)} / {formatQuantity(medication.expiringQuantity)} {medication.unit}</span>
              </div>
            </div>
            <details className="mt-3 border-t border-[#eef1ef] pt-2">
              <summary className="min-h-10 cursor-pointer py-2 text-sm font-semibold text-green-dark">Serije ({medication.batches.length})</summary>
              {medication.batches.length ? (
                <ul className="m-0 divide-y divide-[#eef1ef] p-0">
                  {medication.batches.map((batch) => {
                    const expiring = batch.expiresAt !== null && batch.expiresAt >= today && batch.expiresAt <= expiryLimit;
                    return (
                      <li className="flex flex-wrap justify-between gap-2 py-2 text-xs" key={batch.id}>
                        <span>
                          {batch.batchNumber} · Rok: {formatDate(batch.expiresAt)}
                          {batch.isExpired ? <strong className="ml-1 text-[#a43e3c]">Istekla</strong> : null}
                          {expiring && !batch.isExpired ? <strong className="ml-1 text-[#93631b]">Ističe uskoro</strong> : null}
                        </span>
                        <span className="font-semibold tabular-nums">{formatQuantity(batch.quantityRemaining)} {medication.unit}</span>
                      </li>
                    );
                  })}
                </ul>
              ) : <p className="m-0 pb-2 text-xs text-muted">Nema evidentiranih serija.</p>}
            </details>
          </article>
        )) : (
          <div className="rounded-xl border border-line bg-white px-4 py-12 text-center text-sm text-muted">
            Nema evidentiranih lijekova.
          </div>
        )}
      </section>
    </main>
  );
}

function SummaryCard({ title, value, detail }: { title: string; value: string; detail: string }) {
  return (
    <article className="rounded-xl border border-line bg-white p-4 shadow-[0_2px_6px_rgb(34_62_47_/_2%)]">
      <h2 className="m-0 text-xs font-semibold text-muted">{title}</h2>
      <p className="mb-0 mt-2 text-xl font-bold tabular-nums">{value}</p>
      <p className="mb-0 mt-1 text-xs text-muted">{detail}</p>
    </article>
  );
}
