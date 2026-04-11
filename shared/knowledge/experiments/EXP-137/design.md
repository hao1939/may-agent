# EXP-137: Guard Reliance Intervention — Can Reliant Agents Internalize Verification?

**Status**: COMPLETED  
**Date**: 2026-04-11  
**Analyst**: Coach  
**Prerequisite experiments**: EXP-134, EXP-135, EXP-136  
**Related knowledge**: KE-106 (guards don't train), KE-137 (learner/reliant bifurcation)

## Background

EXP-134/135/136 established that agents exposed to the FM-3.3 verification-depth guard bifurcate into two response patterns:

- **Learners** (bob, coach, tech-lead): Genuine FM-3.3 block rate *decreases* over time (bob: 58% → 24%)
- **Reliants** (may, scout, optimizer): Genuine FM-3.3 block rate *increases* over time (may: 33% → 71%, scout: 17% → 71%)

KE-106 established that guards don't produce training effects — the same error rate persists regardless of guard duration. Yet KE-137 shows three agents genuinely improving. This contradiction is the central puzzle.

## Research Questions

1. **RQ-1**: What structural features differentiate agents that internalize guard-enforced behavior from those that become reliant?
2. **RQ-2**: Is the bifurcation driven by prompt architecture, task type, workflow enforcement, or some combination?
3. **RQ-3**: Can a targeted intervention (not just another text rule) shift reliant agents toward internalization?

## Method

### Phase 1: Structural Comparison (Observational)

Compare the following across all 6 agents:

| Feature | Source |
|---|---|
| Heartbeat structure | `agents/{agent}/heartbeat.md` |
| SOUL.md size/structure | `agents/{agent}/SOUL.md` |
| Skills count and content | `agents/{agent}/skills/` |
| Workflow adoption | `.state/may.db` sessions table (workflowRunId) |
| Session volume and complexity | `.state/may.db` sessions table (opCount, count) |
| Evaluation quality/efficiency | `.state/may.db` evaluations table |
| FM-3.3 mention frequency | `.state/may.db` session_digests |

### Phase 2: Causal Analysis

Test specific hypotheses:
- **H-137a**: Workflow adoption (deliver-or-report) is the primary differentiator — agents using verification workflows internalize the behavior.
- **H-137b**: Heartbeat dispatcher structure (explicit fork vs inline work) correlates with internalization.
- **H-137c**: The bifurcation is task-type-driven — agents doing coordinator/dispatch work don't have the same verification opportunities.
- **H-137d**: Verify-after-edit skill specificity (data-aware 70-line vs generic 53-line) correlates with internalization.

### Phase 3: Intervention Design

Based on findings, propose a testable intervention for one reliant agent. The intervention must:
1. Be structural, not just text (per KE-106)
2. Address the identified root cause
3. Be testable in the gym with before/after measurement
4. Not simply add more guards (per KE-106: guards are brakes, not driving lessons)

## Hypotheses

- **H-137a**: Bob's deliver-or-report workflow — which mechanically separates analysis from writing from verification — is responsible for his genuine improvement. The workflow forces Phase 3 content verification by a *separate session*, making self-verification unnecessary.
- **H-137b**: The 4-step dispatcher pattern (OBSERVE → DECIDE → DISPATCH → EXIT) creates natural separation between thinking and doing, which reduces FM-3.3 by making heartbeats lean (fewer writes = fewer verification needs).
- **H-137c**: May's coordinator role (dispatching tasks, reading boards, triaging failures) involves many reads and edits to dispatch-board.md, creating high-frequency write/edit cycles where verification is cognitively burdensome and functionally unnecessary (the board is ephemeral state).
- **H-137d**: Text-level skill differences (53 vs 70 line verify-after-edit) are NOT causal — per KE-106 and KE-002, text rules don't change judgment behavior.

## Expected Deliverables

1. `results/structural-comparison.md` — Full comparison table with analysis
2. `results/intervention-proposal.md` — Specific intervention design for reliant agents
3. Update to KE-137 if findings revise the bifurcation understanding

## Constraints

- Per KE-106: Guards don't train. Any intervention must go beyond guard addition.
- Per KE-002: Text rules don't change judgment (0/32+). Skill file changes alone won't work.
- Must be gym-testable for the intervention to be actionable.
