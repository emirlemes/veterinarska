import type { Metadata } from "next";
import Link from "next/link";
import { AnimalStatus, Prisma } from "@prisma/client";
import { hasPermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/db";
import { animalListQuerySchema } from "@/features/animals/validation";

export const metadata: Metadata = { title: "Životinje" };

const pageSize = 20;

const statusFilter: Record<"active" | "inactive" | "deceased", AnimalStatus> = {
  active: AnimalStatus.ACTIVE,
  inactive: AnimalStatus.INACTIVE,
  deceased: AnimalStatus.DECEASED,
};

const statusLabels: Record<AnimalStatus, string> = {
  ACTIVE: "Aktivna",
  INACTIVE: "Neaktivna",
  DECEASED: "Uginula",
};

export default async function AnimalsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    page?: string;
    status?: string;
    species?: string;
    ownerId?: string;
  }>;
}) {
  const user = await requirePermission("animals:read");
  const params = await searchParams;
  const parsed = animalListQuerySchema.safeParse(params);
  const filters = parsed.success
    ? parsed.data
    : { q: "", page: 1, status: "active" as const, species: "" };
  const where: Prisma.AnimalWhereInput = {};

  if (filters.status !== "all") where.status = statusFilter[filters.status];
  if (filters.species) where.species = { contains: filters.species, mode: "insensitive" };
  if (filters.ownerId) where.ownerId = filters.ownerId;
  if (filters.q) {
    where.OR = [
      { name: { contains: filters.q, mode: "insensitive" } },
      { species: { contains: filters.q, mode: "insensitive" } },
      { breed: { contains: filters.q, mode: "insensitive" } },
      { microchipNumber: { contains: filters.q, mode: "insensitive" } },
      { passportNumber: { contains: filters.q, mode: "insensitive" } },
      {
        owner: {
          OR: [
            { firstName: { contains: filters.q, mode: "insensitive" } },
            { lastName: { contains: filters.q, mode: "insensitive" } },
            { companyName: { contains: filters.q, mode: "insensitive" } },
            { phone: { contains: filters.q } },
          ],
        },
      },
    ];
  }

  const total = await prisma.animal.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(filters.page, pageCount);
  const animals = await prisma.animal.findMany({
    where,
    include: { owner: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
  });
  const canWrite = hasPermission(user.role, "animals:write");

  function pageHref(targetPage: number) {
    const query = new URLSearchParams({
      q: filters.q,
      page: String(targetPage),
      status: filters.status,
      species: filters.species,
    });
    if (filters.ownerId) query.set("ownerId", filters.ownerId);
    return `/animals?${query.toString()}`;
  }

  return (
    <main className="mx-auto w-full max-w-[1440px] px-[34px] pb-[42px] pt-[31px] max-[820px]:px-[21px] max-[640px]:px-[14px] max-[640px]:pb-[30px] max-[640px]:pt-[22px]">
      <div className="mb-[25px] flex items-end justify-between gap-5 max-[640px]:flex-col max-[640px]:items-stretch">
        <div>
          <p className="mb-[7px] text-[11px] font-[750] uppercase tracking-[0.7px] text-green">Osnovni registri</p>
          <h1 className="m-0 text-[clamp(24px,3vw,30px)] tracking-[-0.9px]">Životinje</h1>
          <p className="mt-2 text-muted">Registar pacijenata i historija njihovih vlasnika.</p>
        </div>
        {canWrite ? <Link className="inline-flex min-h-11 w-full items-center justify-center whitespace-nowrap rounded-[7px] border border-transparent bg-green px-[13px] text-sm font-bold text-white hover:bg-green-dark sm:w-auto" href="/animals/new">+ Nova životinja</Link> : null}
      </div>

      <section className="min-w-0 rounded-[11px] border border-line bg-white p-[18px_19px] shadow-[0_2px_6px_rgb(34_62_47_/_2%)]">
        <form className="flex items-center gap-[9px] border-b border-line pb-4 max-[640px]:items-stretch max-[640px]:flex-col" action="/animals" method="get">
          <input type="hidden" name="page" value="1" />
          <label className="flex-1">
            <span className="sr-only">Pretraga životinja</span>
            <input
              className="h-11 w-full rounded-[7px] border border-[#dce4de] bg-white px-[11px] text-ink outline-none focus:border-green focus:ring-[3px] focus:ring-[rgb(46_118_88_/_12%)]"
              type="search"
              name="q"
              defaultValue={filters.q}
              placeholder="Ime, vrsta, vlasnik ili mikročip..."
              maxLength={100}
            />
          </label>
          <label className="w-[150px] max-[640px]:w-full">
            <span className="sr-only">Status životinja</span>
            <select className="h-11 w-full rounded-[7px] border border-[#dce4de] bg-white px-[11px] text-ink outline-none focus:border-green focus:ring-2 focus:ring-green/15" name="status" defaultValue={filters.status}>
              <option value="active">Aktivne</option>
              <option value="inactive">Neaktivne</option>
              <option value="deceased">Uginule</option>
              <option value="all">Sve</option>
            </select>
          </label>
          <label className="w-[150px] max-[640px]:w-full">
            <span className="sr-only">Filter vrste</span>
            <input
              className="h-11 w-full rounded-[7px] border border-[#dce4de] bg-white px-[11px] text-ink outline-none focus:border-green focus:ring-[3px] focus:ring-[rgb(46_118_88_/_12%)]"
              type="search"
              name="species"
              defaultValue={filters.species}
              placeholder="Vrsta"
              maxLength={80}
            />
          </label>
          <button className="inline-flex min-h-11 cursor-pointer items-center justify-center whitespace-nowrap rounded-[7px] border border-line bg-white px-[13px] text-sm font-bold text-[#53645a] hover:bg-[#f7faf8]" type="submit">Pretraži</button>
        </form>

        {!parsed.success ? (
          <p className="rounded-[7px] bg-[#fbefee] px-3 py-2.5 text-xs text-[#a43e3c]" role="alert">
            Neispravan upit za pretragu ili stranicu. Prikazane su aktivne životinje.
          </p>
        ) : null}
        <div className="py-[15px] pb-[5px] text-[11px] text-muted">{total} životinja</div>
        {animals.length ? (
          <>
          <div className="space-y-3 md:hidden">
            {animals.map((animal) => (
              <article className="rounded-lg border border-[#eef1ef] p-3" key={animal.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link className="break-words text-sm font-bold text-green-dark hover:underline" href={`/animals/${animal.id}`}>
                      {animal.name}
                    </Link>
                    <p className="mb-0 mt-1 text-xs text-muted">
                      {animal.species}{animal.breed ? ` · ${animal.breed}` : ""}
                    </p>
                  </div>
                  <span className={`flex-none rounded-full px-2 py-1 text-[10px] font-bold ${animal.status === "ACTIVE" ? "bg-[#e8f4ec] text-[#2f7657]" : "bg-[#eef1ef] text-[#67736b]"}`}>
                    {statusLabels[animal.status]}
                  </span>
                </div>
                <div className="mt-3 grid gap-2 border-t border-[#eef1ef] pt-3 text-xs">
                  <Link className="break-words font-semibold text-[#53645a]" href={`/clients/${animal.owner.id}`}>
                    Vlasnik: {animal.owner.companyName || `${animal.owner.firstName} ${animal.owner.lastName}`}
                  </Link>
                  <a className="min-h-11 inline-flex items-center text-green-dark" href={`tel:${animal.owner.phone}`}>
                    Telefon: {animal.owner.phone}
                  </a>
                  <div className="flex flex-wrap justify-between gap-2 text-muted">
                    <span>Mikročip: {animal.microchipNumber || "—"}</span>
                    {animal.sex ? <span>Spol: {animal.sex}</span> : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr>
                  <th className="whitespace-nowrap border-b border-line px-[9px] py-2.5 text-[10px] font-bold uppercase tracking-[0.55px] text-[#8a968e]">Životinja</th>
                  <th className="whitespace-nowrap border-b border-line px-[9px] py-2.5 text-[10px] font-bold uppercase tracking-[0.55px] text-[#8a968e]">Vrsta / pasmina</th>
                  <th className="whitespace-nowrap border-b border-line px-[9px] py-2.5 text-[10px] font-bold uppercase tracking-[0.55px] text-[#8a968e]">Vlasnik</th>
                  <th className="whitespace-nowrap border-b border-line px-[9px] py-2.5 text-[10px] font-bold uppercase tracking-[0.55px] text-[#8a968e]">Telefon</th>
                  <th className="whitespace-nowrap border-b border-line px-[9px] py-2.5 text-[10px] font-bold uppercase tracking-[0.55px] text-[#8a968e]">Mikročip</th>
                  <th className="whitespace-nowrap border-b border-line px-[9px] py-2.5 text-[10px] font-bold uppercase tracking-[0.55px] text-[#8a968e]">Status</th>
                </tr>
              </thead>
              <tbody>
                {animals.map((animal) => (
                  <tr key={animal.id}>
                    <td className="whitespace-nowrap border-b border-[#eef1ef] px-[9px] py-3 text-xs last:border-0">
                      <Link className="font-[650] hover:text-green hover:underline" href={`/animals/${animal.id}`}>
                        {animal.name}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap border-b border-[#eef1ef] px-[9px] py-3 text-xs last:border-0">{animal.species}{animal.breed ? ` · ${animal.breed}` : ""}</td>
                    <td className="whitespace-nowrap border-b border-[#eef1ef] px-[9px] py-3 text-xs last:border-0">{animal.owner.companyName || `${animal.owner.firstName} ${animal.owner.lastName}`}</td>
                    <td className="whitespace-nowrap border-b border-[#eef1ef] px-[9px] py-3 text-xs last:border-0">{animal.owner.phone}</td>
                    <td className="whitespace-nowrap border-b border-[#eef1ef] px-[9px] py-3 text-xs last:border-0">{animal.microchipNumber || "—"}</td>
                    <td className="whitespace-nowrap border-b border-[#eef1ef] px-[9px] py-3 text-xs last:border-0">
                      <span className={`inline-flex items-center rounded-full px-2 py-1 text-[10px] font-bold ${animal.status === "ACTIVE" ? "bg-[#e8f4ec] text-[#2f7657]" : "bg-[#eef1ef] text-[#67736b]"}`}>
                        {statusLabels[animal.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        ) : (
          <div className="px-2.5 py-[23px] text-center text-xs text-muted">
            {filters.q || filters.species
              ? "Nema životinja koje odgovaraju pretrazi."
              : "Još nema registrovanih životinja."}
          </div>
        )}

        {pageCount > 1 ? (
          <div className="flex items-center justify-between gap-3 border-t border-line pt-[17px] text-[11px] text-muted">
            <span>Stranica {page} od {pageCount}</span>
            <div className="flex items-center gap-[9px]">
              {page > 1 ? <Link className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-[7px] border border-line bg-white px-[13px] text-xs font-bold text-[#53645a] hover:bg-[#f7faf8]" href={pageHref(page - 1)}>Prethodna</Link> : null}
              {page < pageCount ? <Link className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-[7px] border border-line bg-white px-[13px] text-xs font-bold text-[#53645a] hover:bg-[#f7faf8]" href={pageHref(page + 1)}>Sljedeća</Link> : null}
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
