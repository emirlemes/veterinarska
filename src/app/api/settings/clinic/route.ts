import { Prisma } from "@prisma/client";
import { clinicSettingsSchema } from "@/features/settings/validation";
import { authorizeApiRequest } from "@/lib/auth/authorize-api-request";
import { prisma } from "@/lib/db";

export async function GET() {
  const authorization = await authorizeApiRequest("settings:write");
  if (authorization.response) return authorization.response;

  const settings = await prisma.clinicSettings.findUnique({
    where: { id: "default" },
  });
  return Response.json(settings ? {
    ...settings,
    defaultTaxRate: settings.defaultTaxRate.toString(),
  } : null);
}

export async function PUT(request: Request) {
  const authorization = await authorizeApiRequest("settings:write");
  if (authorization.response) return authorization.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Tijelo zahtjeva nije ispravan JSON." }, { status: 400 });
  }
  const parsed = clinicSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Provjerite unesene postavke.", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const input = parsed.data;

  const settings = await prisma.$transaction(async (transaction) => {
    const updated = await transaction.clinicSettings.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        clinicName: input.clinicName,
        address: input.address || null,
        city: input.city || null,
        phone: input.phone || null,
        email: input.email?.toLowerCase() || null,
        taxIdentificationNumber: input.taxIdentificationNumber || null,
        invoicePrefix: input.invoicePrefix,
        defaultTaxRate: new Prisma.Decimal(input.defaultTaxRate),
        appointmentDurationMinutes: input.appointmentDurationMinutes,
        workingHours: input.workingHours,
      },
      update: {
        clinicName: input.clinicName,
        address: input.address || null,
        city: input.city || null,
        phone: input.phone || null,
        email: input.email?.toLowerCase() || null,
        taxIdentificationNumber: input.taxIdentificationNumber || null,
        invoicePrefix: input.invoicePrefix,
        defaultTaxRate: new Prisma.Decimal(input.defaultTaxRate),
        appointmentDurationMinutes: input.appointmentDurationMinutes,
        workingHours: input.workingHours,
      },
    });
    await transaction.auditLog.create({
      data: {
        userId: authorization.user.id,
        action: "CLINIC_SETTINGS_UPDATED",
        entityType: "ClinicSettings",
        entityId: "default",
        details: {
          clinicName: input.clinicName,
          invoicePrefix: input.invoicePrefix,
          defaultTaxRate: input.defaultTaxRate,
          appointmentDurationMinutes: input.appointmentDurationMinutes,
          workingHours: input.workingHours,
        },
      },
    });
    return updated;
  });

  return Response.json({
    ...settings,
    defaultTaxRate: settings.defaultTaxRate.toString(),
  });
}
