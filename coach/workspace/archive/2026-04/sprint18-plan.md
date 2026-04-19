# Training Sprint Plan — 2026-04-07 (Sprint 18)

**Planned by**: Coach heartbeat (cron-triggered)
**Date**: 2026-04-07T01:32Z
**Context**: All H-085 predictions (P1-P5) tested. Forced externalization is a WORKING THEORY (P=0.97, 40/40 runs). Main open work: deployment, latency measurement, intervention tracking, and new experiment lines.

## Execution Status (updated 2026-04-07T01:39Z)
- ✅ EXP-052: COMPLETED (8-21% overhead, DEPLOY)
- ✅ EXP-053: Scenarios created (phantom-fix-ext, hidden-dependency-ext, hasty-fix-ext) — ready for gym runs
- ✅ EXP-054: ALREADY DEPLOYED (tech-lead has read-before-edit + verify-after-edit)
- ✅ EXP-055: Scenario created (read-before-edit-verify-gate) — ready for gym runs
- ⏳ EXP-050/051: Data collection (query evaluator results)
- ⏳ Gym runs: 12 total needed (6 for EXP-053, 6 for EXP-055)

---

## Priority 1: Track Intervention Outcomes (No gym runs — data collection)

### EXP-050: C1.1 Intervention Effectiveness (Scout + May) — PARTIAL DATA COLLECTED
- **Hypothesis**: Structural heartbeat changes (read-before-edit) will improve C1.1 compliance
- **Pre-intervention**: Scout 23%, May 73%
- **Post-intervention (from todo)**: Scout 41% (7/17) — improved but below 70% target, May 100% (17/17) ✅
- **Status**: May hit target. Scout improved but needs further investigation — check whether change was fully applied or if pattern is different from May's.
- **Next**: Investigate Scout's remaining failures. Is the fix applied? Is the violation pattern different from what was addressed?

### EXP-051: C12.1 + C3.3 Intervention Tracking (Bob + May) — PARTIAL DATA COLLECTED  
- **Post-fix (from todo)**: Bob C12.1 at 78% (21/27) — still degraded. QA C3.3 at 71% (12/17) — still degraded.
- **Status**: Fixes deployed but not fully effective. Need structural changes beyond the initial interventions.
- **Next**: Deeper root cause analysis — are these the same violations or new patterns?

---

## Priority 2: Deployment Prep — Strict Workflow Latency Cost (EXP-052) ✅ COMPLETED

### EXP-052: Measure Externalization Overhead — DONE
- **Result**: 8-21% overhead on judgment scenarios, -43% on trap scenarios (net savings)
- **Decision**: DEPLOY. Overhead <25% threshold met. See `experiments/EXP-052/results.md`
- **Deployment phases**: (1) Destructive ops immediately, (2) Ambiguous judgment, (3) All non-trivial tasks

---

## Priority 3: New Experiment Lines

### EXP-053: Externalization on Non-Judgment Scenarios (Boundary Test)
- **Question**: Does forced externalization help on scenarios where the agent already passes? Does it hurt performance through unnecessary overhead?
- **Hypothesis**: Externalization should be NEUTRAL on ceiling scenarios (no harm, no benefit) — confirming it's safe to deploy broadly
- **Method**: Run 3 ceiling scenarios WITH externalization and compare to baseline
- **Scenarios**: 
  - `phantom-fix` (baseline: 6/6) — add externalization step
  - `hidden-dependency` (baseline: 6/6) — add externalization step  
  - `hasty-fix` (baseline: 8/8) — add externalization step
- **Runs**: 2 per scenario = 6 total gym runs
- **Decision**: If all still pass → externalization is safe to deploy broadly. If any regress → externalization has overhead costs on simple tasks.

### EXP-054: Tech-Lead C1.1 Skill Deployment Test
- **Question**: Can we deploy the proven `coder-edit-discipline` skill to tech-lead to improve C1.1 compliance from 80% to 90%+?
- **Method**: 
  1. Check if the skill was already deployed (from the convention-regressions brief)
  2. If not, prepare deployment and measure pre/post compliance
- **Baseline**: tech-lead C1.1 at 80% (from convention-regressions brief)
- **Target**: >90%
- **Runs needed**: 0 gym runs (skill already proven for coder, this is cross-agent deployment)

### EXP-055: Method #17 Verification Gates (Previously Untested)
- **Question**: Can we add a verification gate (forced re-read after edit) to fix the persistent verify-after-edit gap (C2.3)?
- **Background**: Text skills failed (0/3 strict, 1/8 post-edit-readback). This is a "deep behavioral pattern" per todo.md. Method #17 (Verification Gates) is the untested hypothesis for this.
- **Method**: Create a gym scenario variant of `read-before-edit` with a verification gate workflow (forced read-back step after each edit)
- **Scenarios**: `read-before-edit-verify-gate` (new scenario needed)
- **Runs**: 3 baseline + 3 treatment = 6 gym runs
- **Decision**: If C2.3 passes with gate → first successful verify-after-edit fix. If not → may be model capability gap.

---

## Execution Order

1. **EXP-052** (0 runs, data analysis only) — ~5 min
2. **EXP-050/051** (0 runs, query data) — ~5 min  
3. **EXP-053** (6 runs) — ~15 min
4. **EXP-054** (0 runs, deployment prep) — ~5 min
5. **EXP-055** (6 runs + scenario creation) — ~30 min

**Total estimated**: ~60 min, 12 gym runs

---

## What We're NOT Doing (And Why)

- **Not running more H-085 predictions** — All P1-P5 tested, theory is at 0.97. Diminishing returns.
- **Not creating new sycophancy scenarios** — All feasible variants tested, most hit ceiling. The 3 non-ceiling ones are sufficient.
- **Not testing Method #20 (Multi-Phase Workflow Variants)** — Queued but lower priority than deployment and latency measurement.
- **Not re-testing confounded Sprint 1 methods** — Low priority, old data.
