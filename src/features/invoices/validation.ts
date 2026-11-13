import { z } from "zod";

const money = z
  .string()
  .trim()
  .regex(/^\d{1,9}(?:\.\d{1,2})?$/, "Unesite iznos s najviše dvije decimale.");

export const invoiceListQuerySchema = z.object({
  status: z.enum(["all", "unpaid"]).default("all"),
});

export const invoiceInputSchema = z.object({
  clientId: z.string().uuid(),
  examinationId: z.string().uuid().optional().or(z.literal("")),
  taxRate: z.string().trim().regex(/^\d{1,3}(?:\.\d{1,2})?$/).default("0"),
  dueAt: z.string().optional().or(z.literal("")),
  notes: z.string().trim().max(10000).optional().or(z.literal("")),
  items: z.array(z.object({
    serviceId: z.string().uuid().optional().or(z.literal("")),
    description: z.string().trim().min(1, "Unesite opis stavke.").max(240),
    quantity: z.string().trim().regex(/^\d{1,7}(?:\.\d{1,2})?$/).refine((value) => Number(value) > 0),
    unitPrice: money,
  })).min(1, "Račun mora imati najmanje jednu stavku.").max(100),
}).superRefine((value, context) => {
  if (Number(value.taxRate) > 100) {
    context.addIssue({ code: "custom", path: ["taxRate"], message: "Porezna stopa ne može biti veća od 100%." });
  }
});

export const paymentInputSchema = z.object({
  amount: money.refine((value) => Number(value) > 0, "Iznos uplate mora biti veći od nule."),
  method: z.enum(["CASH", "CARD", "BANK_TRANSFER", "OTHER"]),
  reference: z.string().trim().max(120).optional().or(z.literal("")),
});

export const paymentReversalInputSchema = z.object({
  amount: money.refine((value) => Number(value) > 0, "Iznos storna mora biti veći od nule."),
  reason: z.string().trim().min(1, "Unesite razlog storna.").max(240),
});

export const invoiceVoidInputSchema = z.object({
  reason: z.string().trim().min(1, "Unesite razlog storna računa.").max(240),
});

export function calculateInvoiceTotals(
  items: { quantity: string; unitPrice: string }[],
  taxRate: string,
) {
  const subtotalCents = items.reduce(
    (total, item) => total + Math.round(Number(item.quantity) * Number(item.unitPrice) * 100),
    0,
  );
  const taxAmountCents = Math.round(subtotalCents * Number(taxRate) / 100);
  return {
    subtotalCents,
    taxAmountCents,
    totalCents: subtotalCents + taxAmountCents,
  };
}

export function getInvoiceStatus(totalCents: number, paidCents: number) {
  if (paidCents >= totalCents) return "PAID" as const;
  if (paidCents > 0) return "PARTIALLY_PAID" as const;
  return "ISSUED" as const;
}
