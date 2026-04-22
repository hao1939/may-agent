# Prove the Loop — Project Plan

**Goal**: Prove the coach training loop works end-to-end: identify skill gap → design experiment → run experiment → measure improvement → promote or reject skill.
**Owner**: coach
**Created**: 2026-04-21
**Status**: IN PROGRESS (M1 ✅, M2 ✅, M3 ✅, M4 next)

## Background

This project has run for 24+ iterations without conclusive proof that a coach intervention measurably improved agent performance. The core question: can the coach identify a real skill gap, intervene, and demonstrate statistically significant improvement?

## Key Decision Log
- **2026-04-22**: EXP-196 showed the Data Flow Audit skill correctly guides reasoning, but cascading-fix-trap-v2's ordering bug had no functional impact (penalties.js was self-contained). Skill was SOUND, scenario was BROKEN.
- **2026-04-22**: Created cascading-fix-trap-v3: removed `adjusted_pct` from penalties, homework uses `pct` only. Now ordering bug has real functional consequences (5 test failures). Added grade threshold bug (`>` vs `>=`) that cascades — only visible after fixing ordering.

## Milestones

### Phase 1: Identify a Real Skill Gap

**M1: Select a measurable skill gap from eval data** ✅ COMPLETE (EXP-194)
- Gap identified: **Relational Bug Blindness** — agent fixes value bugs at ~97% but relational bugs (pipeline ordering, data flow) at ~2.5%
- Documented in EXP-194 results: cascading-fix-trap-v2 pipeline-order-fixed check fails in 39/40 trials
- Pattern appears in 9/20 scenarios (45% of scenario corpus)

**M2: Validate the gap is real (not noise)** ✅ COMPLETE (EXP-177 + EXP-195)
- EXP-177 (N=40): 1/40 pass rate on pipeline-order-fixed (2.5%)
- EXP-195 baseline (N=10): 1/10 pass rate (10%) — consistent direction
- Combined N=50 across 2 experiments, 3+ weeks apart: 2/50 (4%) — gap is robust
- Within-scenario control: value bug fixed 97.5% of the time in same codebase (not task difficulty)

### Phase 2: Design Experiment

**M3: Design a targeted intervention** ✅ COMPLETE (EXP-195 + EXP-196 + scenario fix)
- EXP-195: Tested 3 interventions — direct hint raised pass rate 10%→40% but not transferable
- EXP-196: Data Flow Audit skill guides correct reasoning but v2 scenario had no functional bug
- Created cascading-fix-trap-v3 with real functional ordering bug (5 test failures + cascading threshold bug)
- Intervention: Data Flow Audit skill (teaches "trace actual values through pipeline steps")
- Next: run baseline on v3, then treatment with skill

**M4: Establish measurement protocol**
- Define primary metric, sample size requirements, success/failure thresholds
- Plan A/B comparison: before vs after, or treatment vs control
- Output: pre-registered measurement plan

### Phase 3: Run Experiment

**M5: Deploy the intervention**
- Ship the skill/rule/prompt change
- Ensure it's active in production sessions
- Output: deployment confirmation with timestamp

**M6: Collect sufficient post-deployment data**
- Wait for n≥30 post-deployment evals (matching the gap criteria)
- Monitor for obvious regressions in other metrics
- Output: raw data collected, ready for analysis

### Phase 4: Measure Improvement

**M7: Analyze results**
- Compare pre/post failure rates for the targeted pattern
- Calculate effect size and statistical significance
- Output: analysis document with clear verdict

**M8: Make promote/reject decision**
- If improvement ≥ threshold: PROMOTE the skill (make permanent)
- If no improvement or regression: REJECT (revert the change)
- Output: decision record with rationale

### Phase 5: Close the Loop

**M9: Document the complete cycle**
- Write up the full loop: gap → experiment → result → decision
- Extract meta-lessons for the coaching methodology
- Output: case study in `agents/coach/knowledge/`

## Current Status & Blockers

### BLOCKER 1: Insufficient eval volume
- Post-intervention evals accumulate slowly (~1-3/day for targeted failure modes)
- Iter 16 shipped a retry scope-escape fix but only got n=8 evals before the project stalled
- **Need**: Either higher eval throughput, or a more common failure mode to target

### BLOCKER 2: Baseline instability
- Original baseline (0.82) was inflated by gym sessions; production-only baseline is 0.726
- Baselines shift as task mix changes, making before/after comparison unreliable
- **Need**: Stable baseline period (≥7 days, n≥50) before deploying intervention

### BLOCKER 3: No clean A/B mechanism
- Current approach is before/after comparison, which is confounded by time
- Multiple interventions ship simultaneously (finish-guard changes, rule tweaks, etc.)
- **Need**: Either sequential isolated experiments, or a way to tag sessions with active interventions

### Path Forward
1. Pick a **high-frequency** failure mode (appears in ≥20% of evals) so n≥30 accumulates in <3 days
2. Freeze all other interventions during the measurement window
3. Use the simplest possible intervention (single rule addition) to minimize confounders
4. If eval volume remains insufficient, consider synthetic eval runs to boost sample size
