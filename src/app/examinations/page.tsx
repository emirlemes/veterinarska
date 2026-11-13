import type { Metadata } from "next";
import Link from "next/link";
import { ExaminationStatus, InvoiceStatus, Prisma } from "@prisma/client";
import { ClickableRow } from "@/components/clickable-row";
import { CompleteExaminationButton } from "@/components/examinations/complete-examination";
import { tableActionClass, tablePrimaryActionClass } from "@/components/table-action-styles";
import { examinationListQuerySchema } from "@/features/examinations/validation";
import { hasPermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/db";
import { getClinicDateBounds } from "@/lib/dates";

export const metadata: Metadata = { title: "Pregledi" };

const statusLabels: Record<ExaminationStatus, string> = {
  IN_PROGRESS: "U toku",
  COMPLETED: "Završen",
};
const invoiceLabels: Record<InvoiceStatus, string> = {
  DRAFT: "Nacrt",
  ISSUED: "Izdat",
  PARTIALLY_PAID: "Djelimično plaćen",
  PAID: "Plaćen",
  VOID: "Storniran",
};

export default async function ExaminationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; date?: string; veterinarianId?: string; sort?: string; page?: string }>;
}) {
  const user = await requirePermission("examinations:read");
  const params = await searchParams;
  const parsed = examinationListQuerySchema.safeParse(params);
  const filters = parsed.success
    ? parsed.data
    : examinationListQuerySchema.parse({});
  const where: Prisma.ExaminationWhereInput = {};

  if (filters.status !== "all") where.status = filters.status;
  if (filters.veterinarianId) where.veterinarianId = filters.veterinarianId;
  const dateBounds = filters.date ? getClinicDateBounds(filters.date) : null;
  if (dateBounds) where.examinationDate = { gte: dateBounds.start, lt: dateBounds.end };
  if (filters.q) {
    where.OR = [
      { animal: { name: { contains: filters.q, mode: "insensitive" } } },
      { client: { firstName: { contains: filters.q, mode: "insensitive" } } },
      { client: { lastName: { contains: filters.q, mode: "insensitive" } } },
      { client: { companyName: { contains: filters.q, mode: "insensitive" } } },
      { chiefComplaint: { contains: filters.q, mode: "insensitive" } },
      { diagnosis: { contains: filters.q, mode: "insensitive" } },
    ];
  }

  const [total, veterinarians] = await Promise.all([
    prisma.examination.count({ where }),
    prisma.user.findMany({
      where: { examinations: { some: {} } },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
  ]);
  const pageSize = 20;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(filters.page, pageCount);
  const examinations = await prisma.examination.findMany({
    where,
    include: {
      client: { select: { id: true, firstName: true, lastName: true, companyName: true } },
      animal: { select: { id: true, name: true, species: true } },
      veterinarian: { select: { firstName: true, lastName: true } },
      invoice: { select: { id: true, status: true } },
    },
    orderBy: [{ examinationDate: filters.sort === "oldest" ? "asc" : "desc" }, { id: "desc" }],
    skip: (currentPage - 1) * pageSize,
    take: pageSize,
  });
  const canWrite = hasPermission(user.role, "examinations:write");
  const canWriteInvoices = hasPermission(user.role, "invoices:write");
  const canReadInvoices = hasPermission(user.role, "invoices:read");
  function pageHref(page: number) {
    const query = new URLSearchParams({
      q: filters.q, status: filters.status, date: filters.date,
      veterinarianId: filters.veterinarianId, sort: filters.sort, page: String(page),
    });
    return `/examinations?${query.toString()}`;
  }

  return (
    <main className="mx-auto w-full max-w-[1440px] px-4 pb-8 pt-5 sm:px-[34px] sm:pb-[42px] sm:pt-[31px]">
      <div className="mb-5 flex flex-col gap-4 sm:mb-[25px] sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-[7px] text-[11px] font-[750] uppercase tracking-[0.7px] text-green">Medicinska evidencija</p>
          <h1 className="m-0 text-[clamp(24px,3vw,30px)] tracking-[-0.9px]">Pregledi</h1>
          <p className="mt-2 text-sm text-muted">Evidencija i upravljanje veterinarskim pregledima · {total} pregleda</p>
        </div>
        {canWrite ? (
          <Link
            className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-green px-4 text-sm font-bold text-white hover:bg-green-dark sm:w-auto"
            href="/examinations/new"
          >
            + Novi pregled
          </Link>
        ) : null}
      </div>

      <section className="rounded-xl border border-line bg-white p-3 shadow-[0_2px_6px_rgb(34_62_47_/_2%)] sm:p-5">
        <form
          className="grid grid-cols-1 gap-3 border-b border-line pb-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 xl:items-end"
          action="/examinations"
          method="get"
        >
          <label className="grid gap-1.5 text-xs font-semibold text-muted">
            Pretraga
            <input
              className="h-11 w-full rounded-lg border border-[#dce4de] bg-white px-3 text-sm text-ink focus:border-green focus:outline-none focus:ring-2 focus:ring-green/15"
              type="search"
              name="q"
              maxLength={100}
              defaultValue={filters.q}
              placeholder="Životinja, klijent, razlog ili dijagnoza"
            />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-muted">
            Datum
            <input className="h-11 w-full rounded-lg border border-[#dce4de] bg-white px-3 text-sm text-ink" type="date" name="date" defaultValue={filters.date} />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-muted">
            Veterinar
            <select className="h-11 w-full rounded-lg border border-[#dce4de] bg-white px-3 text-sm text-ink" name="veterinarianId" defaultValue={filters.veterinarianId}>
              <option value="">Svi veterinari</option>
              {veterinarians.map((veterinarian) => <option key={veterinarian.id} value={veterinarian.id}>{veterinarian.firstName} {veterinarian.lastName}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-muted">
            Sortiranje
            <select className="h-11 w-full rounded-lg border border-[#dce4de] bg-white px-3 text-sm text-ink" name="sort" defaultValue={filters.sort}>
              <option value="newest">Najnoviji prvo</option>
              <option value="oldest">Najstariji prvo</option>
            </select>
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-muted">
            Status
            <select
              className="h-11 w-full rounded-lg border border-[#dce4de] bg-white px-3 text-sm text-ink focus:border-green focus:outline-none focus:ring-2 focus:ring-green/15"
              name="status"
              defaultValue={filters.status}
            >
              <option value="all">Svi statusi</option>
              {Object.entries(statusLabels).map(([status, label]) => (
                <option key={status} value={status}>{label}</option>
              ))}
            </select>
          </label>
          <button
            className="h-11 rounded-lg border border-line bg-white px-4 text-sm font-bold text-[#53645a] hover:bg-[#f7faf8]"
            type="submit"
          >
            Prikaži
          </button>
        </form>

        {!parsed.success ? (
          <p className="mt-3 rounded-lg bg-[#fbefee] px-3 py-2.5 text-xs text-[#a43e3c]" role="alert">
            Filter nije ispravan. Prikazani su svi pregledi.
          </p>
        ) : null}
        {examinations.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead><tr>{["Datum i vrijeme", "Životinja", "Klijent", "Veterinar", "Razlog pregleda", "Status", ...(canReadInvoices ? ["Status računa"] : []), "Akcije"].map((heading) => <th key={heading} className={`whitespace-nowrap border-b border-line px-3 py-3 text-xs text-muted ${["Klijent", "Veterinar", "Razlog pregleda", "Status računa"].includes(heading) ? "hidden md:table-cell" : ""}`}>{heading}</th>)}</tr></thead>
              <tbody>
                {examinations.map((examination) => (
                  <ClickableRow key={examination.id} href={`/examinations/${examination.id}`}>
                    <td className="whitespace-nowrap border-b border-line px-3 py-3">{new Intl.DateTimeFormat("bs-BA", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Sarajevo" }).format(examination.examinationDate)}</td>
                    <td className="border-b border-line px-3 py-3"><Link className="font-bold text-green-dark hover:underline" href={`/examinations/${examination.id}`}>{examination.animal.name}</Link></td>
                    <td className="hidden border-b border-line px-3 py-3 md:table-cell">{examination.client.companyName || `${examination.client.firstName} ${examination.client.lastName}`}</td>
                    <td className="hidden border-b border-line px-3 py-3 md:table-cell">{examination.veterinarian.firstName} {examination.veterinarian.lastName}</td>
                    <td className="hidden max-w-56 border-b border-line px-3 py-3 md:table-cell"><span className="line-clamp-2 break-words">{examination.chiefComplaint || "—"}</span></td>
                    <td className="border-b border-line px-3 py-3"><span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${examination.status === "COMPLETED" ? "bg-[#edf4ef] text-[#587362]" : "bg-[#fff4df] text-[#93631b]"}`}>{statusLabels[examination.status]}</span></td>
                    {canReadInvoices ? <td className="hidden whitespace-nowrap border-b border-line px-3 py-3 md:table-cell">{examination.invoice ? invoiceLabels[examination.invoice.status] : "Bez računa"}</td> : null}
                    <td className="min-w-[220px] border-b border-line px-3 py-3">
                      <div className="flex max-w-[380px] flex-wrap gap-2">
                        <Link className={tableActionClass} href={`/examinations/${examination.id}`}>Detalji</Link>
                        {canWrite && examination.status === "IN_PROGRESS" ? <>
                          <Link className={tableActionClass} href={`/examinations/${examination.id}/edit`}>Nastavi pregled</Link>
                          <CompleteExaminationButton id={examination.id} canReadAnimals={hasPermission(user.role, "animals:read")} canWriteInvoices={canWriteInvoices} canReadInvoices={canReadInvoices} className={tablePrimaryActionClass} />
                        </> : null}
                        {examination.status === "COMPLETED" ? <>
                          {hasPermission(user.role, "animals:read") ? <Link className={tableActionClass} href={`/animals/${examination.animal.id}`}>Medicinski karton</Link> : null}
                          {examination.invoice && canReadInvoices ? <Link className={tableActionClass} href={`/invoices/${examination.invoice.id}`}>Pregledaj račun</Link> : null}
                          {!examination.invoice && canWriteInvoices ? <Link className={tableActionClass} href={`/invoices/new?examinationId=${encodeURIComponent(examination.id)}`}>Kreiraj račun</Link> : null}
                        </> : null}
                      </div>
                    </td>
                  </ClickableRow>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-3 py-12 text-center">
            <p className="mb-1 text-sm font-semibold">Nema pregleda za odabrane filtere.</p>
            <p className="m-0 text-sm text-muted">Kreirajte novi pregled ili promijenite pretragu.</p>
          </div>
        )}
        {pageCount > 1 ? <div className="mt-4 flex items-center justify-between gap-3 text-sm"><span>Stranica {currentPage} od {pageCount}</span><div className="flex gap-2">{currentPage > 1 ? <Link className="inline-flex min-h-11 items-center rounded-lg border border-line px-3" href={pageHref(currentPage - 1)}>Prethodna</Link> : null}{currentPage < pageCount ? <Link className="inline-flex min-h-11 items-center rounded-lg border border-line px-3" href={pageHref(currentPage + 1)}>Sljedeća</Link> : null}</div></div> : null}
      </section>
    </main>
  );
}
