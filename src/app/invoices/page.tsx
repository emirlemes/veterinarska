import type { Metadata } from "next";
import Link from "next/link";
import { InvoiceStatus, Prisma } from "@prisma/client";
import { hasPermission } from "@/lib/auth/permissions";
import { invoiceListQuerySchema } from "@/features/invoices/validation";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/db";
import { ClickableRow } from "@/components/clickable-row";

export const metadata: Metadata = { title: "Računi" };

const statusLabels: Record<InvoiceStatus, string> = {
  DRAFT: "Nacrt",
  ISSUED: "Izdato",
  PARTIALLY_PAID: "Djelimično plaćeno",
  PAID: "Plaćeno",
  VOID: "Stornirano",
};

function formatCurrency(value: Prisma.Decimal) {
  return new Intl.NumberFormat("bs-BA", { style: "currency", currency: "BAM" }).format(Number(value));
}

function remainingAmount(invoice: {
  status: InvoiceStatus;
  total: Prisma.Decimal;
  payments: { amount: Prisma.Decimal; reversals: { amount: Prisma.Decimal }[] }[];
}) {
  if (invoice.status === InvoiceStatus.DRAFT || invoice.status === InvoiceStatus.VOID) {
    return new Prisma.Decimal(0);
  }
  const paid = invoice.payments.reduce(
    (sum, payment) => sum.plus(
      payment.amount.minus(payment.reversals.reduce(
        (reversed, reversal) => reversed.plus(reversal.amount),
        new Prisma.Decimal(0),
      )),
    ),
    new Prisma.Decimal(0),
  );
  const remaining = invoice.total.minus(paid);
  return remaining.greaterThan(0) ? remaining : new Prisma.Decimal(0);
}

export default async function InvoicesPage({ searchParams }: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await requirePermission("invoices:read");
  const parsed = invoiceListQuerySchema.safeParse(await searchParams);
  const status = parsed.success ? parsed.data.status : "all";
  const foundInvoices = await prisma.invoice.findMany({
    where: status === "unpaid"
      ? { status: { in: [InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID] } }
      : undefined,
    include: {
      client: { select: { id: true, firstName: true, lastName: true, companyName: true } },
      payments: { include: { reversals: { select: { amount: true } } } },
    },
    orderBy: [{ issuedAt: "desc" }, { createdAt: "desc" }],
    take: status === "all" ? 100 : undefined,
  });
  const invoices = status === "unpaid"
    ? foundInvoices.filter((invoice) => remainingAmount(invoice).greaterThan(0)).slice(0, 100)
    : foundInvoices;
  const canWrite = hasPermission(user.role, "invoices:write");

  return (
    <main className="mx-auto w-full max-w-[1440px] px-4 pb-8 pt-5 sm:px-[34px] sm:pb-[42px] sm:pt-[31px]">
      <div className="mb-5 flex flex-col gap-4 sm:mb-[25px] sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-[7px] text-[11px] font-[750] uppercase tracking-[0.7px] text-green">Finansije ambulante</p>
          <h1 className="m-0 text-[clamp(24px,3vw,30px)] tracking-[-0.9px]">Računi</h1>
          <p className="mt-2 text-sm text-muted">{invoices.length} posljednjih računa</p>
        </div>
        {canWrite ? (
          <Link
            className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-green px-4 text-sm font-bold text-white hover:bg-green-dark sm:w-auto"
            href="/invoices/new"
          >
            + Izdaj račun
          </Link>
        ) : null}
        {hasPermission(user.role, "reports:financial") ? (
          <Link
            className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-line bg-white px-4 text-sm font-bold text-[#53645a] hover:bg-[#f7faf8] sm:w-auto"
            href="/reports/financial"
          >
            Finansijski izvještaj
          </Link>
        ) : null}
      </div>

      <nav className="mb-4 flex flex-wrap gap-2" aria-label="Filter računa">
        <Link className={`rounded-lg border px-4 py-3 text-sm font-semibold ${status === "all" ? "border-green bg-green-soft text-green-dark" : "border-line bg-white text-muted"}`} href="/invoices" aria-current={status === "all" ? "page" : undefined}>Svi računi</Link>
        <Link className={`rounded-lg border px-4 py-3 text-sm font-semibold ${status === "unpaid" ? "border-green bg-green-soft text-green-dark" : "border-line bg-white text-muted"}`} href="/invoices?status=unpaid" aria-current={status === "unpaid" ? "page" : undefined}>Nenaplaćeni računi</Link>
      </nav>
      {!parsed.success ? <p role="alert" className="mb-4 rounded-lg bg-[#fbefee] p-3 text-sm text-[#a43e3c]">Neispravan filter računa. Prikazani su svi računi.</p> : null}

      <section className="overflow-hidden rounded-xl border border-line bg-white shadow-[0_2px_6px_rgb(34_62_47_/_2%)]">
        {invoices.length ? (
          <>
            <div className="space-y-3 p-3 md:hidden">
              {invoices.map((invoice) => {
                const outstanding = remainingAmount(invoice);
                return (
                  <Link
                    className="block rounded-lg border border-[#eef1ef] p-3"
                    href={`/invoices/${invoice.id}`}
                    key={invoice.id}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="font-bold text-green-dark">{invoice.invoiceNumber}</span>
                      <span className="text-xs font-semibold">{statusLabels[invoice.status]}</span>
                    </div>
                    <p className="mb-0 mt-1 text-sm">
                      {invoice.client.companyName || `${invoice.client.firstName} ${invoice.client.lastName}`}
                    </p>
                    <div className="mt-2 flex justify-between text-xs text-muted">
                      <span>{invoice.issuedAt ? new Intl.DateTimeFormat("bs-BA", { dateStyle: "medium" }).format(invoice.issuedAt) : "Nije izdat"}</span>
                      <span>Preostalo: {formatCurrency(outstanding)}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr>
                    {["Broj", "Klijent", "Datum", "Status", "Ukupno", "Preostalo"].map((heading) => (
                      <th className="whitespace-nowrap border-b border-line px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-[#8a968e]" key={heading}>
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <ClickableRow href={`/invoices/${invoice.id}`} key={invoice.id}>
                      <td className="border-b border-[#eef1ef] px-4 py-3 text-sm font-semibold">
                        <Link className="text-green-dark hover:underline" href={`/invoices/${invoice.id}`}>{invoice.invoiceNumber}</Link>
                      </td>
                      <td className="border-b border-[#eef1ef] px-4 py-3 text-sm">
                        {invoice.client.companyName || `${invoice.client.firstName} ${invoice.client.lastName}`}
                      </td>
                      <td className="whitespace-nowrap border-b border-[#eef1ef] px-4 py-3 text-sm">
                        {invoice.issuedAt ? new Intl.DateTimeFormat("bs-BA", { dateStyle: "medium" }).format(invoice.issuedAt) : "—"}
                      </td>
                      <td className="border-b border-[#eef1ef] px-4 py-3 text-sm">{statusLabels[invoice.status]}</td>
                      <td className="whitespace-nowrap border-b border-[#eef1ef] px-4 py-3 text-sm tabular-nums">{formatCurrency(invoice.total)}</td>
                      <td className="whitespace-nowrap border-b border-[#eef1ef] px-4 py-3 text-sm tabular-nums">{formatCurrency(remainingAmount(invoice))}</td>
                    </ClickableRow>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="px-4 py-12 text-center">
            <p className="mb-1 text-sm font-semibold">{status === "unpaid" ? "Nema nenaplaćenih računa." : "Još nema izdatih računa."}</p>
            {status === "all" ? <p className="m-0 text-sm text-muted">Račun možete izdati iz profila klijenta ili ovdje.</p> : null}
          </div>
        )}
      </section>
    </main>
  );
}
