/**
 * Content sync — maps Dune PageIndex entries to Meilisearch documents
 * and pushes them in batches.
 *
 * @module
 */

import type { InjectedSearchRecord, PageIndex } from "@dune/core/search";
import type { MeilisearchDocument } from "./types.ts";
import type { MeilisearchClient } from "./client.ts";

/**
 * Convert a PageIndex entry to a Meilisearch document.
 *
 * The document `id` is derived from the route by replacing non-alphanumeric
 * characters with underscores. This is stable across rebuilds.
 */
export function pageToDocument(
  page: PageIndex & { body?: string },
): MeilisearchDocument {
  // Flatten all taxonomy values into a single `tags` array.
  const tags: string[] = Object.values(page.taxonomy).flat();

  const doc: MeilisearchDocument = {
    id: routeToId(page.route),
    route: page.route,
    title: page.title,
    body: page.body ?? "",
    date: page.date,
    template: page.template,
    language: page.language,
    tags,
  };

  if (page.extra) {
    for (const [k, v] of Object.entries(page.extra)) doc[k] = v;
  }

  return doc;
}

/**
 * Convert a plugin-injected record (e.g. PDF text) to a Meilisearch document.
 */
export function injectedRecordToDocument(
  rec: InjectedSearchRecord,
): MeilisearchDocument {
  const doc: MeilisearchDocument = {
    id: routeToId(rec.route),
    route: rec.route,
    title: rec.title,
    body: rec.body,
    date: null,
    template: rec.template ?? "page",
    language: "en",
    tags: [],
  };
  if (rec.fields) {
    for (const [k, v] of Object.entries(rec.fields)) doc[k] = v;
  }
  return doc;
}

/**
 * Convert a URL route to a stable Meilisearch document ID.
 * Replaces leading slash and any non-alphanumeric chars with underscores.
 *
 * @example "/articles/my-post" → "articles_my_post"
 */
export function routeToId(route: string): string {
  return route.replace(/^\//, "").replace(/[^a-zA-Z0-9_-]/g, "_") || "root";
}

/**
 * Push a set of pre-built documents to Meilisearch in batches.
 * Replaces the entire index content (delete-all then put).
 */
export async function syncDocuments(
  client: MeilisearchClient,
  docs: MeilisearchDocument[],
  batchSize = 500,
): Promise<void> {
  await client.deleteAllDocuments();

  for (let i = 0; i < docs.length; i += batchSize) {
    await client.putDocuments(docs.slice(i, i + batchSize));
  }
}

/**
 * Sync a set of pages to Meilisearch in batches.
 * Replaces the entire index content (delete-all then put).
 */
export async function syncPages(
  client: MeilisearchClient,
  pages: PageIndex[],
  batchSize = 500,
): Promise<void> {
  const published = pages.filter((p) => p.published && p.route);
  const docs = published.map(pageToDocument);
  await syncDocuments(client, docs, batchSize);
}
