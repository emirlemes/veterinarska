import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient } from "@tanstack/react-query";
import { animalKeys, animalListQuery } from "../features/animals/queries.ts";
import { QueryHttpError } from "./query-http.ts";

test("animal list filters are part of the key and request and invalid responses are rejected", async () => {
  const originalFetch = globalThis.fetch;
  const requests: string[] = [];
  globalThis.fetch = async (input, init) => {
    requests.push(String(input));
    assert.equal(init?.cache, "no-store");
    return Response.json({ animals: [], total: 0, page: 1, pageCount: 1 });
  };
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const filters = { q: "cat", page: 1, status: "active" as const, species: "cat", ownerId: "owner-id" };
  try {
    await queryClient.fetchQuery(animalListQuery(filters));
    assert.ok(requests[0].includes("ownerId=owner-id"));
    assert.notDeepEqual(animalKeys.list(filters), animalKeys.list({ ...filters, ownerId: undefined }));
    await queryClient.invalidateQueries({ queryKey: animalKeys.lists(), refetchType: "none" });
    assert.equal(queryClient.getQueryState(animalKeys.list(filters))?.isInvalidated, true);
    globalThis.fetch = async () => Response.json({ animals: [{}], total: 1, page: 1, pageCount: 1 });
    await assert.rejects(queryClient.fetchQuery(animalListQuery(filters)), /neispravne podatke/);
    globalThis.fetch = async () => Response.json({}, { status: 403 });
    await assert.rejects(
      queryClient.fetchQuery(animalListQuery(filters)),
      (error) => error instanceof QueryHttpError && error.status === 403,
    );
  } finally {
    queryClient.clear();
    globalThis.fetch = originalFetch;
  }
});
