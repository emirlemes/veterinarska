import Link from "next/link";
import { notFound } from "next/navigation";
import { ExaminationStatus } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { TherapyPanel } from "@/components/examinations/therapy-panel";
import { ExaminationServicePanel } from "@/components/examinations/service-panel";
import { MedicationAdministrationPanel } from "@/components/examinations/medication-administration-panel";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/require-permission";
import { hasPermission } from "@/lib/auth/permissions";
import { getClinicDate } from "@/lib/dates";
import { prisma } from "@/lib/db";

export const metadata = { title: "Pregled" };

const statusLabels: Record<ExaminationStatus, string> = {
  IN_PROGRESS: "U toku",
  COMPLETED: "Završen",
};

function MedicalSection({ title, value }: { title: string; value: string | null }) {
  if (!value) return null;
  return (
    <section className="border-t border-line py-4 first:border-0 first:pt-0">
      <h2 className="mb-2 text-sm font-bold">{title}</h2>
      <p className="m-0 whitespace-pre-wrap text-sm leading-6 text-[#53645a]">{value}</p>
    </section>
  );
}

export default async function ExaminationDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission("examinations:read");
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const clinicDate = getClinicDate();
  const today = new Date(`${clinicDate}T00:00:00.000Z`);
  const [examination, availableBatches, availableServices] = await Promise.all([
    prisma.examination.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, firstName: true, lastName: true, companyName: true } },
      animal: { select: { id: true, name: true, species: true } },
      veterinarian: { select: { firstName: true, lastName: true } },
      appointment: { select: { id: true, startsAt: true } },
      invoice: { select: { id: true } },
      therapies: {
        select: {
          id: true,
          name: true,
          dosage: true,
          frequency: true,
          duration: true,
          instructions: true,
        },
        orderBy: { createdAt: "asc" },
      },
      services: {
        select: {
          id: true,
          serviceId: true,
          priceAtTime: true,
          quantity: true,
          service: { select: { name: true } },
        },
        orderBy: { id: "asc" },
      },
      administrations: {
        include: {
          medication: { select: { name: true, unit: true } },
          batch: { select: { batchNumber: true } },
        },
        orderBy: { administeredAt: "desc" },
      },
    },
    }),
    hasPermission(user.role, "therapies:write")
      ? prisma.medicationBatch.findMany({
          where: {
            quantityRemaining: { gt: new Prisma.Decimal(0) },
            medication: { isActive: true },
            OR: [{ expiresAt: null }, { expiresAt: { gte: today } }],
          },
          include: {
            medication: { select: { name: true, unit: true } },
          },
          orderBy: [{ medication: { name: "asc" } }, { expiresAt: "asc" }],
        })
      : Promise.resolve([]),
    hasPermission(user.role, "examinations:write") && hasPermission(user.role, "services:read")
        ? prisma.service.findMany({
            where: { isActive: true },
            orderBy: { name: "asc" },
            select: { id: true, name: true, price: true },
          })
        : Promise.resolve([]),
  ]);
  if (!examination) notFound();

  const clientName =
    examination.client.companyName ||
    `${examination.client.firstName} ${examination.client.lastName}`;
  const canWrite = hasPermission(user.role, "examinations:write");
  const canWriteTherapies = hasPermission(user.role, "therapies:write");
  const canWriteInvoices = hasPermission(user.role, "invoices:write");
  const canReadInvoices =
    hasPermission(user.role, "invoices:read") ||
    hasPermission(user.role, "reports:financial");

  return (
    <main className="mx-auto w-full max-w-[1440px] px-4 pb-8 pt-5 sm:px-[34px] sm:pb-[42px] sm:pt-[31px]">
      <div className="mb-5 flex flex-col gap-4 sm:mb-[25px] sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="mb-[7px] text-[11px] font-[750] uppercase tracking-[0.7px] text-green">Medicinska evidencija</p>
          <h1 className="m-0 text-[clamp(24px,3vw,30px)] tracking-[-0.9px]">
            Pregled: {examination.animal.name}
          </h1>
          <p className="mt-2 text-sm text-muted">{examination.animal.species} · {clientName}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          {canWrite && examination.status === "IN_PROGRESS" ? (
            <Link
              className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-green px-4 text-sm font-bold text-white hover:bg-green-dark sm:w-auto"
              href={`/examinations/${examination.id}/edit`}
            >
              Uredi pregled
            </Link>
          ) : null}
          {canWriteInvoices && examination.status === "COMPLETED" && !examination.invoice ? (
            <Link
              className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-green px-4 text-sm font-bold text-white hover:bg-green-dark sm:w-auto"
              href={`/invoices/new?examinationId=${encodeURIComponent(examination.id)}`}
            >
              Izdaj račun
            </Link>
          ) : null}
          {!canWrite && !canWriteInvoices ? (
          <Link
            className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-line bg-white px-4 text-sm font-semibold text-[#53645a] hover:bg-[#f7faf8] sm:w-auto"
            href="/examinations"
          >
            Nazad na preglede
          </Link>
          ) : null}
        </div>
        {canReadInvoices && examination.invoice ? (
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-line bg-white px-4 text-sm font-semibold text-green-dark hover:bg-[#f7faf8]"
            href={`/invoices/${examination.invoice.id}`}
          >
            Otvori račun
          </Link>
        ) : null}
      </div>

      <article className="w-full max-w-[900px] rounded-xl border border-line bg-white p-4 shadow-[0_2px_6px_rgb(34_62_47_/_2%)] sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
          <div>
            <div className="text-sm font-bold">
              {new Intl.DateTimeFormat("bs-BA", {
                dateStyle: "long",
                timeStyle: "short",
                timeZone: "Europe/Sarajevo",
              }).format(examination.examinationDate)}
            </div>
            <div className="mt-1 text-sm text-muted">
              Dr. {examination.veterinarian.firstName} {examination.veterinarian.lastName}
              {examination.appointment ? (
                <>
                  {" · "}
                  <Link
                    className="text-green-dark underline-offset-2 hover:underline"
                    href={`/appointments?date=${encodeURIComponent(getClinicDate(examination.appointment.startsAt))}`}
                  >
                    Termin {new Intl.DateTimeFormat("bs-BA", {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: "Europe/Sarajevo",
                    }).format(examination.appointment.startsAt)}
                  </Link>
                </>
              ) : " · Dolazak bez termina"}
            </div>
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
              examination.status === "COMPLETED"
                ? "bg-[#edf4ef] text-[#587362]"
                : "bg-[#fff4df] text-[#93631b]"
            }`}
          >
            {statusLabels[examination.status]}
          </span>
        </div>
        <MedicalSection title="Glavni razlog dolaska" value={examination.chiefComplaint} />
        <MedicalSection title="Simptomi" value={examination.symptoms} />
        <MedicalSection title="Dijagnoza" value={examination.diagnosis} />
        <MedicalSection title="Plan terapije" value={examination.treatmentPlan} />
        <MedicalSection title="Dodatna napomena" value={examination.notes} />
      </article>
      <TherapyPanel
        examinationId={examination.id}
        initialTherapies={examination.therapies}
        editable={canWriteTherapies && examination.status === "IN_PROGRESS"}
      />
      <ExaminationServicePanel
        examinationId={examination.id}
        initialServices={examination.services.map((entry) => ({
          id: entry.id,
          serviceId: entry.serviceId,
          name: entry.service.name,
          quantity: entry.quantity.toString(),
          priceAtTime: entry.priceAtTime.toString(),
        }))}
        availableServices={availableServices.map((service) => ({
          id: service.id,
          name: service.name,
          price: service.price.toString(),
        }))}
        editable={canWrite && examination.status === "IN_PROGRESS"}
      />
      <MedicationAdministrationPanel
        examinationId={examination.id}
        initialAdministrations={examination.administrations.map((administration) => ({
          id: administration.id,
          medicationName: administration.medication.name,
          unit: administration.medication.unit,
          batchNumber: administration.batch.batchNumber,
          quantity: administration.quantity.toString(),
          notes: administration.notes,
          administeredAt: administration.administeredAt.toISOString(),
        }))}
        availableBatches={availableBatches.map((batch) => ({
          id: batch.id,
          medicationName: batch.medication.name,
          unit: batch.medication.unit,
          batchNumber: batch.batchNumber,
          quantityRemaining: batch.quantityRemaining.toString(),
          expiresAt: batch.expiresAt?.toISOString().slice(0, 10) ?? null,
        }))}
        editable={canWriteTherapies && examination.status === "IN_PROGRESS"}
      />
    </main>
  );
}
