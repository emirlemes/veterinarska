import type { Metadata } from "next";
import Link from "next/link";
import { ExaminationStatus, Prisma } from "@prisma/client";
import { ExaminationCard } from "@/components/examinations/examination-card";
import { examinationListQuerySchema } from "@/features/examinations/validation";
import { hasPermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Pregledi" };

const statusLabels: Record<ExaminationStatus, string> = {
  IN_PROGRESS: "U toku",
  COMPLETED: "Završen",
};

export default async function ExaminationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const user = await requirePermission("examinations:read");
  const params = await searchParams;
  const parsed = examinationListQuerySchema.safeParse(params);
  const filters = parsed.success
    ? parsed.data
    : { status: "all" as const, q: "" };
  const where: Prisma.ExaminationWhereInput = {};

  if (filters.status !== "all") where.status = filters.status;
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

  const examinations = await prisma.examination.findMany({
    where,
    include: {
      client: { select: { id: true, firstName: true, lastName: true, companyName: true } },
      animal: { select: { id: true, name: true, species: true } },
      veterinarian: { select: { firstName: true, lastName: true } },
    },
    orderBy: [{ examinationDate: "desc" }, { id: "desc" }],
    take: 100,
  });
  const canWrite = hasPermission(user.role, "examinations:write");

  return (
    <main className="mx-auto w-full max-w-[1440px] px-4 pb-8 pt-5 sm:px-[34px] sm:pb-[42px] sm:pt-[31px]">
      <div className="mb-5 flex flex-col gap-4 sm:mb-[25px] sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-[7px] text-[11px] font-[750] uppercase tracking-[0.7px] text-green">Medicinska evidencija</p>
          <h1 className="m-0 text-[clamp(24px,3vw,30px)] tracking-[-0.9px]">Pregledi</h1>
          <p className="mt-2 text-sm text-muted">{examinations.length} prikazanih pregleda</p>
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
          className="grid grid-cols-1 gap-3 border-b border-line pb-4 sm:grid-cols-[minmax(0,1fr)_180px_auto] sm:items-end"
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
          <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
            {examinations.map((examination) => (
              <ExaminationCard key={examination.id} examination={examination} />
            ))}
          </div>
        ) : (
          <div className="px-3 py-12 text-center">
            <p className="mb-1 text-sm font-semibold">Nema pregleda za odabrane filtere.</p>
            <p className="m-0 text-sm text-muted">Kreirajte novi pregled ili promijenite pretragu.</p>
          </div>
        )}
      </section>
    </main>
  );
}
