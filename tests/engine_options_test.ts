/**
 * Integration tests for filter/sort/facetCounts support in
 * createMeilisearchEngine(). Requires a running Meilisearch instance —
 * skipped (not failed) when unavailable, matching client_health_test.ts.
 *
 * Uses a dedicated throwaway index so this never touches a site's real
 * "content" index.
 */

import { assertEquals } from "@std/assert";
import type { PageIndex } from "@dune/core/search";
import { createMeilisearchEngine } from "../src/engine.ts";
import { MeilisearchClient } from "../src/client.ts";

const TEST_URL = Deno.env.get("MEILI_URL") ?? "http://127.0.0.1:7700";
const TEST_KEY = Deno.env.get("MEILI_API_KEY") ??
  Deno.env.get("MEILI_MASTER_KEY") ?? "";
const TEST_INDEX = "dune_test_search_options";

async function meiliAvailable(): Promise<boolean> {
  try {
    const healthRes = await fetch(`${TEST_URL}/health`);
    await healthRes.body?.cancel();
    if (!healthRes.ok) return false;

    const authRes = await fetch(`${TEST_URL}/indexes`, {
      headers: TEST_KEY ? { Authorization: `Bearer ${TEST_KEY}` } : {},
    });
    await authRes.body?.cancel();
    return authRes.status !== 401 && authRes.status !== 403;
  } catch {
    return false;
  }
}

function makePage(overrides: Partial<PageIndex> & { title: string; route: string }): PageIndex {
  return {
    sourcePath: `${overrides.route.slice(1)}.md`,
    language: "en",
    format: "md",
    template: "default",
    navTitle: overrides.title,
    date: null,
    published: true,
    status: "published",
    visible: true,
    routable: true,
    isModule: false,
    order: 1,
    depth: 1,
    parentPath: null,
    taxonomy: {},
    mtime: Date.now(),
    hash: "abc",
    ...overrides,
  };
}

// Meilisearch indexes documents asynchronously — the client doesn't expose
// task-status polling, so give the (tiny, 3-document) batch a moment to
// settle before querying. Indexing this few documents is well under 1s in
// practice.
async function waitForIndexing(): Promise<void> {
  await new Promise((r) => setTimeout(r, 1000));
}

async function withEngine(
  run: (engine: ReturnType<typeof createMeilisearchEngine>) => Promise<void>,
): Promise<void> {
  if (!await meiliAvailable()) {
    console.log("  [skip] Meilisearch not running at", TEST_URL);
    return;
  }

  const client = new MeilisearchClient({
    url: TEST_URL,
    apiKey: TEST_KEY,
    index: TEST_INDEX,
  });

  // Article A's title contains the query term ("europe"), Post B and PDF
  // C's don't — this creates a genuine "attribute" ranking-rule win for
  // Article A (Meilisearch ranks a title match over a body-only match),
  // not just a score difference invisible to the coarse ranking rules.
  // Regression coverage for a real bug: with Meilisearch's stock
  // rankingRules order (sort after attribute), sort=date only broke ties
  // *after* this kind of relevance win, so Article A stayed first even
  // when sorting by date — a synthetic fixture without this title/body
  // distinction doesn't reproduce the bug, since word-repetition alone
  // isn't visible to the "attribute" rule.
  const pages: PageIndex[] = [
    makePage({
      title: "Europe Article A",
      route: "/a",
      template: "article",
      extra: { subtype: "artikel" },
      date: "2020-01-01",
    }),
    makePage({
      title: "Post B",
      route: "/b",
      template: "post",
      extra: { subtype: "kurzinfo" },
      date: "2022-01-01",
    }),
    makePage({
      title: "PDF C",
      route: "/c",
      template: "pdf",
      extra: { subtype: "pdf" },
      date: "2021-01-01",
    }),
  ];

  const bodyByRoute: Record<string, string> = {
    "/a": "europe policy discussion",
    "/b": "europe policy discussion",
    "/c": "europe policy discussion",
  };

  const engine = createMeilisearchEngine(
    { url: TEST_URL, apiKey: TEST_KEY, index: TEST_INDEX },
    pages,
    { loadText: (page) => Promise.resolve(bodyByRoute[page.route] ?? "") },
  );

  try {
    await engine.build();
    await waitForIndexing();
    await run(engine);
  } finally {
    await client.deleteAllDocuments().catch(() => {});
  }
}

Deno.test("meilisearch engine: filter narrows to matching subtype", async () => {
  await withEngine(async (engine) => {
    const results = await engine.search("europe", 10, {
      filter: { field: "subtype", value: "artikel" },
    });
    assertEquals(results.length, 1);
    assertEquals(results[0].page.title, "Europe Article A");
    assertEquals(results[0].page.extra?.subtype, "artikel");
  });
});

Deno.test("meilisearch engine: no filter returns all matches", async () => {
  await withEngine(async (engine) => {
    const results = await engine.search("europe", 10);
    assertEquals(results.length, 3);
  });
});

Deno.test("meilisearch engine: sort=date orders newest first", async () => {
  await withEngine(async (engine) => {
    const results = await engine.search("europe", 10, { sort: "date" });
    assertEquals(results.map((r) => r.page.title), ["Post B", "PDF C", "Europe Article A"]);
  });
});

Deno.test("meilisearch engine: facetCounts returns distribution across all matches", async () => {
  await withEngine(async (engine) => {
    const counts = await engine.facetCounts!("europe", "subtype");
    assertEquals(counts, { artikel: 1, kurzinfo: 1, pdf: 1 });
  });
});

Deno.test("meilisearch engine: facetCounts on empty query returns {}", async () => {
  await withEngine(async (engine) => {
    const counts = await engine.facetCounts!("", "subtype");
    assertEquals(counts, {});
  });
});
