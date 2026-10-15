/** Internal helper — intentionally not listed in deno.json `exports`. */

/**
 * Strip HTML tags (keeping only Meilisearch's own `<mark>` highlight tags) and
 * truncate to maxChars. `<mark>` markers are swapped for sentinels first, all
 * other tags are removed, and any leftover `<` is dropped, so stripping can
 * never leave (or reassemble) a live tag from malformed input. Truncation
 * happens on the sentinel form, so it can't cut inside a `<mark>` tag; an
 * unclosed highlight is closed before the marks are restored.
 */
export function extractExcerpt(html: string, maxChars: number): string {
  const OPEN = "\u0001";
  const CLOSE = "\u0002";
  let text = html
    .replaceAll(OPEN, "")
    .replaceAll(CLOSE, "")
    .replace(/<mark>/gi, OPEN)
    .replace(/<\/mark>/gi, CLOSE)
    .replace(/<[^>]*>/g, "")
    .replace(/</g, "")
    .replace(/\s+/g, " ")
    .trim();
  const visible = [...text.replaceAll(OPEN, "").replaceAll(CLOSE, "")].length;
  if (visible > maxChars) {
    let kept = "";
    let count = 0;
    let depth = 0;
    for (const ch of text) {
      if (ch === OPEN) depth++;
      else if (ch === CLOSE) depth = Math.max(0, depth - 1);
      else if (++count > maxChars) break;
      kept += ch;
    }
    text = kept + (depth > 0 ? CLOSE : "") + "…";
  }
  return text.replaceAll(OPEN, "<mark>").replaceAll(CLOSE, "</mark>");
}
