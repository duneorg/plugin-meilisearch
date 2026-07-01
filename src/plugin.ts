/**
 * @dune/plugin-meilisearch — Dune plugin entry point.
 *
 * Registers Meilisearch as a named search engine via the `onSearchEngineCreate`
 * hook. When `active` is true (the default), sets it as the active engine,
 * replacing the built-in in-memory search. When `active` is false, the engine
 * is registered but the built-in engine remains active — useful for running
 * both in parallel mode.
 *
 * Enable from `site.yaml`:
 *
 * ```yaml
 * plugins:
 *   - src: "jsr:@dune/plugin-meilisearch"
 *     config:
 *       url: "http://127.0.0.1:7700"   # or env MEILI_URL
 *       apiKey: "${MEILI_API_KEY}"      # or env MEILI_API_KEY
 *       index: "content"               # default: content
 *       active: true                   # default: true
 * ```
 *
 * @module
 */

import type { SearchEngineCreateContext } from "@dune/core/search";
import type { DunePlugin } from "@dune/core/hooks";
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
  /**
   * Whether to set Meilisearch as the active search engine.
   * Set to false to register the engine without activating it
   * (useful when enabling parallel mode manually).
   * @default true
   */
  active?: boolean;
}

const PLUGIN_VERSION = "0.3.0";

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
 * Dune plugin factory for Meilisearch-backed search.
 *
 * The Dune loader calls this with the merged plugin config from `site.yaml`.
 * Registers a `meilisearch` engine via the `onSearchEngineCreate` hook and
 * sets it as the active engine unless `config.active` is false.
 */
function meilisearchPlugin(
  config: MeilisearchPluginConfig = {},
): DunePlugin {
  const url = envOr(config.url, "MEILI_URL") ?? "http://127.0.0.1:7700";
  const apiKey = envOr(config.apiKey, "MEILI_API_KEY");
  const makeActive = config.active !== false;

  return {
    name: "meilisearch",
    version: PLUGIN_VERSION,
    description: "Meilisearch-backed search engine.",
    hooks: {
      onSearchEngineCreate: (ctx: unknown) => {
        const { data } = ctx as { data: SearchEngineCreateContext };
        const engine = createMeilisearchEngine(
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
        data.register("meilisearch", engine);
        if (makeActive) {
          data.setActiveEngine("meilisearch");
        }
      },
    },
  };
}

// The loader reads `.pluginName` to look up config before invoking the factory.
meilisearchPlugin.pluginName = "meilisearch";

export default meilisearchPlugin;
