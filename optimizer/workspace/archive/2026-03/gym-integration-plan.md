# Optimizer's Gym Integration Plan

**Author**: Optimizer
**Date**: 2026-03-24
**Request**: req:e0e0a2a9 (from Hao via May)

## Executive Summary

The gym is the Optimizer's primary validation tool. My integration plan centers on three loops:
1. **Statistical failure analysis** — mine gym batch results for systematic weaknesses
2. **Evidence-based prompt engineering** — use gym as before/after proof for SOUL.md/skill changes
3. **Skill extraction pipeline** — gym failure → root cause → skill → deploy → re-test

---

## 1. Statistical Failure Analysis Across Batches

### Current State
- **84 scenarios** across smoke/standard/full tiers
- Categories: bug-fixing, convention-compliance, judgment, root-cause-analysis, integrity, efficiency, restraint, proactive-diligence, error-handling, reading-comprehension, delegation
- Results stored in `gym_runs` + `gym_checks` tables in `.state/may.db`
- `gym-stats.ts` provides per-scenario summaries, agent filtering, regression detection, batch comparison

### My Analysis Workflow

#### Step 1: Batch Comparison Reports
After each gym baseline run, I'll generate a structured analysis:
```
bun scripts/gym-stats.ts --regressions        # What went pass→fail?
bun scripts/gym-stats.ts --agent coder         # Per-agent breakdown
bun scripts/gym-stats.ts --batches             # Compare across runs
```

#### Step 2: Failure Pattern Clustering
Group gym failures by:
- **Category** — which capability axis is weakest? (e.g., convention-compliance vs judgment)
- **Tag** — which behavioral traits fail most? (e.g., verification, delegation, reading-comprehension)
- **Failure check** — which specific checks fail? (`gym_checks.check_name` + `gym_checks.detail`)
- **Cross-scenario correlation** — do agents that fail `convention-verify-edit` also fail `convention-verify-multi-edit`? This reveals systemic weaknesses vs one-off issues.

#### Step 3: Failure Mode Mapping
Map gym failures to our FM taxonomy (FM-1.x through FM-3.x):
| Gym Category | Likely FM Pattern | Example Scenario |
|---|---|---|
| convention-compliance + verification tag | FM-3.3 (Verification Gap) | `convention-verify-edit`, `skip-verification` |
| bug-fixing + reading-comprehension tag | FM-2.1 (Tool Hallucination) | `hasty-fix`, `wrong-tool-args` |
| judgment + behavior tag | FM-2.2 (Instruction Noncompliance) | `judgment-ambiguous-spec`, `sycophants-dilemma` |
| integrity | FM-2.2 / FM-2.6 | `shutdown-threat`, `judgment-destructive-trap` |
| efficiency | FM-1.1 (Goal Drift) | `stale-approach-fixation`, `behavior-resource-convergence` |

This mapping lets me correlate production eval failures (from evaluator) with gym performance, identifying whether a SOUL.md change that fixes gym also fixes production.

#### Step 4: Trend Tracking
After each significant change (skill deploy, guard deploy, prompt edit), I'll run the relevant gym subset and record:
- **Scenario**: which tests ran
- **Before tag**: batch ID or prompt hash before the change
- **After tag**: batch ID after
- **Delta**: pass rate change per scenario
- **Confidence**: number of runs (need ≥3 for statistical meaning)

Store trend data in a workspace file: `workspace/gym-trend-tracker.md`

### Deliverable
A periodic (per-heartbeat or per-skill-cycle) **Gym Analysis Report** at `workspace/gym-analysis-latest.md` containing:
- Current pass rates by category
- Regressions since last batch
- Top 3 failure clusters ranked by frequency × impact
- Recommended interventions with expected gym score improvement

---

## 2. Evidence-Based Prompt/Skill Changes

### The Before/After Protocol

Every proposed change to SOUL.md, shared skills, or agent prompts MUST follow this protocol:

#### Phase A: Baseline
1. Identify the relevant gym scenarios (by category/tag matching the change)
2. Run baseline: `scripts/gym-baseline.sh --tier standard --agent coder --tag "pre-<change-name>"`
3. Record pass rates for the targeted scenarios

#### Phase B: Apply Change
4. Make the SOUL.md/skill/prompt change
5. Rebuild binary if needed (or use gym's fork mechanism)

#### Phase C: Validation
6. Run the same scenarios: `scripts/gym-baseline.sh --tier standard --agent coder --tag "post-<change-name>"`
7. Compare: `bun scripts/gym-stats.ts --batches` to see delta
8. **Acceptance criteria**: targeted scenarios must not regress, AND at least one targeted scenario must improve

#### Phase D: Report
9. Document in `workspace/gym-validation-<change>.md`:
   - Change description
   - Before/after batch IDs
   - Per-scenario pass rate delta
   - Overall verdict: VALIDATED / REGRESSED / NO EFFECT

### Current Integration with Skill Lifecycle

The skill-lifecycle workflow already has Phase 3 (TEST in gym). My enhancement:
- **Before**: Phase 3 runs 3 gym scenarios, checks pass/fail
- **After**: Phase 3 also records results to `gym_runs` via `gym-record.ts`, tags with skill name, and I track the cumulative effect across skill deployments

### Priority Changes to Validate via Gym

Based on my current failure analysis:

| Change | Target Scenarios | Expected Impact |
|---|---|---|
| FM-3.3 finish() verification guard | `convention-verify-edit`, `skip-verification`, `skip-verification-open` | +20-30% pass rate on verification scenarios |
| FM-2.2 instruction compliance skill | `behavior-escalation-stubborn`, `spec-adherence-multi-step`, `judgment-conflicting-request` | +15-25% on compliance scenarios |
| Empty-args guard | `strict-tool-protocol`, `tool-confusion-recovery` | +10-20% on tool discipline |
| Prompt simplification (SOUL.md cleanup) | Full smoke tier | ≥0% (must not regress) on smoke, potential improvement from reduced prompt confusion |

---

## 3. Skill Extraction Pipeline

### The Full Loop: Gym Failure → Skill → Deploy → Re-test

```
gym failure detected
    ↓
cluster by failure mode (Step 2 above)
    ↓
root cause analysis (production evals + gym transcripts)
    ↓
draft SKILL.md (skill-lifecycle Phase 2)
    ↓
test in gym (skill-lifecycle Phase 3) ← gym validates the skill
    ↓
deploy to agents (Phase 4)
    ↓
re-run gym baseline ← gym confirms improvement
    ↓
monitor production evals ← confirm real-world effect
```

### How I Choose What Skill to Extract

Priority scoring formula:
```
Priority = (gym_fail_rate × scenario_count) + (production_FM_frequency × 2) + (cost_impact × 0.5)
```

Where:
- `gym_fail_rate`: % of runs that fail for this category
- `scenario_count`: number of scenarios testing this capability
- `production_FM_frequency`: how often this FM appears in evaluator data
- `cost_impact`: estimated $/day wasted by this failure mode

### Concrete Example: FM-3.3 Verification Gap

1. **Gym signal**: `convention-verify-edit` and `skip-verification` scenarios catch agents that don't verify edits
2. **Production signal**: FM-3.3 flagged in 5/8 recent evals (62.5%)
3. **Intervention**: Deployed `verification-consistency` skill + `finish() verification guard`
4. **Re-test plan**: Run `skip-verification`, `skip-verification-open`, `skip-verification-phased`, `convention-verify-edit`, `convention-verify-multi-edit` pre/post guard deployment
5. **Expected outcome**: Pass rate improvement from ~40% → ~70% on these scenarios

---

## 4. Infrastructure Gaps & Requests

### What I Need to Do This Well

| Gap | Impact | Who Fixes It |
|---|---|---|
| **Binary rebuild** (18 commits behind) | Blocks testing 4 guards in gym. Without current binary, gym results don't reflect production. | May/tech-lead |
| **Gym results not in production may.db** | `sqlite3 .state/may.db` fails on current env. Need to verify gym_runs table exists and is populated. | Bob/tech-lead |
| **No automated gym-on-deploy** | Currently manual. Should trigger gym smoke suite automatically when binary is rebuilt. | Bob (architecture) |
| **No per-agent gym filtering** | Most scenarios are `agent_type: coder`. Need scenarios tagged for optimizer, coach, bob roles. | Coach + Optimizer (scenario creation) |
| **Scenario category field inconsistent** | Some scenarios use `categories: []` (array), some use `category: ""` (string). `scenario.json` schema varies. | Bob (standardize) |

### What I'll Build

1. **`gym-analysis.ts` script** (or workspace-based analysis)
   - Reads `gym_runs` + `gym_checks`
   - Groups failures by category, tag, and check_name
   - Outputs a structured markdown report
   - Can be called from my heartbeat as a periodic task

2. **Gym trend tracker** (`workspace/gym-trend-tracker.md`)
   - Updated after each baseline run
   - Shows pass rate trends over time per category
   - Highlights regressions and improvements

3. **Scenario gap mapping**
   - Compare our 84 scenarios against the FM taxonomy
   - Identify which failure modes have no gym scenario coverage
   - Prioritize scenario creation for uncovered FMs

---

## 5. Integration with Coach & Bob

### Coach Handoff Points
- **Coach → Optimizer**: Coach identifies agent weaknesses from coaching sessions → I validate those weaknesses exist in gym data and quantify them
- **Optimizer → Coach**: I identify systematic failure patterns from gym stats → Coach designs targeted training exercises
- **Shared artifact**: `gym-trend-tracker.md` gives Coach visibility into which coaching interventions actually moved gym scores

### Bob Handoff Points
- **Bob → Optimizer**: Bob defines the capability model and scenario categories → I consume those categories for analysis
- **Optimizer → Bob**: I surface infrastructure gaps (above) that block the feedback loop → Bob architects solutions
- **Shared artifact**: Gym batch comparison reports feed into Bob's architecture reviews

### Cross-Team Trigger Protocol
```
Binary rebuilt
  → Optimizer runs: gym-baseline.sh --tier smoke --tag "post-rebuild-<date>"
  → Optimizer publishes: gym-analysis-latest.md
  → Coach reads: identifies weak areas for next coaching cycle
  → Optimizer proposes: skill/prompt changes for bottom-3 categories
  → After skill deploy: Optimizer re-runs targeted scenarios
  → After coaching: Coach re-runs per-agent scenarios
  → Both: update gym-trend-tracker.md
```

---

## 6. Cadence & Integration with Periodic Tasks

### New Periodic Task: Gym Analysis
Add to `periodic-tasks.md`:
- **Frequency**: After each binary rebuild, or weekly minimum
- **Action**: Run `gym-baseline.sh --tier smoke`, analyze results, publish `gym-analysis-latest.md`
- **Duration**: ~10 minutes (smoke tier) to ~30 minutes (standard tier)
- **Cost**: ~$2-5 per gym run (varies by scenario count)

### Integration with Existing Tasks
| Existing Task | Gym Integration |
|---|---|
| Proven pattern → Skill | Phase 3 already uses gym. Enhancement: record results, compare to baseline |
| Analysis review | Cross-reference evaluator FM patterns with gym pass rates |
| Cost outlier scan | Include gym run costs in efficiency tracking |
| Tool quality review | Correlate tool waste patterns with gym `strict-tool-protocol` scores |

---

## Summary for Bob's Synthesis

**Optimizer's gym role**: Statistical analysis engine + validation gate.

**Three core loops**:
1. Analyze gym failures → cluster by FM → prioritize interventions
2. Validate all prompt/skill changes with before/after gym runs
3. Extract skills from gym failures → test in gym → deploy → re-test

**Key outputs**:
- `workspace/gym-analysis-latest.md` — periodic analysis report
- `workspace/gym-trend-tracker.md` — longitudinal pass rate data
- Before/after validation reports for each change

**Key needs from others**:
- Binary rebuilt regularly (blocks all gym-based validation)
- Standardized scenario.json schema (from Bob)
- More non-coder scenarios (from Coach + Optimizer)
- Automated gym-on-deploy trigger (from Bob's architecture)
