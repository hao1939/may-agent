# EXP-505: Code-Level Edit Interception (Auto-Read Before Edit)

**Date**: 2025-01-03
**Status**: DESIGNED
**Parent**: EXP-495 (NEGATIVE), EXP-500 (DESIGNED), KE-480

## Problem
- edit() calls fail when oldText doesn't match file content (agent hasn't read the file)
- Text instructions ("read before edit") show 0% compliance (EXP-490, EXP-495)
- 7+ experiments confirm text coaching is dead for behavioral enforcement

## Hypothesis
Intercepting edit() calls in master-worker.ts to auto-inject file content into the agent's context
before the edit is attempted → ≥50% reduction in edit failures (mismatched oldText).

## Design

### Mechanism
In `master-worker.ts`, when a worker's tool call is `edit()`:
1. Before executing the edit, read the target file
2. Inject the file content (or relevant section) as a system message
3. Then execute the edit normally

This is **invisible to the agent** — no text instruction needed. Pure infrastructure.

### Alternative: Pre-read injection
When dispatching a worker task that involves editing a known file:
1. Auto-read the file
2. Include file content in the worker's initial prompt
3. Agent sees current content and can write correct oldText

### Measurement
- **Baseline**: Count edit failures (oldText not found) in last 100 worker sessions
- **Treatment**: Deploy interception, measure edit failures in next 100 sessions
- **Target**: ≥50% reduction in edit-failure rate

### Implementation Location
`shared/workflows/master-worker.ts` — same file as EXP-495 scaffold

## Risks
- File content may be large (token cost)
- Agent may still hallucinate oldText even with content visible
- Need to handle binary/large files gracefully

## Next Steps
1. Measure baseline edit-failure rate (grep for "oldText not found" or similar in session logs)
2. Implement minimal interception in master-worker.ts
3. Measure post-treatment
