# EXP-012: Gated Exploration — Soft Workflow for Exploratory Tasks

**Date**: 2026-04-02
**Hypothesis**: H-041 P3 — Optimizer's workflow performance will improve when rigid step sequences are replaced with gate-based validation checkpoints.
**Type**: Controlled comparison (prospective)
**Cost**: ~$3-5 (10 workflow runs × ~$0.30-0.50 each)
**Status**: READY — workflow built, awaiting execution

## Background

EXP-009 showed a stark quality split for optimizer:
- **With workflow** (skill-lifecycle): 27% good rate
- **Without workflow**: 60% good rate

H-041's decision topology model explains this: optimizer tasks are dominated by *essential decisions* (what to explore, which approach) that skill-lifecycle's rigid step sequence constrains. But unconstrained execution loses the *eliminable decision* benefits of workflows (always write artifacts, always verify).

**The prediction**: A "soft workflow" that gates eliminable decisions (artifact production, verification) while preserving essential decision freedom should achieve quality between the rigid (27%) and unconstrained (60%) extremes — specifically >40% good rate.

## Intervention

### `gated-exploration` workflow (`agents/shared/workflows/gated-exploration.ts`)

**Structure**:
1. **Explore Phase** — Agent gets the goal with ONE constraint: write `workspace/exploration-log.md`. No prescribed steps. Agent decides how to investigate.
2. **Exploration Gate** — Heuristic check: did exploration produce concrete findings (data, file reads, patterns found)? Not just plans or meta-commentary. One retry allowed.
3. **Produce Phase** — Agent takes exploration findings and produces the deliverable. No step prescription.
4. **Delivery Gate** — Validates deliverable exists and isn't just a blocked/failed report.

**Key design choices**:
- Gates validate *artifacts*, not *approach* — the agent decides HOW, gates check WHAT was produced
- One retry on exploration gate failure with specific feedback
- No step count, no prescribed investigation targets
- Uses `ctx.runAgent()` / `ctx.emit()` / `ctx.done()` / `ctx.escalate()` from WorkflowContext

### Comparison conditions

| Condition | Workflow | Description |
|-----------|----------|-------------|
| A (control) | skill-lifecycle | Rigid step sequence, 27% baseline from EXP-009 |
| B (treatment) | gated-exploration | Gate-based, preserves essential decisions |
| C (reference) | none | Unconstrained, 60% reference from EXP-009 |

## Method

### Phase 1: Pilot (5 runs)
1. Select 5 optimizer-appropriate tasks (skill improvement, exploration, analysis)
2. Run each through `gated-exploration` workflow
3. Evaluate each session with standard verdict (good/acceptable/NI)
4. Check: does the exploration gate fire? Does the retry mechanism work?
5. **Go/no-go**: If ≥3/5 runs complete without infrastructure failures, proceed to Phase 2

### Phase 2: Full comparison (10 runs per condition)
1. Select 10 matched task pairs (similar complexity, same task types)
2. Run each task through both `gated-exploration` and `skill-lifecycle`
3. Blind evaluation: rate each output without knowing which workflow produced it
4. Compare good rates, ops efficiency, and artifact quality

### Task selection criteria
- Tasks must be genuinely exploratory (not just "edit this file")
- Tasks should require investigation + deliverable (not just reporting)
- Example types: skill analysis, pattern discovery, system improvement proposals

### Task format for gated-exploration
```
agent: optimizer

## Exploration Goal
<investigation target>

## Deliverable
<expected output artifact>

## Success Criteria
<quality criteria for deliverable>
```

## Metrics

### Primary
- **Good rate**: % of sessions rated "good" — target: >40% (between 27% rigid and 60% unconstrained)
- **Good+Acceptable rate**: % rated "good" or "acceptable" — secondary quality measure

### Secondary
- **Gate pass rate**: % of exploration phases that pass gate on first try (measures gate calibration)
- **Ops per run**: Total tool calls per complete workflow run (efficiency)
- **Artifact quality**: Does exploration-log.md contain concrete findings? (manual review)
- **Completion rate**: % of runs that complete without error/interruption

### Diagnostic
- **Retry rate**: How often does the exploration gate fire a retry?
- **Escalation rate**: How often does the workflow escalate vs complete?
- **Time-per-phase**: Relative ops in explore vs produce phases

## Success Criteria

### P3 confirmed if:
- **Good rate ≥ 40%** (statistically above 27% baseline, below 60% unconstrained)
- OR **Good+Acceptable ≥ 75%** (meaningful quality improvement over skill-lifecycle's ~66%)
- AND **Completion rate ≥ 70%** (workflow doesn't introduce new failure modes)

### P3 falsified if:
- Good rate ≤ 30% (no improvement over rigid workflow)
- OR good rate ≥ 55% (gates provide no measurable benefit over unconstrained — the "gates don't matter" null result)

### Nuanced outcomes:
- Gate pass rate < 50% → gates are too strict, need recalibration
- Gate pass rate > 95% → gates are too lenient, not adding value
- Ops per run > 50 → workflow is too expensive despite quality gains

## Analysis Plan

1. Fisher's exact test on good/not-good counts (gated-exploration vs skill-lifecycle)
2. If Phase 2 data: paired comparison on matched tasks
3. Qualitative analysis of gate failures: what triggers retries? Is the feedback useful?
4. Compare exploration-log.md quality across conditions

## References

- H-041: Decision Topology (prediction P3)
- EXP-009: Workflow effectiveness analysis (27% vs 60% baseline data)
- EXP-011: Decision topology prediction accuracy (R predicts workflow benefit, ρ=0.95)
- `agents/shared/workflows/gated-exploration.ts`: The workflow implementation
- `agents/shared/workflows/skill-lifecycle.ts`: The control workflow

---

*EXP-012: Gated Exploration | Tech-Lead | 2026-04-02*
