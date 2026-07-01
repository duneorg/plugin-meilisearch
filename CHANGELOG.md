# Changelog

## [0.3.1] — 2026-07-01

### Fixed

- Removed `PageLike`/`InjectedRecordLike` re-export aliases — they caused deno doc to show alias properties without their JSDoc, lowering the JSR score. Tests now import directly from `@dune/core/search`.
- Added JSDoc to `MeilisearchClient` constructor.

## [0.3.0] — 2026-07-01

### Changed

- **Updated for @dune/core 0.25 SearchManager API** — `onSearchEngineCreate` hook payload now exposes `register(name, engine)` and `setActiveEngine(name)` callbacks. The plugin registers itself as `"meilisearch"` and calls `setActiveEngine("meilisearch")` on startup.
- **`pageToDocument` spreads `page.extra` fields** — any fields placed in a page's `extra` map are now included in the Meilisearch document, making them searchable and retrievable.
- **`injectedRecordToDocument` renamed field parameter** — accepts `fields` map (previously `extra`) consistent with the rest of the API.
