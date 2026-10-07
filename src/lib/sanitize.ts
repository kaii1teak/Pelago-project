const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&#x27;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

/**
 * CoinGecko descriptions are HTML written by third parties (links, line breaks,
 * occasionally worse). They're shown as plain text paragraphs: tags are removed,
 * a handful of common entities decoded, and the result is only ever rendered
 * as a React text node, so nothing here is ever interpreted as markup.
 *
 * Entities are decoded in a single pass so "&amp;lt;" becomes the literal text
 * "&lt;", not "<".
 */
export function htmlToParagraphs(html: string | null | undefined): string[] {
  if (!html) return [];
  const text = html
    // Block-level breaks become paragraph breaks before tags are stripped.
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/\s*(p|div|li|h[1-6])\s*>/gi, "\n\n")
    // Drop script/style *with* their contents, then every remaining tag.
    .replace(/<\s*(script|style)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(
      /&(?:amp|lt|gt|quot|apos|nbsp|#39|#x27);/gi,
      (m) => ENTITIES[m.toLowerCase()] ?? m,
    );

  return text
    .split(/\r?\n\s*\r?\n|\r?\n{2,}/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}
