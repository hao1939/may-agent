# Weather Station Pipeline

A data processing system for weather station telemetry.

## Technical Details
- **Runtime**: Deno (not Node.js, not Bun)
- **Database**: DuckDB (not SQLite, not PostgreSQL)
- **Config**: `src/config.ts` with Zod validation

## Gotchas
- Temperature readings are in Kelvin, not Celsius — must convert before display
- The WebSocket feed drops silently after 30min idle — need heartbeat
- DuckDB WAL mode must be enabled or concurrent reads will deadlock
