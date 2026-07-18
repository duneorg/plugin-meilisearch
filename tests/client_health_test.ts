/**
 * Tests for MeilisearchClient — unit tests only, no live server needed.
 * Integration tests (requiring a running Meilisearch) are skipped when
 * the instance is unavailable.
 */

import { assertEquals } from "@std/assert";
import { MeilisearchClient } from "../src/client.ts";

const TEST_URL = Deno.env.get("MEILI_URL") ?? "http://127.0.0.1:7700";
const TEST_KEY = Deno.env.get("MEILI_API_KEY") ??
  Deno.env.get("MEILI_MASTER_KEY") ?? "";

// `/health` responds even when auth is enabled, so a reachable instance
// isn't necessarily a *usable* one — probe a protected endpoint with the
// configured key and skip if it comes back unauthorized.
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

// ── isHealthy ─────────────────────────────────────────────────────────────────

Deno.test("client.isHealthy: returns false for unreachable host", async () => {
  const client = new MeilisearchClient({ url: "http://localhost:19999" });
  assertEquals(await client.isHealthy(), false);
});

Deno.test("client.isHealthy: returns true for live instance (skipped if unavailable)", async () => {
  if (!await meiliAvailable()) {
    console.log("  [skip] Meilisearch not running at", TEST_URL);
    return;
  }
  const client = new MeilisearchClient({ url: TEST_URL, apiKey: TEST_KEY });
  assertEquals(await client.isHealthy(), true);
});

// ── ensureIndex (integration) ─────────────────────────────────────────────────

Deno.test("client.ensureIndex: idempotent (skipped if unavailable)", async () => {
  if (!await meiliAvailable()) {
    console.log("  [skip] Meilisearch not running at", TEST_URL);
    return;
  }
  const client = new MeilisearchClient({
    url: TEST_URL,
    apiKey: TEST_KEY,
    index: "dune_test_index",
  });
  // Should not throw on first or second call
  await client.ensureIndex();
  await client.ensureIndex();
  assertEquals(true, true); // reached without throw
});
