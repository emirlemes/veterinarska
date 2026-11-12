import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { readJson, writeJson } from "../../lib/query-http";
import type { animalListQuerySchema } from "./validation";

export type AnimalFilters = z.infer<typeof animalListQuerySchema>;

const animalListSchema = z.object({
  animals: z.array(z.object({
    id: z.string(),
    name: z.string(),
    species: z.string(),
    breed: z.string().nullable(),
    sex: z.string().nullable(),
    microchipNumber: z.string().nullable(),
    status: z.enum(["ACTIVE", "DECEASED", "INACTIVE"]),
    owner: z.object({
      id: z.string(),
      firstName: z.string(),
      lastName: z.string(),
      companyName: z.string().nullable(),
      phone: z.string(),
    }),
  })),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageCount: z.number().int().positive(),
});

export const animalKeys = {
  all: ["animals"] as const,
  lists: () => [...animalKeys.all, "list"] as const,
  list: (filters: AnimalFilters) => [...animalKeys.lists(), filters] as const,
};

export function animalListQuery(filters: AnimalFilters) {
  return queryOptions({
    queryKey: animalKeys.list(filters),
    queryFn: ({ signal }) => {
      const params = new URLSearchParams({
        q: filters.q,
        page: String(filters.page),
        status: filters.status,
        species: filters.species,
      });
      if (filters.ownerId) params.set("ownerId", filters.ownerId);
      return readJson(`/api/animals?${params}`, signal, animalListSchema, {
        load: "Nije moguće učitati životinje. Pokušajte ponovo.",
        invalid: "Server je vratio neispravne podatke o životinjama.",
      });
    },
  });
}

export const writeAnimal = writeJson;
