import { Prisma } from "@prisma/client";
import { z } from "zod";
import { medicationInputSchema } from "@/features/inventory/validation";
import { authorizeApiRequest } from "@/lib/auth/authorize-api-request";
import { prisma } from "@/lib/db";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const authorization = await authorizeApiRequest("inventory:write");
  if (authorization.response) return authorization.response;

  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) {
    return Response.json({ error: "Neispravan identifikator lijeka." }, { status: 400 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Tijelo zahtjeva nije ispravan JSON." }, { status: 400 });
  }
  const parsed = medicationInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Provjerite unesene podatke.", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const input = parsed.data;
  const outcome = await prisma.$transaction(async (transaction) => {
    const medication = await transaction.medication.findFirst({
      where: { id, isActive: true },
      select: { unit: true },
    });
    if (!medication) return "missing" as const;
    if (medication.unit !== input.unit) return "unit-changed" as const;
    const updated = await transaction.medication.updateMany({
      where: { id, isActive: true, unit: medication.unit },
      data: {
        name: input.name,
        activeIngredient: input.activeIngredient || null,
        form: input.form || null,
        strength: input.strength || null,
        category: input.category || null,
        manufacturer: input.manufacturer || null,
        sellingPrice: input.sellingPrice ? new Prisma.Decimal(input.sellingPrice) : null,
        minimumStock: new Prisma.Decimal(input.minimumStock),
      },
    });
    if (updated.count !== 1) return "missing" as const;
    await transaction.auditLog.create({
      data: {
        userId: authorization.user.id,
        action: "MEDICATION_UPDATED",
        entityType: "Medication",
        entityId: id,
      },
    });
    return "updated" as const;
  });
  if (outcome === "missing") return Response.json({ error: "Aktivni lijek nije pronađen." }, { status: 404 });
  if (outcome === "unit-changed") return Response.json({ error: "Jedinicu mjere postojećeg lijeka nije moguće mijenjati." }, { status: 409 });
  return Response.json({ success: true });
}
