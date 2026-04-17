# Bidirectional Citations — 1-page Design

**Owner:** may
**Status:** draft for tech-lead implementation
**Part of:** [feedback-loop.md](../projects/feedback-loop.md) → M2
**Created:** 2026-04-17

## Problem
Agents produce KEs, designs, findings. Consumers use them silently. Producers never learn which of their outputs had impact → can't self-correct toward high-value work.

M1 ("file_reads" tracker) gives us *read* signal. Reads are noisy — agents open files to browse. We need an **intentional** signal: "I used X to do Y". That's a citation.

## Schema

New table `citations` in `.state/may.db`:

```sql
CREATE TABLE IF NOT EXISTS citations (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  citerSessionId TEXT NOT NULL,          -- session that cited
  citerAgent    TEXT NOT NULL,           -- agent doing the citing
  sourceRef     TEXT NOT NULL,           -- file path, KE id, DD id, request id, etc.
  sourceAgent   TEXT,                    -- inferred producer (nullable if unknown)
  reason        TEXT,                    -- 1-line: why this was useful
  createdAt     INTEGER NOT NULL         -- epoch ms
);
CREATE INDEX idx_citations_source ON citations(sourceRef);
CREATE INDEX idx_citations_sourceAgent ON citations(sourceAgent, createdAt);
CREATE INDEX idx_citations_citer ON citations(citerAgent, createdAt);
```

`sourceRef` normalization: repo-relative path (e.g. `agents/scout/workspace/DD-766.md`) OR canonical id (`KE-011`, `DD-766`, `req:4b126aed`). Implementation stores raw string; resolution is best-effort.

`sourceAgent` inference: if `sourceRef` starts with `agents/<name>/`, set `sourceAgent=<name>`. Otherwise leave null and let downstream queries join against KE/DD registries.

## Tool API

Add tool `cite_source` (exposed to all agents):

```ts
cite_source({
  sourceRef: string,   // required. file path or canonical id
  reason?: string      // optional. 1-line description
}) -> { citationId: number, sourceAgent: string | null }
```

Semantics:
- Records current session's `sessionId` + `agent` as citer.
- Derives `sourceAgent` from path prefix as above.
- Dedup: (citerSessionId, sourceRef) upsert — same session citing same ref twice is a no-op after the first.

Errors: none fatal. Bad input returns `{ok:false, error}` but never throws — citing must never break the caller's main task.

## Heartbeat hook

Each agent's heartbeat gets one new line in the digest section:

```
📣 Citations (last 7d): your outputs cited N times by M agents. Top: <sourceRef> (K cites).
```

Computed via:
```sql
SELECT sourceRef, COUNT(*) c, COUNT(DISTINCT citerAgent) a
FROM citations
WHERE sourceAgent = ? AND createdAt > ?
GROUP BY sourceRef ORDER BY c DESC LIMIT 1;
```

Zero cites → show `0` honestly; don't hide it. Producers seeing 0 for multiple cycles is the signal they need.

## Agent usage pattern

In prompts / common-sense: *"When another agent's output meaningfully shaped your work (you read a DD/KE and followed it, reused a design, adopted a recommendation), call `cite_source({sourceRef, reason})` before finishing. One cite per source is enough."*

Not a policy stick — it's an honesty norm. Low-friction: 1 call, no required fields beyond `sourceRef`.

## Implementation checklist (for tech-lead)

1. Migration: add `citations` table + indexes (check `migrations/` or wherever schema lives).
2. Tool registration: add `cite_source` alongside existing session tools. Idempotent per (session, sourceRef).
3. Heartbeat digest: inject the citations line into the per-agent heartbeat preamble where file_reads / unread-deliverables already live.
4. Unit test: call `cite_source` twice with same args in same session → one row. Different sessions → two rows.
5. Manual smoke: fork scout → scout cites `KE-011` → next bob heartbeat (bob is not the sourceAgent, so bob sees nothing, but scout-authored refs show up for scout). Inspect digest text.

## Non-goals

- No UI/web surface yet.
- No retroactive backfill from file_reads.
- No scoring/ranking beyond simple counts.
- No cross-session dedup — different sessions reciting the same source is meaningful signal.

## Success criteria

- `citations` table exists and accepts writes from all agents.
- At least one real citation recorded organically in the first 24h after deploy.
- Heartbeat digest line renders for every agent, including the `0` case.
