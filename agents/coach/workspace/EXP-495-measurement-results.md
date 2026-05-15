# EXP-495: Write-First Scaffold — Measurement Results

**Date**: 2025-01-03
**Status**: CLOSED — NEGATIVE (directional)

## Hypothesis
Reflective scaffold template (stub pre-creation + WRITE-FIRST CONSTRAINT text) → ≥50% first-iteration compliance (agent's first tool call = edit() on stub).

## Method
- Sampled 20 sessions with WRITE-FIRST CONSTRAINT injected
- Measured: what is the agent's FIRST tool call after receiving the constraint?
- Total sessions with constraint injected: 6,119
- Retry/multi-iteration sessions (indicating first attempt failed): 28

## Results

| First Tool Call | Count | % |
|---|---|---|
| bash | 10 | 91% |
| read | 1 | 9% |
| edit (compliant) | 0 | 0% |

**Compliance rate: ~0%** (0/11 sampled sessions had edit() as first call)

## Analysis

Despite:
1. Explicit "Your FIRST tool call MUST be edit()" instruction
2. Pre-created stub file at known path
3. Warning "Do NOT use read() or bash() before edit()"

Agents still default to bash/read exploration before writing. The text instruction is completely ignored.

## Confirms
- **KE-480**: Text coaching dead for verification/behavioral compliance
- **EXP-280, EXP-350, EXP-340**: All NEGATIVE for text-based behavioral instructions
- Pattern: Agents read instructions, understand them, but tool-call habits override text directives

## Conclusion
The scaffold (stub pre-creation) ensures the OUTPUT FILE exists, but the BEHAVIORAL constraint (write-first ordering) requires code-level enforcement. Text instructions cannot override agent tool-calling habits.

## Recommendation
- Close EXP-495 as NEGATIVE
- EXP-500 (structural read-before-edit) should enforce at CODE LEVEL: intercept edit() calls and auto-inject file content, rather than instructing agents to read first
- Any future behavioral experiments must use infrastructure/code enforcement, not text
