# Gym-Driven Evolution Process

## Overview

A repeatable cycle that uses gym scenario results to identify agent weaknesses, design targeted interventions, and measure improvement.

## The Cycle

### Step 1: Identify Worst Category
From the latest baseline, rank categories by pass rate. Pick the worst category that has ≥2 scenarios (for statistical reliability).

**Current target**: Verification (0/2) and Optimizer Workflow (0/2) tied at 0%. Judgment (1/4, 25%) has more scenarios for signal.

### Step 2: Root-Cause Analysis
For each failing scenario in the target category:
1. Read the scenario's `task.md` and `success_criteria.js`
2. If a transcript exists, analyze what the agent did wrong
3. Classify the failure mode:
   - **Format gap**: Agent didn't follow required output format
   - **Context gap**: Agent didn't read/use available context
   - **Judgment gap**: Agent acted too quickly without validation
   - **Skill gap**: Agent lacks the capability entirely

### Step 3: Design Intervention
Based on failure mode, choose intervention type:

| Failure Mode | Intervention | Example |
|---|---|---|
| Format gap | Skill file with format template | "How to write a KE" skill |
| Context gap | Context injection or skill | "Read context.md before acting" rule |
| Judgment gap | Decision protocol skill | "Validate approach before committing" checklist |
| Skill gap | New skill or prompt engineering | New capability addition |

Interventions are written as skill files in `agents/.lab/gym-interventions/`.

### Step 4: Run Targeted Scenarios
Re-run only the failing scenarios from the target category with the intervention applied. Compare check-by-check against baseline.

### Step 5: Measure & Document
Record in `.state/gym-cycle-N-results.md`:
- Which scenarios improved (and by how many checks)
- Which stayed the same
- Net score change on core 20
- Whether to ship the intervention to production agent config

### Step 6: Ship or Iterate
- If improvement ≥ 50% of failing checks recovered → ship to agent config
- If < 50% → analyze remaining failures and iterate
- Update baseline after shipping

## Targeting Priority (from baseline)

1. **Verification (0/2)** — context-learning, context-learning-correction. Failure mode: context gap. Agent doesn't use `context_updates` in finish().
2. **Optimizer Workflow (0/2)** — experiment-analysis-report, knowledge-entry-creation. Failure mode: format gap. Agent doesn't follow structured output templates.
3. **Judgment (1/4)** — ambiguous-context-drift, approach-validation-trap, assertion-without-evidence. Failure mode: judgment gap. Agent acts without validating.
4. **Efficiency (0/1)** — optimize-deploy-config. Needs investigation.
5. **Error Recovery (0/1)** — error-recovery-broken-config. Needs investigation.
6. **Reflexion (0/1)** — reflexion-npx-recovery. Agent doesn't self-correct.

## Cycle 1 Target

**Category**: Optimizer Workflow (0/2)
**Rationale**: Likely the easiest to fix — these are format/template gaps, not deep judgment issues. Agent already does analysis work, it just needs to know the expected output format.

**Scenarios**: experiment-analysis-report, knowledge-entry-creation
**Hypothesis**: Adding a skill that describes expected output formats will improve pass rate from 0/2 to at least 1/2.
