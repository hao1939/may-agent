# Audit: classify-error.ts Architecture Review

**Date**: 2026-04-13  
**Scope**: src/lib/classify-error.ts + all callers  
**Prior finding**: audit-digest-architecture.md identified 3 classification entry points — pre-computed in upsertDigest, on-the-fly in may.ts escalation, classifyError fallback. Recommended unification.

---

## Entry Points Found: 4 (not 3)

The prior audit undercounted. There are **4 distinct classification entry points**, serving **3 different purposes**:

| # | Entry Point | Location | Purpose | Input | Output |
|---|------------|----------|---------|-------|--------|
| 1 | `classifyError()` as **Tier 2 fallback** | may.ts:387 | Recovery decision | `info.error` (string) | `"requeue"` or `"nothing"` |
| 2 | `classifyDigest()` on-the-fly | may.ts:485 | Escalation decision | digest row (structured) | `{ action, reason }` |
| 3 | `classifyDigest()` pre-computed | session-digest.ts:772 (inside upsertDigest) | Baked into digest row | LLM-synthesized digest fields | `{ action, reason }` → stored in DB |
| 4 | `classifyError()` for **request tracking** | manager-agents-tool.ts:278 | Stamp `errorClass` on request DB record | `result.error` (string) | `ErrorClass` → stored in request row |

### Entry Point Details

**EP1 — may.ts recovery subscriber (line 365-440)**  
Two-tier: reads `digest.action` (pre-computed by EP3), falls back to `classifyError()` if no digest. The fallback only distinguishes infra→requeue vs everything→nothing. Simpler than EP3 which also produces "resume", "escalate", "kill".

**EP2 — may.ts escalation subscriber (line 470-518)**  
Re-runs `classifyDigest()` at decision time, reading from the latest digest row. Does NOT use the pre-computed `action` from the digest — instead re-classifies using `what_happened`, `outcome`, and `still_open` fields. This is the entry point the prior audit flagged for unification.

**EP3 — upsertDigest pre-computed (session-digest.ts:772)**  
When upsertDigest runs with a CLASSIFY_TRIGGER (stuck_detected, circuit_break, auto_resume, timeout, overflow, zombie_cleanup), it calls `classifyDigest()` and stores the result in the digest row's `action` and `action_reason` fields. This is consumed by EP1's Tier 1 path.

**EP4 — manager-agents-tool.ts request tracking (line 278)**  
When a `call` action completes with an error, stamps `errorClass: classifyError(result.error)` on the request record. This is purely for **analytics/querying** — not used for recovery decisions. Distinct purpose from EP1-3.

---

## Architecture Assessment

### The actual split is 2 systems, not 3

```
System A: Recovery/Escalation decisions (EP1, EP2, EP3)
  classifyDigest() — structured, trigger-aware, action-oriented
  classifyError()  — string-matching fallback when no digest exists

System B: Request analytics (EP4)
  classifyError()  — stamps errorClass for DB queries/dashboards
```

System B is **completely independent** — it serves a different consumer (request tracking DB) and doesn't feed into any recovery logic. No unification needed with System A.

### Within System A: Is EP2 redundant with EP3?

**EP3** pre-computes `action` during upsertDigest for CLASSIFY_TRIGGERs: `stuck_detected`, `circuit_break`, `auto_resume`, `timeout`, `overflow`, `zombie_cleanup`.

**EP2** re-classifies on-the-fly for `session_end_blocked` and `session_end_failure` triggers.

**Key insight**: These trigger sets don't overlap. EP3 fires for mid-session events (stuck, circuit_break). EP2 fires for end-of-session events (blocked, failure). The `session_end` digest (written by createEndDigest in the DigestWriter subscriber) does NOT run classifyDigest — it's a recording-only digest. So EP2 must classify at read time because no pre-computed action exists for these triggers.

**Could we pre-compute for session_end too?** Yes — createEndDigest could call classifyDigest before inserting. But:
- createEndDigest runs in the DigestWriter subscriber (#4)
- The escalation subscriber (#8 in may.ts) runs AFTER DigestWriter
- If we bake classification into createEndDigest, EP2 could just read `digest.action`
- **Savings**: ~8 lines in may.ts escalation subscriber, removes one `classifyDigest()` import

### EP1's fallback: Is it still needed?

`classifyError()` in may.ts:387 fires only when `digest.action` is null — i.e., no digest exists or the digest has no pre-computed action. In production, every session should have an end digest (written by DigestWriter subscriber). But:
- If DigestWriter fails (DB error, crash before subscriber runs), no digest exists
- If the digest exists but has no `action` field (normal end digests don't have one currently)

The fallback is **correctly placed** as a safety net. The prior audit's suggestion to remove it would reduce resilience.

---

## Severity Ratings

| Finding | Severity | Recommendation |
|---------|----------|----------------|
| EP2 re-classifies instead of reading pre-computed action | **LOW** | Could pre-compute in createEndDigest, but savings are ~8 lines and the current approach works correctly |
| EP4 (request tracking) counted as a "3rd entry point" | **INFO** | Not actually part of the recovery system — separate purpose, no action needed |
| EP1 fallback to classifyError | **NONE** | Correctly serves as safety net; should NOT be removed |
| classifyError.ts is 67 lines, pure function, zero deps | **NONE** | Clean, well-extracted, no action needed |

---

## Verdict: Unification NOT warranted

The prior audit's recommendation to "unify to single pre-computed path" overstated the problem:

1. **EP4 is a different system** — request analytics, not recovery. No unification needed.
2. **EP2 and EP3 serve different trigger sets** — they don't overlap or duplicate work.
3. **EP1's fallback is a correct safety net** — removing it reduces resilience.
4. **The optional improvement** (pre-compute in createEndDigest so EP2 reads instead of re-classifying) saves ~8 lines and adds marginal complexity to createEndDigest. Not worth the change unless we're already modifying that function.

**classify-error.ts itself is clean**: 67 lines, pure function, zero IO, zero dependencies. No changes needed.

**Action**: Close this investigation. The architecture is sound. The "3 entry points" framing made it look worse than it is — in reality it's 2 systems (recovery vs analytics) with correctly-placed fallback chains.
