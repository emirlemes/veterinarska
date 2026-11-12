import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { authorizeApiRequest } from "@/lib/auth/authorize-api-request";
import { prisma } from "@/lib/db";
import { clientInputSchema, clientListQuerySchema } from "@/features/clients/validation";

export async function GET(request: NextRequest) {
  const authorization = await authorizeApiRequest("clients:read");
  if (authorization.response) return authorization.response;

  const params = Object.fromEntries(request.nextUrl.searchParams);
  const parsed = clientListQuerySchema.safeParse(params);
  if (!parsed.success) {
    return Response.json({ error: "Neispravan upit za pretragu ili stranicu." }, { status: 400 });
  }
  const filters = parsed.data;
  const where: Prisma.ClientWhereInput = {};
  if (filters.status !== "all") where.isActive = filters.status === "active";
  if (filters.q) {
    where.OR = [
      { firstName: { contains: filters.q, mode: "insensitive" } },
      { lastName: { contains: filters.q, mode: "insensitive" } },
      { companyName: { contains: filters.q, mode: "insensitive" } },
      { phone: { contains: filters.q } },
      { email: { contains: filters.q, mode: "insensitive" } },
    ];
  }
  const total = await prisma.client.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / 20));
  const page = Math.min(filters.page, pageCount);
  const clients = await prisma.client.findMany({
    where,
    select: {
      id: true, firstName: true, lastName: true, companyName: true,
      phone: true, email: true, city: true, isActive: true,
      _count: { select: { animals: true } },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    skip: (page - 1) * 20,
    take: 20,
  });
  return Response.json({ clients, total, page, pageCount }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

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
