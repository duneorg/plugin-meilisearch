# Changelog

## [1.2.0] — 2026-07-21

### Added

- **`offset` passthrough for pagination**, threading `SearchOptions.offset`
  (added in `@dune/core@0.31.2`) into Meilisearch's native `offset` search
  param — lets a caller page through a result set instead of only ever
  getting the first page.

### Fixed

- **`@dune/core` pin narrowed to `^0.31.2`.** `offset` doesn't exist on
  `SearchOptions` before that version — the previous `^0.31.1` pin's floor
  would type-check against a core version that predates this release's own
  dependency, the same JSR-oldest-version-in-range issue hit last release.
  `deno.lock` regenerated to match (was still resolving `@dune/core` to
  `0.31.0` from the original unbounded pin).

## [1.1.0] — 2026-07-20

### Added

- **`filter`/`sort` options and `facetCounts()`** — implements the
  `SearchOptions`/`FacetCounts` additions from `@dune/core@0.31.1` (search
  filter/sort/facets support). `filter` narrows results to a single
  `field=value` match; `sort: "date"` orders newest-first; `facetCounts(query,
  field)` returns a value→count map. `subtype` added to `filterableAttributes`
  by default so a site's facet config works out of the box.

### Fixed

- **The `@dune/core` pin (`0.31`) floored below the exports this release
  needs.** JSR validates a subpath import against the *oldest* version
  satisfying the declared range, and `0.31.0` predates the `FacetCounts`/
  `SearchFilter`/`SearchOptions` exports added in `0.31.1` — first publish
  attempt failed type-checking against that floor. Narrowed to `^0.31.1`,
  which still tracks future `0.31.x` patches but floors at the version that
  actually has these exports.
- **`sort: "date"` barely reordered results.** Meilisearch's stock
  `rankingRules` order only lets `sort` break ties *after* relevance scoring —
  verified against a real 4500-document index that this meant sort=date had
  almost no visible effect. Moved `sort` to the front of the default
  `rankingRules` so it takes priority over relevance when a caller explicitly
  requests it; a plain relevance search (no `sort` param) is unaffected.

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
