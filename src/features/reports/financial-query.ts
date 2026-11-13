import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { readJson } from "../../lib/query-http";

export type FinancialRange = { from: string; to: string };

const money = z.string().regex(/^-?\d+(?:\.\d+)?$/);

const financialReportSchema = z.object({
  invoices: z.array(z.object({
    id: z.string(),
    invoiceNumber: z.string(),
    total: money,
    issuedAt: z.string().datetime().nullable(),
    status: z.enum(["DRAFT", "ISSUED", "PARTIALLY_PAID", "PAID", "VOID"]),
    client: z.object({
      firstName: z.string(),
      lastName: z.string(),
      companyName: z.string().nullable(),
    }),
  })),
  collected: money,
  paymentCount: z.number().int().nonnegative(),
  paymentEntries: z.array(z.object({
    id: z.string(),
    paidAt: z.string().datetime(),
    amount: money,
    method: z.enum(["CASH", "CARD", "BANK_TRANSFER", "OTHER"]),
    invoice: z.object({
      id: z.string(),
      invoiceNumber: z.string(),
      client: z.object({ firstName: z.string(), lastName: z.string(), companyName: z.string().nullable() }),
    }),
  })),
  issuedTotal: money,
  invoiceCount: z.number().int().nonnegative(),
  outstanding: money,
  overdueCount: z.number().int().nonnegative(),
});

export const financialReportKeys = {
  all: ["reports", "financial"] as const,
  range: (range: FinancialRange) => [...financialReportKeys.all, range] as const,
};

export function financialReportQuery(range: FinancialRange) {
  return queryOptions({
    queryKey: financialReportKeys.range(range),
    queryFn: ({ signal }) => readJson(
      `/api/reports/financial/summary?${new URLSearchParams(range)}`,
      signal,
      financialReportSchema,
      {
        load: "Nije moguće učitati finansijski izvještaj. Pokušajte ponovo.",
        invalid: "Server je vratio neispravan finansijski izvještaj.",
      },
    ),
  });
}
