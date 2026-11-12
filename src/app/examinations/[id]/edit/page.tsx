import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ExaminationForm } from "@/components/examinations/examination-form";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Uredi pregled" };

export default async function EditExaminationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission("examinations:write");
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const examination = await prisma.examination.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, firstName: true, lastName: true, companyName: true } },
      animal: { select: { id: true, name: true, species: true, ownerId: true } },
      veterinarian: { select: { id: true, firstName: true, lastName: true } },
    },
  });
  if (!examination || examination.status === "COMPLETED") notFound();

  return (
    <main className="mx-auto w-full max-w-[1440px] px-4 pb-8 pt-5 sm:px-[34px] sm:pb-[42px] sm:pt-[31px]">
      <div className="mb-5 sm:mb-[25px]">
        <p className="mb-[7px] text-[11px] font-[750] uppercase tracking-[0.7px] text-green">Medicinska evidencija</p>
        <h1 className="m-0 text-[clamp(24px,3vw,30px)] tracking-[-0.9px]">
          Uredi pregled: {examination.animal.name}
        </h1>
        <p className="mt-2 text-sm text-muted">Završen pregled nije moguće naknadno mijenjati.</p>
      </div>
      <ExaminationForm
        clients={[]}
        animals={[]}
        veterinarians={[examination.veterinarian]}
        examination={examination}
        currentUserId={user.id}
      />
      <div className="mt-3 max-w-[820px]">
        <Link
          className="text-sm font-semibold text-green-dark underline-offset-2 hover:underline"
          href={`/examinations/${examination.id}`}
        >
          Pregled detalja
        </Link>
      </div>
    </main>
  );
}
