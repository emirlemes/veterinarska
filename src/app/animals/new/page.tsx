import type { Metadata } from "next";
import Link from "next/link";
import { AnimalForm } from "@/components/animals/animal-form";
import { hasPermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Nova životinja" };

export default async function NewAnimalPage() {
  const user = await requirePermission("animals:write");
  const owners = await prisma.client.findMany({
    where: { isActive: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: { id: true, firstName: true, lastName: true, companyName: true, isActive: true },
  });
  const canCreateOwner = hasPermission(user.role, "clients:write");

  return (
    <main className="mx-auto w-full max-w-[1440px] px-[34px] pb-[42px] pt-[31px] max-[820px]:px-[21px] max-[640px]:px-[14px] max-[640px]:pb-[30px] max-[640px]:pt-[22px]">
      <div className="mb-[25px] flex items-end justify-between gap-5 max-[640px]:flex-col max-[640px]:items-stretch">
        <div>
          <p className="mb-[7px] text-[11px] font-[750] uppercase tracking-[0.7px] text-green">Registar životinja</p>
          <h1 className="m-0 text-[clamp(24px,3vw,30px)] tracking-[-0.9px]">Nova životinja</h1>
          <p className="mt-2 text-muted">Unesite podatke o životinji i odaberite aktivnog vlasnika.</p>
        </div>
        <Link className="inline-flex min-h-11 w-full items-center justify-center whitespace-nowrap rounded-[7px] border border-line bg-white px-[13px] text-sm font-bold text-[#53645a] hover:bg-[#f7faf8] sm:w-auto" href="/animals">Nazad na listu</Link>
      </div>
      {!owners.length ? (
        <section className="min-w-0 rounded-[11px] border border-line bg-white p-[18px_19px] text-center text-xs text-muted shadow-[0_2px_6px_rgb(34_62_47_/_2%)]">
          <p className="mb-5">Za unos životinje prvo je potrebno evidentirati aktivnog klijenta.</p>
          {canCreateOwner ? <Link className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-[7px] border border-transparent bg-green px-[13px] text-sm font-bold text-white hover:bg-green-dark" href="/clients/new">+ Novi klijent</Link> : null}
        </section>
      ) : (
        <AnimalForm
          owners={owners}
          canWriteMedical={hasPermission(user.role, "examinations:write")}
        />
      )}
    </main>
  );
}
