/**
 * Shared types for the @dune/meilisearch plugin.
 * @module
 */

/** Configuration for connecting to a Meilisearch instance. */
export interface MeilisearchConfig {
  /**
   * Base URL of the Meilisearch instance.
   * @example "http://127.0.0.1:7700"
   */
  url: string;

  /**
   * Meilisearch API key. Set to the master key or a search-only key
   * depending on the operation (indexing vs querying).
   * Can be left empty if the instance has no authentication.
   */
  apiKey?: string;

  /**
   * Index name to use for the Dune content index.
   * @default "content"
   */
  index?: string;
}

/**
 * Options for the Meilisearch search engine implementation.
 * Extends the connection config with search-specific settings.
 */
export interface MeilisearchEngineOptions extends MeilisearchConfig {
  /**
   * Meilisearch index settings applied on build().
   * These are merged with / override the defaults.
   */
  settings?: MeilisearchIndexSettings;

  /**
   * Character length of returned excerpts.
   * @default 160
   */
  excerptLength?: number;
}

/** Meilisearch index-level settings. */
export interface MeilisearchIndexSettings {
  /** Fields searched by default. Order determines attribute weight. */
  searchableAttributes?: string[];
  /** Fields available as filter/facet targets in search queries. */
  filterableAttributes?: string[];
  /** Fields that can be used in `sort:` query parameters. */
  sortableAttributes?: string[];
  /** Ordered list of ranking rules applied during result scoring. */
  rankingRules?: string[];
  /** Typo-tolerance configuration. */
  typoTolerance?: {
    /** Enable or disable typo tolerance globally. */
    enabled?: boolean;
    /** Minimum word lengths before one/two typos are tolerated. */
    minWordSizeForTypos?: { oneTypo?: number; twoTypos?: number };
  };
  /** Synonym map: each key expands to its listed equivalents during search. */
  synonyms?: Record<string, string[]>;
  /** Words ignored during indexing and querying (common words, filler). */
  stopWords?: string[];
}

/** A document as stored in the Meilisearch index. */
export interface MeilisearchDocument {
  /** Stable unique ID (based on page route). */
  id: string;
  /** URL route — e.g. "/articles/my-article" */
  route: string;
  /** Page title. */
  title: string;
  /** Plain-text body for full-text indexing. */
  body: string;
  /** Publication date in ISO 8601 format, or null if unset. */
  date: string | null;
  /** Template name used for facet filtering. */
  template: string;
  /** BCP 47 language code, e.g. `"en"`. */
  language: string;
  /** Taxonomy tags flattened: all values across all vocabs. */
  tags: string[];
  /** Custom facet field values from PageIndex.extra. */
  [key: string]: unknown;
}
