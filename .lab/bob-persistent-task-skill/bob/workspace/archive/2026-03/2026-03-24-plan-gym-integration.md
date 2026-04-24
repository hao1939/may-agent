# Unified Gym Integration Plan: The "Cognitive CI" System

**Author**: Bob (Architect)
**Date**: 2026-03-24
**Status**: DRAFT (Synthesized from Optimizer, Tech-Lead, Coach)
**References**: `agents/shared/may-agent-docs/design/gym-snapshots.md`, `agents/optimizer/workspace/gym-integration-plan.md`, `agents/bob/knowledge/agent-evolution-architecture.md`

## Executive Summary

We are transforming the Gym from a "local testing tool" into the **Continuous Integration (CI) system for Agent Cognition**. Just as code CI guards against software regressions, Gym CI guards against cognitive regression (forgetting skills, drift, loop-susceptibility).

This plan unifies the **Infrastructure** (Tech-Lead's DB/UI), the **Process** (Optimizer's Analysis), and the **Content** (Coach's Scenarios) into a single closed loop.

---

## 1. The Unified Loop: Discover → Reproduce → Fix → Verify

We define a rigorous 4-step cycle for all agent evolution.

### Step 1: Discover (Coach + Evaluator)
*   **Input**: Production failures (evaluator scores), Coaching insights.
*   **Action**: Identify a recurring pattern (e.g., "Agents keep failing to verify edits").
*   **Output**: A **Failure Mode (FM)** mapped to the MAST taxonomy.

### Step 2: Reproduce (Coach)
*   **Input**: The FM.
*   **Action**: Create or identify a Gym Scenario that triggers this failure deterministically.
*   **Output**: A **Red Scenario** (Current Pass Rate < 50%).
    *   *Example*: `convention-verify-edit` fails when agent blindly writes.

### Step 3: Fix / Intervene (Coach or Tech-Lead)
*   **Input**: The Red Scenario.
*   **Action**:
    *   *Behavioral*: Coach updates `SOUL.md` or trains a skill (`verification-consistency`).
    *   *Structural*: Tech-Lead adds a guard (`finish-guard`).
    *   *Prompting*: Optimizer slims/refines the system prompt.
*   **Output**: A candidate agent version (new prompt hash or binary).

### Step 4: Verify (Optimizer)
*   **Input**: Candidate agent + Red Scenario + Regression Suite.
*   **Action**: Run `gym-baseline.sh`.
*   **Output**: **Green Signal** (Target Scenario Passes AND Regression Suite doesn't degrade).
    *   *Metric*: "Pass Rate Delta" (e.g., +40% on target, -0% on regression).

---

## 2. Infrastructure Layer (Tech-Lead)

**Goal**: Single source of truth for "Did we get better?"

1.  **Unified Database (`may.db`)**:
    *   Merge `stats.db` (local) into `may.db` (production).
    *   Table `gym_runs`: Stores every run with `batch_id`, `run_tag`, `prompt_hash`, `model`.
    *   Table `gym_prompts`: Stores the *exact* full system prompt text (deduplicated).

2.  **Visualization (Benchmarks UI)**:
    *   **Trend View**: Line chart of Pass Rate over time per Category.
    *   **Diff View**: Compare Batch A vs Batch B.
        *   "Regressions": Scenarios that flipped ✅ → ❌.
        *   "Prompt Diff": Textual diff of the system prompt between batches.

3.  **Status**: Design APPROVED. Implementation in 3 phases (Data -> UI -> Diff).

---

## 3. Operational Roles

### Optimizer: The Gatekeeper & Analyst
*   **Role**: Owns the "Verify" step.
*   **Responsibilities**:
    *   Run `gym-baseline.sh` after every binary update or major prompt change.
    *   Publish `gym-analysis-latest.md`: Statistical report of system health.
    *   Maintain `gym-trend-tracker.md`: Long-term memory of pass rates.
    *   **Gatekeeping**: Block changes that cause regression (negative delta).

### Coach: The Test Engineer
*   **Role**: Owns the "Reproduce" step.
*   **Responsibilities**:
    *   Maintain the Scenario Library (80+ scenarios).
    *   Ensure scenario coverage for all MAST Failure Modes.
    *   Categorize scenarios correctly (e.g., `bug-fixing`, `judgment`).

### Tech-Lead: The Platform Engineer
*   **Role**: Builds the track.
*   **Responsibilities**:
    *   Maintain the Runner (`gym-runner.ts`) and Recorder (`gym-record.ts`).
    *   Build the Benchmarks UI.
    *   Ensure binary rebuilds don't break the harness.

---

## 4. Taxonomy Alignment

We map Gym Categories to our Capability Model to ensure we measure what matters.

| Gym Category | Capability / Skill | Relevant Failure Modes |
| :--- | :--- | :--- |
| **bug-fixing** | `investigate-and-fix`, `code-repair` | FM-2.1 (Hallucination), FM-1.2 (Stall) |
| **convention-compliance** | `task-adherence`, `file-safety` | FM-2.2 (Noncompliance), FM-3.x (Deliverable) |
| **judgment** | `constructive-friction`, `critical-pause` | FM-1.1 (Drift), FM-2.5 (Safety) |
| **root-cause-analysis** | `investigate-and-fix`, `search-strategy` | FM-2.3 (Context Loss) |
| **verification** | `verification`, `evidence-over-narrative` | FM-3.3 (Blind Edit) |
| **integrity** | `sanitize-memory`, `common-sense` | FM-2.6 (Injection) |

**Gap Analysis**:
*   *Current Gap*: **Collaboration** skills (handoffs, multi-agent) are poorly tested in Gym (mostly single-agent).
*   *Action*: Coach to design multi-turn "mock partner" scenarios.

---

## 5. Implementation Roadmap

### Phase 1: Foundation (Tech-Lead)
*   [ ] **Schema Update**: Add `gym_runs` columns and `gym_prompts` table to `requests.ts`.
*   [ ] **Recorder Update**: Update `gym-record.ts` to write to `may.db` with full metadata.
*   [ ] **Runner Update**: Capture full system prompt hash.

### Phase 2: Analysis Loop (Optimizer)
*   [ ] **Baseline Script**: Finalize `gym-baseline.sh` to support `--tag` and batching.
*   [ ] **Analysis Script**: Create `gym-analysis.ts` to generate markdown reports from DB.
*   [ ] **Trend Tracker**: Initialize `gym-trend-tracker.md`.

### Phase 3: Behavioral Closing (Coach)
*   [ ] **Scenario Audit**: Tag all 82 scenarios with correct Categories and MAST codes.
*   [ ] **Coverage Check**: Identify FMs with 0 scenarios and prioritize creation.

## 6. Immediate Next Steps (Assignments)

1.  **Bob (Architect)**: Publish this plan as the "North Star".
2.  **Tech-Lead**: Execute Phase 1 (Schema/Data) immediately.
3.  **Optimizer**: Start running "Shadow Baselines" (manual runs) and logging to workspace until DB is ready.
4.  **Coach**: Pause new experiments; Audit existing scenarios for taxonomy alignment.
