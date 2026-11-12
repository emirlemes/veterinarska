import { logError, withFetchErrorLogging } from "./lib/error-logging";
import { startPerformanceLogging } from "./lib/performance-logging";

try {
  if (window.sessionStorage?.getItem("vetcare:performance-logging") === "true") {
    startPerformanceLogging();
  }
} catch (error) {
  console.warn("[VetCare performance] Could not start performance logging.", error);
}

if (process.env.NEXT_PUBLIC_ERROR_LOGGING === "true") {
  window.addEventListener("error", (event) => {
    logError("Preglednik", event.error ?? event.message);
  });

  window.addEventListener("unhandledrejection", (event) => {
    logError("Neobrađeni promise", event.reason);
  });

  window.fetch = withFetchErrorLogging(window.fetch.bind(window));
}
