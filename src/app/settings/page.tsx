import type { Metadata } from "next";
import { ClinicSettingsForm } from "@/components/settings/clinic-settings-form";
import { defaultWorkingHours, workingHoursSchema } from "@/features/settings/validation";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Podešavanja ambulante" };

export default async function SettingsPage() {
  await requirePermission("settings:write");
  const settings = await prisma.clinicSettings.findUnique({
    where: { id: "default" },
    select: {
      clinicName: true,
      address: true,
      city: true,
      phone: true,
      email: true,
      taxIdentificationNumber: true,
      invoicePrefix: true,
      defaultTaxRate: true,
      appointmentDurationMinutes: true,
      nextInvoiceNumber: true,
      workingHours: true,
    },
  });

  return (
    <main className="mx-auto w-full max-w-[1100px] px-4 pb-8 pt-5 sm:px-[34px] sm:pb-[42px] sm:pt-[31px]">
      <div className="mb-5">
        <p className="mb-[7px] text-[11px] font-[750] uppercase tracking-[0.7px] text-green">Administracija</p>
        <h1 className="m-0 text-[clamp(24px,3vw,30px)] tracking-[-0.9px]">Podešavanja ambulante</h1>
        <p className="mt-2 text-sm text-muted">Podaci se koriste na računima i kao početne vrijednosti za termine.</p>
      </div>
      <ClinicSettingsForm
        settings={{
          clinicName: settings?.clinicName ?? "Veterinarska ambulanta",
          address: settings?.address ?? "",
          city: settings?.city ?? "",
          phone: settings?.phone ?? "",
          email: settings?.email ?? "",
          taxIdentificationNumber: settings?.taxIdentificationNumber ?? "",
          invoicePrefix: settings?.invoicePrefix ?? "RAC",
          defaultTaxRate: settings?.defaultTaxRate.toString() ?? "0",
          appointmentDurationMinutes: settings?.appointmentDurationMinutes ?? 30,
          nextInvoiceNumber: settings?.nextInvoiceNumber ?? 1,
          workingHours: settings?.workingHours && workingHoursSchema.safeParse(settings.workingHours).success
            ? workingHoursSchema.parse(settings.workingHours)
            : defaultWorkingHours,
        }}
      />
    </main>
  );
}
