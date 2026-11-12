import type { Metadata } from "next";
import Link from "next/link";
import { Prisma } from "@prisma/client";
import { InventoryManager } from "@/components/inventory/inventory-manager";
import { hasPermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { getClinicDate } from "@/lib/dates";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Lijekovi i zalihe" };

export default async function InventoryPage() {
  const user = await requirePermission("medications:read");
  const today = getClinicDate();
  const medications = await prisma.medication.findMany({
    where: { isActive: true },
    include: {
      batches: {
        select: {
          id: true,
          batchNumber: true,
          expiresAt: true,
          quantityRemaining: true,
        },
        orderBy: [{ expiresAt: "asc" }, { createdAt: "asc" }],
      },
    },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
  const medicationData = medications.map((medication) => ({
    id: medication.id,
    name: medication.name,
    activeIngredient: medication.activeIngredient,
    form: medication.form,
    strength: medication.strength,
    unit: medication.unit,
    minimumStock: medication.minimumStock.toString(),
    quantity: medication.batches
      .reduce(
        (total, batch) => total.add(batch.quantityRemaining),
        new Prisma.Decimal(0),
      )
      .toString(),
    expiredQuantity: medication.batches
      .filter((batch) => batch.expiresAt !== null && batch.expiresAt.toISOString().slice(0, 10) < today)
      .reduce(
        (total, batch) => total.add(batch.quantityRemaining),
        new Prisma.Decimal(0),
      )
      .toString(),
    batches: medication.batches.map((batch) => ({
      id: batch.id,
      batchNumber: batch.batchNumber,
      expiresAt: batch.expiresAt?.toISOString().slice(0, 10) ?? null,
      quantityRemaining: batch.quantityRemaining.toString(),
      isExpired: batch.expiresAt !== null && batch.expiresAt.toISOString().slice(0, 10) < today,
    })),
  }));
  const canWrite = hasPermission(user.role, "inventory:write");

  return (
    <main className="mx-auto w-full max-w-[1440px] px-4 pb-8 pt-5 sm:px-[34px] sm:pb-[42px] sm:pt-[31px]">
      <div className="mb-5 flex flex-col gap-4 sm:mb-[25px] sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-[7px] text-[11px] font-[750] uppercase tracking-[0.7px] text-green">Ambulantna apoteka</p>
          <h1 className="m-0 text-[clamp(24px,3vw,30px)] tracking-[-0.9px]">Lijekovi i zalihe</h1>
          <p className="mt-2 text-sm text-muted">
            Evidencija lijekova, serija, rokova trajanja i trenutnih količina.
          </p>
        </div>
        {hasPermission(user.role, "reports:inventory") ? (
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-line bg-white px-4 text-sm font-bold text-[#53645a] hover:bg-[#f7faf8]"
            href="/reports/inventory"
          >
            Izvještaj zaliha
          </Link>
        ) : null}
      </div>
      <InventoryManager medications={medicationData} canWrite={canWrite} />
    </main>
  );
}
