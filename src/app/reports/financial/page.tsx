import type { Metadata } from "next";
import Link from "next/link";
import { InvoiceStatus, Prisma } from "@prisma/client";
import { reportDateRangeSchema } from "@/features/reports/validation";
import { requirePermission } from "@/lib/auth/require-permission";
import { getClinicDate, getClinicDateBounds } from "@/lib/dates";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Finansijski izvještaj" };

const invoiceStatusLabels: Record<InvoiceStatus, string> = {
  DRAFT: "Nacrt",
  ISSUED: "Izdato",
  PARTIALLY_PAID: "Djelimično plaćeno",
  PAID: "Plaćeno",
  VOID: "Stornirano",
};

function formatCurrency(value: Prisma.Decimal | number) {
  return new Intl.NumberFormat("bs-BA", {
    style: "currency",
    currency: "BAM",
  }).format(Number(value));
}

function getDefaultRange() {
  const today = getClinicDate();
  return { from: `${today.slice(0, 7)}-01`, to: today };
}

export default async function FinancialReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await requirePermission("reports:financial");
  const params = await searchParams;
  const defaults = getDefaultRange();
  const parsed = reportDateRangeSchema.safeParse({
    from: params.from ?? defaults.from,
    to: params.to ?? defaults.to,
  });
  const range = parsed.success ? parsed.data : defaults;
  const fromBounds = getClinicDateBounds(range.from);
  const toBounds = getClinicDateBounds(range.to);
  if (!fromBounds || !toBounds) throw new Error("Nije moguće izračunati period finansijskog izvještaja.");

  const [invoices, invoiceTotals, payments, reversals, outstandingInvoices] = await Promise.all([
    prisma.invoice.findMany({
      where: { issuedAt: { gte: fromBounds.start, lt: toBounds.end } },
      select: {
        id: true,
        invoiceNumber: true,
        total: true,
        issuedAt: true,
        status: true,
        client: { select: { firstName: true, lastName: true, companyName: true } },
      },
      orderBy: { issuedAt: "desc" },
      take: 500,
    }),
    prisma.invoice.aggregate({
      where: {
        issuedAt: { gte: fromBounds.start, lt: toBounds.end },
        status: { not: InvoiceStatus.VOID },
      },
      _sum: { total: true },
      _count: { _all: true },
    }),
    prisma.payment.aggregate({
      where: { paidAt: { gte: fromBounds.start, lt: toBounds.end } },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.paymentReversal.aggregate({
      where: { reversedAt: { gte: fromBounds.start, lt: toBounds.end } },
      _sum: { amount: true },
    }),
    prisma.invoice.findMany({
      where: { status: { in: [InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID] } },
      select: {
        total: true,
        dueAt: true,
        payments: {
          select: {
            amount: true,
            reversals: { select: { amount: true } },
          },
        },
      },
    }),
  ]);

  const collected = (payments._sum.amount ?? new Prisma.Decimal(0)).minus(
    reversals._sum.amount ?? new Prisma.Decimal(0),
  );
  const outstanding = outstandingInvoices.reduce((total, invoice) => {
    const paid = invoice.payments.reduce(
      (sum, payment) => sum.plus(
        payment.amount.minus(payment.reversals.reduce(
          (reversed, reversal) => reversed.plus(reversal.amount),
          new Prisma.Decimal(0),
        )),
      ),
      new Prisma.Decimal(0),
    );
    const due = invoice.total.minus(paid);
    return total.plus(due.greaterThan(0) ? due : new Prisma.Decimal(0));
  }, new Prisma.Decimal(0));
  const today = new Date();
  const overdueCount = outstandingInvoices.filter(
    (invoice) => invoice.dueAt && invoice.dueAt < today,
  ).length;
  const issuedTotal = invoiceTotals._sum.total ?? new Prisma.Decimal(0);
  const exportHref = `/api/reports/financial?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`;

  return (
    <main className="mx-auto w-full max-w-[1440px] px-4 pb-8 pt-5 sm:px-[34px] sm:pb-[42px] sm:pt-[31px]">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-[7px] text-[11px] font-[750] uppercase tracking-[0.7px] text-green">Finansije ambulante</p>
          <h1 className="m-0 text-[clamp(24px,3vw,30px)] tracking-[-0.9px]">Finansijski izvještaj</h1>
          <p className="mt-2 text-sm text-muted">Izdati računi, naplaćene uplate i otvorena potraživanja.</p>
        </div>
        <Link
          className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-line bg-white px-4 text-sm font-bold text-[#53645a] hover:bg-[#f7faf8] sm:w-auto"
          href={exportHref}
        >
          Preuzmi CSV
        </Link>
      </div>

      <section className="rounded-xl border border-line bg-white p-3 shadow-[0_2px_6px_rgb(34_62_47_/_2%)] sm:p-5">
        <form className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto]" action="/reports/financial" method="get">
          <label className="grid gap-1.5 text-xs font-semibold text-muted">
            Od datuma
            <input className={inputClass} name="from" type="date" defaultValue={range.from} required />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-muted">
            Do datuma
            <input className={inputClass} name="to" type="date" defaultValue={range.to} required />
          </label>
          <button className="h-11 rounded-lg border border-line px-4 text-sm font-bold text-[#53645a] hover:bg-[#f7faf8]" type="submit">
            Prikaži period
          </button>
        </form>
        {!parsed.success ? (
          <p className="mb-0 mt-3 rounded-lg bg-[#fbefee] px-3 py-2.5 text-sm text-[#a43e3c]" role="alert">
            Odabrani period nije ispravan (maksimalno 366 dana). Prikazan je tekući mjesec.
          </p>
        ) : null}
      </section>

      <section className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="Naplaćeno u periodu" value={formatCurrency(collected)} detail={`${payments._count._all} uplata`} />
        <SummaryCard title="Izdato u periodu" value={formatCurrency(issuedTotal)} detail={`${invoiceTotals._count._all} računa`} />
        <SummaryCard title="Otvorena potraživanja" value={formatCurrency(outstanding)} detail="Izdati i djelimično plaćeni računi" />
        <SummaryCard title="Računi s isteklim rokom" value={String(overdueCount)} detail="Broj dospjelih računa" />
      </section>

      <section className="mt-4 overflow-hidden rounded-xl border border-line bg-white shadow-[0_2px_6px_rgb(34_62_47_/_2%)]">
        <div className="border-b border-line px-4 py-4 sm:px-5">
          <h2 className="m-0 text-base font-bold">Računi u odabranom periodu</h2>
          {invoices.length === 500 ? (
            <p className="mb-0 mt-1 text-xs text-muted">
              Prikazano je najviše 500 računa; zbirni iznosi isključuju stornirane račune.
            </p>
          ) : null}
        </div>
        {invoices.length ? (
          <>
            <div className="space-y-3 p-3 md:hidden">
              {invoices.map((invoice) => (
                <Link className="block rounded-lg border border-[#eef1ef] p-3" href={`/invoices/${invoice.id}`} key={invoice.id}>
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="font-bold text-green-dark">{invoice.invoiceNumber}</span>
                    <span className="font-semibold tabular-nums">{formatCurrency(invoice.total)}</span>
                  </div>
                  <p className="mb-0 mt-1 text-sm">
                    {invoice.client.companyName || `${invoice.client.firstName} ${invoice.client.lastName}`}
                  </p>
                  <p className="mb-0 mt-1 text-xs text-muted">
                    {invoice.issuedAt ? new Intl.DateTimeFormat("bs-BA", { dateStyle: "medium", timeZone: "Europe/Sarajevo" }).format(invoice.issuedAt) : "—"}
                    {" · "}{invoiceStatusLabels[invoice.status]}
                  </p>
                </Link>
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full border-collapse text-left">
                <thead><tr>{["Broj računa", "Klijent", "Izdato", "Status", "Ukupno"].map((heading) => (
                  <th className="border-b border-line px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-muted" key={heading}>{heading}</th>
                ))}</tr></thead>
                <tbody>{invoices.map((invoice) => (
                  <tr className="border-b border-[#eef1ef] last:border-0" key={invoice.id}>
                    <td className="px-4 py-3 text-sm font-semibold"><Link className="text-green-dark hover:underline" href={`/invoices/${invoice.id}`}>{invoice.invoiceNumber}</Link></td>
                    <td className="px-4 py-3 text-sm">{invoice.client.companyName || `${invoice.client.firstName} ${invoice.client.lastName}`}</td>
                    <td className="px-4 py-3 text-sm">{invoice.issuedAt ? new Intl.DateTimeFormat("bs-BA", { dateStyle: "medium", timeZone: "Europe/Sarajevo" }).format(invoice.issuedAt) : "—"}</td>
                    <td className="px-4 py-3 text-sm">{invoiceStatusLabels[invoice.status]}</td>
                    <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums">{formatCurrency(invoice.total)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="m-0 px-4 py-10 text-center text-sm text-muted">U ovom periodu nema izdatih računa.</p>
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

const inputClass =
  "h-11 w-full rounded-lg border border-[#dce4de] bg-white px-3 text-sm text-ink outline-none focus:border-green focus:ring-2 focus:ring-green/15";
