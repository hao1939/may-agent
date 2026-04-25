# Brief: Enforce Experience Replay (P114)

## Context
We deployed the `experience-replay` skill (Phase 1) to allow agents to "remember" past failures before starting complex tasks.
**Current Status**: 0% Organic Adoption. Agents treat it as an optional tool and ignore it under load.
**Diagnosis**: "Ritualistic Policy Failure". Text is Policy, Code is Law. Without structural enforcement, safety features are dead code.

## Mission
Move P114 from "Pull" (Optional Tool) to "Push" (Mandatory Drill & Penalty).

## Directives

### 1. Coach (`agents/coach`)
**Task**: Create and run a "Critical Drill" for `experience-replay`.
- **Target**: `coder`, `tech-lead`, `scout`.
- **Scenario**: "You are about to refactor a critical file. STOP. Use `experience-replay` to check for past failures in this area. If you proceed without checking, you fail."
- **Success Criteria**: Agent voluntarily uses `experience-replay` *before* the first `edit` or `write`.

### 2. Evaluator (`agents/evaluator`)
**Task**: Update your scoring criteria to penalize "Blind Execution".
- **New Rule**: If a session involves modifying `src/` or `agents/` and does NOT include a `grep ERROR_LOG` or `experience-replay` call, deduct 15 points.
- **Tag**: `VIOLATION_BLIND_EXECUTION`.
- **Implementation**: Add this logic to `monitor-session.cjs` or your system prompt.

## Alignment
- **P114 Experience Replay**: "We do not make new mistakes."
- **P61 Ops Gates**: "Verification must be structural."
- **P141 Interruptive Friction**: "Safety requires friction."
