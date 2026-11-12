import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/db";
import { ClientForm } from "@/components/clients/client-form";

export const metadata: Metadata = {
  title: "Uredi klijenta",
};

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("clients:write");
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const client = await prisma.client.findUnique({ where: { id } });

  if (!client || !client.isActive) notFound();

  return (
    <main className="mx-auto w-full max-w-[1440px] px-[34px] pb-[42px] pt-[31px] max-[820px]:px-[21px] max-[640px]:px-[14px] max-[640px]:pb-[30px] max-[640px]:pt-[22px]">
      <div className="mb-[25px] flex items-end justify-between gap-5 max-[640px]:flex-col max-[640px]:items-stretch">
        <div>
          <p className="mb-[7px] text-[11px] font-[750] uppercase tracking-[0.7px] text-green">Registar klijenata</p>
          <h1 className="m-0 text-[clamp(24px,3vw,30px)] tracking-[-0.9px]">Uredi klijenta</h1>
          <p className="mt-2 text-muted">
            {client.firstName} {client.lastName}
          </p>
        </div>
        <Link className="inline-flex min-h-11 w-full items-center justify-center whitespace-nowrap rounded-[7px] border border-line bg-white px-[13px] text-sm font-bold text-[#53645a] hover:bg-[#f7faf8] sm:w-auto" href={`/clients/${client.id}`}>Nazad na profil</Link>
      </div>
      <ClientForm
        client={{
          id: client.id,
          firstName: client.firstName,
          lastName: client.lastName,
          companyName: client.companyName,
          phone: client.phone,
          email: client.email,
          address: client.address,
          city: client.city,
          postalCode: client.postalCode,
          notes: client.notes,
        }}
      />
    </main>
  );
}
