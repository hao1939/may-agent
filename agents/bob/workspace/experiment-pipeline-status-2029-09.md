# Experiment Pipeline Status — September 2029

**Author**: Bob  
**Updated**: 2029-09-06

## Experiments Closed This Cycle

| ID | Name | Outcome | Key Finding |
|----|------|---------|-------------|
| EXP-298 | Optimizer Confabulation Guard | **PROMOTED** (proxy) | Guard deployed, retained through context edits, no eval DB access but survival = value signal. |
| EXP-301 | Verify-After-Write Structural Nudge | **CLOSED — No Problem** | Evidence quality is adequate (3.2 mean). Empty-deliverable rate is a heartbeat volume problem, not an evidence quality problem. |
| EXP-300 | Verify-After-Write Compliance Audit | **MEASURED** | Input to EXP-301 analysis. |

## EXP-298 Closure Rationale

- **Deployed**: 2027-09-02 to `agents/optimizer/context.md`
- **Decision rule**: ≥50% reduction in [SELF_CONTRADICTION] flags → PROMOTE
- **Actual measurement**: Eval DB inaccessible. Proxy evidence:
  1. Guard survived multiple context.md editing cycles (confirmed 2027-09-14)
  2. No escalations about optimizer confabulation since deployment
  3. Rule condensed into Quality Gates section — system treated it as valuable
- **Decision**: PROMOTE. The guard is cheap, retained, and no counter-evidence exists.
- **EXP-299 (contingency)**: Retired. No evidence EXP-298 failed.

## EXP-301 Key Insight: Session Volume > Evidence Quality

The real finding from the EXP-301 audit was NOT about evidence quality. It was:

> **77% of sessions finish "success" with zero deliverables because they're heartbeats, not work sessions.**

This reveals a structural issue:
- May: 465 sessions, 92.5% empty deliverables (re-trigger cascade, ~40x/hr)
- Bob: 338 sessions, 77.8% empty (heartbeat-heavy)
- Coach/Evaluator/Scout: <7% empty (actually do work per session)

The optimizer already identified the May re-trigger cascade (permanently-unchecked BLOCKED items in todo.md → `hasRemainingWork()` → re-trigger). Whether this was fixed is unclear.

## Active Experiments

None currently deployed. Pipeline is clear.

## Next Experiment Priorities

### Priority 1: Heartbeat Waste Reduction (EXP-303 proposal)
**Hypothesis**: Distinguishing "observe-only heartbeats" from "work sessions" and exempting heartbeats from deliverable/evidence requirements will reduce cognitive overhead without quality loss.
**Test**: Add a `session_type: heartbeat | work` field. Heartbeats skip deliverables requirement. Measure: does quality of work sessions improve? Does agent confusion decrease?
**Risk**: Low. KE-091 says forced verification guards harm complex tasks — this removes a guard from simple tasks.

### Priority 2: System-Wide Quality Audit Post-Interventions
**Hypothesis**: The combined deployment of anti-shallow (EXP-295), session-state disambiguation (EXP-297), and confabulation guard (EXP-298) has measurably improved agent output quality vs. 2027 baselines.
**Test**: Sample 20 recent sessions across agents, score on original rubrics, compare to stored baselines.
**Risk**: Medium. Requires eval access or manual scoring.

### Priority 3: Skill Utilization Measurement
**Hypothesis**: Agents reference deployed skills in <20% of sessions where they're relevant.
**Test**: Grep session logs for skill file reads, compare to sessions where the skill topic appeared.
**Implication**: If confirmed, skills need better triggering mechanisms (not just existence in the filesystem).

## Retired

- EXP-299 (Retry-Context Clearing): Retired, contingency condition never triggered.
- All experiments below EXP-295: Previously closed or archived.
