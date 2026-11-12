import type { Metadata } from "next";
import Link from "next/link";
import { StockMovementType } from "@prisma/client";
import { stockMovementReportQuerySchema } from "@/features/inventory/validation";
import { requirePermission } from "@/lib/auth/require-permission";
import { getClinicDate, getClinicDateBounds } from "@/lib/dates";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Historija kretanja zaliha" };

const typeLabels: Record<StockMovementType, string> = {
  RECEIPT: "Prijem",
  ADMINISTRATION: "Primjena",
  ADJUSTMENT: "Korekcija",
  REVERSAL: "Storno",
};

const dateFormatter = new Intl.DateTimeFormat("bs-BA", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Sarajevo",
});

function getDefaultRange() {
  const today = getClinicDate();
  const [year, month, day] = today.split("-").map(Number);
  const from = new Date(Date.UTC(year, month - 1, day - 29)).toISOString().slice(0, 10);
  return { from, to: today };
}

export default async function StockMovementReportPage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string;
    to?: string;
    medicationId?: string;
    userId?: string;
    type?: string;
  }>;
}) {
  await requirePermission("reports:inventory");
  const params = await searchParams;
  const defaults = getDefaultRange();
  const parsed = stockMovementReportQuerySchema.safeParse({
    from: params.from ?? defaults.from,
    to: params.to ?? defaults.to,
    medicationId: params.medicationId ?? "all",
    userId: params.userId ?? "all",
    type: params.type ?? "all",
  });
  const filters = parsed.success ? parsed.data : { ...defaults, medicationId: "all", userId: "all", type: "all" as const };
  const from = getClinicDateBounds(filters.from);
  const to = getClinicDateBounds(filters.to);
  if (!from || !to) throw new Error("Nije moguće odrediti period kretanja zaliha.");

  const where = {
    createdAt: { gte: from.start, lt: to.end },
    ...(filters.type !== "all" ? { type: filters.type } : {}),
    ...(filters.userId !== "all" ? { userId: filters.userId } : {}),
    ...(filters.medicationId !== "all"
      ? { batch: { medicationId: filters.medicationId } }
      : {}),
  };
  const [total, movements, medications, users] = await Promise.all([
    prisma.stockMovement.count({ where }),
    prisma.stockMovement.findMany({
      where,
      include: {
        batch: {
          select: {
            batchNumber: true,
            medication: { select: { id: true, name: true, unit: true } },
          },
        },
        user: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 500,
    }),
    prisma.medication.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.user.findMany({
      where: { stockMovements: { some: {} } },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true },
    }),
  ]);

  const exportParams = new URLSearchParams({
    from: filters.from,
    to: filters.to,
    medicationId: filters.medicationId,
    userId: filters.userId,
    type: filters.type,
  });
  const selectedMedicationName = medications.find(({ id }) => id === filters.medicationId)?.name;
  const selectedUser = users.find(({ id }) => id === filters.userId);

  return (
    <main className="mx-auto w-full max-w-[1440px] px-4 pb-8 pt-5 sm:px-[34px] sm:pb-[42px] sm:pt-[31px]">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-[7px] text-[11px] font-[750] uppercase tracking-[0.7px] text-green">Ambulantna apoteka</p>
          <h1 className="m-0 text-[clamp(24px,3vw,30px)] tracking-[-0.9px]">Historija kretanja zaliha</h1>
          <p className="mt-2 text-sm text-muted">Prijemi, primjene i korekcije evidentirane u odabranom periodu.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-line bg-white px-4 text-sm font-bold text-[#53645a] hover:bg-[#f7faf8]"
            href="/reports/inventory"
          >
            Stanje zaliha
          </Link>
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-green px-4 text-sm font-bold text-white hover:bg-green-dark"
            href={`/api/reports/inventory/movements?${exportParams.toString()}`}
          >
            Preuzmi CSV
          </Link>
        </div>
      </div>

      <section className="rounded-xl border border-line bg-white p-3 shadow-[0_2px_6px_rgb(34_62_47_/_2%)] sm:p-5">
        <form
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[repeat(5,minmax(0,1fr))_auto] xl:items-end"
          action="/reports/inventory/movements"
          method="get"
        >
          <label className="grid gap-1.5 text-xs font-semibold text-muted">
            Od datuma
            <input className={inputClass} name="from" type="date" defaultValue={filters.from} required />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-muted">
            Do datuma
            <input className={inputClass} name="to" type="date" defaultValue={filters.to} required />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-muted">
            Lijek
            <select className={inputClass} name="medicationId" defaultValue={filters.medicationId}>
              <option value="all">Svi lijekovi</option>
              {medications.map((medication) => (
                <option key={medication.id} value={medication.id}>{medication.name}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-muted">
            Tip kretanja
            <select className={inputClass} name="type" defaultValue={filters.type}>
              <option value="all">Svi tipovi</option>
              {Object.entries(typeLabels).map(([type, label]) => (
                <option key={type} value={type}>{label}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-muted">
            Evidentirao
            <select className={inputClass} name="userId" defaultValue={filters.userId}>
              <option value="all">Svi korisnici</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>{user.firstName} {user.lastName}</option>
              ))}
            </select>
          </label>
          <button className="h-11 rounded-lg border border-line px-4 text-sm font-bold text-[#53645a] hover:bg-[#f7faf8]" type="submit">
            Primijeni filtere
          </button>
        </form>
        {!parsed.success ? (
          <p className="mb-0 mt-3 rounded-lg bg-[#fbefee] px-3 py-2.5 text-sm text-[#a43e3c]" role="alert">
            Filteri nisu ispravni. Prikazan je posljednji 30-dnevni period bez dodatnih filtera.
          </p>
        ) : null}
      </section>

      <section className="mt-4 overflow-hidden rounded-xl border border-line bg-white shadow-[0_2px_6px_rgb(34_62_47_/_2%)]">
        <div className="border-b border-line px-4 py-4 sm:px-5">
          <h2 className="m-0 text-base font-bold">Kretanja ({total})</h2>
          {selectedMedicationName || selectedUser ? (
            <p className="mb-0 mt-1 text-xs text-muted">
              {[selectedMedicationName, selectedUser && `${selectedUser.firstName} ${selectedUser.lastName}`].filter(Boolean).join(" · ")}
            </p>
          ) : null}
          {total > movements.length ? (
            <p className="mb-0 mt-1 text-xs text-muted">
              Prikazano je posljednjih 500 kretanja. CSV izvoz sadrži do 5000 zapisa.
            </p>
          ) : null}
        </div>
        {movements.length ? (
          <>
            <div className="space-y-3 p-3 md:hidden">
              {movements.map((movement) => (
                <article className="rounded-lg border border-[#eef1ef] p-3" key={movement.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="m-0 truncate text-sm font-bold">{movement.batch.medication.name}</p>
                      <p className="mb-0 mt-1 text-xs text-muted">
                        Serija {movement.batch.batchNumber} · {dateFormatter.format(movement.createdAt)}
                      </p>
                    </div>
                    <strong className={`shrink-0 text-sm tabular-nums ${movement.quantity.isNegative() ? "text-[#a43e3c]" : "text-green-dark"}`}>
                      {movement.quantity.isPositive() ? "+" : ""}{movement.quantity.toString()} {movement.batch.medication.unit}
                    </strong>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-[#eef1ef] pt-2 text-xs">
                    <span className="font-semibold">{typeLabels[movement.type]}</span>
                    <span className="text-muted">{movement.user.firstName} {movement.user.lastName}</span>
                  </div>
                  {movement.reason ? <p className="mb-0 mt-2 text-xs text-muted">{movement.reason}</p> : null}
                </article>
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr>{["Datum i vrijeme", "Tip", "Lijek / serija", "Količina", "Razlog", "Evidentirao"].map((heading) => (
                    <th className="whitespace-nowrap border-b border-line px-3 py-3 text-[10px] font-bold uppercase tracking-[0.55px] text-[#8a968e]" key={heading}>
                      {heading}
                    </th>
                  ))}</tr>
                </thead>
                <tbody>
                  {movements.map((movement) => (
                    <tr key={movement.id}>
                      <td className="whitespace-nowrap border-b border-[#eef1ef] px-3 py-3 text-xs tabular-nums">
                        {dateFormatter.format(movement.createdAt)}
                      </td>
                      <td className="border-b border-[#eef1ef] px-3 py-3 text-xs font-semibold">
                        {typeLabels[movement.type]}
                      </td>
                      <td className="border-b border-[#eef1ef] px-3 py-3 text-sm">
                        <strong>{movement.batch.medication.name}</strong>
                        <span className="ml-1 text-xs text-muted">· {movement.batch.batchNumber}</span>
                      </td>
                      <td className={`whitespace-nowrap border-b border-[#eef1ef] px-3 py-3 text-sm font-semibold tabular-nums ${movement.quantity.isNegative() ? "text-[#a43e3c]" : "text-green-dark"}`}>
                        {movement.quantity.isPositive() ? "+" : ""}{movement.quantity.toString()} {movement.batch.medication.unit}
                      </td>
                      <td className="max-w-[260px] border-b border-[#eef1ef] px-3 py-3 text-xs text-muted">{movement.reason || "—"}</td>
                      <td className="whitespace-nowrap border-b border-[#eef1ef] px-3 py-3 text-xs">
                        {movement.user.firstName} {movement.user.lastName}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="px-4 py-12 text-center">
            <p className="mb-1 text-sm font-semibold">Nema kretanja zaliha za odabrane filtere.</p>
            <p className="m-0 text-sm text-muted">Promijenite period ili odaberite drugi lijek, tip kretanja ili korisnika.</p>
          </div>
        )}
      </section>
    </main>
  );
}

const inputClass =
  "h-11 w-full rounded-lg border border-[#dce4de] bg-white px-3 text-sm text-ink focus:border-green focus:outline-none focus:ring-2 focus:ring-green/15";
