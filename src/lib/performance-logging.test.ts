import assert from "node:assert/strict";
import test from "node:test";
import { getRscTiming, startPerformanceLogging } from "./performance-logging.ts";

test("RSC timing reports only a known section and milliseconds, not IDs or search terms", () => {
  assert.deepEqual(getRscTiming({
    name: "https://example.test/clients/private-id?q=private&_rsc=token",
    initiatorType: "fetch",
    startTime: 50,
    responseStart: 140.4,
    duration: 123.6,
  }, "https://example.test"), {
    section: "/clients",
    firstByteMs: 90,
    totalMs: 124,
  });
  assert.deepEqual(getRscTiming({
    name: "https://example.test/private-name?_rsc=token",
    initiatorType: "fetch",
    startTime: 0,
    responseStart: 0,
    duration: 10,
  }, "https://example.test"), {
    section: "/other",
    firstByteMs: null,
    totalMs: 10,
  });
});

test("RSC timing ignores unrelated, cross-origin and non-fetch resources", () => {
  const timing = { startTime: 0, responseStart: 1, duration: 2, initiatorType: "fetch" };
  assert.equal(getRscTiming({ ...timing, name: "https://example.test/api/clients" }, "https://example.test"), null);
  assert.equal(getRscTiming({ ...timing, name: "https://other.test/clients?_rsc=token" }, "https://example.test"), null);
  assert.equal(getRscTiming({ ...timing, name: "https://example.test/clients?_rsc=token", initiatorType: "img" }, "https://example.test"), null);
});

test("browser observer logs the initial load and buffered RSC timings", () => {
  const keys = ["window", "document", "performance", "PerformanceObserver"] as const;
  const originals = keys.map((key) => Object.getOwnPropertyDescriptor(globalThis, key));
  const originalLog = console.log;
  const entries: unknown[][] = [];
  let observedOptions: unknown;

  class Observer {
    constructor(private callback: (list: { getEntries: () => object[] }) => void) {}
    observe(options: unknown) {
      observedOptions = options;
      this.callback({ getEntries: () => [{
        name: "https://example.test/inventory?_rsc=token",
        initiatorType: "fetch",
        startTime: 10,
        responseStart: 80,
        duration: 100,
      }] });
    }
  }

  console.log = (...args: unknown[]) => { entries.push(args); };
  Object.defineProperty(globalThis, "window", {
    value: { PerformanceObserver: Observer, location: { origin: "https://example.test" } },
    configurable: true,
  });
  Object.defineProperty(globalThis, "PerformanceObserver", { value: Observer, configurable: true });
  Object.defineProperty(globalThis, "document", { value: { readyState: "complete" }, configurable: true });
  Object.defineProperty(globalThis, "performance", {
    value: { getEntriesByType: () => [{ startTime: 0, responseStart: 50, loadEventEnd: 120 }] },
    configurable: true,
  });

  try {
    startPerformanceLogging();
    assert.deepEqual(observedOptions, { type: "resource", buffered: true });
    assert.deepEqual(entries, [
      ["[VetCare performance] Initial page load", { firstByteMs: 50, loadMs: 120 }],
      ["[VetCare performance] RSC request", { section: "/inventory", firstByteMs: 70, totalMs: 100 }],
    ]);
  } finally {
    console.log = originalLog;
    keys.forEach((key, index) => {
      const original = originals[index];
      if (original) Object.defineProperty(globalThis, key, original);
      else Reflect.deleteProperty(globalThis, key);
    });
  }
});
