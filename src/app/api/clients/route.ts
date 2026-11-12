import { NextRequest } from "next/server";
import { authorizeApiRequest } from "@/lib/auth/authorize-api-request";
import { prisma } from "@/lib/db";
import { clientInputSchema } from "@/features/clients/validation";

export async function POST(request: NextRequest) {
  const authorization = await authorizeApiRequest("clients:write");
  if (authorization.response) return authorization.response;

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

  const client = await prisma.$transaction(async (transaction) => {
    const createdClient = await transaction.client.create({
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
      select: { id: true },
    });

    await transaction.auditLog.create({
      data: {
        userId: authorization.user.id,
        action: "CLIENT_CREATED",
        entityType: "Client",
        entityId: createdClient.id,
      },
    });

    return createdClient;
  });

  return Response.json({ id: client.id }, { status: 201 });
}
