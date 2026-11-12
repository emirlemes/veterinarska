import assert from "node:assert/strict";
import test from "node:test";
import { MutationObserver, onlineManager } from "@tanstack/react-query";
import { createQueryClient } from "../components/query-provider.tsx";

test("offline mutations fail immediately rather than being queued for a later connection", async () => {
  const client = createQueryClient();
  onlineManager.setOnline(false);
  let attempts = 0;
  const mutation = new MutationObserver(client, {
    mutationFn: async () => {
      attempts++;
      throw new Error("offline");
    },
  });
  try {
    await assert.rejects(mutation.mutate(), /offline/);
    assert.equal(attempts, 1);
    assert.equal(mutation.getCurrentResult().isPaused, false);
  } finally {
    client.clear();
    onlineManager.setOnline(undefined);
  }
});
