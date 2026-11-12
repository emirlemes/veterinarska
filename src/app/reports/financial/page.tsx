import type { Metadata } from "next";
import { FinancialReport } from "@/components/reports/financial-report";
import { reportDateRangeSchema } from "@/features/reports/validation";
import { requirePermission } from "@/lib/auth/require-permission";
import { getClinicDate } from "@/lib/dates";

export const metadata: Metadata = { title: "Finansijski izvještaj" };

export default async function FinancialReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await requirePermission("reports:financial");
  const params = await searchParams;
  const today = getClinicDate();
  const defaults = { from: `${today.slice(0, 7)}-01`, to: today };
  const parsed = reportDateRangeSchema.safeParse({
    from: params.from ?? defaults.from,
    to: params.to ?? defaults.to,
  });
  return <FinancialReport range={parsed.success ? parsed.data : defaults} invalidRange={!parsed.success} />;
}
