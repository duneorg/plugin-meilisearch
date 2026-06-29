/**
 * @dune/plugin-meilisearch — Dune plugin entry point.
 *
 * Replaces Dune's built-in search engine with a Meilisearch backend by
 * registering for the `onSearchEngineCreate` hook. Enable it from `site.yaml`
 * with no code:
 *
 * ```yaml
 * # site.yaml
 * plugins:
 *   - src: "jsr:@dune/plugin-meilisearch"
 *     config:
 *       url: "http://127.0.0.1:7700"   # or env MEILI_URL
 *       apiKey: "${MEILI_API_KEY}"      # or env MEILI_API_KEY
 *       index: "content"                # default: content
 *       # settings: { ... }             # optional Meilisearch index settings
 * ```
 *
 * `url`/`apiKey` fall back to the `MEILI_URL` / `MEILI_API_KEY` environment
 * variables when not set in config. Dune calls the engine's `build()` at
 * startup and `rebuild()` on content changes; the plugin reuses the host's
 * `loadText` helper to index full page bodies, and indexes any plugin-injected
 * records (e.g. `@dune/plugin-pdf` text) alongside content pages.
 *
 * The lower-level `createMeilisearchEngine` remains exported from the package
 * root for custom wiring.
 *
 * @module
 */

import { createMeilisearchEngine } from "./engine.ts";
import type { MeilisearchIndexSettings } from "./types.ts";

/** Configuration accepted from the `site.yaml` plugin entry. */
export interface MeilisearchPluginConfig {
  /** Base URL of the Meilisearch instance. Falls back to env `MEILI_URL`. */
  url?: string;
  /** API key. Falls back to env `MEILI_API_KEY`. */
  apiKey?: string;
  /** Index name. @default "content" */
  index?: string;
  /** Meilisearch index settings, merged over the plugin defaults. */
  settings?: MeilisearchIndexSettings;
  /** Excerpt length in characters. @default 160 */
  excerptLength?: number;
}

/** Minimal structural view of the Dune plugin API used here. */
interface DunePluginLike {
  name: string;
  version: string;
  description?: string;
  hooks: Record<string, (ctx: unknown) => unknown | Promise<unknown>>;
}

/** Structural view of the `onSearchEngineCreate` hook payload. */
interface SearchEngineCreateData {
  // deno-lint-ignore no-explicit-any
  engine: any;
  // deno-lint-ignore no-explicit-any
  pages: any[];
  // deno-lint-ignore no-explicit-any
  injectedRecords: any[];
  // deno-lint-ignore no-explicit-any
  loadText: (page: any) => Promise<string>;
}

const PLUGIN_VERSION = "0.2.0";

function envOr(value: string | undefined, envKey: string): string | undefined {
  if (value) return value;
  try {
    return Deno.env.get(envKey) ?? undefined;
  } catch {
    // No --allow-env — config must supply the value.
    return undefined;
  }
}

/**
 * Plugin factory. The Dune loader calls this with the merged plugin config
 * from `site.yaml`.
 */
export default function meilisearchPlugin(
  config: MeilisearchPluginConfig = {},
): DunePluginLike {
  const url = envOr(config.url, "MEILI_URL") ?? "http://127.0.0.1:7700";
  const apiKey = envOr(config.apiKey, "MEILI_API_KEY");

  return {
    name: "meilisearch",
    version: PLUGIN_VERSION,
    description: "Meilisearch-backed search engine.",
    hooks: {
      onSearchEngineCreate: (ctx: unknown) => {
        const data = (ctx as { data: SearchEngineCreateData }).data;
        data.engine = createMeilisearchEngine(
          {
            url,
            apiKey,
            index: config.index ?? "content",
            settings: config.settings,
            excerptLength: config.excerptLength,
          },
          data.pages,
          {
            loadText: data.loadText,
            injectedRecords: data.injectedRecords,
          },
        );
      },
    },
  };
}

// The loader reads `.pluginName` to look up config before invoking the factory.
meilisearchPlugin.pluginName = "meilisearch";
