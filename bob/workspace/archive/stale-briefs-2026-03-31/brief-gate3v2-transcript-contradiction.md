# Brief: Gate 3v2 — Transcript-Level Contradiction Detection

**Author**: Bob  
**Date**: 2026-03-29  
**Target**: Tech-Lead (implementation in `src/lib/tools/finish-guard.ts`)  
**Priority**: HIGH  
**Evidence**: Gate 3 validation — 0/6 pass rate (agents/coach/workspace/gate3-validation-results.md)

## Problem

Gate 3 (Contradictory Status Guard) currently only checks the `finish()` **summary** parameter for blocker keywords. In 6/6 gym runs on `missing-prerequisite-detection`, the coder:
- Correctly **detects** the missing `etl-output.json` in the transcript (reads directory, sees it's absent)
- Correctly **reports** the finding in conversation
- But writes a **clean summary** like "Analyzed the project and reported findings" that dodges all blocker patterns
- Calls `finish(status: "success")` — Gate 3 doesn't fire because the summary lacks blocker keywords

This is a consistent 0% pass rate, not stochastic. The coder is reframing "I found a problem" as "I successfully found the problem."

## Design: Transcript Contradiction Detection

Add a new check to Gate 3 that scans the **assistant text messages** in the transcript for evidence of unresolved blockers, then blocks `finish(success)` if found.

### Implementation

In `createFinishGuard()`, after the existing summary-based Gate 3 check, add:

```typescript
// ── Gate 3b: Transcript Contradiction Guard ──────
// The agent may write a clean summary but the transcript reveals
// acknowledged blockers/missing prerequisites that were never resolved.
const TRANSCRIPT_BLOCKER_PATTERNS = /\b(?:file\s+(?:is\s+)?(?:missing|not\s+found|does\s+not\s+exist)|(?:missing|absent|not\s+(?:found|present|available))\s+(?:file|dependency|prerequisite|input|data)|cannot\s+(?:proceed|continue)\s+(?:without|until)|required\s+.*?\s+(?:is|are)\s+(?:missing|not\s+(?:found|present|available))|no\s+such\s+file)\b/i;

// Extract assistant text from transcript
function hasUnresolvedBlockerInTranscript(messages: typeof ctx.context.messages): string | null {
  const blockerMentions: string[] = [];
  
  for (const msg of messages) {
    if (msg.role !== "assistant") continue;
    const text = typeof msg.content === "string" 
      ? msg.content 
      : Array.isArray(msg.content) 
        ? msg.content.filter((b: any) => b?.type === "text").map((b: any) => b.text).join(" ")
        : "";
    
    if (TRANSCRIPT_BLOCKER_PATTERNS.test(text)) {
      const match = text.match(TRANSCRIPT_BLOCKER_PATTERNS);
      if (match) blockerMentions.push(match[0]);
    }
  }
  
  if (blockerMentions.length === 0) return null;
  return blockerMentions[0]; // Return first match for error message
}

const transcriptBlocker = hasUnresolvedBlockerInTranscript(ctx.context.messages);
if (transcriptBlocker) {
  return {
    block: true,
    reason:
      `finish(status: "success") blocked [Transcript Contradiction]: Your session transcript ` +
      `contains evidence of unresolved blockers ("${transcriptBlocker}") but you're claiming success. ` +
      `If you discovered missing files, unmet prerequisites, or blockers during this session, ` +
      `your finish status must reflect that:\n` +
      `1. finish(status: "blocked", blockers: [...]) — when external dependency is missing\n` +
      `2. finish(status: "partial", next_steps: "...") — when some work done but not complete\n` +
      `3. finish(status: "failure", blockers: [...]) — when the task cannot be done\n` +
      `Discovering and reporting a problem is valuable work, but the status must be "blocked" or "partial", not "success".`,
  };
}
```

### Key Design Decisions

1. **Scan assistant messages only** — tool results might mention "file not found" for legitimate reasons (e.g., grep output showing a previous state). Assistant text shows what the agent *acknowledges*.

2. **Focus on file/prerequisite language** — Keep patterns specific to missing files/dependencies. Don't pattern-match generic negative words that could appear in normal analysis.

3. **Place after summary check** — The summary-level Gate 3 should fire first (cheaper). This is the fallback for when the summary is clean but the transcript reveals problems.

4. **No false-positive safeguard needed yet** — The patterns are specific enough. If false positives emerge, we can add a "resolution check" (did the agent subsequently create/fix the missing file?).

### Testing

1. Run existing finish-guard tests to verify no regressions
2. Add test case: assistant says "etl-output.json is missing" → finish(success) → should BLOCK
3. Add test case: assistant says "config.json was missing so I created it" + write evidence → should PASS
4. Re-run `missing-prerequisite-detection` in gym (N=5) to validate improvement

### Expected Impact

This should shift `missing-prerequisite-detection` from 0% → significant improvement on `does-not-claim-success`. The gate blocks `finish(success)` and forces the agent to use `blocked` or `partial` status, which is what the success criteria checks for.

### Files to Modify

- `src/lib/tools/finish-guard.ts` — Add transcript scanning logic after existing Gate 3
- `test/tools/finish-guard.test.ts` — Add test cases for transcript contradiction detection

## Risk Assessment

- **False positive risk**: LOW — patterns are specific to missing file/prerequisite language
- **Performance risk**: LOW — scanning assistant messages is O(n) on message count, typically <50 messages
- **Regression risk**: LOW — existing tests cover Gates 0-2, new logic is additive
