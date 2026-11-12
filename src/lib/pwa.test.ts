import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";

type WorkerEvent = {
  request?: WorkerRequest;
  waitUntil: (promise: Promise<unknown>) => void;
  respondWith: (response: Promise<Response>) => void;
};

type WorkerRequest = {
  url: string;
  method: string;
  mode: string;
};

async function loadServiceWorker({
  fetchRequest = async () => new Response("online"),
  offlineResponse = new Response("offline"),
}: {
  fetchRequest?: (request: WorkerRequest) => Promise<Response>;
  offlineResponse?: Response;
} = {}) {
  const source = await readFile(new URL("../../public/sw.js", import.meta.url), "utf8");
  const listeners = new Map<string, (event: WorkerEvent) => void>();
  const addedShell: string[] = [];
  const matchedUrls: string[] = [];
  let skipWaitingCalled = false;
  let cachePutCalled = false;
  const cache = {
    addAll: async (urls: string[]) => addedShell.push(...urls),
    match: async (request: string | WorkerRequest | URL) => {
      matchedUrls.push(typeof request === "string" ? request : request.toString());
      return offlineResponse;
    },
    put: async () => {
      cachePutCalled = true;
    },
  };
  const self = {
    location: { origin: "https://vetcare.example" },
    addEventListener: (name: string, handler: (event: WorkerEvent) => void) => listeners.set(name, handler),
    clients: { claim: async () => {} },
    skipWaiting: async () => {
      skipWaitingCalled = true;
    },
  };
  const caches = {
    open: async () => cache,
    keys: async () => ["vetcare-shell-v1"],
    delete: async () => true,
  };

  runInNewContext(source, { self, caches, fetch: fetchRequest, URL, Response });

  return {
    listeners,
    addedShell,
    matchedUrls,
    get skipWaitingCalled() {
      return skipWaitingCalled;
    },
    get cachePutCalled() {
      return cachePutCalled;
    },
  };
}

function createRequest(url: string, method = "GET", mode = "cors"): WorkerRequest {
  return { url, method, mode };
}

function createEvent(request: WorkerRequest): WorkerEvent & { response?: Promise<Response> } {
  return {
    request,
    waitUntil() {},
    respondWith(response) {
      this.response = response;
    },
  };
}

test("PWA service worker installs only the static shell and offline page", async () => {
  const worker = await loadServiceWorker();
  const installEvent: WorkerEvent = {
    waitUntil(promise) {
      this.installation = promise;
    },
    respondWith() {},
  } as WorkerEvent & { installation?: Promise<unknown> };

  worker.listeners.get("install")?.(installEvent);
  await (installEvent as WorkerEvent & { installation: Promise<unknown> }).installation;

  assert(worker.skipWaitingCalled);
  assert(worker.addedShell.includes("/offline.html"));
  assert(worker.addedShell.includes("/icons/icon-192.png"));
  assert.equal(worker.addedShell.some((url) => url.startsWith("/api/")), false);
});

test("PWA service worker never intercepts APIs, assets or cross-origin requests", async () => {
  const worker = await loadServiceWorker();
  const requests = [
    createRequest("https://vetcare.example/api/examinations"),
    createRequest("https://vetcare.example/examinations/123"),
    createRequest("https://external.example/page", "GET", "navigate"),
    createRequest("https://vetcare.example/api/examinations", "POST"),
  ];

  for (const request of requests) {
    const event = createEvent(request);
    worker.listeners.get("fetch")?.(event);
    assert.equal(event.response, undefined);
  }
  assert.equal(worker.cachePutCalled, false);
  assert.deepEqual(worker.matchedUrls, []);
});

test("PWA service worker uses network first and serves only the generic offline page on navigation failure", async () => {
  const successfulWorker = await loadServiceWorker({
    fetchRequest: async () => new Response("private response"),
  });
  const onlineEvent = createEvent(createRequest("https://vetcare.example/clients", "GET", "navigate"));
  successfulWorker.listeners.get("fetch")?.(onlineEvent);
  assert.equal(await (await onlineEvent.response)?.text(), "private response");
  assert.equal(successfulWorker.cachePutCalled, false);
  assert.deepEqual(successfulWorker.matchedUrls, []);

  const offlineWorker = await loadServiceWorker({
    fetchRequest: async () => {
      throw new TypeError("Network unavailable");
    },
    offlineResponse: new Response("generic offline page"),
  });
  const offlineEvent = createEvent(createRequest("https://vetcare.example/examinations", "GET", "navigate"));
  offlineWorker.listeners.get("fetch")?.(offlineEvent);
  assert.equal(await (await offlineEvent.response)?.text(), "generic offline page");
  assert.deepEqual(offlineWorker.matchedUrls, ["/offline.html"]);
  assert.equal(offlineWorker.cachePutCalled, false);
});
