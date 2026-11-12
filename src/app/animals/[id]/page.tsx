import type { Metadata } from "next";
import Link from "next/link";
import { AnimalStatus, InvoiceStatus, Prisma } from "@prisma/client";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ArchiveAnimalButton } from "@/components/animals/archive-animal-button";
import { hasPermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Profil životinje" };

const animalStatusLabels: Record<AnimalStatus, string> = {
  ACTIVE: "Aktivna",
  INACTIVE: "Neaktivna",
  DECEASED: "Uginula",
};

const appointmentStatusLabels: Record<string, string> = {
  SCHEDULED: "Zakazan",
  CONFIRMED: "Potvrđen",
  IN_PROGRESS: "U toku",
  COMPLETED: "Završen",
  CANCELLED: "Otkazan",
  NO_SHOW: "Nije došao",
};

const invoiceStatusLabels: Record<InvoiceStatus, string> = {
  DRAFT: "Nacrt",
  ISSUED: "Izdato",
  PARTIALLY_PAID: "Djelimično plaćeno",
  PAID: "Plaćeno",
  VOID: "Stornirano",
};

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("bs-BA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Sarajevo",
  }).format(value);
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("bs-BA", {
    dateStyle: "short",
    timeStyle: "short",
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
  status: InvoiceStatus;
  total: Prisma.Decimal;
  payments: { amount: Prisma.Decimal; reversals: { amount: Prisma.Decimal }[] }[];
}) {
  if (invoice.status !== "ISSUED" && invoice.status !== "PARTIALLY_PAID") {
    return new Prisma.Decimal(0);
  }
  const paid = invoice.payments.reduce(
    (total, payment) =>
      total.plus(
        payment.amount.minus(
          payment.reversals.reduce(
            (reversed, reversal) => reversed.plus(reversal.amount),
            new Prisma.Decimal(0),
          ),
        ),
      ),
    new Prisma.Decimal(0),
  );
  const due = invoice.total.minus(paid);
  return due.greaterThan(0) ? due : new Prisma.Decimal(0);
}

function ownerName(owner: {
  companyName: string | null;
  firstName: string;
  lastName: string;
}) {
  return owner.companyName || `${owner.firstName} ${owner.lastName}`;
}

export default async function AnimalDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission("animals:read");
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();

  const canWrite = hasPermission(user.role, "animals:write");
  const canWriteExaminations = hasPermission(user.role, "examinations:write");
  const canViewMedical = hasPermission(user.role, "examinations:read");
  const canViewFinancial =
    hasPermission(user.role, "invoices:read") ||
    hasPermission(user.role, "reports:financial");

  const animal = await prisma.animal.findUnique({
    where: { id },
    include: {
      owner: true,
      ownerHistory: {
        include: { owner: true },
        orderBy: { validFrom: "desc" },
      },
      appointments: {
        include: {
          veterinarian: { select: { firstName: true, lastName: true } },
          client: { select: { firstName: true, lastName: true, companyName: true } },
        },
        orderBy: { startsAt: "desc" },
        take: 20,
      },
    },
  });
  if (!animal) notFound();

  const [examinations, invoices] = await Promise.all([
    canViewMedical
      ? prisma.examination.findMany({
          where: { animalId: animal.id },
          include: {
            veterinarian: { select: { firstName: true, lastName: true } },
            therapies: true,
            administrations: { include: { medication: { select: { name: true } } } },
          },
          orderBy: { examinationDate: "desc" },
          take: 20,
        })
      : Promise.resolve([]),
    canViewFinancial
      ? prisma.invoice.findMany({
          where: { examination: { animalId: animal.id } },
          include: { payments: { include: { reversals: true } } },
          orderBy: { createdAt: "desc" },
          take: 20,
        })
      : Promise.resolve([]),
  ]);

  return (
    <main className="mx-auto w-full max-w-[1440px] px-[34px] pb-[42px] pt-[31px] max-[820px]:px-[21px] max-[640px]:px-[14px] max-[640px]:pb-[30px] max-[640px]:pt-[22px]">
      <div className="mb-[25px] flex items-end justify-between gap-5 max-[640px]:items-start max-[640px]:flex-col">
        <div>
          <p className="mb-[7px] text-[11px] font-[750] uppercase tracking-[0.7px] text-green">Registar životinja</p>
          <h1 className="m-0 text-[clamp(24px,3vw,30px)] tracking-[-0.9px]">{animal.name}</h1>
          <p className="mt-2 text-muted">
            {animal.species}{animal.breed ? ` · ${animal.breed}` : ""} · {animalStatusLabels[animal.status]}
          </p>
        </div>
        <div className="flex items-center gap-[9px] max-[640px]:w-full max-[640px]:flex-col max-[640px]:items-stretch">
          {canWriteExaminations && animal.status === "ACTIVE" && animal.owner.isActive ? (
            <Link
              className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-[7px] bg-green px-[13px] text-sm font-bold text-white hover:bg-green-dark"
              href={`/examinations/new?clientId=${encodeURIComponent(animal.ownerId)}&animalId=${encodeURIComponent(animal.id)}`}
            >
              Novi pregled
            </Link>
          ) : null}
          {canWrite ? (
            <Link className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-[7px] border border-line bg-white px-[13px] text-sm font-bold text-[#53645a] hover:bg-[#f7faf8]" href={`/animals/${animal.id}/edit`}>Uredi podatke</Link>
          ) : null}
          <Link className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-[7px] border border-line bg-white px-[13px] text-sm font-bold text-[#53645a] hover:bg-[#f7faf8]" href="/animals">Nazad na listu</Link>
          {canWrite && animal.status === "ACTIVE" ? (
            <ArchiveAnimalButton animalId={animal.id} />
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
        <section className="min-w-0 rounded-[11px] border border-line bg-white p-[18px_19px] shadow-[0_2px_6px_rgb(34_62_47_/_2%)]">
          <div className="mb-4 flex items-center justify-between gap-3"><h2 className="m-0 text-sm font-[720]">Podaci o životinji</h2></div>
          <dl className="m-0">
            <Detail label="Vrsta" value={animal.species} />
            <Detail label="Pasmina" value={animal.breed} />
            <Detail label="Spol" value={animal.sex} />
            <Detail label="Datum rođenja" value={animal.dateOfBirth ? formatDate(animal.dateOfBirth) : null} />
            <Detail label="Boja" value={animal.color} />
            <Detail label="Težina" value={animal.weightKg ? `${animal.weightKg.toString()} kg` : null} />
            <Detail label="Mikročip" value={animal.microchipNumber} />
            <Detail label="Pasoš" value={animal.passportNumber} />
            <Detail label="Identifikacijski broj" value={animal.identificationNumber} />
            <Detail label="Evidentirana" value={formatDate(animal.createdAt)} />
          </dl>
          {canViewMedical ? (
            <>
              {animal.allergies ? <div className="mt-[14px] whitespace-pre-wrap rounded-[7px] bg-[#f7faf8] p-3 text-xs leading-[1.6] text-[#5f6e65]"><strong>Alergije:</strong> {animal.allergies}</div> : null}
              {animal.chronicConditions ? (
                <div className="mt-[14px] whitespace-pre-wrap rounded-[7px] bg-[#f7faf8] p-3 text-xs leading-[1.6] text-[#5f6e65]"><strong>Hronična oboljenja:</strong> {animal.chronicConditions}</div>
              ) : null}
              {animal.notes ? <div className="mt-[14px] whitespace-pre-wrap rounded-[7px] bg-[#f7faf8] p-3 text-xs leading-[1.6] text-[#5f6e65]"><strong>Medicinska napomena:</strong> {animal.notes}</div> : null}
            </>
          ) : null}
        </section>

        <section className="min-w-0 rounded-[11px] border border-line bg-white p-[18px_19px] shadow-[0_2px_6px_rgb(34_62_47_/_2%)]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="m-0 text-sm font-[720]">Vlasnik</h2>
              <div className="mt-1 text-[11px] text-muted">Trenutno evidentirani vlasnik</div>
            </div>
          </div>
          <div className="flex flex-col">
            <div className="flex items-start justify-between gap-2.5 border-b border-[#eef1ef] py-3 last:border-0">
              <div>
                <Link className="text-xs font-[650] hover:text-green hover:underline" href={`/clients/${animal.owner.id}`}>
                  {ownerName(animal.owner)}
                </Link>
                <div className="mt-1 text-[11px] text-muted">{animal.owner.phone}</div>
              </div>
              <span className={`inline-flex items-center rounded-full px-2 py-1 text-[10px] font-bold ${animal.owner.isActive ? "bg-[#e8f4ec] text-[#2f7657]" : "bg-[#eef1ef] text-[#67736b]"}`}>
                {animal.owner.isActive ? "Aktivan klijent" : "Arhiviran klijent"}
              </span>
            </div>
          </div>
        </section>

        <section className="col-span-full min-w-0 rounded-[11px] border border-line bg-white p-[18px_19px] shadow-[0_2px_6px_rgb(34_62_47_/_2%)] max-[640px]:col-auto">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="m-0 text-sm font-[720]">Historija vlasništva</h2>
              <div className="mt-1 text-[11px] text-muted">Evidencija promjena vlasnika</div>
            </div>
          </div>
          {animal.ownerHistory.length ? (
            <div className="flex flex-col">
              {animal.ownerHistory.map((entry) => (
                <div className="flex items-start justify-between gap-2.5 border-b border-[#eef1ef] py-3 last:border-0" key={entry.id}>
                  <div>
                    <Link className="text-xs font-[650] hover:text-green hover:underline" href={`/clients/${entry.owner.id}`}>
                      {ownerName(entry.owner)}
                    </Link>
                    {entry.notes ? <div className="mt-1 text-[11px] text-muted">{entry.notes}</div> : null}
                  </div>
                  <div className="mt-1 text-[11px] text-muted">
                    {formatDate(entry.validFrom)}
                    {entry.validUntil ? ` – ${formatDate(entry.validUntil)}` : " – Trenutno"}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-2.5 py-[23px] text-center text-xs text-muted">Historija vlasništva nije evidentirana.</div>
          )}
        </section>

        <section className="min-w-0 rounded-[11px] border border-line bg-white p-[18px_19px] shadow-[0_2px_6px_rgb(34_62_47_/_2%)]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="m-0 text-sm font-[720]">Termini</h2>
              <div className="mt-1 text-[11px] text-muted">Posljednjih 20 termina</div>
            </div>
          </div>
          {animal.appointments.length ? (
            <div className="flex flex-col">
              {animal.appointments.map((appointment) => (
                <div className="flex items-start justify-between gap-2.5 border-b border-[#eef1ef] py-3 last:border-0" key={appointment.id}>
                  <div>
                    <div className="text-xs font-[650]">{appointment.reason}</div>
                    <div className="mt-1 text-[11px] text-muted">
                      {formatDateTime(appointment.startsAt)} · {ownerName(appointment.client)}
                      {" · Dr. "}{appointment.veterinarian.firstName} {appointment.veterinarian.lastName}
                    </div>
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
                <div className="mt-1 text-[11px] text-muted">Posljednjih 20 pregleda</div>
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
                        {examination.diagnosis || "Veterinarski pregled"}
                      </Link>
                      <div className="mt-1 text-[11px] text-muted">
                        {formatDateTime(examination.examinationDate)} · Dr. {examination.veterinarian.firstName} {examination.veterinarian.lastName}
                      </div>
                      {examination.chiefComplaint ? (
                        <div className="mt-1 text-[11px] text-muted">Razlog: {examination.chiefComplaint}</div>
                      ) : null}
                      {examination.therapies.map((therapy) => (
                        <div className="mt-1 text-[11px] text-muted" key={therapy.id}>
                          Terapija: {therapy.name}{therapy.dosage ? ` · ${therapy.dosage}` : ""}
                        </div>
                      ))}
                      {examination.administrations.map((administration) => (
                        <div className="mt-1 text-[11px] text-muted" key={administration.id}>
                          Lijek: {administration.medication.name}
                        </div>
                      ))}
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
                <h2 className="m-0 text-sm font-[720]">Računi</h2>
                <div className="mt-1 text-[11px] text-muted">Računi povezani s pregledima životinje</div>
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
                        <td className="whitespace-nowrap border-b border-[#eef1ef] px-[9px] py-3 text-xs font-[650] last:border-0">{invoice.invoiceNumber}</td>
                        <td className="whitespace-nowrap border-b border-[#eef1ef] px-[9px] py-3 text-xs last:border-0">{invoice.issuedAt ? formatDate(invoice.issuedAt) : "Nije izdan"}</td>
                        <td className="whitespace-nowrap border-b border-[#eef1ef] px-[9px] py-3 text-xs last:border-0">{invoiceStatusLabels[invoice.status]}</td>
                        <td className="whitespace-nowrap border-b border-[#eef1ef] px-[9px] py-3 text-xs last:border-0">{formatCurrency(invoice.total)}</td>
                        <td className="whitespace-nowrap border-b border-[#eef1ef] px-[9px] py-3 text-xs last:border-0">{formatCurrency(amountDue(invoice))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-2.5 py-[23px] text-center text-xs text-muted">Nema računa povezanih s pregledima ove životinje.</div>
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
