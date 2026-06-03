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
  searchableAttributes?: string[];
  filterableAttributes?: string[];
  sortableAttributes?: string[];
  rankingRules?: string[];
  typoTolerance?: {
    enabled?: boolean;
    minWordSizeForTypos?: { oneTypo?: number; twoTypos?: number };
  };
  synonyms?: Record<string, string[]>;
  stopWords?: string[];
}

/** A document as stored in the Meilisearch index. */
export interface MeilisearchDocument {
  /** Stable unique ID (based on page route). */
  id: string;
  /** URL route — e.g. "/articles/my-article" */
  route: string;
  title: string;
  body: string;
  date: string | null;
  template: string;
  language: string;
  /** Taxonomy tags flattened: all values across all vocabs. */
  tags: string[];
  /** Custom facet field values from PageIndex.extra. */
  [key: string]: unknown;
}
