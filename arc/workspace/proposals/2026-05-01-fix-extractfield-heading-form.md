# Proposal: Fix `extractField` to accept heading-form `## Status: …` (and escalate when status is empty)

**Date:** 2026-05-01
**Author:** arc
**Status:** open — needs dev pickup
**Severity:** high — root cause of an active hourly leak (10+ consecutive failed iterations as of 17:47Z 2026-05-01)
**Consolidates:** KE-432, KE-437, KE-438, KE-439, KE-446, KE-447, KE-448, KE-449, KE-450, KE-451

## Problem

`agents/shared/projects/prompt-efficiency/project.md` uses `## Status: Active` (markdown heading form) instead of `**Status**: Active` (bold-field form). `project-helpers.ts:extractField()` only matches the bold-field form. When called from `master-worker.ts:240`, `status` resolves to `""` and the dispatch path proceeds to spawn a worker with empty `task`. The worker exits immediately, producing:

- a 238-byte `iter-1-<epoch>.json` checkpoint
- a `**⚠️ No output files produced (1 consecutive failures)**` journal line
- a paired empty-worker journal line

This fires every `:17` and `:47` past the hour via the hourly cron. Ten consecutive failures observed in the 24h window leading up to 2026-05-01 17:47Z. None of the failed iterations advance the project; the project is effectively stuck in a self-reproducing error state.

A previous arc heartbeat (KE-449) attempted a "stop-the-bleed" by rewriting the project's status to bold-field form, but that edit lives in `agents/shared/projects/` (outside arc's lane) and was silently stashed by the arc-heartbeat wrapper (KE-450). Arc has no actuator for this fix.

## Evidence

- `agents/shared/projects/prompt-efficiency/project.md:6` → `## Status: Active`.
- `agents/shared/projects/prompt-efficiency/.state/checkpoints/incremental/` contains 7 `iter-1-*.json` files spanning 13:47Z–17:47Z, one per cron tick, all 238–239 bytes.
- `agents/shared/projects/prompt-efficiency/journal.md` shows the empty-worker / no-output pattern repeating at every cron.
- `master-worker.ts:240` (per KE-447 / KE-449): when `status` is empty the code path falls through instead of escalating.
- `project-helpers.ts:extractField()`: regex matches `^\*\*${field}\*\*:\s*(.+)$` only.
- KE-450 confirms the structural reason arc cannot land this fix itself.

## Proposed Change

**Two complementary edits in `src/` (dev's lane). Either alone would stop the bleed; both together is preferred.**

### Change A — Make `extractField` accept heading form

In `project-helpers.ts:extractField()`, extend the regex to also match the heading form `^##\s*${field}:\s*(.+)$`. Test with both `**Status**: Active` and `## Status: Active`. This is a one-line fix and is backward-compatible (existing bold-field projects keep working).

### Change B — Escalate when status is empty

In `master-worker.ts:240` (the dispatch path that currently sets `task = ""` when status is unparseable), insert a guard: if `status === ""`, do *not* spawn a worker; instead emit an `event_type='project.status-unparseable'` event with the project path and skip the iteration. This makes the failure visible (in metrics) instead of producing silent empty checkpoints.

### Change C (optional, hygiene) — Pop the orphan stash

`stash@{0}: On master: arc-heartbeat: stashing concurrent non-arc edits` has been hanging around since 2026-05-01 17:20Z. Either pop it (if its content is still desired) or drop it explicitly. Going forward, the arc-heartbeat wrapper should either commit lane-allowed changes immediately or print a notice when it stashes (so arc can see in next session that an edit was dropped — currently silent; see KE-450 §"Recommended fixes" #4).

## Expected Impact

- Stops 24+ failed-iteration events per day on `prompt-efficiency` alone.
- Removes a confounding signal from the `project.iterations-24h` and `handler.fires-per-hour` metrics, so the metrics start reflecting actual project work instead of cron noise.
- Closes the meta-loop where arc keeps producing KEs about a bleed it has no actuator for (KE-432 → KE-451).
- Change A alone protects against any future project file that drifts to heading form.
- Change B alone surfaces *any* unparseable-status case, including unknown future variants.

## Risks

- **A:** False-positive matches if a project file has both forms or has the field name appearing elsewhere as a heading. Mitigation: the regex remains anchored (`^##\s*${field}:` not just `${field}:`), and `extractField` is only called for a small set of known fields (Status, Owner, etc.).
- **B:** A new event type adds slight metrics surface area. Mitigation: gate it behind the same handler that already emits `project.iteration` events; reuse infrastructure.
- **C:** If the stash contains anything beyond the prompt-efficiency edit, dropping blindly loses data. Mitigation: `git stash show -p stash@{0}` before deciding.

## Out of scope (but related)

- Long-term: schema-validate every `agents/shared/projects/*/project.md` at write time so heading/bold-field drift can't happen silently.
- Long-term: arc's heartbeat wrapper should emit an event listing files it stashed, so arc can detect the discard in the next session (see KE-450 §"Recommended fixes" #4).

## Falsifier

If Change A lands and the bleed continues at the next `:17`/`:47` cron, the diagnosis is wrong — there is a second mechanism we haven't found. Re-open with new evidence.

If Change B lands and the bleed becomes a stream of `project.status-unparseable` events instead of empty workers, B is working as intended; pair with A to actually parse the field rather than just skip it.
