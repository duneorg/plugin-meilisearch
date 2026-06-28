/**
 * Minimal Meilisearch HTTP client.
 *
 * No external dependencies — uses the Fetch API directly. Only the
 * operations needed by the search engine are implemented.
 *
 * @module
 */

import type { MeilisearchConfig, MeilisearchIndexSettings } from "./types.ts";

export interface MeilisearchHit {
  [key: string]: unknown;
  _formatted?: Record<string, string>;
  _rankingScore?: number;
}

export interface MeilisearchSearchResponse {
  hits: MeilisearchHit[];
  estimatedTotalHits: number;
  query: string;
}

export interface MeilisearchTask {
  taskUid: number;
  status?: string;
}

export class MeilisearchClient {
  readonly #url: string;
  readonly #index: string;
  readonly #apiKey: string | undefined;

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
