const SECRET = /key|token|password|secret|authorization|cookie|apikey/i;

export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        SECRET.test(key) ? "[redacted]" : redact(entry),
      ]),
    );
  }
  return value;
}

export function logInfo(message: string, details?: Record<string, unknown>): void {
  console.info(message, details ? redact(details) : "");
}

export function logError(message: string, details?: Record<string, unknown>): void {
  console.error(message, details ? redact(details) : "");
}
