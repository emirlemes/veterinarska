import { InvoiceStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { invoiceVoidInputSchema } from "@/features/invoices/validation";
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
  const authorization = await authorizeApiRequest("invoices:write");
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
  const parsed = invoiceVoidInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Unesite razlog storna računa.", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const outcome = await prisma.$transaction(async (transaction) => {
      const invoice = await transaction.invoice.findUnique({
        where: { id: invoiceId },
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          payments: {
            select: {
              amount: true,
              reversals: { select: { amount: true } },
            },
          },
        },
      });
      if (!invoice) return { kind: "missing" as const };
      if (
        invoice.status !== InvoiceStatus.ISSUED &&
        invoice.status !== InvoiceStatus.PARTIALLY_PAID &&
        invoice.status !== InvoiceStatus.PAID
      ) {
        return { kind: "not-voidable" as const };
      }

      const netPaid = invoice.payments.reduce(
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
      if (netPaid.greaterThan(0)) return { kind: "payments-remain" as const };

      const changed = await transaction.invoice.updateMany({
        where: { id: invoiceId, status: invoice.status },
        data: { status: InvoiceStatus.VOID },
      });
      if (changed.count !== 1) return { kind: "conflict" as const };

      await transaction.auditLog.create({
        data: {
          userId: authorization.user.id,
          action: "INVOICE_VOIDED",
          entityType: "Invoice",
          entityId: invoice.id,
          details: {
            invoiceNumber: invoice.invoiceNumber,
            previousStatus: invoice.status,
            reason: parsed.data.reason,
          },
        },
      });
      return { kind: "voided" as const };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    if (outcome.kind === "missing") {
      return Response.json({ error: "Račun nije pronađen." }, { status: 404 });
    }
    if (outcome.kind === "not-voidable") {
      return Response.json(
        { error: "Može se stornirati samo izdat račun koji nije već storniran." },
        { status: 409 },
      );
    }
    if (outcome.kind === "payments-remain") {
      return Response.json(
        { error: "Prije storna računa prvo evidentirajte storno svih uplata." },
        { status: 409 },
      );
    }
    if (outcome.kind === "conflict") {
      return Response.json(
        { error: "Račun je upravo izmijenjen. Osvježite i pokušajte ponovo." },
        { status: 409 },
      );
    }
    return Response.json({ status: InvoiceStatus.VOID });
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
