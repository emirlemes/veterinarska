import { Prisma } from "@prisma/client";
import { medicationInputSchema } from "@/features/inventory/validation";
import { authorizeApiRequest } from "@/lib/auth/authorize-api-request";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  const authorization = await authorizeApiRequest("inventory:write");
  if (authorization.response) return authorization.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Tijelo zahtjeva nije ispravan JSON." }, { status: 400 });
  }

  const parsed = medicationInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Provjerite unesene podatke.", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const medication = await prisma.$transaction(async (transaction) => {
    const created = await transaction.medication.create({
      data: {
        name: parsed.data.name,
        activeIngredient: parsed.data.activeIngredient || null,
        form: parsed.data.form || null,
        strength: parsed.data.strength || null,
        category: parsed.data.category || null,
        manufacturer: parsed.data.manufacturer || null,
        sellingPrice: parsed.data.sellingPrice ? new Prisma.Decimal(parsed.data.sellingPrice) : null,
        unit: parsed.data.unit,
        minimumStock: new Prisma.Decimal(parsed.data.minimumStock),
      },
      select: { id: true },
    });
    await transaction.auditLog.create({
      data: {
        userId: authorization.user.id,
        action: "MEDICATION_CREATED",
        entityType: "Medication",
        entityId: created.id,
      },
    });
    return created;
  });
  return Response.json({ id: medication.id }, { status: 201 });
}
