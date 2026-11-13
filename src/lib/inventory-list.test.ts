import assert from "node:assert/strict";
import test from "node:test";
import { getInventoryListDetails, matchesInventoryStatus, selectInventoryPage, type InventoryListItem } from "../features/inventory/list.ts";
import { invoiceListQuerySchema } from "../features/invoices/validation.ts";
import { medicationInputSchema } from "../features/inventory/validation.ts";

test("inventory filters exclude expired and empty batches and include the 90-day boundary", () => {
  const medication: InventoryListItem = {
    id: "m", name: "Lijek", activeIngredient: null, form: null, strength: null, unit: "kom",
    category: null, manufacturer: null, sellingPrice: null, minimumStock: "5", quantity: "16", expiredQuantity: "10", availableQuantity: "6",
    batches: [
      { id: "a", batchNumber: "A", expiresAt: "2026-11-12", quantityRemaining: "10", isExpired: true },
      { id: "b", batchNumber: "B", expiresAt: "2026-11-13", quantityRemaining: "0", isExpired: false },
      { id: "c", batchNumber: "C", expiresAt: "2027-02-11", quantityRemaining: "6", isExpired: false },
    ],
  };
  const details = getInventoryListDetails(medication, "2026-11-13");
  assert.equal(details.nearestExpiry, "2027-02-11");
  assert.equal(details.expiring, true);
  assert.equal(matchesInventoryStatus(details, "in-stock"), true);
  assert.equal(matchesInventoryStatus(details, "low"), false);
  medication.availableQuantity = "0";
  medication.batches[2].quantityRemaining = "0";
  const empty = getInventoryListDetails(medication, "2026-11-13");
  assert.equal(empty.nearestExpiry, null);
  assert.equal(matchesInventoryStatus(empty, "out"), true);
  assert.equal(matchesInventoryStatus(empty, "low"), true);
  assert.equal(matchesInventoryStatus(empty, "expiring"), false);
});

test("invoice list accepts the dashboard unpaid filter and rejects unknown values", () => {
  assert.equal(invoiceListQuerySchema.parse({ status: "unpaid" }).status, "unpaid");
  assert.equal(invoiceListQuerySchema.safeParse({ status: "other" }).success, false);
});

test("medication metadata permits unknown prices but rejects invalid selling prices", () => {
  const medication = { name: "Lijek", unit: "kom", category: "Terapija", manufacturer: "Proizvođač" };
  assert.equal(medicationInputSchema.safeParse({ ...medication, sellingPrice: "" }).success, true);
  assert.equal(medicationInputSchema.safeParse({ ...medication, sellingPrice: "12.35" }).success, true);
  assert.equal(medicationInputSchema.safeParse({ ...medication, sellingPrice: "-1" }).success, false);
  assert.equal(medicationInputSchema.safeParse({ ...medication, sellingPrice: "2.123" }).success, false);
});

test("inventory search, stock filtering, sorting and pagination operate on the complete list", () => {
  const make = (name: string, quantity: string): InventoryListItem => ({
    id: name, name, activeIngredient: "supstanca", form: null, strength: null, unit: "kom",
    category: "Terapija", manufacturer: "Proizvođač", sellingPrice: "12.5",
    minimumStock: "2", quantity, availableQuantity: quantity, expiredQuantity: "0", batches: [],
  });
  const items = [make("Beta", "1"), make("Alfa", "2"), make("Gama", "3")].map((medication) => ({
    medication, details: getInventoryListDetails(medication, "2026-11-13"),
  }));
  const result = selectInventoryPage(items, { status: "low", search: "PROIZVOĐAČ", category: "Terapija", sort: "quantity", page: 2, pageSize: 1 });
  assert.equal(result.total, 2);
  assert.equal(result.pageCount, 2);
  assert.equal(result.items[0].medication.name, "Alfa");
  assert.equal(selectInventoryPage(items, { status: "all", search: "nepostoji", category: "", sort: "name", page: 9, pageSize: 20 }).page, 1);
  assert.equal(selectInventoryPage(items, { status: "all", search: "", category: "Drugo", sort: "name", page: 1, pageSize: 20 }).total, 0);
});
