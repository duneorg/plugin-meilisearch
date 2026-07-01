/**
 * @dune/plugin-meilisearch
 *
 * Meilisearch-backed search engine for Dune sites.
 *
 * Implements the same `SearchEngine` interface as Dune's built-in in-memory
 * engine, delegating all search and indexing operations to a Meilisearch
 * instance over HTTP. Drop-in replacement for sites that outgrow the built-in
 * engine or need features like typo tolerance, language-aware stemming, or
 * synonym expansion.
 *
 * ## Quick start (plugin)
 *
 * The package default export is a Dune plugin. Enable it from `site.yaml` with
 * no code:
 *
 * ```yaml
 * plugins:
 *   - src: "jsr:@dune/plugin-meilisearch"
 *     config:
 *       url: "http://127.0.0.1:7700"   # or env MEILI_URL
 *       apiKey: "${MEILI_API_KEY}"      # or env MEILI_API_KEY
 *       index: "content"
 * ```
 *
 * Dune calls the engine's `build()` at startup and `rebuild()` on content
 * changes. Full page bodies are indexed via the host's `loadText` helper, and
 * any plugin-injected records (e.g. `@dune/plugin-pdf` text) are indexed too.
 *
 * ## Manual wiring
 *
 * ```ts
 * import { createMeilisearchEngine } from "@dune/plugin-meilisearch/engine";
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

export { default } from "./plugin.ts";
export type { MeilisearchPluginConfig } from "./plugin.ts";
export { createMeilisearchEngine } from "./engine.ts";
export type { MeilisearchEngineRuntime } from "./engine.ts";
// SearchEngine and SearchResult are re-exported from @dune/core/search
export type { SearchEngine, SearchResult } from "@dune/core/search";
export { MeilisearchClient } from "./client.ts";
export type { MeilisearchHit, MeilisearchSearchResponse } from "./client.ts";
export {
  injectedRecordToDocument,
  pageToDocument,
  routeToId,
  syncDocuments,
  syncPages,
} from "./sync.ts";
export type { InjectedRecordLike, PageLike } from "./sync.ts";
export type {
  MeilisearchConfig,
  MeilisearchDocument,
  MeilisearchEngineOptions,
  MeilisearchIndexSettings,
} from "./types.ts";
