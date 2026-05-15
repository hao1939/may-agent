# Multi-Session Harness Integration Plan

**Author:** Coach
**Date:** 2026-04-09
**Status:** Active

---

## 1. Overview

The multi-session test harness extends the gym infrastructure to test failure modes that only emerge across session boundaries (FM-2.6, FM-1.4, FM-3.1 — 133 production errors, 14.9% of total). All 4 implementation phases are complete. This plan covers ongoing integration into the regular gym workflow.

---

## 2. Running Multi-Session Scenarios

### Commands

```bash
# Run a single multi-session scenario
scripts/gym-run.sh multi-session/<scenario-name> --agent coder

# Run ALL multi-session scenarios
scripts/gym-run.sh --run-all --tag multi-session --agent coder

# Run everything (single + multi-session together)
scripts/gym-run.sh --run-all --agent coder
```

No special flags are needed. The runner auto-detects multi-session scenarios when `scenario.json` contains a `sessions` array. Each session gets a fresh agent invocation with only the file system and injected context carrying between sessions — matching production behavior.

### Cost Per Run

- Each multi-session scenario: ~4-6 minutes (2-3 min per session × 2 sessions)
- Full multi-session sweep (5 scenarios): ~20-30 minutes
- Approximately 2-3× the cost of a single-session scenario

---

## 3. Scenario Inventory

| # | Scenario | FM Target | Baseline Pass Rate | What It Tests |
|---|----------|-----------|-------------------|---------------|
| 1 | `stale-plan-drift` | FM-2.6 | 75% (borderline) | Agent follows stale plan after external changes. Gets product right but fails behavioral checks (never detects the plan is stale). |
| 2 | `ghost-deliverable-chain` | FM-3.1 | 25% | Prior session claims incomplete work is done. Agent must verify inherited state, not trust handoff context. |
| 3 | `unresolved-failure-chain` | FM-1.4 | 44% (high variance) | Prior session crashed mid-rename. Agent must diagnose cascading failures, not blindly fix. |
| 4 | `kb-integration-failure` | FM-2.6 + FM-3.1 | 11% | Context claims robust code; reality has hardcoded creds, swallowed errors, no retries. Agent must inspect before extending. |
| 5 | `instruction-override-drift` | FM-2.6 | 40% | Convention changes between sessions (console.log → structured logger). Agent must follow updated conventions, not carry S1 patterns. |

**Baseline data source:** `agents/coach/workspace/multi-session-baselines.md` (N=2 per scenario)

---

## 4. Regression Cadence

### Monthly Sweep (Primary)

Run all 5 multi-session scenarios once per month:

```bash
scripts/gym-run.sh --run-all --tag multi-session --agent coder
```

**Purpose:** Catch regressions in cross-session behavior from model updates, framework changes, or skill modifications.

**Pass criteria:** No scenario should degrade >20pp from its baseline. If a previously-passing scenario starts failing consistently (2+ consecutive months), investigate.

### On-Demand (Triggered)

Run the full multi-session suite when:
- A new skill is deployed to Bob (especially skills touching context handling, verification, or instruction following)
- Framework changes to `manager.ts`, `context-learn.ts`, or the session lifecycle
- Model version upgrades

### Growth Cycle Integration

When testing a new intervention (skill, workflow gate, etc.) against multi-session scenarios:
1. Run baseline: 2-3 reps without intervention
2. Run treatment: 2-3 reps with intervention
3. Compare pass rates per scenario
4. Focus on the hardest scenarios (kb-integration-failure at 11%, ghost-deliverable-chain at 25%) for maximum signal

---

## 5. How Bob Uses Multi-Session Scenarios for Growth Cycles

### As Intervention Targets

The multi-session scenarios are the best targets for skill/workflow interventions because they have the most room for improvement:

| Priority | Scenario | Baseline | Intervention Ideas |
|----------|----------|----------|--------------------|
| 1 | kb-integration-failure (11%) | Lowest baseline | "Inspect inherited code before extending" skill |
| 2 | ghost-deliverable-chain (25%) | Low baseline | "Verify claimed deliverables" workflow gate |
| 3 | instruction-override-drift (40%) | Medium baseline | "Follow updated conventions" instruction emphasis |
| 4 | unresolved-failure-chain (44%) | High variance | "Diagnose before fixing" skill |
| 5 | stale-plan-drift (75%) | Borderline | "Detect stale context" behavioral training |

### Growth Cycle Workflow

1. **Fork**: Create `agents/.lab/<intervention-name>/` with the proposed change
2. **Patch**: Apply skill/gate/workflow modification
3. **Test**: Run target multi-session scenario 2-3× with and without intervention
4. **Evaluate**: Compare pass rates. Need >20pp improvement to be meaningful.
5. **Promote** if improved, discard if not. One change per cycle.

### Behavioral Checks Matter

Multi-session scenarios include behavioral checks (did the agent detect the problem?) alongside product checks (is the code correct?). Behavioral checks are always 0% at baseline — they're the true measure of whether an intervention teaches the agent to reason about cross-session state, not just accidentally produce correct output.

---

## 6. Maintenance Plan

### Who Maintains What

| Component | Owner | Cadence |
|-----------|-------|---------|
| Scenario files (environment, task.md, context.md) | Coach | As needed — stable after creation |
| success_criteria.js | Coach | Update when scenario behavior expectations change |
| Baseline data | Coach | Re-measure quarterly or after model updates |
| Runner code (gym-runner.ts) | Tech-lead | Only when infrastructure changes |
| Monthly regression runs | Coach (via cron) | Monthly |

### Adding New Scenarios

Follow the authoring guide at `agents/coach/workspace/multi-session-authoring-guide.md`. Key steps:

1. Identify a target FM from production error analysis
2. Create directory: `agents/gym/scenarios/multi-session/<name>/`
3. Write `scenario.json` with `sessions` array and `tags: ["multi-session"]`
4. Create session-N directories with task.md, context.md, and environment files
5. Write `success_criteria.js` with both product AND behavioral checks
6. Run 2-3 baseline trials to confirm non-ceiling (<70% pass rate)
7. Add to baselines document

### When to Add New Scenarios

- After production error analysis reveals a new cross-session failure pattern
- When an existing single-session scenario hits ceiling and needs multi-session to discriminate
- Target: 5-8 total multi-session scenarios (current: 5). Don't over-expand — each one costs 2-3× a single-session scenario to maintain and run.

### Retiring Scenarios

Remove a scenario when:
- It has been at ceiling (>90%) for 3+ consecutive monthly sweeps
- The failure mode it tests has been eliminated through framework changes
- Replace with a harder variant targeting the same FM

---

## 7. Reference Documents

| Document | Path | Description |
|----------|------|-------------|
| Design doc | `agents/coach/workspace/design-multi-session-harness.md` | Full architecture, rationale, implementation phases |
| Authoring guide | `agents/coach/workspace/multi-session-authoring-guide.md` | How to create new scenarios |
| Baselines | `agents/coach/workspace/multi-session-baselines.md` | Detailed check-level baseline data |
| Runner code | `scripts/gym-runner.ts` | The `runMultiSessionScenario()` function |
| Scenarios | `agents/gym/scenarios/multi-session/` | All 5 scenario directories |

---

*This plan ensures multi-session scenarios are a living part of the gym infrastructure, not a one-time build. Monthly sweeps catch regressions, growth cycles use them as intervention targets, and the authoring guide enables expansion when new failure modes are discovered.*
