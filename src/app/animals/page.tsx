import type { Metadata } from "next";
import { AnimalList } from "@/components/animals/animal-list";
import { animalListQuerySchema } from "@/features/animals/validation";
import { hasPermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";

export const metadata: Metadata = { title: "Životinje" };

export default async function AnimalsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; status?: string; species?: string; ownerId?: string }>;
}) {
  const user = await requirePermission("animals:read");
  const parsed = animalListQuerySchema.safeParse(await searchParams);
  const filters = parsed.success
    ? parsed.data
    : { q: "", page: 1, status: "active" as const, species: "" };

  return <AnimalList filters={filters} canWrite={hasPermission(user.role, "animals:write")} invalidFilters={!parsed.success} />;
}
