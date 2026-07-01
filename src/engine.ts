/**
 * Meilisearch-backed SearchEngine implementation.
 *
 * Implements Dune's `SearchEngine` interface, delegating search and suggest
 * calls to a Meilisearch instance over HTTP.
 *
 * Usage:
 * ```ts
 * import { createMeilisearchEngine } from "@dune/plugin-meilisearch/engine";
 *
 * const searchEngine = createMeilisearchEngine({
 *   url: Deno.env.get("MEILI_URL") ?? "http://127.0.0.1:7700",
 *   apiKey: Deno.env.get("MEILI_API_KEY"),
 *   index: "content",
 * });
 * ```
 *
 * @module
 */

import type {
  SearchEngine,
  SearchResult,
  PageIndex,
  InjectedSearchRecord,
} from "@dune/core/search";
import { MeilisearchClient } from "./client.ts";
import {
  injectedRecordToDocument,
  pageToDocument,
  syncDocuments,
} from "./sync.ts";
import type { MeilisearchEngineOptions } from "./types.ts";

/**
 * Runtime wiring supplied by the Dune plugin layer.
 * Lets the engine populate document bodies and index plugin-injected records.
 */
export interface MeilisearchEngineRuntime {
  /** Load a page's plain-text body (Dune's `onSearchEngineCreate` `loadText`). */
  loadText?: (page: PageIndex) => Promise<string>;
  /** Plugin-injected records (e.g. PDF text) to index alongside pages. */
  injectedRecords?: InjectedSearchRecord[];
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
 * Create a Meilisearch-backed search engine implementing Dune's `SearchEngine`.
 */
export function createMeilisearchEngine(
  options: MeilisearchEngineOptions,
  initialPages: PageIndex[] = [],
  runtime: MeilisearchEngineRuntime = {},
): SearchEngine {
  const client = new MeilisearchClient(options);
  const excerptLength = options.excerptLength ?? 160;
  const { loadText, injectedRecords = [] } = runtime;

  let pages = initialPages;

  return {
    // ── build ────────────────────────────────────────────────────────────────

    async build(): Promise<void> {
      await client.ensureIndex();

      const settings = {
        ...DEFAULT_SETTINGS,
        ...(options.settings ?? {}),
      };
      await client.applySettings(settings);

      const published = pages.filter((p) => p.published && p.route);
      const pageDocs = await Promise.all(
        published.map(async (p) => {
          const body = loadText ? await loadText(p) : "";
          return pageToDocument({ ...p, body });
        }),
      );

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
        cropLength: Math.ceil(excerptLength / 5),
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

        // Reconstruct a PageIndex from stored document fields with defaults for
        // fields not stored in Meilisearch.
        const route = (hit["route"] as string | undefined) ?? "";
        const page: PageIndex = {
          sourcePath: `${route.replace(/^\//, "")}.md`,
          route,
          title: (hit["title"] as string | undefined) ?? "",
          navTitle: (hit["title"] as string | undefined) ?? "",
          date: (hit["date"] as string | null | undefined) ?? null,
          template: (hit["template"] as string | undefined) ?? "page",
          language: (hit["language"] as string | undefined) ?? "en",
          format: "md",
          published: true,
          status: "published",
          visible: true,
          routable: true,
          isModule: false,
          order: 0,
          depth: 1,
          parentPath: null,
          taxonomy: {},
          mtime: 0,
          hash: "",
        };

        // Restore taxonomy from the flat `tags` array — best-effort.
        const tags = hit["tags"];
        if (Array.isArray(tags)) {
          page.taxonomy = { tag: tags as string[] };
        }

        const highlights = extractHighlightTerms(
          formatted as Record<string, string>,
        );

        return {
          page,
          score: (hit._rankingScore as number | undefined) ?? 1,
          excerpt,
          highlights,
        };
      });
    },

    // ── rebuild ──────────────────────────────────────────────────────────────

    async rebuild(newPages: PageIndex[]): Promise<void> {
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
