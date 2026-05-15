# Premature DONE Investigation

**Date**: 2026-04-18
**Metric**: `workflow.premature-done` = 12 (target: 0, threshold: 3)

## What the metric measures

Projects marked `Status: done/complete` but with unchecked `- [ ]` milestones remaining. The source command scans all `agents/*/workspace/projects/*.md` files.

## All 12 premature-DONE projects

| # | File | Agent | Checked | Pattern |
|---|------|-------|---------|---------|
| 1 | bob/exp166-execution.md | bob | 0/28 | Stale project — work done but checklist never updated |
| 2 | bob/exp167-runs.md | bob | 0/2 | Stale project — work done but checklist never updated |
| 3 | coach/metric-autonomy.md | coach | 0/21 | Git divergence — committed version has unchecked boxes but project IS done (KE-215 written) |
| 4 | coach/prove-the-loop.md | coach | 0/4 | Status says "paused" but regex matches "done" in the status line text |
| 5 | may/metric-system.md | may | 10/20 | Partially complete — marked done prematurely |
| 6 | may/review-branch-merge.md | may | 5/10 | Partially complete — marked done prematurely |
| 7 | may/system-evolution.md | may | 0/5 | Status says "paused" but contains "done" substring |
| 8 | optimizer/process-automation.md | optimizer | 5/9 | Partially complete — marked done prematurely |
| 9 | tech-lead/cold-start-fix.md | tech-lead | 4/7 | Partially complete — marked done prematurely |
| 10 | tech-lead/context-management.md | tech-lead | 4/5 | Nearly complete — 1 unchecked item |
| 11 | tech-lead/metric-system-phase1.md | tech-lead | 0/6 | Stale — uses `✅ complete` format, checkboxes are deliverable items not milestones |
| 12 | tech-lead/verification-streamline.md | tech-lead | 5/6 | Nearly complete — 1 unchecked item |

## Root cause categories

### Category A: Genuinely premature (5 projects — the real problem)
**may/metric-system.md** (10/20), **may/review-branch-merge.md** (5/10), **optimizer/process-automation.md** (5/9), **tech-lead/cold-start-fix.md** (4/7): These were marked done while significant work remained. The worker session reported "done" and the project status was flipped without verifying all checkboxes.

### Category B: False positives from status text matching (3 projects)
**coach/prove-the-loop.md**, **may/system-evolution.md**: Status contains "done" as a substring (e.g. "paused (stop-rule triggered) — Iter 12 complete. Reordered...") but project is NOT actually marked done. The metric's regex `grep -oiP "Status.*?:\s*\K.*"` captures the full line and matches "done" anywhere.

**coach/metric-autonomy.md**: Has iteration status lines like `**Status**: Iter 4 DONE` that the regex picks up, plus the actual status IS done but checkboxes were never checked (the work was done via KE entries, not the original milestone plan).

### Category C: Stale/format mismatch (4 projects)
**bob/exp166-execution.md** (0/28), **bob/exp167-runs.md** (0/2), **tech-lead/metric-system-phase1.md** (0/6): Work was completed but checkboxes were run-tracking items (individual gym runs) or deliverable lists, not milestones. Nobody went back to check them off.

**tech-lead/context-management.md** (4/5), **tech-lead/verification-streamline.md** (5/6): Nearly done, 1 item each unchecked — likely oversight.

## Agent breakdown

| Agent | Count | Real premature | False positive |
|-------|-------|---------------|----------------|
| tech-lead | 4 | 2 | 2 (format/stale) |
| may | 3 | 2 | 1 (regex) |
| bob | 2 | 0 | 2 (stale) |
| coach | 2 | 0 | 2 (regex/divergence) |
| optimizer | 1 | 1 | 0 |

## Proposed fixes

### Fix 1: Improve the metric source command (reduces 12 → ~5)
The current regex matches "done" anywhere in the status line. Fix: require `Status` value to be exactly `done` or `complete` (not containing those words in longer text).

```bash
# Current (overly broad):
status=$(grep -oiP "Status.*?:\s*\K.*" "$f" | head -1 | tr "[:upper:]" "[:lower:]")
echo "$status" | grep -qi "done\|complete"

# Proposed (exact match):
status=$(grep -oiP "^\*?\*?Status\*?\*?:?\s*\K\S+" "$f" | head -1 | tr "[:upper:]" "[:lower:]")
echo "$status" | grep -qxP "done|complete|✅"
```

This eliminates false positives from "paused (... done ...)" and iteration status lines.

### Fix 2: Add checkpoint-before-done guard to persistent-task workflow
When a persistent-task worker marks a project "done", the reviewer should verify all `- [ ]` items are checked or explicitly removed. Add to reviewer prompt:
> Before accepting DONE: count unchecked `- [ ]` items. If any remain, either check them off with evidence or remove them with justification. Do not accept DONE with unchecked items.

### Fix 3: Clean up stale projects (immediate — reduces count by 4)
These projects need manual cleanup:
- `bob/exp166-execution.md` — check off completed run items or archive
- `bob/exp167-runs.md` — check off completed items or archive
- `tech-lead/metric-system-phase1.md` — check off deliverables (work is done)
- `tech-lead/context-management.md` — check off or remove the 1 remaining item
- `tech-lead/verification-streamline.md` — check off or remove the 1 remaining item

### Fix 4: Context update for all agents
Add to each agent's context.md:
> When marking a project DONE, verify ALL `- [ ]` checkboxes are either checked `- [x]` or removed. The premature-DONE metric counts projects marked done with unchecked items.

## Recommended priority

1. **Fix 1** (metric accuracy) — most impactful, removes ~7 false positives immediately
2. **Fix 3** (cleanup) — quick wins, removes ~4 more
3. **Fix 4** (prevention) — stops new premature-DONEs
4. **Fix 2** (workflow guard) — systemic prevention for persistent-task projects
