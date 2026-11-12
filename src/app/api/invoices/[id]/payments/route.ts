import { InvoiceStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { paymentInputSchema } from "@/features/invoices/validation";
import { authorizeApiRequest } from "@/lib/auth/authorize-api-request";
import { prisma } from "@/lib/db";

const idSchema = z.string().uuid();

function isPrismaError(error: unknown, code: string) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authorization = await authorizeApiRequest("payments:write");
  if (authorization.response) return authorization.response;
  const { id: invoiceId } = await context.params;
  if (!idSchema.safeParse(invoiceId).success) {
    return Response.json({ error: "Neispravan identifikator računa." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Tijelo zahtjeva nije ispravan JSON." }, { status: 400 });
  }
  const parsed = paymentInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Provjerite unesene podatke.", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const paymentAmount = new Prisma.Decimal(parsed.data.amount);

  try {
    const outcome = await prisma.$transaction(
      async (transaction) => {
        const invoice = await transaction.invoice.findUnique({
          where: { id: invoiceId },
          select: { id: true, status: true, total: true },
        });
        if (!invoice) return { kind: "missing" as const };
        if (
          invoice.status !== InvoiceStatus.ISSUED &&
          invoice.status !== InvoiceStatus.PARTIALLY_PAID
        ) {
          return { kind: "not-payable" as const };
        }

        const payments = await transaction.payment.findMany({
          where: { invoiceId },
          select: {
            amount: true,
            reversals: { select: { amount: true } },
          },
        });
        const paid = payments.reduce(
          (sum, payment) =>
            sum.plus(
              payment.amount.minus(
                payment.reversals.reduce(
                  (reversed, reversal) => reversed.plus(reversal.amount),
                  new Prisma.Decimal(0),
                ),
              ),
            ),
          new Prisma.Decimal(0),
        );
        const due = invoice.total.minus(paid);
        if (paymentAmount.greaterThan(due)) return { kind: "exceeds-due" as const };

        const updatedStatus = paymentAmount.equals(due)
          ? InvoiceStatus.PAID
          : InvoiceStatus.PARTIALLY_PAID;
        const changed = await transaction.invoice.updateMany({
          where: {
            id: invoiceId,
            status: invoice.status,
          },
          data: { status: updatedStatus },
        });
        if (changed.count !== 1) return { kind: "conflict" as const };

        const payment = await transaction.payment.create({
          data: {
            invoiceId,
            recordedById: authorization.user.id,
            amount: paymentAmount,
            method: parsed.data.method,
            reference: parsed.data.reference || null,
          },
          select: { id: true, paidAt: true },
        });
        await transaction.auditLog.create({
          data: {
            userId: authorization.user.id,
            action: "INVOICE_PAYMENT_RECORDED",
            entityType: "Payment",
            entityId: payment.id,
            details: { invoiceId, amount: paymentAmount.toString(), method: parsed.data.method },
          },
        });
        return {
          kind: "recorded" as const,
          payment: {
            id: payment.id,
            paidAt: payment.paidAt.toISOString(),
            amount: paymentAmount.toString(),
            method: parsed.data.method,
            reference: parsed.data.reference || null,
          },
          status: updatedStatus,
          remaining: due.minus(paymentAmount).toString(),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (outcome.kind === "missing") {
      return Response.json({ error: "Račun nije pronađen." }, { status: 404 });
    }
    if (outcome.kind === "not-payable") {
      return Response.json({ error: "Uplata se može evidentirati samo za izdat račun s dugovanjem." }, { status: 409 });
    }
    if (outcome.kind === "exceeds-due") {
      return Response.json({ error: "Iznos uplate je veći od preostalog dugovanja." }, { status: 400 });
    }
    if (outcome.kind === "conflict") {
      return Response.json({ error: "Račun je upravo izmijenjen. Osvježite i pokušajte ponovo." }, { status: 409 });
    }
    return Response.json(outcome, { status: 201 });
  } catch (error) {
    if (isPrismaError(error, "P2034")) {
      return Response.json(
        { error: "Račun je upravo izmijenjen. Osvježite i pokušajte ponovo." },
        { status: 409 },
      );
    }
    throw error;
  }
}
