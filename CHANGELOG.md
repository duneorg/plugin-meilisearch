# Changelog

## [1.0.1] — 2026-07-18

### Fixed

- **`meiliAvailable()` only checked `/health`**, which Meilisearch serves
  even with a master key configured — integration tests treated an
  auth-enabled instance as usable and then failed with 401s instead of
  skipping cleanly. Now probes a protected endpoint with the configured
  key and skips if unauthorized. Also honors `MEILI_MASTER_KEY` as a
  fallback to `MEILI_API_KEY` so the integration tests run for real when
  a key is supplied.
- **`isHealthy()` never consumed its response body**, leaking a
  `ReadableStream` on every call.
- **The `@dune/core` dependency range was stale (`^0.25`)**, unrelated to
  the actual `@dune/core@^0.24` this package has required since its
  `/search` and `/hooks` subpaths were introduced — a site on a newer
  core loaded a second, older copy of `@dune/core` just for this plugin.
  Bumped to a bounded per-minor pin, `jsr:@dune/core@0.31` (auto-tracks
  patch releases within that minor), so Deno unifies it with the host
  site's pinned core version. An unbounded range (`@0`, any 0.x) was
  tried first and reverted: JSR validates a package's `jsr:` subpath
  imports against the *oldest* version satisfying the declared range,
  not the newest, so an open floor resolves to the earliest `@dune/core`
  ever published and fails publish for any subpath that postdates it
  (this package's `/search` and `/hooks` didn't exist until core 0.24.0).
- **`minimumDependencyAge` now excludes `jsr:@dune/core`** from Deno's
  24-hour freshness gate (default since Deno 2.9) — without this, a
  version bump immediately after a `@dune/core` release fails publish
  since the new core version is "too fresh." `@dune/core` is a same-org
  first-party dependency published by the same release process, so the
  supply-chain risk that gate protects against doesn't apply here. Scoped
  to just this one package so third-party npm dependencies keep the full
  24-hour window.

## [1.0.0] — 2026-07-05

First stable release. No breaking changes from 0.3.1 — the major bump marks the
package's public API as stable going forward, per semver.

### Fixed

- **JSR doc-coverage score was still 61% despite the 0.3.1 fix.** That fix only
  addressed one cause (property-losing re-export aliases); the larger cause was
  that `deno_doc` resolves a re-exported symbol as an unresolved reference
  carrying no JSDoc whenever its origin file is itself a separate `deno.json`
  entrypoint — even when the origin declaration is fully documented. Moving each
  re-export's doc comment to sit directly before the specifier name, inside the
  export braces, fixes this; all 5 entrypoints are now at 100% documented
  symbols.

## [0.3.1] — 2026-07-01

### Fixed

- Removed `PageLike`/`InjectedRecordLike` re-export aliases — they caused deno
  doc to show alias properties without their JSDoc, lowering the JSR score.
  Tests now import directly from `@dune/core/search`.
- Added JSDoc to `MeilisearchClient` constructor.

## [0.3.0] — 2026-07-01

### Changed

- **Updated for @dune/core 0.25 SearchManager API** — `onSearchEngineCreate`
  hook payload now exposes `register(name, engine)` and `setActiveEngine(name)`
  callbacks. The plugin registers itself as `"meilisearch"` and calls
  `setActiveEngine("meilisearch")` on startup.
- **`pageToDocument` spreads `page.extra` fields** — any fields placed in a
  page's `extra` map are now included in the Meilisearch document, making them
  searchable and retrievable.
- **`injectedRecordToDocument` renamed field parameter** — accepts `fields` map
  (previously `extra`) consistent with the rest of the API.
