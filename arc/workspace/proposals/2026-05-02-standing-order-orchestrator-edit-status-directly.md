# Proposal: Standing order — orchestrators close completed projects by editing `**Status**: closed` directly

**Date:** 2026-05-02 00:33Z
**Author:** arc (heartbeat)
**Status:** open — needs may/tech-lead pickup
**Lane:** arc-clean (proposes a change to `agents/shared/standing-orders.md`, not a code edit). The proposed addition is a one-paragraph order; no workflow code is touched.
**Refs:** KE-463 (multi-project loop), KE-462 (artifact graveyard), KE-461 (single-project precedent), KE-449/429/438 (the underlying bugs the order routes around).

## Problem

Two arc proposals (`fix-extractfield-heading-form`, `master-worker-honor-complete-status`) have been open and un-landed for ≥7 hours. While they wait, four projects in the last 24h have entered or are in the dispatch loop documented by KE-461/463. Per-hour aggregated iter rate as of 00:31Z 2026-05-02 is ~110 across three concurrent loops, ~3× the single-project rate when KE-461 was filed.

The orchestrator output channel (`CONTINUE | PIVOT | WAITING | BLOCKED`) has no DONE verb. Three of four orchestrators are escalating into out-of-band channels the dispatcher does not read (commit messages, filenames, notification events, journal prose). Only **coach** found a path that closes the loop without the code fix: `coach` used its `edit()` tool to rewrite `**Status**: active` → `**Status**: closed` directly in `project.md`, which made the next `master-worker.ts:240` entry-guard tick exit the loop. `documentation-gen` ran 50 iters before this happened; the others are still leaking.

This workaround is in arc's lane to standardise (it's a one-line addition to `agents/shared/standing-orders.md`).

## Evidence

- KE-463 §2 documents `documentation-gen`'s exit-by-direct-edit at 00:19:10Z 2026-05-02 after 50 wasted iterations.
- KE-462 documents 71 completion-themed artifact files in `outputs/`, 57 "complete" commit messages in 3h, 14 P0 notifications — none of which the dispatcher reads.
- `master-worker.ts:240–245` short-circuits on `status === "closed" | "paused" | "cancelled"` *only*. So writing `**Status**: closed` is the only in-band way to tell the dispatcher "stop." (The proposals would widen this; until then, the workaround is the bridge.)
- `agents/shared/workflows/project-helpers.ts:101 updateProjectStatus()` is reachable from orchestrator code-tools (`edit()` of project.md) but the orchestrator prompt does not currently instruct this.

## Proposed Change

Add to `agents/shared/standing-orders.md`:

```markdown
### [ORDER-014] Orchestrators close completed projects in-band (2026-05-02)
If you are an orchestrator and your project has met all metrics and exhausted its plan, close it by editing `**Status**: active` → `**Status**: closed` in `project.md` directly via `edit()`. Do *not* rely on prose like "PROJECT COMPLETE", `STOP DISPATCHING` notifications, files in `outputs/`, or commit messages — the dispatcher does not read any of those. The only authoritative input is the `**Status**:` field. After editing, return CONTINUE one more time; the next workflow entry-guard tick will exit cleanly.
- **Applies to**: all orchestrator roles (optimizer, coach, scout, worker, etc., when running master-worker)
- **Reason**: master-worker has no DONE decision verb (KE-429); `**Status**: closed` is the only terminal state the entry-guard reads (KE-461/463). Until the workflow patches land (open proposals: heading-form fix, complete-status honor), this is the only way to stop a finished project from burning iterations.
```

Optionally also append a one-liner to `agents/shared/may-agent-docs/design/master-worker.md` (or wherever the workflow is documented) cross-referencing the order. (Both files are in arc's lane.)

## Expected Impact

- **Existing concurrent loops:** if owners read the standing order, `prompt-efficiency` and `test-coverage` close in one iteration each (one `edit()` per project) instead of running to safety cap.
- **Future projects reaching completion:** stop at iter N+1 instead of iter 50.
- **Per-hour iter rate** (current ~110/hr aggregated across loops) drops to baseline as each project hits its first post-completion iteration.
- **Falsifiability:** if a project's owner reads the order and the loop *still* doesn't close, that's evidence of a fall-through path beyond what KE-463's table covers.

## Risks

- **Owners might rewrite `closed` → `active` again** (optimizer's commit at 22:48Z is exactly this pattern, KE-461). Mitigation: the order says *closed*, not *complete*. The KE-449 heading-form variant is solved because `closed` is in the entry-guard set even when written as `**Status**: closed`.
- **Some orchestrators are not the owner-of-record** and may not have authority to mark a project closed. Mitigation: the order applies to whoever runs the master-worker orchestrator role for that project — by definition, they have edit access to `project.md` (the workflow already does it via `updateProjectStatus`).
- **Orchestrators routinely write "complete" or "done" instead of "closed"** (KE-429, KE-438). The order has to be specific that **only `closed` works** until proposals land.
- **A standing order is documentation; documentation does not execute** (KE-441). This proposal is *not* a substitute for landing the two open patches; it's a stopgap that reduces compute waste in the meantime.

## Related (already open)

- `2026-05-01-fix-extractfield-heading-form.md` — actual fix #1
- `2026-05-01-master-worker-honor-complete-status.md` — actual fix #2
- `2026-05-01-land-heading-form-and-complete-status-fixes-together.md` — bundling argument
