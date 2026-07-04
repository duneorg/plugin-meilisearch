# Changelog

## [1.0.0] — 2026-07-05

First stable release. No breaking changes from 0.3.1 — the major bump marks
the package's public API as stable going forward, per semver.

### Fixed

- **JSR doc-coverage score was still 61% despite the 0.3.1 fix.** That fix
  only addressed one cause (property-losing re-export aliases); the larger
  cause was that `deno_doc` resolves a re-exported symbol as an unresolved
  reference carrying no JSDoc whenever its origin file is itself a separate
  `deno.json` entrypoint — even when the origin declaration is fully
  documented. Moving each re-export's doc comment to sit directly before the
  specifier name, inside the export braces, fixes this; all 5 entrypoints
  are now at 100% documented symbols.

## [0.3.1] — 2026-07-01

### Fixed

- Removed `PageLike`/`InjectedRecordLike` re-export aliases — they caused deno doc to show alias properties without their JSDoc, lowering the JSR score. Tests now import directly from `@dune/core/search`.
- Added JSDoc to `MeilisearchClient` constructor.

## [0.3.0] — 2026-07-01

### Changed

- **Updated for @dune/core 0.25 SearchManager API** — `onSearchEngineCreate` hook payload now exposes `register(name, engine)` and `setActiveEngine(name)` callbacks. The plugin registers itself as `"meilisearch"` and calls `setActiveEngine("meilisearch")` on startup.
- **`pageToDocument` spreads `page.extra` fields** — any fields placed in a page's `extra` map are now included in the Meilisearch document, making them searchable and retrievable.
- **`injectedRecordToDocument` renamed field parameter** — accepts `fields` map (previously `extra`) consistent with the rest of the API.
