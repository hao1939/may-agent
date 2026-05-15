# Intervention Design: Good-Enough Rubric + Auto-Advance Cap

**Date:** 2026-04-22  
**Milestone:** MS3 — Design intervention  
**Treatment:** C+D Hybrid

## Problem Statement

Evaluator rejection loops waste more iterations than accepting imperfect work. When reviewer says DONE but evaluator scores <7, the project retries — often making things worse. After 3 failures, the project blocks entirely. Data shows this pattern hit pwi-smart-context (3 rejections), coach (15 low scores/hr), tech-lead (4 in 31min).

## Current Behavior (baseline)

1. Evaluator rubric has 7+ criteria including "no shortcuts", "building ≠ verifying", "evidence"
2. Score threshold: ≥7 = PASS
3. After 3 false-dones → project blocks with escalation
4. No distinction between milestone types (research vs implementation)

## Proposed Changes

### Change 1: Simplified "Good Enough" Rubric (Option C)

Replace the current 7-criterion rubric with a 3-criterion rubric focused on milestone completion:

```
1. **Deliverables exist**: Were files/artifacts actually created or updated? (not just claimed)
2. **Goal addressed**: Does the work make meaningful progress toward the stated goal?
3. **Honest reporting**: Are milestone checkmarks and status claims accurate?
```

**Removed criteria:**
- "No shortcuts" — too subjective, penalizes efficient work
- "Building ≠ verifying" — valid concern but causes false rejections on research milestones  
- Metric movement check — metrics often lag behind milestone completion

**Kept but simplified:**
- Evidence requirement → folded into "deliverables exist" (if the file exists, that IS evidence)

### Change 2: 2-Attempt Auto-Advance (Option D)

Replace the current "block at 3" with "auto-advance at 2":

```
falseDoneCount >= 2 → 
  - Mark milestone DONE with caveat: "Auto-advanced after 2 evaluator rejections"
  - Set Health to score/10 (CAVEAT)
  - Continue to next milestone (don't block)
  - Log warning to journal for human review
```

**Rationale:** Blocking is the worst outcome — it stalls the entire project and requires manual intervention. Auto-advancing with a caveat flag preserves momentum. If the work truly isn't done, the next milestone will fail anyway.

### Change 3: Keep strict mode for implementation milestones (optional, defer)

Could add a `strict: true` flag on milestones that involve code/deployment where the full rubric matters. Defer this — start with the simpler changes and measure.

## Implementation Plan

In `agents/shared/workflows/project.ts`:

1. **`buildEvalPrompt()`** (line ~425): Replace criteria 1-7 with the 3 simplified criteria
2. **`handleDoneDecision()`** (line ~570): Change `falseDoneCount >= 3` block to auto-advance at `>= 2`
3. Add caveat tracking to project status

## Expected Impact

- **Rejection-loop rate**: from ~30% → <10% (fewer false rejections + auto-advance cap)
- **False-done rate**: may increase slightly (from ~2% → ~5%) but within target
- **Iterations-to-complete**: decrease by 2-3 iterations average (no more 3-rejection stalls)

## Risks

1. **Quality regression**: Simplified rubric might pass genuinely incomplete work → mitigate with milestone progression check (next milestone catches it)
2. **Auto-advance hides problems**: → mitigate with CAVEAT flag visible in project status for human audit
3. **Evaluator becomes rubber stamp**: → monitor pass rate; if >95%, rubric is too lenient

## Measurement Plan

After implementation, run 5+ projects through the workflow and compare:
- Rejection-loop frequency (before vs after)
- Iterations per milestone
- Any false-done that required rework

## Decision

Proceed to MS4: implement changes 1 and 2 in project.ts.
