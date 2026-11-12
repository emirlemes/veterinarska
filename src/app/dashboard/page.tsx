import type { Metadata } from "next";
import { InvoiceStatus, Prisma } from "@prisma/client";
import { hasPermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/db";
import { getClinicDate, getClinicDayBounds } from "@/lib/dates";

export const metadata: Metadata = {
  title: "Kontrolna tabla",
};

const appointmentStatusLabels: Record<string, string> = {
  SCHEDULED: "Zakazan",
  CONFIRMED: "Potvrđen",
  IN_PROGRESS: "U toku",
  COMPLETED: "Završen",
  CANCELLED: "Otkazan",
  NO_SHOW: "Nije došao",
};

function formatCurrency(value: Prisma.Decimal | number) {
  return new Intl.NumberFormat("bs-BA", {
    style: "currency",
    currency: "BAM",
  }).format(Number(value));
}

function formatTime(value: Date) {
  return new Intl.DateTimeFormat("bs-BA", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Sarajevo",
  }).format(value);
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("bs-BA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Sarajevo",
  }).format(value);
}

function getOutstandingAmount(invoice: {
  total: Prisma.Decimal;
  payments: { amount: Prisma.Decimal; reversals: { amount: Prisma.Decimal }[] }[];
}) {
  const paid = invoice.payments.reduce(
    (paymentTotal, payment) => {
      const reversed = payment.reversals.reduce(
        (reversedTotal, reversal) => reversedTotal.plus(reversal.amount),
        new Prisma.Decimal(0),
      );
      return paymentTotal.plus(payment.amount.minus(reversed));
    },
    new Prisma.Decimal(0),
  );
  const due = invoice.total.minus(paid);
  return due.greaterThan(0) ? due : new Prisma.Decimal(0);
}

export default async function DashboardPage() {
  const user = await requirePermission("dashboard:read");
  const canViewFinancial =
    hasPermission(user.role, "invoices:read") ||
    hasPermission(user.role, "reports:financial");
  const canViewInventory =
    hasPermission(user.role, "medications:read") ||
    hasPermission(user.role, "inventory:write");
  const canViewExaminations = hasPermission(user.role, "examinations:read");
  const { start, end } = getClinicDayBounds();
  const clinicDate = new Date(`${getClinicDate()}T00:00:00.000Z`);

  const [
    appointments,
    todayAppointmentCount,
    completedExaminations,
    clientCount,
    animalCount,
    stock,
    recentExaminations,
  ] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        startsAt: { gte: start, lt: end },
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
      },
      include: {
        client: { select: { firstName: true, lastName: true } },
        animal: { select: { name: true, species: true } },
        veterinarian: { select: { firstName: true, lastName: true } },
      },
      orderBy: { startsAt: "asc" },
      take: 8,
    }),
    prisma.appointment.count({
      where: {
        startsAt: { gte: start, lt: end },
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
      },
    }),
    canViewExaminations
      ? prisma.examination.count({
      where: {
        status: "COMPLETED",
        examinationDate: { gte: start, lt: end },
      },
        })
      : Promise.resolve(0),
    prisma.client.count({ where: { isActive: true } }),
    prisma.animal.count({ where: { status: "ACTIVE" } }),
    canViewInventory
      ? prisma.medication.findMany({
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            unit: true,
            minimumStock: true,
            batches: {
              where: { OR: [{ expiresAt: null }, { expiresAt: { gte: clinicDate } }] },
              select: { quantityRemaining: true },
            },
          },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
    canViewExaminations
      ? prisma.examination.findMany({
          where: { status: "COMPLETED" },
          include: {
            animal: { select: { name: true, species: true } },
            client: { select: { firstName: true, lastName: true } },
            veterinarian: { select: { firstName: true, lastName: true } },
          },
          orderBy: { examinationDate: "desc" },
          take: 4,
        })
      : Promise.resolve([]),
  ]);
  const financialData = canViewFinancial
    ? await Promise.all([
        prisma.payment.aggregate({
          where: { paidAt: { gte: start, lt: end } },
          _sum: { amount: true },
        }),
        prisma.paymentReversal.aggregate({
          where: { reversedAt: { gte: start, lt: end } },
          _sum: { amount: true },
        }),
        prisma.invoice.findMany({
          where: {
            status: {
              in: [InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID],
            },
          },
          select: {
            total: true,
            payments: {
              select: {
                amount: true,
                reversals: { select: { amount: true } },
              },
            },
          },
        }),
        prisma.invoice.findMany({
          where: {
            status: {
              in: [InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.PAID],
            },
          },
          include: {
            client: { select: { firstName: true, lastName: true } },
          },
          orderBy: { issuedAt: "desc" },
          take: 4,
        }),
      ])
    : null;
  const outstandingInvoices = (financialData?.[2] ?? []).filter((invoice) =>
    getOutstandingAmount(invoice).greaterThan(0),
  );
  const recentInvoices = financialData?.[3] ?? [];
  const outstandingTotal = outstandingInvoices.reduce(
    (total, invoice) => total.plus(getOutstandingAmount(invoice)),
    new Prisma.Decimal(0),
  );
  const paymentsTotal = financialData
    ? (financialData[0]._sum.amount ?? new Prisma.Decimal(0)).minus(
        financialData[1]._sum.amount ?? new Prisma.Decimal(0),
      )
    : new Prisma.Decimal(0);

  const lowStock = stock
    .map((medication) => ({
      ...medication,
      quantity: medication.batches.reduce(
        (total, batch) => total.plus(batch.quantityRemaining),
        new Prisma.Decimal(0),
      ),
    }))
    .filter((medication) => medication.quantity.lte(medication.minimumStock))
    .slice(0, 5);

  return (
    <main className="mx-auto w-full max-w-[1440px] px-[34px] pb-[42px] pt-[31px] max-[820px]:px-[21px] max-[640px]:px-[14px] max-[640px]:pb-[30px] max-[640px]:pt-[22px]">
      <div className="mb-[25px] flex items-end justify-between gap-5 max-[640px]:items-start">
        <div>
          <p className="mb-[7px] text-[11px] font-[750] uppercase tracking-[0.7px] text-green">Pregled poslovanja</p>
          <h1 className="m-0 text-[clamp(24px,3vw,30px)] tracking-[-0.9px]">Kontrolna tabla</h1>
          <p className="mt-2 text-muted">
            Dnevni pregled rada ambulante i najvažnijih pokazatelja.
          </p>
        </div>
        <div className="whitespace-nowrap rounded-lg border border-line bg-white px-3 py-[9px] text-xs text-[#58675e] max-[640px]:hidden">{formatDate(new Date())}</div>
      </div>

      <section className="mb-[18px] grid grid-cols-4 gap-[14px] max-[1100px]:grid-cols-2 max-[640px]:gap-2.5" aria-label="Dnevni pokazatelji">
        <StatCard label="Današnji termini" value={todayAppointmentCount} note="aktivni termini" />
        {canViewExaminations ? (
          <StatCard label="Završeni pregledi" value={completedExaminations} note="danas" />
        ) : null}
        <StatCard label="Registrovani klijenti" value={clientCount} note="aktivni klijenti" />
        <StatCard label="Registrovane životinje" value={animalCount} note="aktivne životinje" />
        {canViewFinancial ? (
          <>
            <StatCard
              label="Današnja naplata"
              value={formatCurrency(paymentsTotal)}
              note="evidentirane uplate"
            />
            <StatCard
              label="Nenaplaćeno"
              value={formatCurrency(outstandingTotal)}
              note={`${outstandingInvoices.length} otvorenih računa`}
            />
          </>
        ) : null}
        {canViewInventory ? (
          <StatCard label="Niske zalihe" value={lowStock.length} note="lijekovi ispod minimuma" />
        ) : null}
      </section>

      <div className={`mb-[17px] grid gap-[17px] max-[640px]:grid-cols-1 ${canViewInventory ? "grid-cols-[minmax(0,1.5fr)_minmax(280px,0.9fr)]" : "grid-cols-1"}`}>
        <section className="min-w-0 rounded-[11px] border border-line bg-white p-[18px_19px] shadow-[0_2px_6px_rgb(34_62_47_/_2%)]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="m-0 text-sm font-[720]">Termini za danas</h2>
              <div className="mt-1 text-[11px] text-muted">Raspored pregleda u ambulanti</div>
            </div>
          </div>
          {appointments.length ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr>
                    <th className="whitespace-nowrap border-b border-line px-[9px] py-2.5 text-[10px] font-bold uppercase tracking-[0.55px] text-[#8a968e]">Vrijeme</th>
                    <th className="whitespace-nowrap border-b border-line px-[9px] py-2.5 text-[10px] font-bold uppercase tracking-[0.55px] text-[#8a968e]">Klijent / životinja</th>
                    <th className="whitespace-nowrap border-b border-line px-[9px] py-2.5 text-[10px] font-bold uppercase tracking-[0.55px] text-[#8a968e]">Veterinar</th>
                    <th className="whitespace-nowrap border-b border-line px-[9px] py-2.5 text-[10px] font-bold uppercase tracking-[0.55px] text-[#8a968e]">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {appointments.map((appointment) => (
                    <tr key={appointment.id}>
                      <td className="whitespace-nowrap border-b border-[#eef1ef] px-[9px] py-3 text-xs font-[650] last:border-0">{formatTime(appointment.startsAt)}</td>
                      <td className="whitespace-nowrap border-b border-[#eef1ef] px-[9px] py-3 text-xs last:border-0">
                        <div className="font-[650]">
                          {appointment.client.firstName} {appointment.client.lastName}
                        </div>
                        <div className="mt-[3px] text-[11px] text-muted">
                          {appointment.animal.name} · {appointment.animal.species}
                        </div>
                      </td>
                      <td className="whitespace-nowrap border-b border-[#eef1ef] px-[9px] py-3 text-xs last:border-0">
                        {appointment.veterinarian.firstName} {appointment.veterinarian.lastName}
                      </td>
                      <td className="whitespace-nowrap border-b border-[#eef1ef] px-[9px] py-3 text-xs last:border-0">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-1 text-[10px] font-bold ${
                            appointment.status === "COMPLETED"
                              ? "bg-[#e8f4ec] text-[#2f7657]"
                              : appointment.status === "IN_PROGRESS"
                                ? "bg-[#fff4df] text-[#94641e]"
                                : "bg-[#eef1ef] text-[#67736b]"
                          }`}
                        >
                          {appointmentStatusLabels[appointment.status]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-2.5 py-[23px] text-center text-xs text-muted">Za danas nema zakazanih termina.</div>
          )}
        </section>

        {canViewInventory ? (
          <section className="min-w-0 rounded-[11px] border border-line bg-white p-[18px_19px] shadow-[0_2px_6px_rgb(34_62_47_/_2%)]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="m-0 text-sm font-[720]">Upozorenja o zalihama</h2>
              <div className="mt-1 text-[11px] text-muted">Lijekovi na minimumu ili ispod njega</div>
            </div>
          </div>
          {lowStock.length ? (
            <div className="flex flex-col">
              {lowStock.map((medication) => (
                <div className="flex items-start justify-between gap-2.5 border-b border-[#eef1ef] py-3 last:border-0" key={medication.id}>
                  <div>
                    <div className="text-xs font-[650]">{medication.name}</div>
                    <div className="mt-1 text-[11px] text-muted">
                      Minimum: {medication.minimumStock.toString()} {medication.unit}
                    </div>
                  </div>
                  <div className="whitespace-nowrap text-[11px] font-[750] text-amber">
                    {medication.quantity.toString()} {medication.unit}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-2.5 py-[23px] text-center text-xs text-muted">Nema lijekova ispod minimalne zalihe.</div>
          )}
          </section>
        ) : null}
      </div>

      <div className={`grid grid-cols-2 gap-[17px] max-[640px]:grid-cols-1 ${canViewExaminations && canViewFinancial ? "" : "grid-cols-1"}`}>
        {canViewExaminations ? (
          <section className="min-w-0 rounded-[11px] border border-line bg-white p-[18px_19px] shadow-[0_2px_6px_rgb(34_62_47_/_2%)]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="m-0 text-sm font-[720]">Posljednji pregledi</h2>
              <div className="mt-1 text-[11px] text-muted">Nedavno završeni pregledi</div>
            </div>
          </div>
          {recentExaminations.length ? (
            <div className="flex flex-col">
              {recentExaminations.map((examination) => (
                <div className="flex items-start justify-between gap-2.5 border-b border-[#eef1ef] py-3 last:border-0" key={examination.id}>
                  <div>
                    <div className="text-xs font-[650]">
                      {examination.animal.name} · {examination.animal.species}
                    </div>
                    <div className="mt-1 text-[11px] text-muted">
                      {examination.client.firstName} {examination.client.lastName} · dr.{" "}
                      {examination.veterinarian.firstName} {examination.veterinarian.lastName}
                    </div>
                  </div>
                  <span className="mt-[3px] text-[11px] text-muted">{formatDate(examination.examinationDate)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-2.5 py-[23px] text-center text-xs text-muted">Još nema završenih pregleda.</div>
          )}
          </section>
        ) : null}

        {canViewFinancial ? (
          <section className="min-w-0 rounded-[11px] border border-line bg-white p-[18px_19px] shadow-[0_2px_6px_rgb(34_62_47_/_2%)]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="m-0 text-sm font-[720]">Posljednji računi</h2>
              <div className="mt-1 text-[11px] text-muted">Nedavno izdani računi</div>
            </div>
          </div>
          {recentInvoices.length ? (
            <div className="flex flex-col">
              {recentInvoices.map((invoice) => (
                <div className="flex items-start justify-between gap-2.5 border-b border-[#eef1ef] py-3 last:border-0" key={invoice.id}>
                  <div>
                    <div className="text-xs font-[650]">{invoice.invoiceNumber}</div>
                    <div className="mt-1 text-[11px] text-muted">
                      {invoice.client.firstName} {invoice.client.lastName}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-[650]">{formatCurrency(invoice.total)}</div>
                    <div className="mt-1 text-[11px] text-muted">
                      {invoice.issuedAt ? formatDate(invoice.issuedAt) : "Nije izdan"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-2.5 py-[23px] text-center text-xs text-muted">Još nema izdanih računa.</div>
          )}
          </section>
        ) : null}
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string | number;
  note: string;
}) {
  return (
    <article className="min-h-[120px] rounded-[11px] border border-line bg-white p-[17px_18px] shadow-[0_2px_6px_rgb(34_62_47_/_2%)] max-[640px]:min-h-[106px] max-[640px]:p-[14px]">
      <div className="text-xs font-[550] text-muted">{label}</div>
      <div className="mt-[17px] text-[26px] font-[750] tracking-[-0.8px] max-[640px]:mt-[14px] max-[640px]:text-[22px]">{value}</div>
      <div className="mt-1 text-[11px] text-[#96a19b]">{note}</div>
    </article>
  );
}
