export class ProviderError extends Error {
  constructor(
    message: string,
    readonly code: "timeout" | "http" | "invalid" | "configuration" | "network",
    readonly status?: number,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

type FetchInit = RequestInit & { timeoutMs?: number; retries?: number; maxRetryAfterMs?: number };

async function fetchWithRetry<T>(url: string, init: FetchInit, read: (response: Response) => Promise<T>): Promise<T> {
  const retries = init.retries ?? 2;
  const timeoutMs = init.timeoutMs ?? 12000;
  const maxRetryAfterMs = init.maxRetryAfterMs ?? 5000;
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      if (response.status === 429 || response.status >= 500) {
        lastError = new ProviderError(
          response.status === 429 ? "Provider rate limit reached (429). Try again in about a minute." : `Provider returned ${response.status}.`,
          "http",
          response.status,
        );
        if (attempt === retries) break;
        const retryAfterSeconds = Number(response.headers.get("retry-after"));
        await delay(
          Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
            ? Math.min(retryAfterSeconds * 1000, maxRetryAfterMs)
            : 300 * 2 ** attempt,
        );
        continue;
      }
      if (!response.ok) {
        throw new ProviderError(`Provider returned ${response.status}.`, "http", response.status);
      }
      return await read(response);
    } catch (error) {
      if (error instanceof ProviderError && error.code === "http" && (error.status ?? 0) < 500) {
        throw error;
      }
      lastError =
        error instanceof Error && error.name === "AbortError"
          ? new ProviderError("Provider request timed out.", "timeout")
          : error instanceof ProviderError
            ? error
            : new ProviderError("Provider request failed.", "network");
      if (attempt === retries) break;
      await delay(300 * 2 ** attempt);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError ?? new ProviderError("Provider request failed.", "network");
}

export function fetchJson(url: string, init: FetchInit = {}): Promise<unknown> {
  return fetchWithRetry(url, init, (response) => response.json());
}

export function fetchText(url: string, init: FetchInit = {}): Promise<string> {
  return fetchWithRetry(url, init, (response) => response.text());
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function kmhToMps(value: number): number {
  return value / 3.6;
}
