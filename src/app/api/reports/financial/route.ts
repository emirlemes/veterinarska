import { NextRequest } from "next/server";
import { InvoiceStatus } from "@prisma/client";
import { reportDateRangeSchema } from "@/features/reports/validation";
import { authorizeApiRequest } from "@/lib/auth/authorize-api-request";
import { getClinicDateBounds } from "@/lib/dates";
import { prisma } from "@/lib/db";

function csvCell(value: string | number) {
  const text = String(value);
  const safeText = typeof value === "string" && /^[\u0000-\u0020]*[=+\-@]/.test(value)
    ? `'${text}`
    : text;
  return `"${safeText.replaceAll('"', '""')}"`;
}

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

  const [payments, reversals, invoices] = await Promise.all([
    prisma.payment.findMany({
      where: { paidAt: { gte: from.start, lt: to.end } },
      include: {
        invoice: { select: { invoiceNumber: true, client: { select: { firstName: true, lastName: true, companyName: true } } } },
      },
      orderBy: { paidAt: "asc" },
    }),
    prisma.paymentReversal.findMany({
      where: { reversedAt: { gte: from.start, lt: to.end } },
      include: {
        payment: {
          include: {
            invoice: { select: { invoiceNumber: true, client: { select: { firstName: true, lastName: true, companyName: true } } } },
          },
        },
      },
      orderBy: { reversedAt: "asc" },
    }),
    prisma.invoice.findMany({
      where: {
        issuedAt: { gte: from.start, lt: to.end },
        status: { not: InvoiceStatus.VOID },
      },
      include: { client: { select: { firstName: true, lastName: true, companyName: true } } },
      orderBy: { issuedAt: "asc" },
    }),
  ]);
  const rows = [
    ["Tip", "Datum", "Broj dokumenta", "Klijent", "Način", "Iznos (BAM)", "Referenca"],
  ];

  for (const invoice of invoices) {
    rows.push([
      "Račun",
      invoice.issuedAt?.toISOString() ?? "",
      invoice.invoiceNumber,
      invoice.client.companyName || `${invoice.client.firstName} ${invoice.client.lastName}`,
      "",
      invoice.total.toFixed(2),
      "",
    ]);
  }
  for (const payment of payments) {
    const client =
      payment.invoice.client.companyName ||
      `${payment.invoice.client.firstName} ${payment.invoice.client.lastName}`;
    rows.push([
      "Uplata",
      payment.paidAt.toISOString(),
      payment.invoice.invoiceNumber,
      client,
      payment.method,
      Number(payment.amount).toFixed(2),
      payment.reference ?? "",
    ]);
  }
  for (const reversal of reversals) {
    const client =
      reversal.payment.invoice.client.companyName ||
      `${reversal.payment.invoice.client.firstName} ${reversal.payment.invoice.client.lastName}`;
    rows.push([
      "Storno uplate",
      reversal.reversedAt.toISOString(),
      reversal.payment.invoice.invoiceNumber,
      client,
      "",
      (-Number(reversal.amount)).toFixed(2),
      reversal.reason,
    ]);
  }

  const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="finansijski-izvjestaj-${parsed.data.from}-${parsed.data.to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
