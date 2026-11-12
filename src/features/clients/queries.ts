import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { QueryHttpError, readJson, writeJson } from "../../lib/query-http";
import type { clientListQuerySchema } from "./validation";

export type ClientFilters = z.infer<typeof clientListQuerySchema>;

const clientListSchema = z.object({
  clients: z.array(z.object({
    id: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    companyName: z.string().nullable(),
    phone: z.string(),
    email: z.string().nullable(),
    city: z.string().nullable(),
    isActive: z.boolean(),
    _count: z.object({ animals: z.number().int().nonnegative() }),
  })),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageCount: z.number().int().positive(),
});

export type ClientList = z.infer<typeof clientListSchema>;

export const clientKeys = {
  all: ["clients"] as const,
  lists: () => [...clientKeys.all, "list"] as const,
  list: (filters: ClientFilters) => [...clientKeys.lists(), filters] as const,
};

export { QueryHttpError as ClientListError };
export const writeClient = writeJson;

export function clientListQuery(filters: ClientFilters) {
  return queryOptions({
    queryKey: clientKeys.list(filters),
    queryFn: async ({ signal }): Promise<ClientList> => {
      const params = new URLSearchParams({
        q: filters.q,
        page: String(filters.page),
        status: filters.status,
      });
      return readJson(`/api/clients?${params}`, signal, clientListSchema, {
        load: "Nije moguće učitati klijente. Pokušajte ponovo.",
        invalid: "Server je vratio neispravne podatke o klijentima.",
      });
    },
  });
}
