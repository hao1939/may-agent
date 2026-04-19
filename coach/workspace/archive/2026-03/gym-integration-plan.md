# Coach's Gym Integration Plan

**Author**: Coach | **Date**: 2026-03-24 | **Request**: req:e0e0a2a9

## 1. Using Gym Results to Identify Agent Weaknesses

### Current State
Coach already uses gym as the core measurement tool in every growth-cycle:
- **86 scenarios** across smoke/standard tiers covering convention, behavior, delegation, error-recovery categories
- **177 experiment records** in `experiments.jsonl` tracking agent × scenario × method outcomes
- Results stored in `.state/may.db` (gym_runs, gym_checks, gym_prompts tables)

### Weakness Identification Process

**Step 1: Error-Pattern → Scenario Mapping**
- Scan `agents/*/ERROR_LOG.jsonl` for repeated FM-codes (3+ occurrences)
- Map each FM-code to the gym category most likely to trigger it:
  - FM-2.1 (hallucination/tool-misuse) → `convention-verify-*`, `conflicting-evidence`
  - FM-2.2 (instruction noncompliance) → `behavior-escalation-*`, `delegation-scope-*`
  - FM-1.3/1.4 (error recovery) → `cascading-error`, `convention-retry-pivot`
  - FM-3.3 (verification gaps) → `convention-verify-edit`, `convention-verify-multi-edit`
- Run targeted baseline on those scenarios for the specific agent

**Step 2: Ability/Behavior Matrix**
Build a per-agent scorecard across axes:
| Axis | Gym Categories | Measured By |
|------|---------------|-------------|
| **Tool Correctness** | convention-verify-*, convention-safe-append | Pass rate on tool-use checks |
| **Error Recovery** | cascading-error, convention-retry-pivot | Pivot quality when first approach fails |
| **Scope Discipline** | delegation-scope-boundary, bloated-refactor | Stays within assigned scope |
| **Judgment Under Ambiguity** | conflicting-evidence, behavior-escalation-stubborn | Makes correct call with incomplete info |
| **Efficiency** | behavior-resource-convergence, abandoned-branch | Solves in minimal steps |
| **Verification** | convention-verify-edit, convention-verify-multi-edit | Catches own mistakes before finishing |

**Step 3: Baseline Sweep (Weekly)**
Run `scripts/gym-baseline.sh` for each product agent (coder, qa, tech-lead) against all standard scenarios. Tag runs by week for trend tracking. Compare week-over-week to detect regressions.

## 2. Designing Targeted Training Exercises

### Scenario Design Principles (from 177 experiments)
1. **Specificity > Coverage**: A scenario targeting one exact failure mode (e.g., "vitest fails due to missing deps, not the patch") beats a broad scenario that tests everything loosely
2. **Realistic Triggers**: Scenarios must reproduce the exact conditions that cause the error in production — same file types, same ambiguity, same tool outputs
3. **Measurable Criteria**: Each scenario needs `success_criteria.js` with binary pass/fail checks. Subjective criteria ("good judgment") are uncheckable and waste experiment budget
4. **Ceiling-Effect Gate**: Before any training exercise, run baseline first. If agent already passes → skip. This saved us from wasting ~16 sessions on exp-061 through exp-064

### Training Exercise Pipeline
```
ERROR_LOG pattern (3+ repeats)
  → Diagnose sub-pattern (SPEC_LITERALISM, OVER_STRICT_GATE, etc.)
  → Design scenario reproducing exact trigger conditions
  → Run baseline to confirm failure
  → Select method from catalog (15+ methods, evidence-rated)
  → Fork agent, apply method, run patched gym test
  → Compare: baseline vs patched scores
  → Promote if improved, discard if not
```

### Method Selection (Evidence-Based)
From 177 experiments, current method effectiveness:
| Method | Experiments | Pass Rate | Best For |
|--------|------------|-----------|----------|
| #15 Workflow Enforcement | 8 | ~50% | Procedural errors (FM-2.2, FM-3.3) |
| #10 Conditional Guard | 4 | ~25% | Over-generalization prevention |
| #6 Knowledge File | 3 | ~33% | Complex judgment patterns |
| #1 SOUL Guard | 2 | ~50% | High-level behavior shifts |

When a method fails 3+ times for the same pattern → trigger Method Invention (step 4 in heartbeat) to develop new approaches.

## 3. Before/After Measurement Protocol

### Per-Experiment Measurement
Every growth-cycle produces a structured record:
```json
{
  "id": "exp-NNN",
  "agent": "qa",
  "error_code": "FM-2.1",
  "scenario": "qa-overstrict-gate",
  "method": "#15",
  "baseline_pass": false,
  "patched_pass": true,
  "result": "PASS|FAIL|CEILING|PARTIAL",
  "date": "2026-03-24"
}
```

### Aggregate Tracking
- **Per-agent trend**: Weekly gym sweep scores tracked in `may.db`. Query with `scripts/gym-stats.ts`
- **Per-method ROI**: Which methods produce the most promotions per attempt? Updated in `knowledge/method-catalog.md`
- **Per-FM-code progress**: Is FM-2.1 frequency decreasing over time? Cross-reference ERROR_LOG timestamps with experiment dates

### Feedback Loop
```
Week N: Baseline sweep → identify 3 weakest areas
         ↓
Week N: Run 3 growth-cycles (daily cap) targeting weakest areas
         ↓
Week N+1: Re-sweep → measure improvement
         ↓
         Compare: Did targeted areas improve? Did other areas regress?
         ↓
         Update method catalog with evidence
         ↓
         Adjust next week's targets
```

## 4. Integration Points with Other Teams

### → Optimizer
- Coach identifies WHAT agents fail at (specific scenarios, FM-codes)
- Optimizer analyzes WHY across the population (statistical patterns)
- Coach applies targeted fixes; Optimizer proposes systematic prompt changes
- Both use gym as shared validation: no change ships without before/after gym scores

### → Bob (Architect)
- Bob defines which capability axes matter (the rows of the scorecard)
- Coach maps those axes to concrete gym scenarios
- Bob ensures the feedback loop architecture is sound (triggers, data flow, storage)
- Coach provides ground-truth on what the gym can and cannot measure

### → May (Coordinator)
- May tracks which experiments are in flight and their status
- Coach reports experiment results to May's tracking DB
- May can trigger growth-cycles via cron when error patterns are detected

## 5. Current Gaps & Proposed Improvements

| Gap | Impact | Proposed Fix |
|-----|--------|-------------|
| No automated weekly sweep | Manual baseline runs miss regressions | Cron job: weekly `gym-baseline.sh` for all agents |
| 86 scenarios but uneven coverage | Some FM-codes have no matching scenario | Prioritize scenario creation for FM-1.3, FM-1.4 gaps |
| Method catalog has 15 methods but only ~8 tested | Untested methods might be valuable | Systematic method-learning via training sprints |
| No cross-agent comparison | Can't tell if QA is weaker than Coder at X | Add agent comparison view to gym-stats |
| Ceiling effect wastes budget | ~4 experiments hit ceiling (all passed baseline) | Ceiling gate now mandatory; need harder scenarios |

## 6. Daily Operating Rhythm

| Time | Activity | Tool Cost |
|------|----------|-----------|
| Each heartbeat | Scan ERROR_LOGs, triage top pattern | 5-8 calls |
| When pattern found | Dispatch growth-cycle workflow | ~11 coder sessions |
| Max 3/day | Growth cycles (hard cap) | ~$21/day max |
| Weekly | Full baseline sweep + scorecard update | ~30 scenario runs |
| Per experiment | Record to experiments.jsonl + may.db | 1 call |
| Every 5 sessions | Self-evolve: review experiment evidence, update methods | 10-15 calls |
