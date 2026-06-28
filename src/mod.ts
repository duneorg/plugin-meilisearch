/**
 * @dune/meilisearch
 *
 * Meilisearch-backed search engine for Dune sites.
 *
 * Implements the same `SearchEngine` interface as Dune's built-in in-memory
 * engine, delegating all search and indexing operations to a Meilisearch
 * instance over HTTP. Drop-in replacement for sites that outgrow the built-in
 * engine or need features like typo tolerance, language-aware stemming, or
 * synonym expansion.
 *
 * ## Quick start
 *
 * ```ts
 * import { createMeilisearchEngine } from "@dune/meilisearch/engine";
 *
 * const search = createMeilisearchEngine({
 *   url: Deno.env.get("MEILI_URL") ?? "http://127.0.0.1:7700",
 *   apiKey: Deno.env.get("MEILI_API_KEY"),
 *   index: "content",
 *   settings: {
 *     // site-specific tuning (ranking rules, synonyms, stopWords, etc.)
 *     rankingRules: ["words", "typo", "proximity", "attribute", "sort", "exactness"],
 *   },
 * }, pages); // pass your PageIndex[] here
 * ```
 *
 * ## Architecture
 *
 * - `@dune/meilisearch/client` — minimal HTTP client wrapping Meilisearch's REST API
 * - `@dune/meilisearch/sync`   — PageIndex → MeilisearchDocument mapping and batch push
 * - `@dune/meilisearch/engine` — SearchEngine implementation wiring client + sync
 *
 * ## Site-specific configuration
 *
 * The plugin ships sensible defaults for `searchableAttributes`,
 * `filterableAttributes`, `rankingRules`, and `typoTolerance`. Override any
 * of these in the `settings` option. Language-specific synonyms, stopWords,
 * and other tuning go here as well — the plugin has no opinions about content.
 *
 * @module
 */

export { createMeilisearchEngine } from "./engine.ts";
export type { SearchEngineInterface, SearchResult } from "./engine.ts";
export { MeilisearchClient } from "./client.ts";
export type { MeilisearchHit, MeilisearchSearchResponse } from "./client.ts";
export { pageToDocument, routeToId, syncPages } from "./sync.ts";
export type { PageLike } from "./sync.ts";
export type {
  MeilisearchConfig,
  MeilisearchDocument,
  MeilisearchEngineOptions,
  MeilisearchIndexSettings,
} from "./types.ts";
