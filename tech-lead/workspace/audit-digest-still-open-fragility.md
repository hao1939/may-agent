# Audit: Digest `still_open` Field — 0.9% Population Rate

**Date**: 2026-04-13  
**Lens**: D (Fragility)  
**Status**: Analysis complete — proposal included  

---

## Executive Summary

The `still_open` field in `session_digests` is populated in only **72 of 8,160 digests (0.9%)**. This field is the *sole input* to the recovery classifier (`classifyDigest()`) that decides whether to escalate, requeue, or resume failed sessions. With 99.1% null rate, the recovery system is essentially **dead on arrival** — it defaults to "nothing" (no action) for almost every failure.

## Root Cause Analysis

### Three Source Paths, All Broken

| Source Path | Trigger | How `still_open` Gets Set | Population Rate | Why It Fails |
|---|---|---|---|---|
| **finish()** via subscriber | `end` | `finishParams.next_steps ?? finishParams.blockers` | **0/3,613 (0%)** | Agents never set `next_steps`. Status is always `success`/`done`/`error`/`interrupted` — never `partial`/`blocked`. |
| **LLM synthesis** | `infra_retry`, `auto_resume`, `stuck_detected` | Regex parse of `STILL_OPEN:` from evaluator output | **19/435 (4.4%)** | LLM returns "none" → parsed to null. Or regex fails to match. |
| **checkpoint()** | `checkpoint` | `checkpoint.data.next_steps` | **51/486 (10.5%)** | Only 7.6% of sessions use checkpoint(). When they do, `next_steps` is often not provided. |

### The finish() Path Is the Critical Failure

3,613 session-end digests — zero have `still_open`. This is the *primary* digest creation path.

**Why?** The subscriber extracts `still_open` from:
```javascript
const nextSteps = finishParams?.next_steps ?? finishParams?.blockers?.map((b) => b.reason).join("; ") ?? null;
```

But the `finish()` schema only marks `next_steps` as "required when status is 'partial' or 'blocked'". In practice:
- **0 sessions** in the DB have status `partial` or `blocked` 
- 16,261 sessions are `done`, 2,889 are `error`, 1,076 are `interrupted`
- Errored sessions never called finish() → no finishParams → null
- Interrupted sessions never called finish() → no finishParams → null
- Successful sessions don't need recovery → null is fine

**The field only matters when sessions fail, but failed sessions never call finish().**

### The LLM Synthesis Path

For `infra_retry` (335 digests) and `auto_resume` (80 digests), the system synthesizes digests via LLM. The prompt asks:
```
STILL_OPEN: <what remains to be done, or "none">
```

The parser:
```javascript
stillOpenMatch?.[1]?.trim().toLowerCase() === "none" ? null : stillOpenMatch?.[1]?.trim() ?? null
```

Two failure modes:
1. LLM says "none" → null (likely common — most sessions are fine)
2. LLM says something like "None." or "Nothing remains" → non-null but useless text
3. Regex fails if LLM adds markdown fences or reformats

Result: **0/335 infra_retry** and **0/80 auto_resume** digests have still_open populated.

### The Checkpoint Path (Only Success Story)

51 of 486 checkpoint digests have still_open. This works because:
- `checkpoint.data.next_steps` is a direct string from the agent
- When agents explicitly save progress, they sometimes include next_steps
- But only 7.6% of sessions use checkpoint at all

## Downstream Impact

### classifyDigest() — The Recovery Classifier

This function decides what to do when a session fails. It checks `digest.still_open` in 6 of 8 trigger branches:

| Trigger | Condition | Action if still_open null |
|---|---|---|
| `stuck_detected` | `in_progress && still_open` | → **nothing** |
| `timeout` | `still_open` | → **nothing** |  
| `zombie_cleanup` | `still_open` | → **nothing** |
| `overflow` | `still_open` | → **nothing** |
| `session_end_failure` | `still_open` | → **nothing** |
| `auto_resume` | `in_progress && still_open` | → **nothing** |

**Result from DB**: 79 classified digests exist. 77 have action "nothing". Only 4 actually triggered recovery (2 escalate, 2 requeue).

### getUnresolvedDigests() — Session Startup Context

Called at every session start. Finds digests with non-null `still_open` and non-success outcome. Currently returns 3 items in last 24h. This means agents almost never get told "here's what was left unfinished."

## Verdict: Worth Fixing (Not Removing)

The field is **architecturally correct** — the recovery classifier logic is sound and the consumption paths are well-designed. The problem is purely **supply-side**: the field never gets populated.

Removing it would mean the recovery system has no mechanism to decide whether to retry failed work. That's worse than the current state.

## Proposed Fix: Dual-Source Population

### Fix 1: Extract from finish() summary (high impact, no schema change)

When a session ends with `error` or `interrupted` status (no finishParams), the subscriber currently sets `still_open = null`. Instead:

**For errored sessions**: The `event.outcome` field contains the last assistant text (up to 500 chars). This often describes what the agent was in the middle of doing. Use it as `still_open` for non-success outcomes:

```javascript
// Current:
const nextSteps = finishParams?.next_steps ?? finishParams?.blockers?.map(...) ?? null;

// Proposed:
let nextSteps = finishParams?.next_steps ?? finishParams?.blockers?.map(...).join("; ") ?? null;

// For failed sessions without finishParams, use last assistant text as context
if (!nextSteps && status !== 'success' && !finishParams) {
  nextSteps = event.outcome ? `[auto-captured] ${event.outcome}`.slice(0, 500) : null;
}
```

**Expected impact**: ~2,889 error sessions + ~1,076 interrupted sessions would get still_open populated. That's **~55% of all end digests**.

### Fix 2: Make checkpoint() always populate next_steps (medium impact)

The `checkpoint()` tool schema has optional `next_steps` in the data field. Agents use it 10.5% of the time. The checkpoint tool could be enhanced to auto-extract next_steps from the summary when not explicitly provided. But this is lower priority since checkpoints are rare.

### Fix 3: Improve LLM synthesis parsing (low impact, diminishing returns)

The LLM synthesis path only fires for ~435 digests. Even perfect parsing would add modest numbers. Lower priority.

### Recommended Order

1. **Fix 1 first** — one code change, covers the majority of cases
2. Monitor population rate for 1 week
3. If rate reaches >40%, skip other fixes
4. If not, add Fix 2

### Expected Outcome

Fix 1 alone should move population from **0.9% → ~25-30%** of all digests (higher for the critical failure/interruption cases that actually need recovery). For non-success end digests specifically, it should go from **0% → ~95%**.

## Data Evidence

```
Total digests:          8,160
still_open NOT NULL:    72 (0.9%)

By trigger:
  session_start:  0/3,620  (0%)    — expected, no work done yet
  end:            0/3,613  (0%)    — CRITICAL BUG
  checkpoint:    51/486   (10.5%)  — only working path
  infra_retry:    0/335   (0%)     — LLM says "none"
  auto_resume:    0/80    (0%)     — LLM says "none"
  stuck_detected: 17/20   (85%)   — works because LLM sees actual stuck work
  circuit_break:  2/4     (50%)
  zombie_cleanup: 2/2    (100%)

Recovery actions taken:
  nothing:   77 (97.5%)
  escalate:   2 (2.5%)
  requeue:    2 (2.5%)
  
Sessions by status:
  done:        16,261
  error:        2,889  ← these need still_open, get null
  interrupted:  1,076  ← these need still_open, get null
  partial:          0  ← nobody uses this status
  blocked:          0  ← nobody uses this status
```
