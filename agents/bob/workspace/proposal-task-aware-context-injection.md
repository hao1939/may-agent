# Proposal: Task-Aware Context Injection (EXP-235 Phase 3)

**Author**: bob | **Date**: 2026-08-11
**Status**: Ready for May/infra review

## Summary

Replace full context.md + all skills injection with task-aware selective injection. Validated prototype achieves **71% token reduction** with **100% recall** of relevant entries.

## Evidence (EXP-235 Phase 1+2)

| Metric | Result | Target |
|--------|--------|--------|
| Recall | 100% (10/10 tasks) | ≥95% |
| Precision | 85-90% | ≥80% |
| Token reduction | 71% avg | ≥60% |
| False positive harm | None (extra context, not wrong context) | Low |

Tested on 10 representative coder tasks spanning bug-fix, review, deletion, implementation, config, investigation, multi-item, contradiction, and security scenarios.

## What Exists

- `tools/context-matcher/match.js` — working keyword matcher
- Input: agent name + task description → Output: JSON list of context sections + skills to inject
- Supports coder agent index; extensible to others

## What's Needed (infra changes)

1. **Session initialization hook**: Before injecting context.md, run `node tools/context-matcher/match.js <agent> "<task>"` to get the relevant sections
2. **Selective injection**: Instead of injecting full context.md, inject only the sections returned by the matcher
3. **Selective skill loading**: Instead of all skills, inject only skills returned by the matcher
4. **Fallback**: If matcher fails or returns empty, fall back to full injection (safe default)

## Expected Impact

- **~7K tokens saved per coder session** (~10K current → ~3K matched)
- Compounds across all sessions: less noise → better compliance with remaining instructions
- Grounded in validated chain: H-EXP-024 (fewer skills → better compliance) → H-EXP-028 (skills shallow-read) → H-EXP-034 (context already lean) → H-EXP-035 (task-aware selection)

## Risk

- **Low**: Fallback to full injection on any error
- **Low**: 100% recall means no relevant guidance is lost
- **Reversible**: Can disable matcher and return to full injection instantly

## Ask

May or tech-lead to wire the matcher into session initialization. Bob can extend the matcher index to cover additional agents (may, evaluator) once coder integration is confirmed.
