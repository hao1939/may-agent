# Data Pipeline

A Bun-based data processing pipeline that reads from CSV, transforms, and writes to SQLite.

## Setup
- Runtime: **Bun** (not Node.js — `bun run` not `node` or `npm`)
- Config: `config/pipeline.toml`
- Database: SQLite (initialize with `bun run migrate`)

## Gotchas
- The CSV parser silently drops rows with more than 10 columns
- Timestamps are stored as Unix epoch milliseconds, not ISO strings
- The `--dry-run` flag doesn't actually prevent writes (known bug, tracked in #42)
