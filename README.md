# @dune/meilisearch

[Meilisearch](https://www.meilisearch.com)-backed search engine for [Dune CMS](https://getdune.com) sites.

Drop-in replacement for Dune's built-in in-memory search engine. Implements the same `SearchEngine` interface — no changes to templates or route handlers. Swap in when you need:

- Typo tolerance and fuzzy matching
- Language-aware stemming and compound word handling
- Synonym expansion and stop words
- Persistent index across restarts
- Sub-millisecond queries at large corpus sizes (thousands of pages + PDFs)

## Installation

Requires a running Meilisearch instance (v1.0+).

Add to your site's `deno.json`:

```json
{
  "imports": {
    "@dune/meilisearch": "jsr:@dune/meilisearch",
    "@dune/meilisearch/engine": "jsr:@dune/meilisearch/engine"
  }
}
```

## Usage

Pass the engine to Dune's bootstrap where a `SearchEngine` is expected:

```ts
import { createMeilisearchEngine } from "@dune/meilisearch/engine";

const search = createMeilisearchEngine({
  url: Deno.env.get("MEILI_URL") ?? "http://127.0.0.1:7700",
  apiKey: Deno.env.get("MEILI_API_KEY"),
  index: "content", // optional, default: "content"
}, pages); // your PageIndex[] from Dune
```

On `build()`, the engine:

1. Creates the Meilisearch index if it does not exist
2. Applies index settings (searchable/filterable attributes, ranking rules, typo tolerance)
3. Syncs all published pages as documents (delete-all then batch-put)

On `rebuild(pages)`, the full sync runs again with the new page list — used automatically by `dune dev` on content changes.

## Configuration

All options except `url` are optional.

```ts
createMeilisearchEngine({
  url: "http://127.0.0.1:7700",
  apiKey: "your-api-key",
  index: "content",
  excerptLength: 160,         // characters in returned excerpts
  settings: {
    // Override any Meilisearch index settings
    stopWords: ["der", "die", "das", "und", "in"],
    synonyms: {
      "eu": ["europäische union", "europa"],
    },
    rankingRules: ["words", "typo", "proximity", "attribute", "sort", "exactness"],
    typoTolerance: {
      enabled: true,
      minWordSizeForTypos: { oneTypo: 5, twoTypos: 9 },
    },
  },
}, pages);
```

### Default index settings

Applied on every `build()` unless overridden:

| Setting | Default |
|---------|---------|
| `searchableAttributes` | `["title", "body", "tags"]` |
| `filterableAttributes` | `["template", "language", "tags"]` |
| `sortableAttributes` | `["date"]` |
| `rankingRules` | words → typo → proximity → attribute → sort → exactness |
| `typoTolerance` | enabled, oneTypo ≥ 5 chars, twoTypos ≥ 9 chars |

## Custom facet fields

If your site uses `system.search.facets` in `site.yaml` (Dune's `PageIndex.extra`), those fields are automatically spread onto Meilisearch documents and available for filtering:

```yaml
# site.yaml
system:
  search:
    facets:
      - field: subtype
```

With this config, `subtype` values (`kurzinfo`, `buchbesprechung`, etc.) are indexed and filterable via the standard Dune search API.

## Document schema

Each Dune page is indexed as:

```ts
{
  id: string;       // stable ID derived from route
  route: string;    // e.g. "/articles/my-article"
  title: string;
  body: string;     // plain text body
  date: string | null;
  template: string;
  language: string;
  tags: string[];   // all taxonomy values flattened across vocabs
  // ...extra fields from PageIndex.extra
}
```

## Running Meilisearch

The quickest way to get a local instance:

```bash
# Docker
docker run -d -p 7700:7700 getmeili/meilisearch:latest

# Or download the binary
curl -L https://install.meilisearch.com | sh
./meilisearch
```

For production, run Meilisearch as a systemd service on the same server as Dune and bind it to `127.0.0.1` only — no public exposure needed.

## License

MIT
