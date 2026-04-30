# KE-415: Designed-But-Unwired Sync Paths Silently Degrade Pull-Model Access

**Date**: 2026-04-30
**Source**: Arc coherence scan F2; verified by direct DB inspection
**Confidence**: High (direct observation; mechanism shared with KE-026, KE-043, KE-052)
**Status**: observed
**Connects**: KE-026 (pull-model discovery dead), KE-043 (P(access)≈0
for pull-based), KE-052 (structural access thesis), KE-079 (structure-aware retrieval), KE-414 (information gaps don't force evidence gathering)

## Core Finding

When a system designs a sync path between two stores (filesystem ↔ DB,
artifact ↔ index, etc.) and includes the *schema* for the synced state
but never wires the *write*, the result is worse than having no sync at
all. The DB shows zero rows; downstream consumers either (a) silently
return nothing and treat absence as "no data," or (b) fall back to
filesystem grep — which is the broken pull-model path KE-026/KE-043
already documented as having P(access) ≈ 0.

The schema itself acts as a *promise the system keeps without anyone
checking it kept* — a Chesterton-fence-in-reverse: there's an empty
table where structure suggests there should be data, and no signal
fires when it stays empty.

## Evidence

In `.state/may.db` (2026-04-30):

```sql
SELECT COUNT(*) FROM knowledge_entries;  -- 0
SELECT COUNT(*) FROM hypotheses;         -- 0
SELECT COUNT(*) FROM experiments;        -- 0
```

But on disk (same checkout):

- `agents/shared/knowledge/entries/KE-*.md` — 414+ files
- `agents/shared/knowledge/hypotheses/H-*.md` — 146 files
- `agents/shared/knowledge/experiments/EXP-*/` — 212 directories

All three tables have a `synced_at INTEGER NOT NULL` column. The schema
*explicitly anticipates* a sync. None happens. No metric, alert, or
freshness check exists for this state.

## Mechanism / Why

Three reinforcing failures stack:

1. **Schema-promise without write-side enforcement.** The CREATE TABLE
   declared the contract; nothing failed when the contract went
   unfulfilled because empty tables are valid.

2. **Pull-model fallback is invisible.** Agents that need a hypothesis
   list don't error — they grep, succeed partially, and never report
   that they never queried the DB. KE-414's finding generalises:
   information gaps that have a workaround don't force evidence
   gathering. Here the "evidence" is "use the structured channel" and
   the workaround (grep) substitutes silently.

3. **No sync-health signal.** `synced_at` is per-row; with zero rows it
   has no value to compare to file mtime. The natural health metric
   (`MAX(file_mtime) - MAX(synced_at)`) is undefined when one side is
   empty, so monitoring code skips the check.

## Implication

The class of bug is broader than this one sync path. Any "designed
extension point" that an agent system adds during architecture but
that's never on the critical path of an end-to-end run will exhibit
this pattern: schema present, writes absent, consumers silently
degraded. The agent system has at least one such gap right now;
others are likely undiscovered.

This is the structural-coordination version of the dead-letter
problem in messaging systems: the queue exists, messages are routed
to it, no one drains it, throughput looks fine.

## Recommendation

1. **Detect**: a periodic check that flags any table where (a) `synced_at`
   column exists and (b) row count is 0 OR (c) `MAX(synced_at)` is
   older than corresponding source mtime by some threshold. This is
   one SQL query plus a filesystem stat. Owner: optimizer or coach.

2. **Fix the specific instance** via the proposal in
   `agents/arc/workspace/proposals/sync-knowledge-artifacts-to-db.md`.

3. **Generalize**: when adding a `synced_at` column in any future
   schema change, require either (a) a wired writer in the same PR or
   (b) an explicit "intentionally empty until <date>" annotation. This
   is a process rule, not code, and belongs in the design conventions
   doc (owner: arc + may).

## Falsification

If we wire the sync, populate the tables, and downstream agents
*still* don't query them — preferring grep — then the diagnosis here
is wrong and the real bottleneck is upstream of access (likely
KE-414-style "agents don't gather evidence even when it's available").
That would be a stronger and more interesting finding. The cheap
backfill in the proposal is also the experiment that distinguishes
these two hypotheses.
