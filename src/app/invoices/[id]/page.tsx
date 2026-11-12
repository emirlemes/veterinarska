import type { Metadata } from "next";
import Link from "next/link";
import { InvoiceStatus, PaymentMethod, Prisma } from "@prisma/client";
import { notFound } from "next/navigation";
import { InvoicePaymentPanel } from "@/components/invoices/invoice-payment-panel";
import { InvoiceVoidPanel } from "@/components/invoices/invoice-void-panel";
import { PaymentReversalPanel } from "@/components/invoices/payment-reversal-panel";
import { PrintInvoiceButton } from "@/components/invoices/print-invoice-button";
import { hasPermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/db";
import { z } from "zod";

export const metadata: Metadata = { title: "Račun" };

const invoiceStatusLabels: Record<InvoiceStatus, string> = {
  DRAFT: "Nacrt",
  ISSUED: "Izdato",
  PARTIALLY_PAID: "Djelimično plaćeno",
  PAID: "Plaćeno",
  VOID: "Stornirano",
};

const paymentMethodLabels: Record<PaymentMethod, string> = {
  CASH: "Gotovina",
  CARD: "Kartica",
  BANK_TRANSFER: "Bankovni transfer",
  OTHER: "Ostalo",
};

function formatCurrency(value: Prisma.Decimal) {
  return new Intl.NumberFormat("bs-BA", { style: "currency", currency: "BAM" }).format(Number(value));
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("bs-BA", {
    dateStyle: "medium",
    timeZone: "Europe/Sarajevo",
  }).format(value);
}

export default async function InvoiceDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission("invoices:read");
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();

  const [invoice, settings] = await Promise.all([
    prisma.invoice.findUnique({
      where: { id },
      include: {
        client: true,
        examination: {
          include: { animal: { select: { id: true, name: true, species: true } } },
        },
        items: { orderBy: { id: "asc" } },
        payments: {
          include: {
            recordedBy: { select: { firstName: true, lastName: true } },
            reversals: { select: { id: true, amount: true, reason: true, reversedAt: true } },
          },
          orderBy: { paidAt: "desc" },
        },
      },
    }),
    prisma.clinicSettings.findUnique({ where: { id: "default" } }),
  ]);
  if (!invoice) notFound();

  const paid = invoice.payments.reduce(
    (total, payment) => total.plus(
      payment.amount.minus(payment.reversals.reduce(
        (reversed, reversal) => reversed.plus(reversal.amount),
        new Prisma.Decimal(0),
      )),
    ),
    new Prisma.Decimal(0),
  );
  const rawRemaining = invoice.total.minus(paid);
  const remaining = rawRemaining.greaterThan(0) ? rawRemaining : new Prisma.Decimal(0);
  const canWritePayments = hasPermission(user.role, "payments:write");
  const canWriteInvoices = hasPermission(user.role, "invoices:write");

  return (
    <main className="mx-auto w-full max-w-[1440px] px-4 pb-8 pt-5 sm:px-[34px] sm:pb-[42px] sm:pt-[31px] print:max-w-none print:p-0">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between print:hidden">
        <div>
          <p className="mb-[7px] text-[11px] font-[750] uppercase tracking-[0.7px] text-green">Finansije ambulante</p>
          <h1 className="m-0 text-[clamp(24px,3vw,30px)] tracking-[-0.9px]">{invoice.invoiceNumber}</h1>
          <p className="mt-2 text-sm text-muted">{invoiceStatusLabels[invoice.status]}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <PrintInvoiceButton />
          <Link className="inline-flex min-h-11 items-center justify-center rounded-lg border border-line px-4 text-sm font-semibold text-[#53645a] hover:bg-[#f7faf8]" href="/invoices">
            Nazad na račune
          </Link>
        </div>
      </div>

      <article className="mx-auto w-full max-w-[900px] rounded-xl border border-line bg-white p-4 shadow-[0_2px_6px_rgb(34_62_47_/_2%)] sm:p-8 print:max-w-none print:border-0 print:p-0 print:shadow-none">
        <header className="flex flex-col justify-between gap-5 border-b-2 border-ink pb-5 sm:flex-row">
          <div>
            <h2 className="m-0 text-xl font-bold">{settings?.clinicName || "Veterinarska ambulanta"}</h2>
            <div className="mt-2 space-y-0.5 text-sm text-muted">
              {settings?.address ? <p className="m-0">{settings.address}{settings.city ? `, ${settings.city}` : ""}</p> : null}
              {settings?.phone ? <p className="m-0">Telefon: {settings.phone}</p> : null}
              {settings?.email ? <p className="m-0">{settings.email}</p> : null}
              {settings?.taxIdentificationNumber ? <p className="m-0">ID broj: {settings.taxIdentificationNumber}</p> : null}
            </div>
          </div>
          <div className="sm:text-right">
            <div className="text-xs font-bold uppercase tracking-wide text-muted">Račun</div>
            <div className="mt-1 text-lg font-bold">{invoice.invoiceNumber}</div>
            <div className="mt-2 text-sm">Datum izdavanja: {invoice.issuedAt ? formatDate(invoice.issuedAt) : "—"}</div>
            <div className="text-sm">Dospijeće: {invoice.dueAt ? formatDate(invoice.dueAt) : "Po prijemu"}</div>
            <div className="mt-2 inline-flex rounded-full bg-[#edf4ef] px-2.5 py-1 text-xs font-bold text-[#587362]">
              {invoiceStatusLabels[invoice.status]}
            </div>
          </div>
        </header>

        <section className="py-5">
          <h3 className="m-0 text-xs font-bold uppercase tracking-wide text-muted">Kupac</h3>
          <p className="mb-0 mt-1 text-base font-semibold">
            {invoice.client.companyName || `${invoice.client.firstName} ${invoice.client.lastName}`}
          </p>
          {invoice.client.companyName ? (
            <p className="mb-0 mt-1 text-sm text-muted">{invoice.client.firstName} {invoice.client.lastName}</p>
          ) : null}
          <div className="mt-1 text-sm text-muted">
            {[invoice.client.address, invoice.client.city].filter(Boolean).join(", ")}
          </div>
          <div className="text-sm text-muted">{invoice.client.phone}{invoice.client.email ? ` · ${invoice.client.email}` : ""}</div>
          {invoice.examination ? (
            <p className="mb-0 mt-2 text-sm text-muted">
              Pregled: {invoice.examination.animal.name} · {formatDate(invoice.examination.examinationDate)}
              {" · "}{invoice.examination.animal.species}
            </p>
          ) : null}
        </section>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-y border-line">
                {["Opis", "Količina", "Cijena", "Iznos"].map((heading) => (
                  <th className="px-2 py-3 text-xs font-bold uppercase tracking-wide text-muted sm:px-3" key={heading}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item) => (
                <tr className="border-b border-[#eef1ef]" key={item.id}>
                  <td className="px-2 py-3 text-sm sm:px-3">{item.description}</td>
                  <td className="whitespace-nowrap px-2 py-3 text-sm tabular-nums sm:px-3">{item.quantity.toString()}</td>
                  <td className="whitespace-nowrap px-2 py-3 text-sm tabular-nums sm:px-3">{formatCurrency(item.unitPrice)}</td>
                  <td className="whitespace-nowrap px-2 py-3 text-right text-sm font-semibold tabular-nums sm:px-3">{formatCurrency(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <dl className="ml-auto mt-4 grid w-full max-w-[360px] grid-cols-[1fr_auto] gap-x-6 gap-y-2 text-sm">
          <dt className="text-muted">Međuzbir</dt><dd className="m-0 text-right tabular-nums">{formatCurrency(invoice.subtotal)}</dd>
          <dt className="text-muted">Porez ({invoice.taxRate.toString()}%)</dt><dd className="m-0 text-right tabular-nums">{formatCurrency(invoice.taxAmount)}</dd>
          <dt className="border-t border-line pt-2 font-bold">Ukupno</dt><dd className="m-0 border-t border-line pt-2 text-right text-base font-bold tabular-nums">{formatCurrency(invoice.total)}</dd>
          <dt className="text-muted">Uplaćeno</dt><dd className="m-0 text-right tabular-nums">{formatCurrency(paid)}</dd>
          <dt className="font-bold">Preostalo</dt><dd className="m-0 text-right font-bold tabular-nums">{formatCurrency(remaining)}</dd>
        </dl>
        {invoice.notes ? (
          <p className="mb-0 mt-5 whitespace-pre-wrap border-t border-line pt-4 text-sm text-muted">
            <strong>Napomena:</strong> {invoice.notes}
          </p>
        ) : null}
      </article>

      <section className="mx-auto mt-4 w-full max-w-[900px] rounded-xl border border-line bg-white p-4 shadow-[0_2px_6px_rgb(34_62_47_/_2%)] sm:p-6 print:hidden">
        <h2 className="m-0 text-base font-bold">Uplate</h2>
        {invoice.payments.length ? (
          <div className="mt-3 divide-y divide-[#eef1ef] border-y border-[#eef1ef]">
            {invoice.payments.map((payment) => {
              const reversed = payment.reversals.reduce(
                (sum, reversal) => sum.plus(reversal.amount),
                new Prisma.Decimal(0),
              );
              return (
                <div className="flex flex-wrap items-start justify-between gap-2 py-3 text-sm" key={payment.id}>
                  <div>
                    <div className="font-semibold">{paymentMethodLabels[payment.method]}</div>
                    <div className="mt-1 text-xs text-muted">
                      {formatDate(payment.paidAt)} · {payment.recordedBy.firstName} {payment.recordedBy.lastName}
                      {payment.reference ? ` · Ref: ${payment.reference}` : ""}
                    </div>
                    {reversed.greaterThan(0) ? (
                      <div className="mt-1 text-xs text-[#a43e3c]">Stornirano: {formatCurrency(reversed)}</div>
                    ) : null}
                    {payment.reversals.map((reversal) => (
                      <div className="mt-1 text-xs text-[#a43e3c]" key={reversal.id}>
                        Storno {formatCurrency(reversal.amount)} · {formatDate(reversal.reversedAt)} · {reversal.reason}
                      </div>
                    ))}
                    {canWritePayments && payment.amount.minus(reversed).greaterThan(0) ? (
                      <PaymentReversalPanel
                        invoiceId={invoice.id}
                        paymentId={payment.id}
                        refundable={payment.amount.minus(reversed).toString()}
                      />
                    ) : null}
                  </div>
                  <span className="font-bold tabular-nums">{formatCurrency(payment.amount)}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mb-0 mt-2 text-sm text-muted">Uplate još nisu evidentirane.</p>
        )}
        {canWritePayments && remaining.greaterThan(0) ? (
          <div className="mt-5 border-t border-line pt-4">
            <h3 className="mb-3 text-sm font-bold">Evidentiraj uplatu</h3>
            <InvoicePaymentPanel
              invoiceId={invoice.id}
              remaining={remaining.toString()}
              payable={invoice.status === "ISSUED" || invoice.status === "PARTIALLY_PAID"}
            />
          </div>
        ) : null}
        {canWriteInvoices && invoice.status === "DRAFT" ? (
          <p className="mt-3 text-xs text-muted">Nacrt računa se ne može naplatiti dok se ne izda.</p>
        ) : null}
        {canWriteInvoices &&
        invoice.status !== InvoiceStatus.DRAFT &&
        invoice.status !== InvoiceStatus.VOID ? (
          paid.equals(0) ? (
            <InvoiceVoidPanel invoiceId={invoice.id} />
          ) : (
            <p className="mt-5 border-t border-line pt-4 text-xs text-muted">
              Račun se može stornirati nakon što stornirate sve evidentirane uplate.
            </p>
          )
        ) : null}
      </section>
    </main>
  );
}
