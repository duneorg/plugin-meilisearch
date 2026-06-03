/**
 * Content sync — maps Dune PageIndex entries to Meilisearch documents
 * and pushes them in batches.
 *
 * @module
 */

import type { MeilisearchDocument } from "./types.ts";
import type { MeilisearchClient } from "./client.ts";

/** Minimal PageIndex shape this module requires. */
export interface PageLike {
  route: string;
  title: string;
  date: string | null;
  template: string;
  language: string;
  published: boolean;
  taxonomy: Record<string, string[]>;
  extra?: Record<string, string | string[]>;
}

/**
 * Convert a PageIndex entry to a Meilisearch document.
 *
 * The document `id` is derived from the route by replacing non-alphanumeric
 * characters with underscores. This is stable across rebuilds.
 */
export function pageToDocument(page: PageLike): MeilisearchDocument {
  // Flatten all taxonomy values into a single `tags` array.
  const tags = Object.values(page.taxonomy).flat();

  const doc: MeilisearchDocument = {
    id: routeToId(page.route),
    route: page.route,
    title: page.title,
    body: "", // populated by the engine when it has body text
    date: page.date,
    template: page.template,
    language: page.language,
    tags,
  };

  // Spread extra facet fields (e.g. subtype) directly onto the document.
  if (page.extra) {
    for (const [k, v] of Object.entries(page.extra)) {
      doc[k] = v;
    }
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
 * Sync a set of pages to Meilisearch in batches.
 * Replaces the entire index content (delete-all then put).
 */
export async function syncPages(
  client: MeilisearchClient,
  pages: PageLike[],
  batchSize = 500,
): Promise<void> {
  const published = pages.filter((p) => p.published && p.route);
  const docs = published.map(pageToDocument);

  await client.deleteAllDocuments();

  for (let i = 0; i < docs.length; i += batchSize) {
    await client.putDocuments(docs.slice(i, i + batchSize));
  }
}
