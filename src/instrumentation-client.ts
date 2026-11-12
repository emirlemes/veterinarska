import { logError, withFetchErrorLogging } from "./lib/error-logging";

if (process.env.NEXT_PUBLIC_ERROR_LOGGING === "true") {
  window.addEventListener("error", (event) => {
    logError("Preglednik", event.error ?? event.message);
  });

  window.addEventListener("unhandledrejection", (event) => {
    logError("Neobrađeni promise", event.reason);
  });

  window.fetch = withFetchErrorLogging(window.fetch.bind(window));
}
