import { z } from "zod";
import { reportDateRangeSchema } from "@/features/reports/validation";

const optionalText = z.string().trim().max(240).optional().or(z.literal(""));
const positiveQuantity = z
  .string()
  .trim()
  .regex(/^\d{1,9}(?:\.\d{1,3})?$/, "Unesite količinu s najviše tri decimale.")
  .refine((value) => Number(value) > 0, "Količina mora biti veća od nule.");

export const inventoryListStatusSchema = z.enum(["all", "in-stock", "low", "out", "expiring"]);

export const medicationInputSchema = z.object({
  name: z.string().trim().min(1, "Unesite naziv lijeka.").max(180),
  activeIngredient: z.string().trim().max(180).optional().or(z.literal("")),
  form: z.string().trim().max(100).optional().or(z.literal("")),
  strength: z.string().trim().max(100).optional().or(z.literal("")),
  category: z.string().trim().max(100).optional().or(z.literal("")),
  manufacturer: z.string().trim().max(180).optional().or(z.literal("")),
  sellingPrice: z.string().trim().regex(/^\d{1,9}(?:\.\d{1,2})?$/, "Unesite ispravnu cijenu.").optional().or(z.literal("")),
  unit: z.string().trim().min(1, "Unesite jedinicu mjere.").max(40),
  minimumStock: z.string().trim().regex(/^\d{1,9}(?:\.\d{1,3})?$/).default("0"),
});

export const medicationBatchInputSchema = z.object({
  batchNumber: z.string().trim().min(1, "Unesite broj serije.").max(100),
  quantity: positiveQuantity,
  expiresAt: z.string().optional().or(z.literal("")),
  purchasePrice: z
    .string()
    .trim()
    .regex(/^\d{1,9}(?:\.\d{1,2})?$/, "Unesite ispravnu cijenu.")
    .optional()
    .or(z.literal("")),
  reason: optionalText,
});

export const stockAdjustmentSchema = z.object({
  direction: z.enum(["ADD", "REMOVE"]),
  quantity: positiveQuantity,
  reason: z.string().trim().min(1, "Unesite razlog korekcije.").max(240),
});

export const stockMovementReportQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  medicationId: z.union([z.literal("all"), z.string().uuid()]).default("all"),
  userId: z.union([z.literal("all"), z.string().uuid()]).default("all"),
  type: z.enum(["all", "RECEIPT", "ADMINISTRATION", "ADJUSTMENT", "REVERSAL"]).default("all"),
}).superRefine((value, context) => {
  const parsedRange = reportDateRangeSchema.safeParse({ from: value.from, to: value.to });
  if (!parsedRange.success) {
    for (const issue of parsedRange.error.issues) {
      context.addIssue({
        code: "custom",
        path: issue.path,
        message: issue.message,
      });
    }
  }
});

export function getMedicationStockState(
  quantity: number,
  minimumStock: number,
): "OUT_OF_STOCK" | "LOW_STOCK" | "IN_STOCK" {
  if (quantity <= 0) return "OUT_OF_STOCK";
  if (quantity <= minimumStock) return "LOW_STOCK";
  return "IN_STOCK";
}
