/**
 * Telling "Meilisearch is not available right now" from "this will never work".
 *
 * Dune keeps going when a search engine fails to build: it retries in the
 * background and falls back to the built-in engine. That is right for an
 * unreachable server and wrong for a rejected API key, which retrying cannot
 * fix and which should stop startup with a clear message. Dune recognises the
 * second kind by the `SearchConfigError` class, which it matches by name, so
 * the one from `@dune/plugin-api` is recognised whichever copy of core runs.
 *
 * @module
 */

import { SearchConfigError } from "@dune/plugin-api";
import { MeilisearchHttpError } from "./client.ts";

/**
 * The reason retrying cannot help, or null when the failure may be transient
 * (connection refused, timeout, 5xx, a missing index).
 */
export function unrecoverableReason(err: unknown): string | null {
  if (!(err instanceof MeilisearchHttpError)) return null;
  if (err.status === 401) {
    return "Meilisearch rejected the API key (401). Check apiKey / MEILI_API_KEY.";
  }
  if (err.status === 403) {
    return "The Meilisearch API key may not do this (403). It needs permission to create the index, change settings and add documents.";
  }
  if (
    err.status === 400 &&
    (err.path === "/indexes" || err.path.endsWith("/settings"))
  ) {
    return "Meilisearch rejected the index settings or name (400). Check `index` and `settings` in the plugin config.";
  }
  return null;
}

/** Wrap an unrecoverable failure as Dune's `SearchConfigError`; pass others through. */
export function classifyBuildError(err: unknown): unknown {
  const reason = unrecoverableReason(err);
  if (!reason) return err;
  return new SearchConfigError(`${reason} (${(err as Error).message})`, {
    cause: err,
  });
}
