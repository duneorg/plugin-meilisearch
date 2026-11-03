/**
 * Dune retries a failed build in the background; a failure that retrying cannot
 * fix (bad API key, invalid settings) must stop startup instead. These tests
 * run the engine against a local server that answers with fixed statuses, so
 * no Meilisearch is needed.
 */

import { assert, assertEquals, assertRejects } from "@std/assert";
import * as coreSearch from "@dune/core/search";
import { createMeilisearchEngine } from "../src/engine.ts";
import { unrecoverableReason } from "../src/config-error.ts";
import { MeilisearchHttpError } from "../src/client.ts";

/** A server whose every answer is `status`, or per-path answers via `byPath`. */
async function withServer<T>(
  answer: (path: string) => number,
  fn: (url: string) => Promise<T>,
): Promise<T> {
  const server = Deno.serve({ port: 0, onListen: () => {} }, (req) => {
    const status = answer(new URL(req.url).pathname);
    return new Response(JSON.stringify({ message: `status ${status}` }), {
      status,
      headers: { "content-type": "application/json" },
    });
  });
  try {
    return await fn(`http://127.0.0.1:${server.addr.port}`);
  } finally {
    await server.shutdown();
  }
}

const build = (url: string) =>
  createMeilisearchEngine({ url, index: "t" }).build();

Deno.test("build: 401 is a SearchConfigError with an actionable message", async () => {
  await withServer(() => 401, async (url) => {
    const err = await assertRejects(() => build(url));
    // A core that has SearchConfigError gets one; an older core gets a plain Error.
    assertEquals(
      (err as Error).name === "SearchConfigError",
      "SearchConfigError" in coreSearch,
    );
    assert(
      (err as Error).message.includes("rejected the API key"),
      (err as Error).message,
    );
    assert(((err as Error).cause as Error) instanceof MeilisearchHttpError);
  });
});

Deno.test("build: 403 is unrecoverable", async () => {
  await withServer(() => 403, async (url) => {
    const err = await assertRejects(() => build(url));
    assert((err as Error).message.includes("may not do this"));
  });
});

Deno.test("build: 400 on settings is unrecoverable", async () => {
  await withServer(
    (path) => path.endsWith("/settings") ? 400 : 202,
    async (url) => {
      const err = await assertRejects(() => build(url));
      assert((err as Error).message.includes("index settings"));
    },
  );
});

Deno.test("build: 5xx and connection errors stay plain, retryable errors", async () => {
  await withServer(() => 503, async (url) => {
    const err = await assertRejects(() => build(url));
    assert(
      err instanceof MeilisearchHttpError,
      "503 is passed through unchanged",
    );
  });
  const refused = await assertRejects(() => build("http://127.0.0.1:1"));
  assertEquals(refused instanceof MeilisearchHttpError, false);
  assertEquals((refused as Error).name === "SearchConfigError", false);
});

Deno.test("build: an existing index (409) is fine", async () => {
  // 409 on create, then success everywhere else: no error.
  await withServer((path) => path === "/indexes" ? 409 : 202, async (url) => {
    await build(url);
  });
});

Deno.test("unrecoverableReason: only auth failures and bad settings count", () => {
  const e = (status: number, path = "/indexes/t/documents") =>
    new MeilisearchHttpError(status, path, "");
  assertEquals(unrecoverableReason(e(500)), null);
  assertEquals(unrecoverableReason(e(404)), null);
  assertEquals(unrecoverableReason(e(400, "/indexes/t/documents")), null);
  assertEquals(unrecoverableReason(new TypeError("fetch failed")), null);
  assert(unrecoverableReason(e(401)) !== null);
  assert(unrecoverableReason(e(400, "/indexes/t/settings")) !== null);
});
