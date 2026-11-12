import { Prisma } from "@prisma/client";
import { serviceInputSchema } from "@/features/services/validation";
import { authorizeApiRequest } from "@/lib/auth/authorize-api-request";
import { prisma } from "@/lib/db";

export async function GET() {
  const authorization = await authorizeApiRequest("services:read");
  if (authorization.response) return authorization.response;

  const services = await prisma.service.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      price: true,
      isActive: true,
    },
  });
  return Response.json(services.map((service) => ({
    ...service,
    price: service.price.toString(),
  })));
}

export async function POST(request: Request) {
  const authorization = await authorizeApiRequest("services:write");
  if (authorization.response) return authorization.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Tijelo zahtjeva nije ispravan JSON." }, { status: 400 });
  }
  const parsed = serviceInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Provjerite unesene podatke usluge.", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const service = await prisma.$transaction(async (transaction) => {
    const created = await transaction.service.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description || null,
        price: new Prisma.Decimal(parsed.data.price),
      },
      select: { id: true },
    });
    await transaction.auditLog.create({
      data: {
        userId: authorization.user.id,
        action: "SERVICE_CREATED",
        entityType: "Service",
        entityId: created.id,
      },
    });
    return created;
  });
  return Response.json({ id: service.id }, { status: 201 });
}
