/**
 * Meilisearch-backed SearchEngine implementation.
 *
 * Implements the same interface as Dune's built-in in-memory engine, but
 * delegates search and suggest calls to a Meilisearch instance over HTTP.
 *
 * Usage:
 * ```ts
 * import { createMeilisearchEngine } from "@dune/plugin-meilisearch/engine";
 *
 * // In your Dune bootstrap or custom server entry:
 * const searchEngine = createMeilisearchEngine({
 *   url: Deno.env.get("MEILI_URL") ?? "http://127.0.0.1:7700",
 *   apiKey: Deno.env.get("MEILI_API_KEY"),
 *   index: "content",
 * });
 * ```
 *
 * @module
 */

import { MeilisearchClient } from "./client.ts";
import {
  injectedRecordToDocument,
  pageToDocument,
  syncDocuments,
} from "./sync.ts";
import type { InjectedRecordLike, PageLike } from "./sync.ts";
import type { MeilisearchEngineOptions } from "./types.ts";

/**
 * Runtime wiring supplied by the Dune plugin layer (not by manual callers).
 * Lets the engine populate document bodies and index plugin-injected records
 * without depending on `@dune/core`.
 */
export interface MeilisearchEngineRuntime {
  /** Load a page's plain-text body (Dune's `onSearchEngineCreate` `loadText`). */
  loadText?: (page: PageLike) => Promise<string>;
  /** Plugin-injected records (e.g. PDF text) to index alongside pages. */
  injectedRecords?: InjectedRecordLike[];
}

/** Minimal SearchResult shape compatible with @dune/core SearchResult. */
export interface SearchResult {
  /** The matched page (includes `sourcePath` for display purposes). */
  page: PageLike & { sourcePath: string };
  /** Relevance score from Meilisearch's ranking (higher is better). */
  score: number;
  /** Plain-text excerpt around the match, with `<mark>` highlight tags. */
  excerpt: string;
  /** Lowercased query terms that produced highlights in this result. */
  highlights?: string[];
}

/**
 * The interface this engine implements — a subset of @dune/core SearchEngine.
 * Defined locally to avoid a circular dependency on @dune/core.
 */
export interface SearchEngineInterface {
  /** Build the search index (apply settings, sync all documents). Call after startup. */
  build(): Promise<void>;
  /** Search for pages matching `query`. Returns up to `limit` results. */
  search(query: string, limit?: number): Promise<SearchResult[]>;
  /** Rebuild the index after content changes (replaces all documents). */
  rebuild(pages: PageLike[]): Promise<void>;
  /** Return autocomplete suggestions for a typed prefix string. */
  suggest(prefix: string, limit?: number): Promise<string[]>;
}

// Default index settings applied on build().
const DEFAULT_SETTINGS = {
  searchableAttributes: ["title", "body", "tags"],
  filterableAttributes: ["template", "language", "tags"],
  sortableAttributes: ["date"],
  rankingRules: [
    "words",
    "typo",
    "proximity",
    "attribute",
    "sort",
    "exactness",
  ],
  typoTolerance: {
    enabled: true,
    minWordSizeForTypos: { oneTypo: 5, twoTypos: 9 },
  },
};

/**
 * Create a Meilisearch-backed search engine.
 *
 * Pass this to Dune's bootstrap where a SearchEngine is expected.
 * All options except `url` are optional.
 */
export function createMeilisearchEngine(
  options: MeilisearchEngineOptions,
  initialPages: PageLike[] = [],
  runtime: MeilisearchEngineRuntime = {},
): SearchEngineInterface {
  const client = new MeilisearchClient(options);
  const excerptLength = options.excerptLength ?? 160;
  const { loadText, injectedRecords = [] } = runtime;

  let pages = initialPages;

  return {
    // ── build ────────────────────────────────────────────────────────────────

    async build(): Promise<void> {
      await client.ensureIndex();

      // Merge user settings over defaults.
      const settings = {
        ...DEFAULT_SETTINGS,
        ...(options.settings ?? {}),
      };
      await client.applySettings(settings);

      // Build documents from published pages, populating body text via the
      // loader when one is provided (otherwise fall back to any inline body).
      const published = pages.filter((p) => p.published && p.route);
      const pageDocs = await Promise.all(
        published.map(async (p) => {
          const body = loadText ? await loadText(p) : (p.body ?? "");
          return pageToDocument({ ...p, body });
        }),
      );

      // Include plugin-injected records (e.g. PDF text) when present.
      const injectedDocs = injectedRecords.map(injectedRecordToDocument);

      await syncDocuments(client, [...pageDocs, ...injectedDocs]);
    },

    // ── search ───────────────────────────────────────────────────────────────

    async search(query: string, limit = 20): Promise<SearchResult[]> {
      if (!query.trim()) return [];

      const response = await client.search({
        q: query,
        limit,
        attributesToCrop: ["body"],
        cropLength: Math.ceil(excerptLength / 5), // words (≈5 chars each)
        attributesToHighlight: ["title", "body"],
        highlightPreTag: "<mark>",
        highlightPostTag: "</mark>",
      });

      return response.hits.map((hit) => {
        const formatted = hit._formatted ?? {};
        const excerpt = extractExcerpt(
          (formatted["body"] as string | undefined) ??
            (hit["body"] as string | undefined) ?? "",
          excerptLength,
        );

        // Reconstruct a minimal PageLike from the stored document fields.
        const page: PageLike & { sourcePath: string } = {
          sourcePath: `${hit["route"] ?? ""}.md`,
          route: (hit["route"] as string | undefined) ?? "",
          title: (hit["title"] as string | undefined) ?? "",
          date: (hit["date"] as string | null | undefined) ?? null,
          template: (hit["template"] as string | undefined) ?? "",
          language: (hit["language"] as string | undefined) ?? "en",
          published: true,
          taxonomy: {},
          extra: {},
        };

        // Restore taxonomy from the flat `tags` array — best-effort.
        const tags = hit["tags"];
        if (Array.isArray(tags)) {
          page.taxonomy = { tag: tags as string[] };
        }

        const highlights = extractHighlightTerms(formatted);

        return {
          page,
          score: (hit._rankingScore as number | undefined) ?? 1,
          excerpt,
          highlights,
        };
      });
    },

    // ── rebuild ──────────────────────────────────────────────────────────────

    async rebuild(newPages: PageLike[]): Promise<void> {
      pages = newPages;
      await this.build();
    },

    // ── suggest ──────────────────────────────────────────────────────────────

    async suggest(prefix: string, limit = 10): Promise<string[]> {
      if (!prefix || prefix.length < 2) return [];

      const response = await client.search({
        q: prefix,
        limit,
        attributesToRetrieve: ["title"],
      });

      const seen = new Set<string>();
      for (const hit of response.hits) {
        const title = hit["title"] as string | undefined;
        if (title) seen.add(title);
        if (seen.size >= limit) break;
      }
      return [...seen];
    },
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Strip HTML tags and truncate to excerptLength characters. */
function extractExcerpt(html: string, maxChars: number): string {
  // Keep <mark> tags for highlight rendering; strip everything else.
  const text = html
    .replace(/<(?!\/?(mark)(?=>|\s))[^>]+>/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > maxChars ? text.slice(0, maxChars) + "…" : text;
}

/** Extract highlighted terms from Meilisearch's _formatted object. */
function extractHighlightTerms(
  formatted: Record<string, string>,
): string[] {
  const terms = new Set<string>();
  const markRe = /<mark>(.*?)<\/mark>/gi;
  for (const val of Object.values(formatted)) {
    let m: RegExpExecArray | null;
    while ((m = markRe.exec(val)) !== null) {
      terms.add(m[1].toLowerCase());
    }
  }
  return [...terms];
}
