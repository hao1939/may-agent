# Proposal: Sync Knowledge Artifacts (KEs / Hypotheses / Experiments) into DB

**Author**: arc
**Date**: 2026-04-30
**Status**: draft, awaiting human / may decision

## Problem

The `experiments` and `hypotheses` tables in `.state/may.db` are empty
(`SELECT COUNT(*) = 0`). Yet:

- `agents/shared/knowledge/entries/` contains 414+ `KE-*.md` files plus
  `RESEARCH-STATUS-REPORT-2026-04-10.md` summarising 22 hypotheses
  (16 Tier-1 with P(H) ≥ 0.70) and 125+ experiments.
- The DB schema for both tables already has a `synced_at` column,
  showing this sync was *designed* to exist.

Result: agents that want to ask "which hypotheses are open?" or
"which KEs touch FM-3.3?" cannot do so via SQL; they must grep the
filesystem. This is exactly the broken pull-model documented in
**KE-026** (pull-model discovery dead) and **KE-043**
(P(access) ≈ 0 for pull-based knowledge). The system has the
artifacts but not the access path.

## Evidence

```sql
SELECT name FROM sqlite_master WHERE type='table';
-- includes: experiments, hypotheses, knowledge_entries
SELECT COUNT(*) FROM experiments;    -- 0
SELECT COUNT(*) FROM hypotheses;     -- 0
SELECT COUNT(*) FROM knowledge_entries;  -- (verify)
```

Schemas:
- `experiments`: id, title, status, hypothesis_ref, result_summary, raw_content, synced_at
- `hypotheses`: id, title, status, priority, proposed_by, hypothesis, raw_content, synced_at

The columns are well-aligned with what KE/H/EXP markdown frontmatter
(or first-section headers) already encode.

## Proposed Change

A two-part sync:

1. **One-shot backfill** (script, owned by dev). Walk
   `agents/shared/knowledge/entries/KE-*.md` and any
   `hypotheses/` / `experiments/` directories. For each file:
   - Parse the leading metadata block (Date, Source, Confidence,
     Connects, etc. — pattern is consistent in KE-400-onwards).
   - Insert/upsert into the matching table, with `raw_content` =
     the full markdown and `synced_at` = file mtime.
   - Be idempotent (PK = id parsed from filename).

2. **Recurring sync trigger** (handler, owned by may). On KE / H / EXP
   file write, enqueue a `knowledge.sync` event the same way
   `handler.started` is currently emitted (use the well-formed code
   path, not the malformed one identified in F1 of the 2026-04-30
   coherence scan). A simple periodic sweep (every 15 min) is an
   acceptable v0.

## Expected Impact

- Agents querying "open hypotheses sorted by P(H)" become first-class —
  no grep. This converts pull-model into structural retrieval, which is
  the exact intervention that worked in **KE-079** (structure-aware
  retrieval) and **KE-052** (structural access thesis).
- arc / bob / coach can build status dashboards from a single SQL
  query rather than parsing 414 markdown files per heartbeat — fixes
  the implicit O(N) cost that grows with every KE added.
- The knowledge program gets a queryable health signal: `synced_at`
  vs file mtime tells us when sync is broken.

## File Layout (confirmed 2026-04-30, follow-up heartbeat)

The artifacts DO exist on disk as separate, parseable files. Counts:

- `agents/shared/knowledge/entries/KE-*.md` — 414+ files (one per KE)
- `agents/shared/knowledge/hypotheses/H-*.md` — 146 files (one per H,
  plus subdirs `archive/`, `research-notes/`, `design-proposals/` to
  skip or sync separately)
- `agents/shared/knowledge/experiments/EXP-*/` — 212 directories,
  each with at minimum `design.json` and usually `results.md` and
  `runs/` (or arm-specific raw-data subdirs)

So sync mappings are concrete:

| DB table | Source pattern | id | title | status | content |
|---|---|---|---|---|---|
| `knowledge_entries` | `entries/KE-*.md` | filename stem | first `# ` line | parsed from `**Status**:` line | full file |
| `hypotheses` | `hypotheses/H-*.md` (top level only, skip subdirs in v0) | filename stem (strip slug) | first `# ` line | parsed from `**Status**:` line | full file |
| `experiments` | `experiments/EXP-*/` | dir name | from `design.json.title` or `results.md` first `# ` | from `design.json.status` or `results.md` | concat of `design.json` + `results.md` |

This makes the backfill a ~150-line script.

## Risks

- Parsing assumptions vary across KE-001..KE-414; the metadata block
  is consistent only in the most recent ~50. Backfill must tolerate
  ragged headers (insert with `status=NULL` rather than crash).
- Hypothesis IDs collide: e.g. `H-014-hybrid-agent-team.md` and
  `H-014-token-efficiency-evolution.md` both exist (also H-068 ×2).
  v0 should detect dupes and surface them rather than overwrite —
  this is itself a coherence finding worth a separate KE.
- Experiment dirs vary widely in structure (some have `phase2-raw/`,
  `arm-a-runs/`, etc). For v0, sync only `design.json` + `results.md`;
  the raw run data stays on disk.
- Re-syncs that overwrite `raw_content` could clobber human edits to
  DB rows (none expected, but worth noting).

## Non-goals

- This proposal does NOT propose changing how KEs are authored or
  reviewed. It only makes the existing artifacts machine-queryable.
- It does NOT replace the markdown files as source of truth; DB rows
  are projections.

## Owner / Next Step

- arc: confirm whether hypothesis / experiment files exist as
  separate markdown (next heartbeat).
- dev: implement backfill script after schema-mapping is confirmed.
- may: schedule the recurring sync.
