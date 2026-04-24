# Lens D: overflow.ts Token Budget Overflow Handling Fragility

**Date**: 2026-04-13  
**File**: `src/lib/overflow.ts` (160 lines)

## Target

`src/lib/overflow.ts` — overflow detection (`isOverflowError`) and progress extraction (`extractProgress`) for context window overflow scenarios.

## What It Does

Provides two functions: (1) `isOverflowError()` — regex-based detection of context overflow errors from 16 provider-specific error string patterns, and (2) `extractProgress()` — extracts structured progress from an overflowed conversation to produce a markdown handoff document.

Used by: `manager.ts` (completion handling, 2 call sites), `manager-retry.ts` (retry gating, 1 call site), `chat-session.ts` (crash loop prevention, 2 call sites).

## Findings

### 1. `extractProgress()` is dead code (MEDIUM)
The function is defined, exported via `index.ts`, and has a test file (`test/overflow.test.ts`), but **zero production callers** exist anywhere in `src/`. When a session overflows, `manager.ts:785` creates a digest entry and `manager.ts:799` checks overflow for chat session archival — but neither calls `extractProgress()`. The recovery document it generates is never written to disk or injected into a new session. This means **overflow recovery is detected but never acted on** — the progress extraction infrastructure exists but was never wired.

### 2. Regex-only detection with no false-positive guard (LOW)
`isOverflowError()` tests 16 regex patterns against the raw error string. Some patterns are broad:
- `/too many tokens/i` — could match unrelated error messages mentioning tokens
- `/^4(?:00|13)\s*(?:status code)?\s*\(no body\)/i` — matches bare 400/413 status codes without body, which could be non-overflow HTTP errors (rate limiting, malformed request)

In practice this is low-risk because the function is only called on `session.error` strings from LLM providers, which have specific formats. But a provider returning `400 (no body)` for a non-overflow reason would be misclassified.

### 3. Chat session overflow creates one-shot archive with no continuation (LOW)
When overflow is detected in `manager.ts:799-800`, chat sessions are archived instead of going idle (correct — prevents crash loop). But no new session is created and no progress is carried over. The user loses all conversation context. `extractProgress()` was presumably designed to bridge this gap but was never wired.

### 4. No overflow warning before hitting the limit (LOW)
The system only detects overflow reactively (after the LLM rejects the request). There's no proactive detection — e.g., "context is at 90% capacity, compaction needed." Compaction exists in `compaction.ts` but is triggered independently. If compaction fails or is insufficient, the next LLM call hits the wall with no graceful degradation.

## Recommendations

1. **P2**: Delete `extractProgress()` + its test (~90 lines dead code), or wire it into the overflow handling path in `manager.ts` to actually produce recovery documents for overflowed sessions.
2. **P3**: Audit the `400/413 (no body)` regex pattern — confirm it only matches overflow errors and not other HTTP failures from LLM providers.
3. **P3**: Consider proactive overflow warning (emit event when context reaches 80-90% of limit) so compaction can be triggered before failure.

## Verdict

**Minor issues** — detection is solid and well-integrated for reactive overflow handling. Main gap is the dead `extractProgress()` function (90 lines of unused code + tests). The overflow→archive→lost-context path for chat sessions is a known UX gap that `extractProgress` was designed to solve but never completed.
