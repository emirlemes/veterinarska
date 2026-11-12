import { z } from "zod";
import { authorizeApiRequest } from "@/lib/auth/authorize-api-request";
import { prisma } from "@/lib/db";
import { clientInputSchema } from "@/features/clients/validation";

const idSchema = z.string().uuid();

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authorization = await authorizeApiRequest("clients:write");
  if (authorization.response) return authorization.response;

  const { id } = await context.params;
  if (!idSchema.safeParse(id).success) {
    return Response.json({ error: "Neispravan identifikator klijenta." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Tijelo zahtjeva nije ispravan JSON." }, { status: 400 });
  }

  const parsed = clientInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Provjerite unesene podatke.", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const updated = await prisma.$transaction(async (transaction) => {
    const result = await transaction.client.updateMany({
      where: { id, isActive: true },
      data: {
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        companyName: parsed.data.companyName || null,
        phone: parsed.data.phone,
        email: parsed.data.email || null,
        address: parsed.data.address || null,
        city: parsed.data.city || null,
        postalCode: parsed.data.postalCode || null,
        notes: parsed.data.notes || null,
      },
    });

    if (result.count > 0) {
      await transaction.auditLog.create({
        data: {
          userId: authorization.user.id,
          action: "CLIENT_UPDATED",
          entityType: "Client",
          entityId: id,
        },
      });
    }

    return result.count;
  });

  if (updated === 0) {
    return Response.json({ error: "Klijent nije pronađen ili je arhiviran." }, { status: 404 });
  }

  return Response.json({ success: true });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authorization = await authorizeApiRequest("clients:write");
  if (authorization.response) return authorization.response;

  const { id } = await context.params;
  if (!idSchema.safeParse(id).success) {
    return Response.json({ error: "Neispravan identifikator klijenta." }, { status: 400 });
  }

  const archived = await prisma.$transaction(async (transaction) => {
    const result = await transaction.client.updateMany({
      where: { id, isActive: true },
      data: { isActive: false },
    });

    if (result.count > 0) {
      await transaction.auditLog.create({
        data: {
          userId: authorization.user.id,
          action: "CLIENT_ARCHIVED",
          entityType: "Client",
          entityId: id,
        },
      });
    }

    return result.count;
  });

  if (archived === 0) {
    return Response.json({ error: "Klijent nije pronađen ili je već arhiviran." }, { status: 404 });
  }

  return Response.json({ success: true });
}
