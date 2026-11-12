const sections = new Set([
  "login", "dashboard", "clients", "animals", "appointments", "examinations",
  "inventory", "invoices", "reports", "services", "employees", "settings",
]);

type RequestTiming = Pick<
  PerformanceResourceTiming,
  "name" | "initiatorType" | "startTime" | "responseStart" | "duration"
>;

export function getRscTiming(entry: RequestTiming, origin: string) {
  if (entry.initiatorType !== "fetch") return null;

  const url = new URL(entry.name, origin);
  if (url.origin !== origin || !url.searchParams.has("_rsc")) return null;

  const section = url.pathname.split("/")[1];
  return {
    section: sections.has(section) ? `/${section}` : "/other",
    totalMs: Math.round(entry.duration),
    firstByteMs: entry.responseStart > 0
      ? Math.round(entry.responseStart - entry.startTime)
      : null,
  };
}

export function startPerformanceLogging() {
  if (!("PerformanceObserver" in window)) {
    console.warn("[VetCare performance] PerformanceObserver is not supported by this browser.");
    return;
  }

  const logNavigation = () => {
    const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (navigation) {
      console.log("[VetCare performance] Initial page load", {
        firstByteMs: Math.round(navigation.responseStart - navigation.startTime),
        loadMs: Math.round(navigation.loadEventEnd - navigation.startTime),
      });
    }
  };
  if (document.readyState === "complete") {
    logNavigation();
  } else {
    window.addEventListener("load", () => setTimeout(logNavigation, 0), { once: true });
  }

  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      const timing = getRscTiming(entry as PerformanceResourceTiming, window.location.origin);
      if (timing) console.log("[VetCare performance] RSC request", timing);
    }
  });
  observer.observe({ type: "resource", buffered: true });
}
