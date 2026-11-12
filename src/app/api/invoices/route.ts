import { InvoiceStatus, Prisma } from "@prisma/client";
import { invoiceInputSchema } from "@/features/invoices/validation";
import { authorizeApiRequest } from "@/lib/auth/authorize-api-request";
import { getClinicDate } from "@/lib/dates";
import { prisma } from "@/lib/db";

function isPrismaError(error: unknown, code: string) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

export async function POST(request: Request) {
  const authorization = await authorizeApiRequest("invoices:write");
  if (authorization.response) return authorization.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Tijelo zahtjeva nije ispravan JSON." }, { status: 400 });
  }
  const parsed = invoiceInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Provjerite unesene stavke i podatke računa.", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const input = parsed.data;
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  let dueAt: Date | null = null;
  if (input.dueAt) {
    if (!datePattern.test(input.dueAt)) {
      return Response.json({ error: "Datum dospijeća nije ispravan." }, { status: 400 });
    }
    const [year, month, day] = input.dueAt.split("-").map(Number);
    dueAt = new Date(Date.UTC(year, month - 1, day));
    if (dueAt.toISOString().slice(0, 10) !== input.dueAt) {
      return Response.json({ error: "Datum dospijeća nije ispravan." }, { status: 400 });
    }
  }
  const taxRate = new Prisma.Decimal(input.taxRate);

  try {
    const result = await prisma.$transaction(
      async (transaction) => {
        const client = await transaction.client.findFirst({
          where: { id: input.clientId, isActive: true },
          select: { id: true },
        });
        if (!client) return { kind: "missing-client" as const };

        if (input.examinationId) {
          const examination = await transaction.examination.findFirst({
            where: { id: input.examinationId, clientId: client.id, status: "COMPLETED" },
            select: { id: true, invoice: { select: { id: true } } },
          });
          if (!examination) return { kind: "invalid-examination" as const };
          if (examination.invoice) return { kind: "duplicate-examination" as const };
        }

        const selectedServiceIds = [...new Set(
          input.items.map((item) => item.serviceId).filter((id): id is string => Boolean(id)),
        )];
        const services = selectedServiceIds.length
          ? await transaction.service.findMany({
              where: { id: { in: selectedServiceIds }, isActive: true },
              select: { id: true, name: true, price: true },
            })
          : [];
        if (services.length !== selectedServiceIds.length) {
          return { kind: "invalid-service" as const };
        }
        const serviceById = new Map(services.map((service) => [service.id, service]));
        if (input.items.some((item) => {
          if (!item.serviceId) return false;
          const service = serviceById.get(item.serviceId);
          return !service || service.name !== item.description ||
            !service.price.equals(new Prisma.Decimal(item.unitPrice));
        })) {
          return { kind: "stale-service" as const };
        }
        const invoiceItems = input.items.map((item) => {
          const service = item.serviceId ? serviceById.get(item.serviceId) : null;
          return {
            description: service?.name ?? item.description,
            quantity: new Prisma.Decimal(item.quantity),
            unitPrice: service?.price ?? new Prisma.Decimal(item.unitPrice),
          };
        });
        const subtotalCents = invoiceItems.reduce(
          (sum, item) => sum + Math.round(Number(item.quantity) * Number(item.unitPrice) * 100),
          0,
        );
        if (!Number.isSafeInteger(subtotalCents) || subtotalCents > 999999999999) {
          return { kind: "invalid-total" as const };
        }
        const subtotal = new Prisma.Decimal(subtotalCents).div(100);
        const taxAmount = subtotal.mul(taxRate).div(100).toDecimalPlaces(2);
        const total = subtotal.plus(taxAmount);

        const settings = await transaction.clinicSettings.upsert({
          where: { id: "default" },
          create: { id: "default" },
          update: {},
          select: { invoicePrefix: true, nextInvoiceNumber: true },
        });
        const incremented = await transaction.clinicSettings.updateMany({
          where: { id: "default", nextInvoiceNumber: settings.nextInvoiceNumber },
          data: { nextInvoiceNumber: { increment: 1 } },
        });
        if (incremented.count !== 1) return { kind: "sequence-conflict" as const };

        const invoiceNumber = `${settings.invoicePrefix}-${getClinicDate().replaceAll("-", "")}-${String(settings.nextInvoiceNumber).padStart(6, "0")}`;
        const invoice = await transaction.invoice.create({
          data: {
            invoiceNumber,
            clientId: client.id,
            examinationId: input.examinationId || null,
            status: InvoiceStatus.ISSUED,
            issuedAt: new Date(),
            dueAt,
            subtotal,
            taxRate,
            taxAmount,
            total,
            notes: input.notes || null,
            items: {
              create: invoiceItems.map(({ description, quantity, unitPrice }) => {
                return {
                  description,
                  quantity,
                  unitPrice,
                  total: quantity.mul(unitPrice).toDecimalPlaces(2),
                };
              }),
            },
          },
          select: { id: true, invoiceNumber: true },
        });
        await transaction.auditLog.create({
          data: {
            userId: authorization.user.id,
            action: "INVOICE_ISSUED",
            entityType: "Invoice",
            entityId: invoice.id,
            details: { invoiceNumber: invoice.invoiceNumber, total: total.toString() },
          },
        });
        return { kind: "created" as const, ...invoice };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (result.kind === "missing-client") {
      return Response.json({ error: "Klijent nije pronađen." }, { status: 404 });
    }
    if (result.kind === "invalid-examination") {
      return Response.json({ error: "Završeni pregled ne postoji za odabranog klijenta." }, { status: 400 });
    }
    if (result.kind === "duplicate-examination") {
      return Response.json({ error: "Za ovaj pregled račun već postoji." }, { status: 409 });
    }
    if (result.kind === "invalid-service") {
      return Response.json({ error: "Jedna ili više odabranih usluga nisu aktivne. Osvježite cjenovnik." }, { status: 400 });
    }
    if (result.kind === "stale-service") {
      return Response.json({ error: "Naziv ili cijena odabrane usluge su promijenjeni. Osvježite stranicu i provjerite račun." }, { status: 409 });
    }
    if (result.kind === "invalid-total") {
      return Response.json({ error: "Ukupan iznos računa prelazi dozvoljeni limit." }, { status: 400 });
    }
    if (result.kind === "sequence-conflict") {
      return Response.json({ error: "Broj računa je upravo dodijeljen. Pokušajte ponovo." }, { status: 409 });
    }
    return Response.json({ id: result.id, invoiceNumber: result.invoiceNumber }, { status: 201 });
  } catch (error) {
    if (isPrismaError(error, "P2002")) {
      return Response.json({ error: "Račun za odabrani pregled već postoji." }, { status: 409 });
    }
    if (isPrismaError(error, "P2034")) {
      return Response.json({ error: "Broj računa je upravo dodijeljen. Pokušajte ponovo." }, { status: 409 });
    }
    throw error;
  }
}
