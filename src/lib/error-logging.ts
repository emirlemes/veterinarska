export function logError(source: string, details: unknown) {
  if (process.env.NEXT_PUBLIC_ERROR_LOGGING === "true") {
    console.log(`[Greška: ${source}]`, details);
  }
}

export function withFetchErrorLogging(fetchRequest: typeof fetch): typeof fetch {
  return async (input, init) => {
    try {
      const response = await fetchRequest(input, init);
      if (!response.ok) {
        logError("HTTP zahtjev", { status: response.status });
      }
      return response;
    } catch (error) {
      logError("Mrežni zahtjev", error);
      throw error;
    }
  };
}
