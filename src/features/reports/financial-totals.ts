import { Prisma } from "@prisma/client";

type OutstandingInvoice = {
  total: Prisma.Decimal;
  dueAt: Date | null;
  payments: { amount: Prisma.Decimal; reversals: { amount: Prisma.Decimal }[] }[];
};

export function calculateFinancialTotals({
  paymentTotal,
  reversalTotal,
  invoiceTotal,
  outstandingInvoices,
  now,
}: {
  paymentTotal: Prisma.Decimal | null;
  reversalTotal: Prisma.Decimal | null;
  invoiceTotal: Prisma.Decimal | null;
  outstandingInvoices: OutstandingInvoice[];
  now: Date;
}) {
  const collected = (paymentTotal ?? new Prisma.Decimal(0)).minus(
    reversalTotal ?? new Prisma.Decimal(0),
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

  return {
    collected: collected.toString(),
    issuedTotal: (invoiceTotal ?? new Prisma.Decimal(0)).toString(),
    outstanding: outstanding.toString(),
    overdueCount: outstandingInvoices.filter((invoice) => invoice.dueAt && invoice.dueAt < now).length,
  };
}
