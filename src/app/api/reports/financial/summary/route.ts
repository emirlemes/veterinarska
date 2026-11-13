import { InvoiceStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { reportDateRangeSchema } from "@/features/reports/validation";
import { calculateFinancialTotals } from "@/features/reports/financial-totals";
import { authorizeApiRequest } from "@/lib/auth/authorize-api-request";
import { getClinicDateBounds } from "@/lib/dates";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const authorization = await authorizeApiRequest("reports:financial");
  if (authorization.response) return authorization.response;

  const parsed = reportDateRangeSchema.safeParse({
    from: request.nextUrl.searchParams.get("from"),
    to: request.nextUrl.searchParams.get("to"),
  });
  if (!parsed.success) {
    return Response.json({ error: "Odaberite ispravan period izvještaja." }, { status: 400 });
  }
  const from = getClinicDateBounds(parsed.data.from);
  const to = getClinicDateBounds(parsed.data.to);
  if (!from || !to) {
    return Response.json({ error: "Odabrani period nije ispravan." }, { status: 400 });
  }

  const [invoices, invoiceTotals, payments, reversals, outstandingInvoices, paymentEntries] = await Promise.all([
    prisma.invoice.findMany({
      where: { issuedAt: { gte: from.start, lt: to.end } },
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
        issuedAt: { gte: from.start, lt: to.end },
        status: { not: InvoiceStatus.VOID },
      },
      _sum: { total: true },
      _count: { _all: true },
    }),
    prisma.payment.aggregate({
      where: { paidAt: { gte: from.start, lt: to.end } },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.paymentReversal.aggregate({
      where: { reversedAt: { gte: from.start, lt: to.end } },
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
    prisma.payment.findMany({
      where: { paidAt: { gte: from.start, lt: to.end } },
      select: {
        id: true, paidAt: true, amount: true, method: true,
        invoice: { select: { id: true, invoiceNumber: true, client: { select: { firstName: true, lastName: true, companyName: true } } } },
      },
      orderBy: [{ paidAt: "desc" }, { id: "desc" }],
      take: 500,
    }),
  ]);
  const totals = calculateFinancialTotals({
    paymentTotal: payments._sum.amount,
    reversalTotal: reversals._sum.amount,
    invoiceTotal: invoiceTotals._sum.total,
    outstandingInvoices,
    now: new Date(),
  });

  return Response.json({
    invoices: invoices.map((invoice) => ({
      ...invoice,
      total: invoice.total.toString(),
      issuedAt: invoice.issuedAt?.toISOString() ?? null,
    })),
    ...totals,
    paymentEntries: paymentEntries.map((payment) => ({
      ...payment,
      paidAt: payment.paidAt.toISOString(),
      amount: payment.amount.toString(),
    })),
    paymentCount: payments._count._all,
    invoiceCount: invoiceTotals._count._all,
  }, { headers: { "Cache-Control": "private, no-store" } });
}
