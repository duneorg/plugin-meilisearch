/**
 * Minimal Meilisearch HTTP client.
 *
 * No external dependencies — uses the Fetch API directly. Only the
 * operations needed by the search engine are implemented.
 *
 * @module
 */

import type { MeilisearchConfig, MeilisearchIndexSettings } from "./types.ts";

/** A single document returned by the Meilisearch search API, with optional highlight and score metadata. */
export interface MeilisearchHit {
  [key: string]: unknown;
  /** Field values with highlight `<mark>` tags injected by Meilisearch. */
  _formatted?: Record<string, string>;
  /** Normalised relevance score in the range [0, 1] (higher is better). */
  _rankingScore?: number;
}

/** Response envelope returned by the Meilisearch `/indexes/{uid}/search` endpoint. */
export interface MeilisearchSearchResponse {
  /** Matched documents, each optionally decorated with `_formatted` and `_rankingScore`. */
  hits: MeilisearchHit[];
  /** Approximate total number of matching documents. */
  estimatedTotalHits: number;
  /** The search query that produced this response. */
  query: string;
}

/** Meilisearch async task reference returned by write operations (index, delete, settings). */
export interface MeilisearchTask {
  /** Unique task identifier, usable to poll task status. */
  taskUid: number;
  /** Task status string (e.g. `"enqueued"`, `"succeeded"`, `"failed"`). */
  status?: string;
}

/**
 * Minimal Meilisearch HTTP client using the Fetch API.
 *
 * Covers only the operations needed by the search engine: index creation,
 * settings, document upsert/delete, and search. For full Meilisearch API
 * access use the official `meilisearch-js` SDK instead.
 */
export class MeilisearchClient {
  readonly #url: string;
  readonly #index: string;
  readonly #apiKey: string | undefined;

  /** Create a client for the given Meilisearch instance. */
  constructor(config: MeilisearchConfig) {
    this.#url = config.url.replace(/\/$/, "");
    this.#index = config.index ?? "content";
    this.#apiKey = config.apiKey;
  }

  // ── Internal helpers ────────────────────────────────────────────────────────

  #headers(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.#apiKey) headers["Authorization"] = `Bearer ${this.#apiKey}`;
    return headers;
  }

  async #request(path: string, init: RequestInit = {}): Promise<Response> {
    return await fetch(`${this.#url}${path}`, {
      ...init,
      headers: {
        ...this.#headers(),
        ...(init.headers as Record<string, string> ?? {}),
      },
    });
  }

  async #json<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await this.#request(path, init);
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Meilisearch ${res.status} at ${path}: ${body}`);
    }
    return await res.json() as T;
  }

  // ── Health ──────────────────────────────────────────────────────────────────

  /** Returns true if the Meilisearch instance is reachable and healthy. */
  async isHealthy(): Promise<boolean> {
    try {
      const res = await this.#request("/health");
      return res.ok;
    } catch {
      return false;
    }
  }

  // ── Index management ────────────────────────────────────────────────────────

  /** Ensure the index exists. No-op if it already exists. */
  async ensureIndex(): Promise<void> {
    try {
      await this.#json(`/indexes`, {
        method: "POST",
        body: JSON.stringify({ uid: this.#index, primaryKey: "id" }),
      });
    } catch (err) {
      // 409 Conflict = index already exists — that's fine.
      if (err instanceof Error && !err.message.includes("409")) throw err;
    }
  }

  /** Apply index settings. Safe to call multiple times (idempotent). */
  async applySettings(
    settings: MeilisearchIndexSettings,
  ): Promise<MeilisearchTask> {
    return await this.#json<MeilisearchTask>(
      `/indexes/${this.#index}/settings`,
      {
        method: "PATCH",
        body: JSON.stringify(settings),
      },
    );
  }

  // ── Documents ───────────────────────────────────────────────────────────────

  /** Add or replace documents. Upserts by primary key (`id`). */
  async putDocuments(docs: unknown[]): Promise<MeilisearchTask> {
    return await this.#json<MeilisearchTask>(
      `/indexes/${this.#index}/documents`,
      {
        method: "PUT",
        body: JSON.stringify(docs),
      },
    );
  }

  /** Delete all documents from the index (keeps settings). */
  async deleteAllDocuments(): Promise<MeilisearchTask> {
    return await this.#json<MeilisearchTask>(
      `/indexes/${this.#index}/documents`,
      {
        method: "DELETE",
      },
    );
  }

  // ── Search ──────────────────────────────────────────────────────────────────

  /** Full-text search. */
  async search(params: {
    q: string;
    limit?: number;
    attributesToCrop?: string[];
    cropLength?: number;
    attributesToHighlight?: string[];
    highlightPreTag?: string;
    highlightPostTag?: string;
    attributesToRetrieve?: string[];
  }): Promise<MeilisearchSearchResponse> {
    return await this.#json<MeilisearchSearchResponse>(
      `/indexes/${this.#index}/search`,
      {
        method: "POST",
        body: JSON.stringify(params),
      },
    );
  }
}
