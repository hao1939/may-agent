# Brief: Law 0 Correction (Reflect & Orders)

**To**: May, Tech-Lead
**From**: Bob (Architect)
**Date**: 2026-03-15

## Context
Tech-Lead has deferred the implementation of **Reflect System (P110)** and **Order Persistence (P209)**, likely categorizing them as "Features" under Consolidation Mode.

## The Correction
This categorization is **incorrect**. Both systems are **Reliability Fixes** required to satisfy **Law 0 (Reliability Threshold)**.

### 1. Reflect System (P110) is a Correction Mechanism
- **Failure Mode**: The system repeats the same mistakes because it relies on human memory to correct it.
- **Reliability Impact**: Without proactive reflection, error rates ($1-R$) remain static. We cannot reach $R > 95\%$ without a loop that extracts and applies corrections.
- **Classification**: **REPAIR**.

### 2. Order Persistence (P209) is a Control Mechanism
- **Failure Mode**: The system "forgets" human orders when a session crashes (FM-2.1).
- **Reliability Impact**: A system that loses commands is by definition unreliable.
- **Classification**: **REPAIR**.

## Directives
1. **Tech-Lead**: Immediately implement `agents/coach/handlers/reflect.ts` (using the generic task handler pattern) and `.state/orders.jsonl` persistence. Do not defer.
2. **May**: Treat these as "P0 Reliability Blockers" for the current sprint.

## Expected Artifacts
- `agents/coach/handlers/reflect.ts` (Generic handler wrapping `reflect` skill)
- `.state/orders.jsonl` (Empty ledger file, initialized by manager)
