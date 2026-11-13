import { getMedicationStockState, inventoryListStatusSchema } from "./validation";
import type { z } from "zod";

export type InventoryStatus = z.infer<typeof inventoryListStatusSchema>;

export type InventoryListItem = {
  id: string;
  name: string;
  activeIngredient: string | null;
  form: string | null;
  strength: string | null;
  category: string | null;
  manufacturer: string | null;
  sellingPrice: string | null;
  unit: string;
  minimumStock: string;
  quantity: string;
  expiredQuantity: string;
  availableQuantity: string;
  batches: {
    id: string;
    batchNumber: string;
    expiresAt: string | null;
    quantityRemaining: string;
    isExpired: boolean;
  }[];
};

export function getInventoryListDetails(medication: InventoryListItem, today: string) {
  const limit = new Date(`${today}T00:00:00.000Z`);
  limit.setUTCDate(limit.getUTCDate() + 90);
  const expiryLimit = limit.toISOString().slice(0, 10);
  const expiries = medication.batches
    .filter((batch) => Number(batch.quantityRemaining) > 0 && batch.expiresAt !== null && batch.expiresAt >= today)
    .map((batch) => batch.expiresAt)
    .filter((date): date is string => date !== null)
    .sort();
  const available = Number(medication.availableQuantity);
  return {
    state: getMedicationStockState(available, Number(medication.minimumStock)),
    low: available <= Number(medication.minimumStock),
    nearestExpiry: expiries[0] ?? null,
    expiring: expiries.some((date) => date <= expiryLimit),
  };
}

export function matchesInventoryStatus(details: ReturnType<typeof getInventoryListDetails>, status: InventoryStatus) {
  switch (status) {
    case "in-stock": return details.state === "IN_STOCK" || details.state === "LOW_STOCK";
    case "low": return details.low;
    case "out": return details.state === "OUT_OF_STOCK";
    case "expiring": return details.expiring;
    case "all": return true;
  }
}

export function selectInventoryPage(
  items: { medication: InventoryListItem; details: ReturnType<typeof getInventoryListDetails> }[],
  options: { status: InventoryStatus; search: string; category: string; sort: "name" | "quantity"; page: number; pageSize: number },
) {
  const search = options.search.trim().toLocaleLowerCase("bs");
  const filtered = items
    .filter(({ medication, details }) =>
      matchesInventoryStatus(details, options.status) &&
      (!options.category || medication.category === options.category) &&
      [medication.name, medication.activeIngredient, medication.manufacturer].some((value) =>
        value?.toLocaleLowerCase("bs").includes(search),
      ),
    )
    .sort((a, b) => options.sort === "quantity"
      ? Number(a.medication.availableQuantity) - Number(b.medication.availableQuantity) || a.medication.name.localeCompare(b.medication.name, "bs")
      : a.medication.name.localeCompare(b.medication.name, "bs"));
  const pageCount = Math.max(1, Math.ceil(filtered.length / options.pageSize));
  const page = Math.max(1, Math.min(options.page, pageCount));
  return {
    items: filtered.slice((page - 1) * options.pageSize, page * options.pageSize),
    page,
    pageCount,
    total: filtered.length,
  };
}
