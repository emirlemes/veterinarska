import type { z } from "zod";

export class QueryHttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(status === 401 || status === 403
      ? "Nemate pristup podacima. Prijavite se ponovo."
      : message);
  }
}

export async function readJson<T>(
  url: string,
  signal: AbortSignal,
  schema: z.ZodType<T>,
  messages: { load: string; invalid: string },
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { signal, cache: "no-store" });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new Error("Nije moguće povezati se sa serverom. Pokušajte ponovo.");
  }
  if (!response.ok) throw new QueryHttpError(response.status, messages.load);
  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new Error(messages.invalid);
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) throw new Error(messages.invalid);
  return parsed.data;
}

export async function writeJson(url: string, method: "POST" | "PUT" | "DELETE", body?: object) {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new Error("Nije moguće povezati se sa serverom. Pokušajte ponovo.");
  }
  let result: unknown;
  try {
    result = await response.json();
  } catch {
    throw new Error("Server je vratio neispravan odgovor. Provjerite stanje prije ponovnog pokušaja.");
  }
  if (!response.ok) {
    const message = typeof result === "object" && result !== null && "error" in result &&
      typeof result.error === "string" ? result.error : "Zahtjev nije uspio. Provjerite podatke i pokušajte ponovo.";
    throw new Error(message);
  }
  return result;
}
