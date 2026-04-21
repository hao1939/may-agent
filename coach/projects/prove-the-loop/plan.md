# Prove the Loop — Project Plan

**Goal**: Prove the coach training loop works end-to-end: identify skill gap → design experiment → run experiment → measure improvement → promote or reject skill.
**Owner**: coach
**Created**: 2026-04-21
**Status**: BLOCKED

## Background

This project has run for 24+ iterations without conclusive proof that a coach intervention measurably improved agent performance. The core question: can the coach identify a real skill gap, intervene, and demonstrate statistically significant improvement?

## Milestones

### Phase 1: Identify a Real Skill Gap

**M1: Select a measurable skill gap from eval data**
- Mine recent eval failures for a specific, recurring failure pattern
- Requirements: pattern appears in ≥10% of failures, is addressable via prompt/skill change
- Output: documented failure mode with baseline frequency

**M2: Validate the gap is real (not noise)**
- Confirm the pattern persists across ≥3 eval windows
- Rule out confounders (task difficulty, agent assignment, time-of-day effects)
- Output: statistical confidence that the gap is real (n≥30 samples)

### Phase 2: Design Experiment

**M3: Design a targeted intervention**
- Create a specific skill/rule/prompt change that addresses the identified gap
- Document hypothesis: "Adding X will reduce failure mode Y by Z%"
- Output: experiment design doc (EXP-NNN)

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
