# KE-371: Workflow Protection Coverage Gap — Most Agent Sessions Are Unprotected

**Date**: 2026-04-23
**Source**: EXP-076
**Confidence**: High
**Connects**: KE-007, KE-367, KE-369

## Core Finding

99.9% of Bob's sessions (2,145/2,147) and 84% of QA's sessions run without workflow protection. Agents with workflow access don't use it (tech-lead: 0% usage despite having it). Work sessions score significantly higher than heartbeats (Bob: 3.98 vs 3.47), but heartbeats — which involve complex triage and dispatch — get no structural protection.

## Evidence

- EXP-076: Audit of 17,301 sessions across 8 agents from may.db
- Bob: 0.1% protected, quality 3.32, waste 2.5
- Coach: 8.6% protected (via code-level invocation), quality 3.20, waste 7.5
- Work sessions consistently outscore heartbeat sessions across agents

## Mechanism / Why

Workflow tools exist but aren't integrated into the session types that need them most. Heartbeats are judgment-intensive (triage, prioritize, dispatch) but run as unstructured sessions. The quality gap between work and heartbeat sessions suggests structural protection would help.

## Implications

### 1. Bob and QA are the top candidates for workflow expansion
Highest session volume × lowest protection = most potential improvement.

### 2. Having workflow access ≠ using it
Tech-lead has access but 0% usage — need to make workflows the default path, not optional.

## Actionable

- Design lightweight heartbeat workflow for Bob that structures triage→decide→act phases
- Give QA workflow access and default QA tasks to use implement-and-verify
- Measure quality delta after workflow adoption

## Open Questions

- Would workflow overhead (KE-369) offset quality gains for simple heartbeat sessions?
- What's the minimum useful workflow for a heartbeat?
