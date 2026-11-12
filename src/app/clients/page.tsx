import type { Metadata } from "next";
import { ClientList } from "@/components/clients/client-list";
import { clientListQuerySchema } from "@/features/clients/validation";
import { hasPermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";

export const metadata: Metadata = { title: "Klijenti" };

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; status?: string }>;
}) {
  const user = await requirePermission("clients:read");
  const parsed = clientListQuerySchema.safeParse(await searchParams);
  const filters = parsed.success
    ? parsed.data
    : { q: "", page: 1, status: "active" as const };

  return <ClientList filters={filters} canWrite={hasPermission(user.role, "clients:write")} invalidFilters={!parsed.success} />;
}
