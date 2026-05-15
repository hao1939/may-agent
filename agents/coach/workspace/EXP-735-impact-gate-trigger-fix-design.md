# EXP-735: Impact Gate Trigger Condition Fix

## Problem Statement

EXP-650 (impact-scanning gate) has been deployed since 2029-08-04 with **zero triggers**. The gate is supposed to catch sessions where agents edit multiple files without checking for downstream consumers.

**Root cause**: The gate checks if `grep|rg|ripgrep|find` appears ANYWHERE in the combined output text. Since agents routinely use bash (which produces output containing these keywords), the condition `!grepMentions` is almost never true.

## Current Logic (heartbeat-data.ts:530-537)

```typescript
const grepMentions = /\b(grep|rg |ripgrep|find\s.*-name)\b/i.test(combinedText);
const deliverableEdits = Array.isArray((result as any).deliverables) ? (result as any).deliverables.length : 0;
const didMultipleEdits = deliverableEdits >= 2 || editMentions >= 3;
if (didMultipleEdits && !grepMentions && result.status !== "error") {
```

## Why It Never Fires

1. `combinedText` includes the full session output (all bash stdout, all tool results)
2. Any `grep`, `rg`, or `find` command output anywhere in the session satisfies `grepMentions`
3. Agents almost always run at least one search command per session as standard practice
4. Result: `!grepMentions` is effectively always `false`

## Proposed Fix

Replace keyword detection with **semantic detection**: did the agent search for the specific symbols they modified?

### Option A: Symbol-Aware Check (Complex)
Parse deliverables for function/export names, check if those names appear in grep/rg commands. High accuracy but complex to implement.

### Option B: Temporal Check (Moderate)
Check if any grep/rg command was run AFTER the last edit. If all searches were before edits (exploratory), the agent didn't verify impact. Requires tool-call ordering data (not available in current output text).

### Option C: Simplified Trigger (Simple, Recommended)
Replace `!grepMentions` with a stricter condition:
```typescript
const grepAfterEdit = /\b(grep|rg)\b.*\b(caller|consumer|import|require|usage)\b/i.test(combinedText);
const didImpactCheck = grepAfterEdit || /impact|downstream|consumer|caller/i.test(summaryText);
if (didMultipleEdits && !didImpactCheck && result.status !== "error") {
```

This checks for INTENTIONAL impact searching (grep + impact-related terms), not incidental search commands.

## Hypothesis

**H1**: With Option C, gate fires on ≥15% of multi-edit sessions (from 0%).
**H2**: Re-prompted sessions produce at least 1 additional grep for modified symbols.

## Design

### Phase 1: Dry-Run Measurement
- Implement Option C with LOGGING ONLY (no re-prompt)
- Monitor for 30+ multi-edit sessions
- Measure fire rate and false-positive rate

### Phase 2: Activation
- If fire rate ≥10% and FP rate ≤30%, activate the re-prompt

## Success Criteria
- Gate fires on ≥10% of multi-edit sessions
- False positive rate ≤30% (sessions where agent DID check impact but gate fired anyway)

## Status
DESIGNED — awaiting implementation by tech-lead
