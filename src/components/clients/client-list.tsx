"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { clientListQuery, ClientListError, type ClientFilters } from "@/features/clients/queries";
import { QueryStatus } from "@/components/query-status";
import { ClickableCard, ClickableRow } from "@/components/clickable-row";

export function ClientList({ filters, canWrite, invalidFilters }: {
  filters: ClientFilters;
  canWrite: boolean;
  invalidFilters: boolean;
}) {
  const query = useQuery(clientListQuery(filters));
  const forbidden = query.error instanceof ClientListError &&
    (query.error.status === 401 || query.error.status === 403);
  const data = forbidden ? undefined : query.data;
  const { clients = [], total = 0, page = filters.page, pageCount = 1 } = data ?? {};

  function pageHref(targetPage: number) {
    const query = new URLSearchParams({
      q: filters.q,
      page: String(targetPage),
      status: filters.status,
    });
    return `/clients?${query.toString()}`;
  }

  return (
    <main className="mx-auto w-full max-w-[1440px] px-[34px] pb-[42px] pt-[31px] max-[820px]:px-[21px] max-[640px]:px-[14px] max-[640px]:pb-[30px] max-[640px]:pt-[22px]">
      <div className="mb-[25px] flex items-end justify-between gap-5 max-[640px]:flex-col max-[640px]:items-stretch">
        <div>
          <p className="mb-[7px] text-[11px] font-[750] uppercase tracking-[0.7px] text-green">Osnovni registri</p>
          <h1 className="m-0 text-[clamp(24px,3vw,30px)] tracking-[-0.9px]">Klijenti</h1>
          <p className="mt-2 text-muted">Pregled i upravljanje vlasnicima životinja.</p>
        </div>
        {canWrite ? (
          <Link className="inline-flex min-h-11 w-full items-center justify-center whitespace-nowrap rounded-[7px] border border-transparent bg-green px-[13px] text-sm font-bold text-white hover:bg-green-dark sm:w-auto" href="/clients/new">
            + Novi klijent
          </Link>
        ) : null}
      </div>

      <section className="min-w-0 rounded-[11px] border border-line bg-white p-[18px_19px] shadow-[0_2px_6px_rgb(34_62_47_/_2%)]">
        <form className="flex items-center gap-[9px] border-b border-line pb-4 max-[640px]:items-stretch max-[640px]:flex-col" action="/clients" method="get">
          <input type="hidden" name="page" value="1" />
          <label className="flex-1">
            <span className="sr-only">Pretraga klijenata</span>
            <input
              className="h-11 w-full rounded-[7px] border border-[#dce4de] bg-white px-[11px] text-ink outline-none focus:border-green focus:ring-[3px] focus:ring-[rgb(46_118_88_/_12%)]"
              type="search"
              name="q"
              defaultValue={filters.q}
              placeholder="Pretraži ime, telefon ili e-mail..."
              maxLength={100}
            />
          </label>
          <label className="w-[150px] max-[640px]:w-full">
            <span className="sr-only">Status klijenata</span>
            <select className="h-11 w-full rounded-[7px] border border-[#dce4de] bg-white px-[11px] text-ink outline-none focus:border-green focus:ring-[3px] focus:ring-[rgb(46_118_88_/_12%)]" name="status" defaultValue={filters.status}>
              <option value="active">Aktivni</option>
              <option value="archived">Arhivirani</option>
              <option value="all">Svi klijenti</option>
            </select>
          </label>
          <button className="inline-flex min-h-11 cursor-pointer items-center justify-center whitespace-nowrap rounded-[7px] border border-line bg-white px-[13px] text-sm font-bold text-[#53645a] hover:bg-[#f7faf8]" type="submit">Pretraži</button>
        </form>

        {invalidFilters ? (
          <p className="rounded-[7px] bg-[#fbefee] px-3 py-2.5 text-xs text-[#a43e3c]" role="alert">
            Neispravan upit za pretragu ili stranicu. Prikazani su aktivni klijenti.
          </p>
        ) : null}

        <QueryStatus pending={query.isPending} fetching={query.isFetching} paused={query.fetchStatus === "paused"} error={query.error} hasData={!!data} forbidden={forbidden} onRetry={() => { void query.refetch(); }} />
        {data ? <div className="py-[15px] pb-[5px] text-[11px] text-muted">{total} klijenata</div> : null}
        {data && clients.length ? (
          <>
          <div className="space-y-3 md:hidden">
            {clients.map((client) => (
              <ClickableCard href={`/clients/${client.id}`} className="rounded-lg border border-[#eef1ef] p-3" key={client.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link className="break-words text-sm font-bold text-green-dark hover:underline" href={`/clients/${client.id}`}>
                      {client.companyName || `${client.firstName} ${client.lastName}`}
                    </Link>
                    {client.companyName ? (
                      <p className="mb-0 mt-1 text-xs text-muted">{client.firstName} {client.lastName}</p>
                    ) : null}
                  </div>
                  <span className={`flex-none rounded-full px-2 py-1 text-[10px] font-bold ${client.isActive ? "bg-[#e8f4ec] text-[#2f7657]" : "bg-[#eef1ef] text-[#67736b]"}`}>
                    {client.isActive ? "Aktivan" : "Arhiviran"}
                  </span>
                </div>
                <div className="mt-3 grid gap-2 border-t border-[#eef1ef] pt-3 text-xs">
                  <a className="min-h-11 inline-flex items-center text-green-dark" href={`tel:${client.phone}`}>
                    Telefon: {client.phone}
                  </a>
                  {client.email ? (
                    <a className="break-all text-[#53645a]" href={`mailto:${client.email}`}>{client.email}</a>
                  ) : null}
                  <div className="flex justify-between gap-2 text-muted">
                    <span>{client.city || "Grad nije unesen"}</span>
                    <span>{client._count.animals} životinja</span>
                  </div>
                </div>
              </ClickableCard>
            ))}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr>
                  <th className="whitespace-nowrap border-b border-line px-[9px] py-2.5 text-[10px] font-bold uppercase tracking-[0.55px] text-[#8a968e]">Klijent</th>
                  <th className="whitespace-nowrap border-b border-line px-[9px] py-2.5 text-[10px] font-bold uppercase tracking-[0.55px] text-[#8a968e]">Telefon</th>
                  <th className="whitespace-nowrap border-b border-line px-[9px] py-2.5 text-[10px] font-bold uppercase tracking-[0.55px] text-[#8a968e]">E-mail</th>
                  <th className="whitespace-nowrap border-b border-line px-[9px] py-2.5 text-[10px] font-bold uppercase tracking-[0.55px] text-[#8a968e]">Grad</th>
                  <th className="whitespace-nowrap border-b border-line px-[9px] py-2.5 text-[10px] font-bold uppercase tracking-[0.55px] text-[#8a968e]">Životinje</th>
                  <th className="whitespace-nowrap border-b border-line px-[9px] py-2.5 text-[10px] font-bold uppercase tracking-[0.55px] text-[#8a968e]">Status</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <ClickableRow key={client.id} href={`/clients/${client.id}`}>
                    <td className="whitespace-nowrap border-b border-[#eef1ef] px-[9px] py-3 text-xs last:border-0">
                      <Link className="font-[650] hover:text-green hover:underline" href={`/clients/${client.id}`}>
                        {client.companyName || `${client.firstName} ${client.lastName}`}
                      </Link>
                      {client.companyName ? (
                        <div className="mt-[3px] text-[11px] text-muted">
                          {client.firstName} {client.lastName}
                        </div>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap border-b border-[#eef1ef] px-[9px] py-3 text-xs last:border-0">{client.phone}</td>
                    <td className="whitespace-nowrap border-b border-[#eef1ef] px-[9px] py-3 text-xs last:border-0">{client.email || "—"}</td>
                    <td className="whitespace-nowrap border-b border-[#eef1ef] px-[9px] py-3 text-xs last:border-0">{client.city || "—"}</td>
                    <td className="whitespace-nowrap border-b border-[#eef1ef] px-[9px] py-3 text-xs last:border-0">{client._count.animals}</td>
                    <td className="whitespace-nowrap border-b border-[#eef1ef] px-[9px] py-3 text-xs last:border-0">
                      <span className={`inline-flex items-center rounded-full px-2 py-1 text-[10px] font-bold ${client.isActive ? "bg-[#e8f4ec] text-[#2f7657]" : "bg-[#eef1ef] text-[#67736b]"}`}>
                        {client.isActive ? "Aktivan" : "Arhiviran"}
                      </span>
                    </td>
                  </ClickableRow>
                ))}
              </tbody>
            </table>
          </div>
          </>
        ) : data ? (
          <div className="px-2.5 py-[23px] text-center text-xs text-muted">
            {filters.q ? "Nema klijenata koji odgovaraju pretrazi." : "Još nema registrovanih klijenata."}
          </div>
        ) : null}

        {data && pageCount > 1 ? (
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
