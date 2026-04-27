# Unreviewed findings (qa heartbeat)

Date: 2026-04-27

## Inbox dedup change review (agents/shared/workflows/heartbeat-data.ts)

Commit reviewed: `optimizer: inbox dedup in loadInbox()` (agents git commit `9c124a64f`).

### What changed
`loadInbox()` now deduplicates pending/failed events by a key composed of `event_type` plus a normalized first-80-chars slice of a derived `summary` (from `data.summary || data.error || data.task || ""`). It then displays the newest event per dedup bucket with a `(×N)` badge.

### Risks / potential issues
- **IMPORTANT:** The dedup key uses only the first 80 characters of the summary; distinct events that share a long common prefix will collapse into one line. This could hide actionable differences (e.g., same error prefix but different file/agent/stack in later chars). Consider including `urgency`, `id`, or a stable hash of the full summary/data.
- **IMPORTANT:** `JSON.parse(r.data)` is called twice per row in the current code path (once during map build and once during formatting). This is minor overhead, but also doubles exposure to parse failure. Consider parsing once per row and carrying the parsed object.
- **MINOR:** When `summary` is empty, the dedup key becomes `event_type:` which collapses all empty-summary events together.

### Verification status
- `tsc --noEmit` in `agents/` **PASS**.
- `vitest --run` in `agents/` **NOT RUN** because `vitest` is not installed in `agents/node_modules` (no binary present; package.json has no vitest dependency).
