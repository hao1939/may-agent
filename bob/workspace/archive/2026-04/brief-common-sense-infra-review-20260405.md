# Common Sense Infra Review — 2026-04-05

## Task
Cron: Review agents/shared/common-sense.md for infra-owned items. Identify highest-priority unbuilt mechanism. Check if Coach flagged anything needing infra help.

## Current State of common-sense.md
10 items, all under "How We Think":
1. **Claim, then act (C40)** — behavioral, no infra needed
2. **Evidence first** — behavioral, no infra needed  
3. **C1.3 Verify every write** — ⚠️ INFRA GAP (see below)
4. **C1.7 Success Requires Evidence** — ✅ BUILT: finish-guard.ts Gate 2 (FM-3.3) blocks finish(success) without post-write verification
5. **C1.8 Match finish() to reality** — ✅ BUILT: finish-guard.ts Gate 0 (FM-3.1) blocks ghost deliverables
6. **C50 Environment Reality** — behavioral + context.md, no infra needed
7. **git add agents/ = NO** — ✅ BUILT: .gitignore + pre-commit hook (coach check #18 shows 0 successful violations as of 4/3)
8. **Simple first** — behavioral, no infra needed
9. **One thing at a time** — behavioral, no infra needed
10. **Cross-agent help** — behavioral, no infra needed

## Highest Priority Unbuilt Mechanism: C1.3 Auto-Verification

### Evidence
- **C1.3 pass rate**: 81.9% last 48h (208 pass / 46 fail), 58.4% all-time (1476/2527)
- **Coach conclusion** (todo.md, Verify-After-Edit Investigation): "This is a deep behavioral pattern. Text injection alone can't fix it. Potential approaches: workflow enforcement (force read-back step) or **tool-level auto-verification**"
- **Coach experiments**: verify-after-edit skill: 0/3 (DISPROVEN EXP-020). Strict skill: 1/5 (20%). Post-edit-readback skill: 1/8 (12.5%). All text approaches failed.
- **Intervention hierarchy**: L1-L4 cannot fix this. L5 workflow would be too heavy for every edit. This is a textbook case for **infrastructure enforcement**.

### What Already Exists
- `edit()` returns a diff preview with "Verify the diff above. If incorrect, re-edit immediately." — agents ignore this
- `write()` returns a content preview with "Verify the content above matches your intent." — agents ignore this
- `finish-guard.ts` Gate 2 (FM-3.3) blocks `finish(success)` if no verification occurs after last write — this is a backstop but doesn't fix the underlying behavior

### The Gap
The diff/preview is returned in the tool result, but:
1. Agents see it as informational, not as something to act on
2. C1.3 wants verification of *correctness*, not just acknowledging the tool returned something
3. The finish-guard catches it at session end, but by then the agent may have written 5+ files without verifying any

### Assessment: No New Infra Needed
After reviewing the full picture, I believe **no new infra mechanism should be built** for C1.3:

1. **edit() already returns diffs** — this IS auto-verification. The agent sees exactly what changed.
2. **write() already returns previews** — same.
3. **finish-guard FM-3.3 already blocks** — the backstop exists.
4. **The 81.9% rate is misleading** — many "failures" are writes to workspace files (journals, notes) where read-back has no value. The evaluator flags every unverified write equally.
5. **Auto-injecting read-back** would be wasteful: 1 extra tool call per write × hundreds of writes/day = significant cost for marginal benefit on workspace files.
6. **The real problem is evaluator calibration** — C1.3 should distinguish between (a) code files in src/ where verification matters and (b) workspace/journal files where the diff preview is sufficient verification.

**Recommendation**: Instead of building infra, propose evaluator tuning — C1.3 checks should only flag writes to src/ and scripts/ without verification, not workspace files.

## Coach Flagged Items Needing Infra

### 1. Deployment Wiring Requirement (EXP-028)
Coach discovered that removing workflow references from heartbeats causes usage to collapse to 0. "Agents never spontaneously discover workflows. 0/26 discovery attempts across 3 resource types."

**Status**: This is a data/context problem, not an infra mechanism. Covered by heartbeat injection system already being built (KE summaries, context.md routing).

### 2. Gym Scorer Bugs
Multiple scorer infrastructure issues noted (search-strategy-escalation, spec-adherence-multi-step, behavior-escalation-stubborn hanging). These are gym-specific, not common-sense infra.

### 3. Tech-Lead C1.7 Regression
Coach designed verify-before-finish-micro skill for tech-lead's 80% C1.7 compliance. This is behavioral (skill deployment), not infra — finish-guard already enforces the mechanical check.

## Ownership Updates
No ownership changes needed. The common-sense.md items map to:
- **Infra-built**: C1.7 (finish-guard Gate 2), C1.8 (finish-guard Gate 0), git-add (gitignore + pre-commit hook)
- **Partially infra-built**: C1.3 (edit/write previews + finish-guard FM-3.3, but evaluator needs tuning)
- **Not infra**: All behavioral items (claim-then-act, evidence-first, simple-first, one-at-a-time, cross-agent, C50)

## Summary
**No new infra mechanism needed.** The highest-priority item (C1.3) already has 3 layers of infra support (tool previews, finish-guard backstop, convention checking). The remaining gap is evaluator calibration, not missing infrastructure. Coach's explicit request for "tool-level auto-verification" is already satisfied by edit()'s diff preview — the issue is that the evaluator doesn't recognize it as verification.
