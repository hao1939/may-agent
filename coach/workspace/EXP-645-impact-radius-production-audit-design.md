# EXP-645 — Impact Radius Check Production Audit

## Status: CLOSED — H1 REJECTED (6% scanning rate vs 30% target)

## Problem

The `impact-radius-check` skill showed +100pp improvement in two gym scenarios (EXP-445, EXP-570). It was deployed to bob/context.md and coder/context.md on 2028-02-01. However, we've never measured whether the skill actually fires in production sessions — agents might ignore it in real tasks just as they ignore verify-after-edit.

## Question

Does the impact-radius-check skill produce observable behavioral changes in production worker sessions (grep/rg for consumers, explicit cross-file scanning)?

## Hypothesis

H1: ≥30% of production sessions involving file modifications show evidence of cross-file impact scanning (grep for consumers/callers/imports of modified symbols).

H2: Sessions with impact scanning have lower rates of follow-up "fix what I broke" sessions compared to those without.

## Method

### Phase 1: Behavioral Signal Detection (this session)
1. Sample recent bob and coder sessions from `.state/sessions/`
2. Look for impact-radius-check behavioral markers:
   - `grep` or `rg` for function/variable names after modifying a file
   - Explicit mention of "consumers", "callers", "impact" in agent messages
   - Multi-file edits that touch both source and dependent files
3. Score each session: SCANNING (skill evidence) vs NON-SCANNING (no evidence)

### Phase 2: Correlation (next session)
1. Compare SCANNING vs NON-SCANNING sessions for:
   - Follow-up fix sessions within 24h
   - Edit failures (cascading breakage)
   - Task completion rate

## Success Criteria
- Phase 1: Score ≥10 sessions, report scanning rate
- Phase 2: Identify correlation (or lack thereof) between scanning and outcomes

## Builds On
- EXP-445: +100pp on escalation-judgment scenario
- EXP-570: +100pp on cross-file-impact-config-change (generalization confirmed)
- KE-480: Text coaching dead for verification, but impact-radius is a *decision* skill not a *verification* behavior

## Key Distinction from KE-480
Impact-radius-check is a **cognitive** skill (think before acting) not a **procedural** skill (always do X after Y). KE-480 applies to procedural compliance. Cognitive skills may have different production dynamics — this experiment will reveal whether that's true.

## Timeline
- Phase 1: This heartbeat
- Phase 2: Next heartbeat (if Phase 1 shows variance)
