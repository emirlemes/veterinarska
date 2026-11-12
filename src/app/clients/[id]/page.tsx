import type { Metadata } from "next";
import Link from "next/link";
import { InvoiceStatus, Prisma } from "@prisma/client";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ArchiveClientButton } from "@/components/clients/archive-client-button";
import { hasPermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/db";

export const metadata: Metadata = {
  title: "Profil klijenta",
};

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("bs-BA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Sarajevo",
  }).format(value);
}

function formatCurrency(value: Prisma.Decimal) {
  return new Intl.NumberFormat("bs-BA", {
    style: "currency",
    currency: "BAM",
  }).format(Number(value));
}

function amountDue(invoice: {
  total: Prisma.Decimal;
  payments: { amount: Prisma.Decimal; reversals: { amount: Prisma.Decimal }[] }[];
}) {
  const paid = invoice.payments.reduce(
    (total, payment) => {
      const reversed = payment.reversals.reduce(
        (sum, reversal) => sum.plus(reversal.amount),
        new Prisma.Decimal(0),
      );
      return total.plus(payment.amount.minus(reversed));
    },
    new Prisma.Decimal(0),
  );
  return invoice.total.minus(paid);
}

function displayAmountDue(invoice: {
  status: InvoiceStatus;
  total: Prisma.Decimal;
  payments: { amount: Prisma.Decimal; reversals: { amount: Prisma.Decimal }[] }[];
}) {
  if (
    invoice.status !== InvoiceStatus.ISSUED &&
    invoice.status !== InvoiceStatus.PARTIALLY_PAID
  ) {
    return new Prisma.Decimal(0);
  }
  const amount = amountDue(invoice);
  return amount.greaterThan(0) ? amount : new Prisma.Decimal(0);
}

const appointmentStatusLabels: Record<string, string> = {
  SCHEDULED: "Zakazan",
  CONFIRMED: "Potvrđen",
  IN_PROGRESS: "U toku",
  COMPLETED: "Završen",
  CANCELLED: "Otkazan",
  NO_SHOW: "Nije došao",
};

const invoiceStatusLabels: Record<string, string> = {
  DRAFT: "Nacrt",
  ISSUED: "Izdato",
  PARTIALLY_PAID: "Djelimično plaćeno",
  PAID: "Plaćeno",
  VOID: "Stornirano",
};

export default async function ClientDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission("clients:read");
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const canViewMedical = hasPermission(user.role, "examinations:read");
  const canViewFinancial =
    hasPermission(user.role, "invoices:read") ||
    hasPermission(user.role, "reports:financial");

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      animals: { orderBy: { name: "asc" } },
      appointments: {
        include: { animal: { select: { name: true } } },
        orderBy: { startsAt: "desc" },
        take: 5,
      },
    },
  });
  if (!client) notFound();

  const [examinations, invoices] = await Promise.all([
    canViewMedical
      ? prisma.examination.findMany({
          where: { clientId: client.id },
          include: { animal: { select: { name: true } } },
          orderBy: { examinationDate: "desc" },
          take: 5,
        })
      : Promise.resolve([]),
    canViewFinancial
      ? prisma.invoice.findMany({
          where: { clientId: client.id },
          include: { payments: { include: { reversals: true } } },
          orderBy: { createdAt: "desc" },
          take: 10,
        })
      : Promise.resolve([]),
  ]);

  const canWrite = hasPermission(user.role, "clients:write");
  const canWriteExaminations = hasPermission(user.role, "examinations:write");
  const canWriteInvoices = hasPermission(user.role, "invoices:write");
  const outstandingInvoices = invoices.filter(
    (invoice) =>
      (invoice.status === InvoiceStatus.ISSUED ||
        invoice.status === InvoiceStatus.PARTIALLY_PAID) &&
      displayAmountDue(invoice).greaterThan(0),
  );

  return (
    <main className="mx-auto w-full max-w-[1440px] px-[34px] pb-[42px] pt-[31px] max-[820px]:px-[21px] max-[640px]:px-[14px] max-[640px]:pb-[30px] max-[640px]:pt-[22px]">
      <div className="mb-[25px] flex items-end justify-between gap-5 max-[640px]:items-start max-[640px]:flex-col">
        <div>
          <p className="mb-[7px] text-[11px] font-[750] uppercase tracking-[0.7px] text-green">Registar klijenata</p>
          <h1 className="m-0 text-[clamp(24px,3vw,30px)] tracking-[-0.9px]">{client.companyName || `${client.firstName} ${client.lastName}`}</h1>
          <p className="mt-2 text-muted">
            {client.companyName ? `${client.firstName} ${client.lastName} · ` : ""}
            {client.isActive ? "Aktivan klijent" : "Arhiviran klijent"}
          </p>
        </div>
        <div className="flex items-center gap-[9px] max-[640px]:w-full max-[640px]:flex-col max-[640px]:items-stretch">
          {canWriteInvoices && client.isActive ? (
            <Link
              className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-[7px] bg-green px-[13px] text-sm font-bold text-white hover:bg-green-dark"
              href={`/invoices/new?clientId=${encodeURIComponent(client.id)}`}
            >
              Izdaj račun
            </Link>
          ) : null}
          {canWriteExaminations && client.isActive ? (
            <Link
              className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-[7px] bg-green px-[13px] text-sm font-bold text-white hover:bg-green-dark"
              href={`/examinations/new?clientId=${encodeURIComponent(client.id)}`}
            >
              Novi pregled
            </Link>
          ) : null}
          {canWrite && client.isActive ? (
            <Link className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-[7px] border border-line bg-white px-[13px] text-sm font-bold text-[#53645a] hover:bg-[#f7faf8]" href={`/clients/${client.id}/edit`}>Uredi podatke</Link>
          ) : null}
          <Link className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-[7px] border border-line bg-white px-[13px] text-sm font-bold text-[#53645a] hover:bg-[#f7faf8]" href="/clients">Nazad na listu</Link>
          {canWrite && client.isActive ? <ArchiveClientButton clientId={client.id} /> : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
        <section className="min-w-0 rounded-[11px] border border-line bg-white p-[18px_19px] shadow-[0_2px_6px_rgb(34_62_47_/_2%)]">
          <div className="mb-4 flex items-center justify-between gap-3"><h2 className="m-0 text-sm font-[720]">Podaci o klijentu</h2></div>
          <dl className="m-0">
            <Detail label="Telefon" value={client.phone} />
            <Detail label="E-mail" value={client.email} />
            <Detail label="Adresa" value={client.address} />
            <Detail label="Grad" value={[client.postalCode, client.city].filter(Boolean).join(" ") || null} />
            <Detail label="Registrovan" value={formatDate(client.createdAt)} />
          </dl>
          {client.notes ? <p className="mt-[14px] whitespace-pre-wrap rounded-[7px] bg-[#f7faf8] p-3 text-xs leading-[1.6] text-[#5f6e65]">{client.notes}</p> : null}
        </section>

        <section className="min-w-0 rounded-[11px] border border-line bg-white p-[18px_19px] shadow-[0_2px_6px_rgb(34_62_47_/_2%)]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="m-0 text-sm font-[720]">Životinje</h2>
              <div className="mt-1 text-[11px] text-muted">{client.animals.length} evidentiranih životinja</div>
            </div>
          </div>
          {client.animals.length ? (
            <div className="flex flex-col">
              {client.animals.map((animal) => (
                <div className="flex items-start justify-between gap-2.5 border-b border-[#eef1ef] py-3 last:border-0" key={animal.id}>
                  <div>
                    <Link className="text-xs font-[650] hover:text-green hover:underline" href={`/animals/${animal.id}`}>
                      {animal.name}
                    </Link>
                    <div className="mt-1 text-[11px] text-muted">
                      {animal.species}{animal.breed ? ` · ${animal.breed}` : ""}
                    </div>
                  </div>
                  <span className={`inline-flex items-center rounded-full px-2 py-1 text-[10px] font-bold ${animal.status === "ACTIVE" ? "bg-[#e8f4ec] text-[#2f7657]" : "bg-[#eef1ef] text-[#67736b]"}`}>
                    {animal.status === "ACTIVE" ? "Aktivna" : animal.status === "DECEASED" ? "Uginula" : "Neaktivna"}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-2.5 py-[23px] text-center text-xs text-muted">Za ovog klijenta još nema registrovanih životinja.</div>
          )}
        </section>

        <section className="min-w-0 rounded-[11px] border border-line bg-white p-[18px_19px] shadow-[0_2px_6px_rgb(34_62_47_/_2%)]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="m-0 text-sm font-[720]">Termini</h2>
              <div className="mt-1 text-[11px] text-muted">Posljednjih pet termina</div>
            </div>
          </div>
          {client.appointments.length ? (
            <div className="flex flex-col">
              {client.appointments.map((appointment) => (
                <div className="flex items-start justify-between gap-2.5 border-b border-[#eef1ef] py-3 last:border-0" key={appointment.id}>
                  <div>
                    <div className="text-xs font-[650]">{appointment.animal.name} · {appointment.reason}</div>
                    <div className="mt-1 text-[11px] text-muted">{formatDate(appointment.startsAt)}</div>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-[#eef1ef] px-2 py-1 text-[10px] font-bold text-[#67736b]">{appointmentStatusLabels[appointment.status]}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-2.5 py-[23px] text-center text-xs text-muted">Nema evidentiranih termina.</div>
          )}
        </section>

        {canViewMedical ? (
          <section className="min-w-0 rounded-[11px] border border-line bg-white p-[18px_19px] shadow-[0_2px_6px_rgb(34_62_47_/_2%)]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="m-0 text-sm font-[720]">Medicinska historija</h2>
                <div className="mt-1 text-[11px] text-muted">Posljednjih pet pregleda</div>
              </div>
            </div>
            {examinations.length ? (
              <div className="flex flex-col">
                {examinations.map((examination) => (
                  <div className="flex items-start justify-between gap-2.5 border-b border-[#eef1ef] py-3 last:border-0" key={examination.id}>
                    <div>
                      <Link
                        className="text-xs font-[650] hover:text-green hover:underline"
                        href={`/examinations/${examination.id}`}
                      >
                        {examination.animal.name} · {examination.diagnosis || "Pregled"}
                      </Link>
                      <div className="mt-1 text-[11px] text-muted">{formatDate(examination.examinationDate)}</div>
                    </div>
                    <span className={`inline-flex items-center rounded-full px-2 py-1 text-[10px] font-bold ${examination.status === "COMPLETED" ? "bg-[#e8f4ec] text-[#2f7657]" : "bg-[#fff4df] text-[#94641e]"}`}>
                      {examination.status === "COMPLETED" ? "Završen" : "U toku"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-2.5 py-[23px] text-center text-xs text-muted">Nema evidentiranih pregleda.</div>
            )}
          </section>
        ) : null}

        {canViewFinancial ? (
          <section className="col-span-full min-w-0 rounded-[11px] border border-line bg-white p-[18px_19px] shadow-[0_2px_6px_rgb(34_62_47_/_2%)] max-[640px]:col-auto">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="m-0 text-sm font-[720]">Računi i naplata</h2>
              <div className="mt-1 text-[11px] text-muted">
                {outstandingInvoices.length} računa sa preostalim dugovanjem
              </div>
            </div>
          </div>
          {invoices.length ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr>
                    <th className="whitespace-nowrap border-b border-line px-[9px] py-2.5 text-[10px] font-bold uppercase tracking-[0.55px] text-[#8a968e]">Broj računa</th>
                    <th className="whitespace-nowrap border-b border-line px-[9px] py-2.5 text-[10px] font-bold uppercase tracking-[0.55px] text-[#8a968e]">Datum</th>
                    <th className="whitespace-nowrap border-b border-line px-[9px] py-2.5 text-[10px] font-bold uppercase tracking-[0.55px] text-[#8a968e]">Status</th>
                    <th className="whitespace-nowrap border-b border-line px-[9px] py-2.5 text-[10px] font-bold uppercase tracking-[0.55px] text-[#8a968e]">Ukupno</th>
                    <th className="whitespace-nowrap border-b border-line px-[9px] py-2.5 text-[10px] font-bold uppercase tracking-[0.55px] text-[#8a968e]">Preostalo</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr key={invoice.id}>
                      <td className="whitespace-nowrap border-b border-[#eef1ef] px-[9px] py-3 text-xs font-[650] last:border-0">
                        <Link className="text-green-dark hover:underline" href={`/invoices/${invoice.id}`}>
                          {invoice.invoiceNumber}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap border-b border-[#eef1ef] px-[9px] py-3 text-xs last:border-0">{invoice.issuedAt ? formatDate(invoice.issuedAt) : "Nije izdan"}</td>
                      <td className="whitespace-nowrap border-b border-[#eef1ef] px-[9px] py-3 text-xs last:border-0">{invoiceStatusLabels[invoice.status]}</td>
                      <td className="whitespace-nowrap border-b border-[#eef1ef] px-[9px] py-3 text-xs last:border-0">{formatCurrency(invoice.total)}</td>
                      <td className="whitespace-nowrap border-b border-[#eef1ef] px-[9px] py-3 text-xs last:border-0">{formatCurrency(displayAmountDue(invoice))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-2.5 py-[23px] text-center text-xs text-muted">Nema izdanih računa.</div>
          )}
          </section>
        ) : null}
      </div>
    </main>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-3 border-b border-[#eef1ef] py-[9px] last:border-0">
      <dt className="text-[11px] text-muted">{label}</dt>
      <dd className="m-0 wrap-anywhere text-xs font-semibold">{value || "—"}</dd>
    </div>
  );
}
