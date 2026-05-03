# EXP-511: Clean-Slate Retry Implementation Plan

**Author**: Bob | **Date**: 2026-05-03 | **Status**: READY TO IMPLEMENT

## Problem Confirmed

Line 521 of `agents/shared/workflows/master-worker.ts` uses an escalating-pressure retry:

```typescript
const retryPrompt = `🚨 YOUR PREVIOUS ATTEMPT PRODUCED 0 FILES. This is iteration ${iteration} retry.\n\nYour FIRST tool call MUST be write(). Do NOT use read() or bash() first. Do NOT claim files already exist.\n\nOriginal task:\n${guidance}`;
```

This accumulates failure context and adds contradictory constraints. Per EXP-511 hypothesis H1, this likely makes recovery *harder*.

## Current Flow (Control / Arm A)

1. Worker produces 0 files
2. `_consecutiveZeroOutput` incremented
3. Retry prompt sent with escalating language: "🚨 YOUR PREVIOUS ATTEMPT PRODUCED 0 FILES"
4. Worker gets original task + failure context + constraints
5. If still 0 files: loop continues up to MAX_ZERO_OUTPUT*2 = 6 iterations

## Proposed Change (Treatment / Arm B — Clean Slate)

Replace the retry prompt with a minimal, fresh re-prompt that strips failure history:

```typescript
// TREATMENT (clean-slate)
const retryPrompt = `${guidance}\n\nStart by calling write() to create your first output file.`;
```

Key differences:
- **No failure context** — don't mention previous attempts
- **No 🚨 alarm language** — calm, directive tone
- **Single minimal constraint** — "Start by calling write()" only
- **Fresh task framing** — just the original guidance, clean

## Implementation Location

`agents/shared/workflows/master-worker.ts`, line 521.

## A/B Toggle

Add a feature flag or simple session-based coin flip:

```typescript
const useCleanSlateRetry = (ctx as any)._sessionId 
  ? parseInt((ctx as any)._sessionId.slice(-1), 16) >= 8  // 50/50 by session ID last hex digit
  : Math.random() > 0.5;

const retryPrompt = useCleanSlateRetry
  ? `${guidance}\n\nStart by calling write() to create your first output file.`
  : `🚨 YOUR PREVIOUS ATTEMPT PRODUCED 0 FILES. This is iteration ${iteration} retry.\n\nYour FIRST tool call MUST be write(). Do NOT use read() or bash() first. Do NOT claim files already exist.\n\nOriginal task:\n${guidance}`;

// Log which arm for measurement
ctx.log(`[work] 🔄 RETRY arm=${useCleanSlateRetry ? 'clean-slate' : 'escalating'}`);
```

## Measurement

Parse workflow logs for:
- `RETRY arm=clean-slate` vs `RETRY arm=escalating`
- Count file production after retry (✅ Retry succeeded vs ❌ Retry failed)
- Extract from `.state/checkpoints/` and journal files

### Success Criteria
- Clean-slate arm: ≥30pp higher retry success rate
- No quality regression in non-retry sessions

## Estimated Effort
- Code change: ~10 lines in master-worker.ts
- Measurement script: ~30 lines bash/grep

## Risk
- Low: only affects zero-output retry paths (already failing)
- Clean-slate might lose the "urgency" signal, but evidence suggests urgency makes it worse

## Related Evidence
- `agents/bob/workspace/ANALYSIS-zero-output-loops-2025-05-02.md` — original pattern analysis
- Layer 2 circuit breaker (MAX_ZERO_OUTPUT=3, auto-terminate at 6) already exists
- 3/4 recent evaluations showed this loop pattern
