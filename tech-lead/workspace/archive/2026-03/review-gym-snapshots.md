# Review: Gym Benchmark Tracking Design
**Date**: 2026-03-24
**Reviewer**: Tech Lead
**Doc**: agents/shared/may-agent-docs/design/gym-snapshots.md
**Request**: req:eb2931a0

## Verdict: APPROVE with phasing

Good design. The problem is real — 82 scenarios as a flat table is useless. The solution is proportional. A few notes:

## What's Already Done
- **DB unification** (Section 1): Landed in `fda5082`. `gym_runs` and `gym_checks` are already in `may.db`. Cross this off the implementation list.

## Schema Review

The proposed `ALTER TABLE` additions to `gym_runs` are sound:
- `run_tag`, `config_hash`, `framework_sha`, `model`, `batch_id` — all TEXT, all nullable. No conflicts with existing columns.
- `categories`, `tags` as JSON TEXT — fine for SQLite. No need for normalized tables at this scale.
- `tier` TEXT — simple and correct.

**One concern**: The doc proposes `ALTER TABLE` but `requests.ts` uses `CREATE TABLE IF NOT EXISTS`. Since we control the schema DDL, just add the columns directly to the existing `CREATE TABLE` statement. SQLite's `ALTER TABLE ADD COLUMN` works but is unnecessary here since we can modify the DDL. Existing rows will have NULL for new columns, which is fine.

The `gym_snapshots` table is clean — `config_hash` as PK, `files` as JSON blob. The `ON DELETE CASCADE` question doesn't apply here (no FK from `gym_runs` to `gym_snapshots`). Consider adding one:
```sql
FOREIGN KEY(config_hash) REFERENCES gym_snapshots(config_hash)
```
But this is optional — the snapshot is for reference, not referential integrity.

## Recording Flow

The proposed changes to `gym-runner.ts`, `gym-record.ts`, and `gym-baseline.sh` are the right files. One missing integration point: `scripts/gym-run.sh` needs to pass `--batch` and `--tag` through to `gym-record.ts`. Check that the shell script forwards unknown args.

## Web UI

The batch timeline + comparison view is a good design. The CSS-bar category chart is the right simplicity level. No chart library needed.

**Suggestion**: Phase the UI work:
1. **Phase 1**: Schema + recording flow (batch_id, config_hash, metadata columns). Ship this first — the data layer must work before the UI can show anything.
2. **Phase 2**: Batch timeline view + category grouping.
3. **Phase 3**: Comparison view + config diff panel. This is the most complex piece.

## Implementation Recommendation

Ship Phase 1 first. It's the foundation and has the lowest risk. The data starts accumulating immediately. The UI can be built on top of real data.

Estimated effort: Phase 1 = 1 session, Phase 2 = 1-2 sessions, Phase 3 = 2 sessions.

## Summary
- Schema: Sound, no conflicts. Add columns to existing CREATE TABLE DDL.
- Recording flow: Right files identified. Minor gap: gym-run.sh arg forwarding.
- UI: Good design, phase it. Data layer first.
- Approve for implementation in phases.
