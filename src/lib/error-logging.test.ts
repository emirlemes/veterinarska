import assert from "node:assert/strict";
import test from "node:test";
import { logError, withFetchErrorLogging } from "./error-logging.ts";

test("error logging is opt-in and does not change fetch results or failures", async () => {
  const originalFlag = process.env.NEXT_PUBLIC_ERROR_LOGGING;
  const originalLog = console.log;
  const entries: unknown[][] = [];
  console.log = (...args: unknown[]) => { entries.push(args); };

  try {
    const response = new Response(null, { status: 400 });
    const failedRequest: typeof fetch = async () => response;
    const failure = new Error("network failure");
    const rejectedRequest: typeof fetch = async () => { throw failure; };

    process.env.NEXT_PUBLIC_ERROR_LOGGING = "false";
    logError("test", failure);
    assert.equal(await withFetchErrorLogging(failedRequest)("/test"), response);
    await assert.rejects(withFetchErrorLogging(rejectedRequest)("/test"), (error) => error === failure);
    assert.equal(entries.length, 0);

    process.env.NEXT_PUBLIC_ERROR_LOGGING = "true";
    logError("test", failure);
    assert.equal(await withFetchErrorLogging(failedRequest)("/test"), response);
    await assert.rejects(withFetchErrorLogging(rejectedRequest)("/test"), (error) => error === failure);
    assert.equal(entries.length, 3);
    assert.deepEqual(entries[1][1], { status: 400 });
    assert.equal(entries[2][1], failure);

    const success = new Response(null, { status: 200 });
    const successfulRequest: typeof fetch = async () => success;
    assert.equal(await withFetchErrorLogging(successfulRequest)("/test"), success);
    assert.equal(entries.length, 3);
  } finally {
    console.log = originalLog;
    if (originalFlag === undefined) delete process.env.NEXT_PUBLIC_ERROR_LOGGING;
    else process.env.NEXT_PUBLIC_ERROR_LOGGING = originalFlag;
  }
});

test("browser instrumentation reports unhandled errors and failed requests", async () => {
  const originalFlag = process.env.NEXT_PUBLIC_ERROR_LOGGING;
  const originalLog = console.log;
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const entries: unknown[][] = [];
  const browser = Object.assign(new EventTarget(), {
    fetch: async () => new Response(null, { status: 503 }),
  });
  console.log = (...args: unknown[]) => { entries.push(args); };
  process.env.NEXT_PUBLIC_ERROR_LOGGING = "true";
  Object.defineProperty(globalThis, "window", { value: browser, configurable: true });

  try {
    await import("../instrumentation-client.ts");
    const failure = new Error("test failure");
    browser.dispatchEvent(Object.assign(new Event("error"), { error: failure }));
    browser.dispatchEvent(Object.assign(new Event("unhandledrejection"), { reason: failure }));
    const response = await browser.fetch();

    assert.equal(response.status, 503);
    assert.equal(entries.length, 3);
    assert.equal(entries[0][1], failure);
    assert.equal(entries[1][1], failure);
    assert.deepEqual(entries[2][1], { status: 503 });
  } finally {
    console.log = originalLog;
    if (originalFlag === undefined) delete process.env.NEXT_PUBLIC_ERROR_LOGGING;
    else process.env.NEXT_PUBLIC_ERROR_LOGGING = originalFlag;
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
