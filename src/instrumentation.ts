import type { Instrumentation } from "next";
import { logError } from "./lib/error-logging";

export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  logError("Server", {
    error,
    method: request.method,
    route: context.routePath,
    type: context.routeType,
  });
};
