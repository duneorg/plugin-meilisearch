/**
 * Tests for the plugin factory (the `site.yaml` integration entry point) and
 * the injected-record document mapping. No live Meilisearch instance needed —
 * engine creation does not perform I/O until build() is called.
 */

import { assertEquals, assertExists } from "@std/assert";
import meilisearchPlugin from "../src/plugin.ts";
import { injectedRecordToDocument } from "../src/sync.ts";

Deno.test("plugin: factory returns name, version, and the engine hook", () => {
  const plugin = meilisearchPlugin({ url: "http://127.0.0.1:7700" });
  assertEquals(plugin.name, "meilisearch");
  assertExists(plugin.version);
  assertExists(plugin.hooks.onSearchEngineCreate);
});

Deno.test("plugin: pluginName tag for loader config lookup", () => {
  assertEquals(meilisearchPlugin.pluginName, "meilisearch");
});

Deno.test("plugin: onSearchEngineCreate assigns an engine to the payload", () => {
  const plugin = meilisearchPlugin({ url: "http://127.0.0.1:7700" });
  const data = {
    engine: null as unknown,
    pages: [],
    injectedRecords: [],
    loadText: () => Promise.resolve(""),
  };
  plugin.hooks.onSearchEngineCreate({ data });

  assertExists(data.engine);
  const engine = data.engine as { build: unknown; search: unknown; rebuild: unknown; suggest: unknown };
  assertEquals(typeof engine.build, "function");
  assertEquals(typeof engine.search, "function");
  assertEquals(typeof engine.rebuild, "function");
  assertEquals(typeof engine.suggest, "function");
});

Deno.test("injectedRecordToDocument: maps route/title/body and stable id", () => {
  const doc = injectedRecordToDocument({
    route: "/pdf/issue-1.pdf",
    title: "Quarterly Report",
    body: "revenue figures",
    template: "pdf",
  });
  assertEquals(doc.id, "pdf_issue-1_pdf");
  assertEquals(doc.route, "/pdf/issue-1.pdf");
  assertEquals(doc.title, "Quarterly Report");
  assertEquals(doc.body, "revenue figures");
  assertEquals(doc.template, "pdf");
});

Deno.test("injectedRecordToDocument: extra fields spread onto document", () => {
  const doc = injectedRecordToDocument({
    route: "/pdf/manual.pdf",
    title: "Manual",
    body: "steps",
    fields: { author: "Ada Lovelace" },
  });
  assertEquals(doc["author"], "Ada Lovelace");
  assertEquals(doc.template, "page");
});
