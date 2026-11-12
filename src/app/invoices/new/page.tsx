import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { InvoiceForm } from "@/components/invoices/invoice-form";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Novi račun" };

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string; examinationId?: string }>;
}) {
  await requirePermission("invoices:write");
  const params = await searchParams;
  if (params.clientId && !z.string().uuid().safeParse(params.clientId).success) notFound();
  if (params.examinationId && !z.string().uuid().safeParse(params.examinationId).success) notFound();

  const clients = await prisma.client.findMany({
    where: { isActive: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: { id: true, firstName: true, lastName: true, companyName: true },
  });
  const [settings, examination, services] = await Promise.all([
    prisma.clinicSettings.findUnique({
      where: { id: "default" },
      select: { defaultTaxRate: true },
    }),
    params.examinationId
      ? prisma.examination.findUnique({
          where: { id: params.examinationId },
          select: {
            id: true,
            clientId: true,
            status: true,
            animal: { select: { name: true } },
            diagnosis: true,
            services: {
              select: {
                quantity: true,
                priceAtTime: true,
                service: { select: { name: true } },
              },
              orderBy: { id: "asc" },
            },
            administrations: {
              select: {
                quantity: true,
                medication: { select: { name: true, unit: true } },
              },
              orderBy: { administeredAt: "asc" },
            },
            invoice: { select: { id: true } },
          },
        })
      : Promise.resolve(null),
    prisma.service.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, price: true },
    }),
  ]);
  if (params.examinationId) {
    if (!examination || examination.status !== "COMPLETED") notFound();
    if (examination.invoice) redirect(`/invoices/${examination.invoice.id}`);
  }

  return (
    <main className="mx-auto w-full max-w-[1440px] px-4 pb-8 pt-5 sm:px-[34px] sm:pb-[42px] sm:pt-[31px]">
      <div className="mb-5 sm:mb-[25px]">
        <p className="mb-[7px] text-[11px] font-[750] uppercase tracking-[0.7px] text-green">Finansije ambulante</p>
        <h1 className="m-0 text-[clamp(24px,3vw,30px)] tracking-[-0.9px]">Izdaj račun</h1>
        <p className="mt-2 text-sm text-muted">Provjerite stavke i iznos prije izdavanja. Izdati račun se čuva kao finansijski zapis.</p>
      </div>
      {clients.length ? (
        <InvoiceForm
          clients={clients}
          services={services.map((service) => ({ ...service, price: service.price.toString() }))}
          selectedClientId={params.clientId}
          examination={examination ? {
            id: examination.id,
            clientId: examination.clientId,
            animalName: examination.animal.name,
            diagnosis: examination.diagnosis,
            services: examination.services.map((entry) => ({
              description: entry.service.name,
              quantity: entry.quantity.toString(),
              unitPrice: entry.priceAtTime.toString(),
            })),
            administeredMedications: examination.administrations.map((entry) => ({
              name: entry.medication.name,
              quantity: entry.quantity.toString(),
              unit: entry.medication.unit,
            })),
          } : undefined}
          defaultTaxRate={settings?.defaultTaxRate.toString() ?? "0"}
        />
      ) : (
        <section className="max-w-[760px] rounded-xl border border-line bg-white p-5 text-sm text-muted">
          <h2 className="m-0 text-base font-semibold text-ink">Nema aktivnih klijenata</h2>
          <p className="mb-0 mt-2">Račun se izdaje klijentu. Prvo dodajte klijenta u registar.</p>
          <Link className="mt-4 inline-flex min-h-10 items-center rounded-lg bg-green px-4 font-semibold text-white" href="/clients/new">
            Dodaj klijenta
          </Link>
        </section>
      )}
    </main>
  );
}
