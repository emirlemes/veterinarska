import { InvoiceStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { paymentReversalInputSchema } from "@/features/invoices/validation";
import { authorizeApiRequest } from "@/lib/auth/authorize-api-request";
import { prisma } from "@/lib/db";

const idSchema = z.string().uuid();

function isPrismaError(error: unknown, code: string) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; paymentId: string }> },
) {
  const authorization = await authorizeApiRequest("payments:write");
  if (authorization.response) return authorization.response;

  const { id: invoiceId, paymentId } = await context.params;
  if (!idSchema.safeParse(invoiceId).success || !idSchema.safeParse(paymentId).success) {
    return Response.json({ error: "Neispravan identifikator računa ili uplate." }, { status: 400 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Tijelo zahtjeva nije ispravan JSON." }, { status: 400 });
  }
  const parsed = paymentReversalInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Unesite iznos i razlog storna.", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const reversalAmount = new Prisma.Decimal(parsed.data.amount);
  try {
    const outcome = await prisma.$transaction(async (transaction) => {
      const invoice = await transaction.invoice.findUnique({
        where: { id: invoiceId },
        select: { id: true, total: true, status: true },
      });
      if (!invoice) return { kind: "missing-invoice" as const };

      const payment = await transaction.payment.findFirst({
        where: { id: paymentId, invoiceId },
        select: {
          id: true,
          amount: true,
          reversals: { select: { amount: true } },
        },
      });
      if (!payment) return { kind: "missing-payment" as const };

      const alreadyReversed = payment.reversals.reduce(
        (total, reversal) => total.plus(reversal.amount),
        new Prisma.Decimal(0),
      );
      const refundable = payment.amount.minus(alreadyReversed);
      if (reversalAmount.greaterThan(refundable)) {
        return { kind: "exceeds-payment" as const, refundable: refundable.toString() };
      }

      const allPayments = await transaction.payment.findMany({
        where: { invoiceId },
        select: {
          amount: true,
          reversals: { select: { amount: true } },
        },
      });
      const paidBefore = allPayments.reduce(
        (total, entry) => total.plus(
          entry.amount.minus(entry.reversals.reduce(
            (reversed, reversal) => reversed.plus(reversal.amount),
            new Prisma.Decimal(0),
          )),
        ),
        new Prisma.Decimal(0),
      );
      const paidAfter = paidBefore.minus(reversalAmount);
      const nextStatus = paidAfter.greaterThanOrEqualTo(invoice.total)
        ? InvoiceStatus.PAID
        : paidAfter.greaterThan(0)
          ? InvoiceStatus.PARTIALLY_PAID
          : InvoiceStatus.ISSUED;

      const changed = await transaction.invoice.updateMany({
        where: { id: invoiceId, status: invoice.status },
        data: { status: nextStatus },
      });
      if (changed.count !== 1) return { kind: "conflict" as const };

      const reversal = await transaction.paymentReversal.create({
        data: {
          paymentId,
          amount: reversalAmount,
          reason: parsed.data.reason,
        },
        select: { id: true, reversedAt: true },
      });
      await transaction.auditLog.create({
        data: {
          userId: authorization.user.id,
          action: "INVOICE_PAYMENT_REVERSED",
          entityType: "PaymentReversal",
          entityId: reversal.id,
          details: {
            invoiceId,
            paymentId,
            amount: reversalAmount.toString(),
            reason: parsed.data.reason,
          },
        },
      });
      return {
        kind: "reversed" as const,
        reversal: {
          id: reversal.id,
          amount: reversalAmount.toString(),
          reason: parsed.data.reason,
          reversedAt: reversal.reversedAt.toISOString(),
        },
        status: nextStatus,
        remaining: invoice.total.minus(paidAfter).toString(),
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    if (outcome.kind === "missing-invoice") {
      return Response.json({ error: "Račun nije pronađen." }, { status: 404 });
    }
    if (outcome.kind === "missing-payment") {
      return Response.json({ error: "Uplata nije pronađena za ovaj račun." }, { status: 404 });
    }
    if (outcome.kind === "exceeds-payment") {
      return Response.json({
        error: "Iznos storna prelazi iznos uplate koji još nije storniran.",
        refundable: outcome.refundable,
      }, { status: 400 });
    }
    if (outcome.kind === "conflict") {
      return Response.json({ error: "Račun je upravo izmijenjen. Osvježite i pokušajte ponovo." }, { status: 409 });
    }
    return Response.json(outcome, { status: 201 });
  } catch (error) {
    if (isPrismaError(error, "P2034")) {
      return Response.json({ error: "Račun je upravo izmijenjen. Osvježite i pokušajte ponovo." }, { status: 409 });
    }
    throw error;
  }
}
