There are configuration errors across three files that need fixing:

1. `config/database.json` — the `port` should be `5432` (currently `5433`)
2. `config/cache.json` — the `ttl` should be `3600` (currently `360`)
3. `config/api.json` — the `rateLimit` should be `100` (currently `10`)

Fix all three files. Make sure the rest of each file's content is preserved.
