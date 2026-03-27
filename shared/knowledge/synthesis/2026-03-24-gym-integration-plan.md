# Design: Unified Gym Integration (Cognitive CI)

**Status**: Draft
**Date**: 2026-03-25
**Author**: Bob (Architect)
**Input**: Coach Plan (req:e0e0a2a9), Optimizer Plan (req:e0e0a2a9), Tech-Lead Implementation (gym-tracking)

## 1. The Core Loop: "Gym is CI"

We are transitioning from ad-hoc experimentation to **Cognitive CI**.
Just as code changes must pass tests, **agent behavior changes must pass gym scenarios.**

### The Unified Loop
1. **Detect (Coach)**: Identify behavioral failure (e.g., FM-3.3 Verification Gap) via production logs.
2. **Reproduce (Coach)**: Create/Select a Gym Scenario that fails for this reason.
3. **Measure (Optimizer)**: Run Baseline (`scripts/gym-baseline.sh`) to confirm failure rate.
4. **Fix (Any)**: Implement the fix (Skill, Prompt, or Guard).
5. **Verify (Optimizer)**: Run Gym Batch (`--tag post-fix`).
6. **Decide (Bob)**:
   - If `pass_rate` improves AND `regressions` = 0 → **Deploy**.
   - If `regressions` > 0 → **Reject**.

---

## 2. Role Responsibilities

| Agent | Role | Responsibility | Key Artifacts |
|---|---|---|---|
| **Coach** | **The Detector** | - Scans logs for behavioral failures.<br>- Designs scenarios to reproduce them.<br>- Prescribes "Training Plans" (targeted scenarios). | `ERROR_LOG.jsonl`<br>`scenarios/` |
| **Optimizer** | **The Validator** | - Runs the Gym Baselines & Batches.<br>- Analyzes statistical trends (Pass/Fail).<br>- Maintains the "Gym Trend Tracker". | `gym-analysis.md`<br>`gym-trend-tracker.md`<br>`gym_runs` DB |
| **Tech-Lead** | **The Enforcer** | - Ensures infra works (gym-runner, DB).<br>- Blocks deploys that fail Gym CI.<br>- Manages the "Build" (binary/image). | `gym-runner.ts`<br>`gym-baseline.sh` |
| **Bob** | **The Architect** | - Defines the Standard (schemas, thresholds).<br>- Approves/Rejects based on Validator reports.<br>- Designs the "Meta-Loop" (this document). | `design/gym-integration.md` |

---

## 3. Workflow Integration

### A. The "Growth Cycle" (Coach-Driven)
*Trigger: Coach sees 5x FM-3.3 failures in logs.*
1. **Coach**: Identifies `convention-verify-edit` as the matching scenario.
2. **Coach**: Checks Optimizer's `gym-trend-tracker.md`. "Current pass rate: 20%".
3. **Coach**: Drafts a fix (e.g., `finish-guard.ts` or SOUL prompt).
4. **Coach**: Dispatches to Tech-Lead to implement in a branch/fork.
5. **Coach**: Triggers Optimizer: "Run gym baseline on branch X for scenario Y".
6. **Optimizer**: Runs gym. "Pass rate: 80%. Regressions: None."
7. **Bob**: Reviews report. "Promote to Main."

### B. The "Skill Extraction" (Optimizer-Driven)
*Trigger: Optimizer sees efficiency regression in gym stats.*
1. **Optimizer**: Notices `behavior-resource-convergence` score dropped 15%.
2. **Optimizer**: Analyzes transcripts. "Agents are looping on npm install".
3. **Optimizer**: Extracts `npm-install-discipline` skill.
4. **Optimizer**: Runs Gym validation (A/B test).
5. **Optimizer**: Updates `gym-trend-tracker.md`. "Restored to 95%".
6. **Bob**: "Approve Skill Deployment."

---

## 4. Implementation Standards

### Data Structure (`.state/may.db`)
- **`gym_runs`**: `id`, `agent_name`, `scenario`, `pass` (0/1), `timestamp`, `batch_id`, `prompt_hash`
- **`gym_checks`**: `run_id`, `check_name`, `passed` (0/1), `details`

### Artifacts
- **`workspace/gym-trend-tracker.md`** (Optimizer): Single source of truth for agent competence.
  - Columns: `Date`, `BatchID`, `Agent`, `Scenario`, `PassRate`, `Delta`.
- **`agents/gym/scenarios/*/scenario.json`** (Standard):
  - Must include `categories` (array) matching the Capability Matrix.
  - Must include `success_criteria` (js file) returning structured boolean checks.

---

## 5. Immediate Next Steps

1. **Tech-Lead**: Fix the Gym Runtime (Context Overload issue) — **P0 Blocker**.
2. **Bob**: Publish this design to `agents/shared/knowledge/synthesis/gym-integration.md`.
3. **Optimizer**: Create the `gym-trend-tracker.md` template and run the first "Golden Baseline".
4. **Coach**: Audit existing 86 scenarios against the "FM Taxonomy" to find coverage gaps.
