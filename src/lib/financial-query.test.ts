import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient } from "@tanstack/react-query";
import { Prisma } from "@prisma/client";
import { financialReportKeys, financialReportQuery } from "../features/reports/financial-query.ts";
import { calculateFinancialTotals } from "../features/reports/financial-totals.ts";
import { QueryHttpError } from "./query-http.ts";

test("financial totals preserve decimal payment reversals and never subtract overpayments from outstanding", () => {
  const decimal = (value: string) => new Prisma.Decimal(value);
  const totals = calculateFinancialTotals({
    paymentTotal: decimal("42.23"),
    reversalTotal: decimal("2.11"),
    invoiceTotal: decimal("180"),
    now: new Date("2026-11-12T12:00:00Z"),
    outstandingInvoices: [
      {
        total: decimal("100"),
        dueAt: new Date("2026-11-11T12:00:00Z"),
        payments: [{ amount: decimal("30"), reversals: [{ amount: decimal("2.11") }] }],
      },
      {
        total: decimal("80"),
        dueAt: new Date("2026-11-13T12:00:00Z"),
        payments: [{ amount: decimal("90"), reversals: [] }],
      },
    ],
  });
  assert.deepEqual(totals, {
    collected: "40.12", issuedTotal: "180", outstanding: "72.11", overdueCount: 1,
  });
});

test("financial query separates periods and rejects malformed or unauthorized responses", async () => {
  const originalFetch = globalThis.fetch;
  const requests: string[] = [];
  globalThis.fetch = async (input, init) => {
    requests.push(String(input));
    assert.equal(init?.cache, "no-store");
    return Response.json({
      invoices: [], collected: "12.34", paymentCount: 1, issuedTotal: "20",
      invoiceCount: 1, outstanding: "7.66", overdueCount: 0,
    });
  };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const range = { from: "2026-11-01", to: "2026-11-12" };
  try {
    const data = await client.fetchQuery(financialReportQuery(range));
    assert.equal(data.collected, "12.34");
    assert.ok(requests[0].includes("from=2026-11-01"));
    assert.notDeepEqual(financialReportKeys.range(range), financialReportKeys.range({ ...range, to: "2026-11-13" }));
    globalThis.fetch = async () => Response.json({
      invoices: [], collected: "not money", paymentCount: 1, issuedTotal: "20",
      invoiceCount: 1, outstanding: "7.66", overdueCount: 0,
    });
    await assert.rejects(client.fetchQuery(financialReportQuery(range)), /neispravan finansijski izvještaj/);
    globalThis.fetch = async () => Response.json({}, { status: 401 });
    await assert.rejects(client.fetchQuery(financialReportQuery(range)), (error) => error instanceof QueryHttpError && error.status === 401);
  } finally {
    client.clear();
    globalThis.fetch = originalFetch;
  }
});
