/**
 * Upstream data supplies URLs that end up in href attributes. Only plain
 * http(s) links are accepted: no javascript:, data:, or anything unparseable.
 */
export function safeUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 300) return null;
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** "https://www.bitcoin.org/en/" -> "bitcoin.org" */
export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
