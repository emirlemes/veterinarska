import { Prisma } from "@prisma/client";
import { z } from "zod";
import { serviceUpdateSchema } from "@/features/services/validation";
import { authorizeApiRequest } from "@/lib/auth/authorize-api-request";
import { prisma } from "@/lib/db";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authorization = await authorizeApiRequest("services:write");
  if (authorization.response) return authorization.response;

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return Response.json({ error: "Usluga nije pronađena." }, { status: 404 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Tijelo zahtjeva nije ispravan JSON." }, { status: 400 });
  }
  const parsed = serviceUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Provjerite unesene izmjene usluge.", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const result = await prisma.$transaction(async (transaction) => {
    const existing = await transaction.service.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) return false;

    await transaction.service.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description || null } : {}),
        ...(input.price !== undefined ? { price: new Prisma.Decimal(input.price) } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });
    await transaction.auditLog.create({
      data: {
        userId: authorization.user.id,
        action: input.isActive === false
          ? "SERVICE_ARCHIVED"
          : input.isActive === true && Object.keys(input).length === 1
            ? "SERVICE_REACTIVATED"
            : "SERVICE_UPDATED",
        entityType: "Service",
        entityId: id,
      },
    });
    return true;
  });

  if (!result) return Response.json({ error: "Usluga nije pronađena." }, { status: 404 });
  return Response.json({ ok: true });
}
