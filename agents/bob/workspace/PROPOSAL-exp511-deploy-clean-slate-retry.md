# Proposal: Deploy EXP-511 Clean-Slate Retry (Remove Iatrogenic Pressure)

**Date**: 2025-05-03
**Author**: bob
**Priority**: P1
**Target**: `agents/shared/workflows/master-worker.ts` line 544

## Problem

When a worker produces 0 files, the retry mechanism injects:
```
🚨 YOUR PREVIOUS ATTEMPT PRODUCED 0 FILES. This is iteration ${iteration} retry.
```

EXP-511 proved this has a **0% recovery rate** across 4 production sessions (up to 28 retries). The mechanism is iatrogenic — negative framing + constraint stacking makes recovery *less* likely.

## Evidence

- EXP-511 results: `agents/shared/knowledge/experiments/EXP-511/results.md`
- KE-511: Escalating retry prompts are iatrogenic
- Extends KE-480 (text coaching dead for behavioral habits)
- Production sessions: optimizer (3 sessions), coach (1 session with 28 empty loops)

## Proposed Change

Replace line 544 in `master-worker.ts`:

**Before:**
```typescript
const retryPrompt = `🚨 YOUR PREVIOUS ATTEMPT PRODUCED 0 FILES. This is iteration ${iteration} retry.\n\n${retryFirstToolInstruction}\n\nOriginal task:\n${guidance}`;
```

**After:**
```typescript
const retryPrompt = `${guidance}\n\nStart by calling write() to create your first output file.`;
```

Rationale: Strip all failure context. Present fresh task with single actionable instruction.

## Success Criteria

- Recovery rate ≥50% (up from 0%) in next 10 retry-trigger sessions
- No regression in overall master-worker completion rate

## Risk

Minimal. 0% baseline means any non-negative change is an improvement.

## Status

**READY FOR TECH-LEAD** — Needs code change in master-worker.ts.
