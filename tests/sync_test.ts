/**
 * Unit tests for the PageIndex → MeilisearchDocument mapping and the sync order.
 * No network calls required.
 */

import { assertEquals } from "@std/assert";
import { pageToDocument, routeToId, syncDocuments } from "../src/sync.ts";
import type { MeilisearchClient } from "../src/client.ts";
import type { MeilisearchDocument } from "../src/types.ts";
import type { PageIndex as PageLike } from "@dune/plugin-api";

function makePage(overrides: Partial<PageLike> = {}): PageLike {
  return {
    route: "/articles/my-post",
    title: "My Post",
    date: "2024-06-01",
    template: "article",
    language: "de",
    published: true,
    taxonomy: { tag: ["ewr", "demokratie"] },
    extra: { subtype: "artikel" },
    ...overrides,
    // deno-lint-ignore no-explicit-any
  } as any;
}

// ── routeToId ─────────────────────────────────────────────────────────────────

Deno.test("routeToId: converts route to stable id", () => {
  assertEquals(routeToId("/articles/my-post"), "articles_my-post");
  assertEquals(routeToId("/dossiers/ewr"), "dossiers_ewr");
  assertEquals(routeToId("/"), "root");
});

Deno.test("routeToId: strips leading slash", () => {
  assertEquals(routeToId("/foo/bar"), "foo_bar");
});

Deno.test("routeToId: handles special characters", () => {
  const id = routeToId("/articles/über-die-eu");
  // Non-alphanumeric non-dash chars become underscores
  assertEquals(id.includes("ber"), true);
  assertEquals(id.startsWith("articles"), true);
});

// ── pageToDocument ────────────────────────────────────────────────────────────

Deno.test("pageToDocument: basic mapping", () => {
  const doc = pageToDocument(makePage());
  assertEquals(doc.route, "/articles/my-post");
  assertEquals(doc.title, "My Post");
  assertEquals(doc.date, "2024-06-01");
  assertEquals(doc.template, "article");
  assertEquals(doc.language, "de");
  assertEquals(doc.id, "articles_my-post");
});

Deno.test("pageToDocument: flattens taxonomy into tags", () => {
  const doc = pageToDocument(
    makePage({
      taxonomy: { tag: ["ewr", "demokratie"], category: ["politics"] },
    }),
  );
  assertEquals(Array.isArray(doc.tags), true);
  assertEquals((doc.tags as string[]).includes("ewr"), true);
  assertEquals((doc.tags as string[]).includes("demokratie"), true);
  assertEquals((doc.tags as string[]).includes("politics"), true);
});

Deno.test("pageToDocument: empty taxonomy produces empty tags", () => {
  const doc = pageToDocument(makePage({ taxonomy: {} }));
  assertEquals(doc.tags, []);
});

Deno.test("pageToDocument: extra fields spread onto document", () => {
  const doc = pageToDocument(makePage({ extra: { subtype: "kurzinfo" } }));
  assertEquals(doc["subtype"], "kurzinfo");
});

Deno.test("pageToDocument: no extra → no extra fields beyond standard", () => {
  const doc = pageToDocument(makePage({ extra: undefined }));
  assertEquals(doc["subtype"], undefined);
});

Deno.test("pageToDocument: null date preserved", () => {
  const doc = pageToDocument(makePage({ date: null }));
  assertEquals(doc.date, null);
});

// ── syncDocuments ─────────────────────────────────────────────────────────────

function fakeClient(existing: string[]) {
  const calls: string[] = [];
  const client = {
    listDocumentIds: () => {
      calls.push("list");
      return Promise.resolve(existing);
    },
    putDocuments: (docs: { id: string }[]) => {
      calls.push(`put:${docs.map((d) => d.id).join(",")}`);
      return Promise.resolve({});
    },
    deleteDocuments: (ids: string[]) => {
      calls.push(`delete:${ids.join(",")}`);
      return Promise.resolve({});
    },
    deleteAllDocuments: () => {
      calls.push("deleteAll");
      return Promise.resolve({});
    },
  };
  return { client: client as unknown as MeilisearchClient, calls };
}

const doc = (id: string) => ({ id } as unknown as MeilisearchDocument);

Deno.test("syncDocuments: upserts everything, then deletes only the ids that are gone", async () => {
  const { client, calls } = fakeClient(["a", "b", "gone"]);
  await syncDocuments(client, [doc("a"), doc("b"), doc("c")]);
  assertEquals(calls, ["list", "put:a,b,c", "delete:gone"]);
});

Deno.test("syncDocuments: never empties the index, and deletes nothing when nothing is stale", async () => {
  const { client, calls } = fakeClient(["a"]);
  await syncDocuments(client, [doc("a")]);
  assertEquals(calls, ["list", "put:a"]);
});

Deno.test("syncDocuments: batches puts and deletes", async () => {
  const { client, calls } = fakeClient(["x", "y", "z"]);
  await syncDocuments(client, [doc("a"), doc("b"), doc("c")], 2);
  assertEquals(calls, ["list", "put:a,b", "put:c", "delete:x,y", "delete:z"]);
});
