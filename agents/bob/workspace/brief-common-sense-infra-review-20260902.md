# Common Sense Infra Review — 2026-09-02

## Summary

Evaluator pipeline (IT-87) is **RESOLVED** as of Jul 3 — 7,233 evals in 7d. Previous briefs were stale on this. The highest-priority unbuilt infra mechanism is now **structural guards for C1.1/C1.3** (read-before-edit, verify-after-write). Coach has multiple P0 items explicitly blocked on engineering building these.

## Ownership Update: IT-87 Evaluator Pipeline

**Status changed: P0 UNBUILT → RESOLVED (Jul 3)**. Coach confirms evaluator producing evals again. No common-sense.md text change needed (the doc doesn't reference IT-87 directly), but prior briefs' #1 recommendation is now moot.

## Highest Priority Unbuilt: Structural Guards (P0)

Coach has proven via multiple experiments (EXP-251, EXP-265, KE-338) that **text-based coaching cannot fix compliance** for:

| Convention | Compliance | Violations/7d | Coach Status |
|-----------|-----------|---------------|--------------|
| read-before-edit (C1.1) | 19% (was 34%) | 285 (amy alone) | BLOCKED on infra |
| verify-after-write (C1.3) | 7-9% | 502 system-wide | Escalated to tech-lead Apr 28 |

**Why this is the #1 priority:**
- common-sense.md's "Evidence first" and "Context first" principles are violated at massive scale
- Coach has exhausted text interventions — proven dead end (KE-338)
- Compliance is *degrading* without structural enforcement
- Coach's C2.3 (Framework-Level Enforcement) is explicitly BLOCKED on engineering

## Design: Lightweight Guard for read-before-edit

**Mechanism:** Track file reads in session state. When `edit(path)` is called, check if `read(path)` occurred earlier in the session.

**Behavior:**
- If no prior read: inject warning in edit response: "⚠️ No read() of this file found in session. Blind edits risk data loss."
- Do NOT block — soft nudge only (matches coach's preference for graduated intervention)
- Log violations to metrics for coach to measure

**For verify-after-write (C1.3):**
- After successful `write()`/`edit()`: append suggestion to output: "💡 Consider read()-back to verify"
- Track compliance: did a read() of same path follow within next 3 tool calls?

**Scope:** ~50 lines of guard logic in the tool dispatch layer.

## Coach's Infra Requests (All Blocked on Engineering)

1. **C2.3 Framework-Level Enforcement** — the umbrella item
2. **Verify-after-write guard** — escalated Apr 28, no response
3. **Read-before-edit guard** — 19% compliance, degrading
4. **PATH_HALLUCINATION bash wrapper** — tech-lead is #1 offender, text coaching dead

## Recommendation

1. **P0:** Ship read-before-edit soft guard — highest violation volume, simplest design
2. **P0:** Ship verify-after-write nudge — 502 failures/7d, coach blocked
3. **P1:** PATH check in bash wrapper — needs more design work
4. **Done:** Remove IT-87 from future brief priority lists
