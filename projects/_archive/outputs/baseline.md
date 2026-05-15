# Agent System Literacy — Baseline Metrics

**Generated**: 2026-06-24
**Purpose**: Phase 1 baseline snapshot for the agent-system-literacy project

---

## 1. Project Creation Rate (last 7 days)

- **51 projects** have been modified in the last 7 days (across all statuses)
- **Total projects**: 51
- **Status breakdown**:
  - done: 42
  - active: 2
  - waiting: 2
  - closed: 1
  - complete: 1
  - cancelled: 1
  - blocked: 1
  - unknown: 1

**Interpretation**: The system is mature — 82% of projects are done. Active project creation has slowed, which is expected for a system in steady-state.

---

## 2. Escalation Quality

- **Checkpoint data**: No checkpoint files with blocked/failure status found in the last 7 days
- **Structured escalation signals**: Minimal — the `.state/checkpoints/` directory pattern is sparsely used

**Interpretation**: Either (a) agents rarely get blocked, or (b) blocked states aren't being persisted to checkpoints. The `escalation` skill exists in the skills library but evidence of structured escalation (with reason + what-was-tried) is sparse. This is a gap the literacy project should address.

---

## 3. Skill Read Rate

- **Skills library size**: 50+ skills in `/app/agents/shared/skills/`
- **Journal references to `skills/`**:
  - agent-system-literacy: 2 references
  - convention-compliance: 2 references
  - gym-leverage-ow: 2 references
  - prove-the-loop: 1 reference
- **Total projects referencing skills in journals**: 4 out of 51 (~8%)

**Interpretation**: Skills are rarely referenced in project journals. This suggests either (a) skills are used but not logged, or (b) most agents don't consult the skills library during work. Low read-rate is the primary signal that literacy interventions are needed.

---

## Summary

| Metric | Baseline Value | Target Direction |
|--------|---------------|-----------------|
| Project creation rate | 51 total, 2 active | Stable (not a growth metric) |
| Escalation quality | Near-zero structured escalations | ↑ Increase structured blocked/failure reports |
| Skill read rate | 8% of projects reference skills | ↑ Increase to 25%+ |

These baselines establish the "before" state for measuring impact of literacy interventions.
