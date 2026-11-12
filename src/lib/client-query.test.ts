import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient } from "@tanstack/react-query";
import { clientKeys, clientListQuery, ClientListError, writeClient } from "../features/clients/queries.ts";

test("client list uses filter-specific keys and validates the server response", async () => {
  const originalFetch = globalThis.fetch;
  const requests: string[] = [];
  globalThis.fetch = async (input, init) => {
    requests.push(String(input));
    assert.equal(init?.cache, "no-store");
    return Response.json({ clients: [], total: 0, page: 1, pageCount: 1 });
  };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const active = { q: "", page: 1, status: "active" as const };
  const archived = { ...active, status: "archived" as const };
  try {
    await client.fetchQuery(clientListQuery(active));
    await client.fetchQuery(clientListQuery(archived));
    assert.equal(requests.length, 2);
    assert.notDeepEqual(clientKeys.list(active), clientKeys.list(archived));
    await client.invalidateQueries({ queryKey: clientKeys.lists(), refetchType: "none" });
    assert.equal(client.getQueryState(clientKeys.list(active))?.isInvalidated, true);
    assert.equal(client.getQueryState(clientKeys.list(archived))?.isInvalidated, true);
    globalThis.fetch = async () => Response.json({ clients: "invalid" });
    await assert.rejects(client.fetchQuery(clientListQuery(active)), /neispravne podatke/);
  } finally {
    client.clear();
    globalThis.fetch = originalFetch;
  }
});

test("client requests surface authorization, network, and write errors", async () => {
  const originalFetch = globalThis.fetch;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  try {
    globalThis.fetch = async () => Response.json({ error: "Potrebna je prijava." }, { status: 401 });
    await assert.rejects(
      client.fetchQuery(clientListQuery({ q: "", page: 1, status: "active" })),
      (error) => error instanceof ClientListError && error.status === 401,
    );
    globalThis.fetch = async () => Response.json({ error: "Klijent je arhiviran." }, { status: 400 });
    await assert.rejects(writeClient("/api/clients/id", "PUT", {}), /Klijent je arhiviran/);
    globalThis.fetch = async () => { throw new TypeError("network"); };
    await assert.rejects(writeClient("/api/clients", "POST", {}), /Nije moguće povezati/);
  } finally {
    client.clear();
    globalThis.fetch = originalFetch;
  }
});
