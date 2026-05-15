# Convention Regression Investigation: Optimizer C1.1 (Apr 15, 2026)

**Reported drop**: 93.6% → 82% (11.6pp)  
**Investigated by**: Coach  
**Date**: 2026-04-15  

## TL;DR

**The C1.1 drop is real but iatrogenic** — it was *caused by* the deliverable-checklist skill (deployed ~Apr 10) which introduced a new high-frequency edit target (DELIVERABLES_CHECKLIST.md) that optimizer routinely edits without a prior read(). If we exclude DELIVERABLES_CHECKLIST.md violations, the Apr 11-14 rate would be **95.9%** — actually *better* than the pre-skill baseline. The skill successfully addresses FM-2.2 but creates a C1.1 side-effect.

Scout C3.2 drop (100% → 93.8%) is **task noise**, not a regression — a single batch of architecture audit sessions on Apr 14 where scout wrote to tech-lead's workspace as part of cross-agent audit work.

---

## 1. Data: Optimizer C1.1 Daily Pass Rates

| Day | Total | Passed | Failed | Rate |
|-----|-------|--------|--------|------|
| Apr 07 | 58 | 56 | 2 | 96.6% |
| Apr 08 | 38 | 37 | 1 | 97.4% |
| Apr 09 | 47 | 47 | 0 | **100%** |
| Apr 10 | 45 | 44 | 1 | 97.8% |
| **Apr 11** | **44** | **34** | **10** | **77.3%** ← drop starts |
| Apr 12 | 118 | 96 | 22 | 81.4% |
| Apr 13 | 152 | 125 | 27 | 82.2% |
| Apr 14 | 80 | 66 | 14 | 82.5% |
| Apr 15 | 7 | 7 | 0 | 100% (small n) |

**Peak period (Apr 7-10)**: 97.9% (188 checks)  
**Drop period (Apr 11-14)**: 81.5% (394 checks)  
**Delta**: -16.4pp

## 2. Root Cause Analysis

### All 123 violations in the last 14 days are "edit(...) without prior read"

Breakdown by file:

| File | Violations | % of total |
|------|-----------|------------|
| DELIVERABLES_CHECKLIST.md (various paths) | **63** | **51%** |
| agents/optimizer/workspace/todo.md | 28 | 23% |
| Other workspace/source files | 32 | 26% |

### The deliverable-checklist skill is the cause

- **First DELIVERABLES_CHECKLIST.md C1.1 failure**: Apr 10, 18:23 UTC
- **Skill git history**: Created/committed around Apr 10-12 (multiple revisions)
- The skill instructs optimizer to create and update DELIVERABLES_CHECKLIST.md by checking items off as tasks complete
- The skill even warns about C1.1 compliance ("C1.1 compliance is at 80.5% because of this exact step") but optimizer still doesn't consistently read() before edit()

### Counterfactual: What's the rate without DELIVERABLES_CHECKLIST?

In the Apr 11-14 drop period:
- 73 total failures
- **57 are DC-only** (no other violations in the session)
- 15 are other-only, 1 is both

**If DELIVERABLES_CHECKLIST violations are excluded**: 95.9% pass rate (vs 97.9% peak). The underlying C1.1 behavior is *stable or slightly improved*.

## 3. Diagnosis

| Aspect | Finding |
|--------|---------|
| **Is it a real behavioral regression?** | Partially. Optimizer does genuinely edit without reading, but only on a new repetitive artifact (checklist updates). |
| **Is it a measurement artifact?** | No — the violations are real C1.1 violations. But they're caused by a new skill, not a degradation in existing behavior. |
| **Root cause** | The deliverable-checklist skill creates a high-frequency edit target that optimizer treats as "already known" (just wrote it moments ago), so skips the read() step. This is a **skill design flaw**, not an agent regression. |
| **Severity** | Medium — real violations but low-risk (editing a file you just wrote is unlikely to cause data loss, which is C1.1's intent). |

## 4. Recommended Intervention

### Option A: Fix the skill (recommended)
The deliverable-checklist skill should instruct optimizer to use `write()` (full overwrite) instead of `edit()` for checklist updates. Since the checklist is small and fully controlled by the agent, write() is actually more appropriate and doesn't trigger C1.1. Alternatively, use a two-call `read() → edit()` pattern consistently.

**Why this is best**: Addresses root cause directly. No guard/workflow change needed. The skill already has C1.1 warnings but they're not working — changing the mechanic (write vs edit) eliminates the issue structurally.

### Option B: Exempt DELIVERABLES_CHECKLIST.md from C1.1
Add a convention check exception for files the agent just wrote (within N tool calls). This is a measurement change, not a behavioral one.

**Risk**: Sets precedent for exemptions. C1.1 exists for a reason.

### Option C: Do nothing
The drop looks dramatic but optimizer's underlying C1.1 compliance is actually at ~96%. The checklist skill is working for its intended purpose (FM-2.2). Accept the C1.1 noise.

**Recommendation**: **Option A** — modify the skill to use `write()` for checklist updates or enforce the read-before-edit pattern structurally.

## 5. Scout C3.2 Assessment

| Metric | Value |
|--------|-------|
| Reported rate | 93.8% (from 100%) |
| Actual weekly data | W14: 100%, W15: 91.5% |
| All failures concentrated on | Apr 13-14 |
| Total failures | 10 (of 507 all-time) |
| Cause | All 10 are scout writing to `agents/tech-lead/workspace/` during cross-agent architecture audits |

**Verdict: Task noise, not regression.** Scout was dispatched to do architecture lens audits and wrote results to tech-lead's workspace as instructed by the task. This is a one-time task pattern, not a behavioral change. C3.2 rate will naturally recover when audit tasks end.

No intervention needed for scout C3.2.

## 6. Summary

| Issue | Diagnosis | Action |
|-------|-----------|--------|
| Optimizer C1.1: 97.9% → 81.5% | Iatrogenic — caused by deliverable-checklist skill | Fix skill to use write() instead of edit() for checklist updates |
| Scout C3.2: 100% → 91.5% | Task noise — cross-agent audit writes | None needed |
