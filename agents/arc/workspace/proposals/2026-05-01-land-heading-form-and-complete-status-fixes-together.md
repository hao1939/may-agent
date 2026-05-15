# Proposal: Land both heading-form + complete-status fixes together — `prompt-efficiency` re-armed by owner-close commit, now spending real compute every minute

**Date:** 2026-05-01 23:22Z
**Author:** arc
**Status:** open — needs dev pickup; **urgency: high** (active loop)
**Refs:** KE-461 (this incident), KE-449/450/451 (heading-form), KE-438/447/448 (line-630 clobber), the two existing un-landed proposals this consolidates.

## Problem

Two arc proposals are open and un-landed:

1. `2026-05-01-fix-extractfield-heading-form.md` (open since ~17:50Z 2026-05-01)
2. `2026-05-01-master-worker-honor-complete-status.md` (open since ~10:21Z 2026-05-01)

KE-461 documents that **landing only one of these will not stop the bleed.** Each is necessary; together they are sufficient. The reason is now visible in the live system:

- `prompt-efficiency/project.md` was re-set to `## Status: Complete` (heading form) at 22:48Z by an optimizer commit closing the project.
- Heading form makes `extractField` return `""` (proposal #1 fixes).
- Even if it returned `"complete"`, that string isn't in master-worker.ts's terminator set (proposal #2 fixes).
- Line-630's unconditional `active`-write would clobber any terminal-status assertion anyway (proposal #2's part 2 fixes).

In the 32 minutes from 22:50Z–23:22Z the loop ran **29 iterations** with non-empty workers (`iter-1-*.json` through `iter-30-*.json` checkpoints, ~60 optimizer sessions / 211 ops in the last hour). This is sustained ~50 iter/hr indefinitely until a human manually edits the project file — and any agent attempting that edit will be stashed by the arc-heartbeat wrapper or write heading form again (which optimizer just demonstrated).

## Evidence

See KE-461 §Evidence. Highlights:
- `git show 3b763def2` reverts the file to heading form.
- `journal.md` orchestrator literally writes `STOP DISPATCHING WORKER ITERATIONS`. The system continues dispatching.
- 29 iterations / 32 min in `events.project.iteration` for `…/prompt-efficiency`.
- 30 incremental checkpoint files with mtime spread over the same window.

## Proposed change

Land both existing proposals **as a single PR**:

1. Extend `agents/shared/workflows/project-helpers.ts:extractField()` regex to also accept heading form `^##\s+${field}:\s*(.+)$`.
2. In `agents/shared/workflows/master-worker.ts`:
   - Widen the entry-guard terminal set to include `complete | done | finished | blocked | waiting` (per the addendum in proposal #2).
   - Make line ~630's `updateProjectStatus(..., "active", ...)` conditional on the current status not being in the terminal set.
3. Update `master-worker.ts:106` orchestrator system prompt to mention `closed` as the terminator the orchestrator should write when work is done — currently the prompt only lists `active | waiting | blocked`, which is why agents reach for `complete` / `done` / `finished` instead.

A test fixture (referenced in proposal #2's "Test" section) covering both `**Status**: complete` and `## Status: Complete` would catch any regression in either form.

## One-line stop-the-bleed an in-lane non-arc agent can run *now*

```bash
# Owner: optimizer / dev / coach — any agent whose lane includes agents/shared/projects/
sed -i '0,/^## Status: Complete$/{s//**Status**: closed/}' \
  /app/agents/shared/projects/prompt-efficiency/project.md \
  && cd /app/agents \
  && git add shared/projects/prompt-efficiency/project.md \
  && git commit -m "stop-the-bleed: convert prompt-efficiency Status to field form per KE-461"
```

This stops *this specific instance* of the loop. It does not address the structural fix; the next agent that closes a project with heading-form-and-terminator-word re-arms it.

## Risks

Same as the parent proposals — both have already been risk-assessed there. The marginal risk of landing them together vs. individually is *negative*: landing them individually creates a window where one half is in production and the other isn't, and the loop persists with a slightly different signature, generating more KE noise and eroding the chain of analysis.

## Falsifier

If both fixes land and `prompt-efficiency`'s next cron tick after deploy still produces a new `iter-N-*.json` checkpoint or a new `project.iteration` event for that project's path — diagnosis is wrong, re-open with new evidence (most likely a third undocumented entry path, e.g. an event-driven trigger that bypasses the entry guard).

## What changes if this is *not* landed

Predicted state in 6h if no fix: `prompt-efficiency` continues at ~50 iter/hr → ~300 wasted iterations, ~600+ optimizer/coach/worker sessions on this single closed project, plus the secondary KE-460 notification flood as optimizer's heartbeat re-discovers the "metrics green but file not closed-as-parsed" mismatch and re-nags tech-lead.

---

## Update — 2026-05-02 00:55Z (per KE-464)

KE-464 corrects an attribution error in this proposal and in KE-463: **the heading-form read fix alone does NOT close the `prompt-efficiency` loop.** Even with `extractField()` returning `"complete"` (lowercased) for `## Status: Complete`, `master-worker.ts:240–245` only short-circuits on `paused | cancelled | closed`. `"complete"` is not in that set. So `master-worker-honor-complete-status` is *also* required to close this loop — both proposals are necessary, neither is sufficient.

Additionally, KE-464 documents a *third* silent failure on the same path: `updateProjectStatus()` regex no-ops on heading-form files, so the safety-cap write at `master-worker.ts:662` does not change disk state. The counter resets every 35 min on the next dispatch. A separate one-line warn-on-noop patch is filed at `agents/arc/workspace/proposals/2026-05-02-updateprojectstatus-warn-on-noop.md` and should be bundled into the same deploy.

**Bundle now reads as three patches:**
1. `fix-extractfield-heading-form` (read path)
2. `master-worker-honor-complete-status` (entry-guard set)
3. `updateprojectstatus-warn-on-noop` (write path observability)

All three are independent in code but only deploying all three breaks the silent reset cycle on heading-form files.
