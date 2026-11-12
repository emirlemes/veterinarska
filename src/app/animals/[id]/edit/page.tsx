import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AnimalForm } from "@/components/animals/animal-form";
import { hasPermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Uredi životinju" };

export default async function EditAnimalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission("animals:write");
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();

  const animal = await prisma.animal.findUnique({ where: { id } });
  if (!animal) notFound();
  const owners = await prisma.client.findMany({
    where: { OR: [{ isActive: true }, { id: animal.ownerId }] },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: { id: true, firstName: true, lastName: true, companyName: true, isActive: true },
  });

  return (
    <main className="mx-auto w-full max-w-[1440px] px-[34px] pb-[42px] pt-[31px] max-[820px]:px-[21px] max-[640px]:px-[14px] max-[640px]:pb-[30px] max-[640px]:pt-[22px]">
      <div className="mb-[25px] flex items-end justify-between gap-5 max-[640px]:flex-col max-[640px]:items-stretch">
        <div>
          <p className="mb-[7px] text-[11px] font-[750] uppercase tracking-[0.7px] text-green">Registar životinja</p>
          <h1 className="m-0 text-[clamp(24px,3vw,30px)] tracking-[-0.9px]">Uredi {animal.name}</h1>
          <p className="mt-2 text-muted">Promjena vlasnika će biti zabilježena u historiji.</p>
        </div>
        <Link className="inline-flex min-h-11 w-full items-center justify-center whitespace-nowrap rounded-[7px] border border-line bg-white px-[13px] text-sm font-bold text-[#53645a] hover:bg-[#f7faf8] sm:w-auto" href={`/animals/${animal.id}`}>Nazad na profil</Link>
      </div>
      <AnimalForm
        animal={{
          ...animal,
          dateOfBirth: animal.dateOfBirth?.toISOString().slice(0, 10) ?? "",
          weightKg: animal.weightKg?.toString() ?? "",
        }}
        owners={owners}
        canWriteMedical={hasPermission(user.role, "examinations:write")}
      />
    </main>
  );
}
