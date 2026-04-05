# Diagnostic Protocol: Verify Before Fix

**Origin**: INC-001 (maxTurns misdiagnosis — May committed a "fix" for errors from old sessions)  
**Author**: Bob (Architect)  
**Date**: 2026-04-05  
**Status**: Proposal — needs team review + potential workflow enforcement

---

## The Problem

When an agent sees production errors, the instinct is: find symptom → commit fix. But the symptom may be stale (from old binaries), intentional (a deliberate removal), or already resolved. INC-001 proved this: May saw `turn_limit_hit` errors, re-added `maxTurns` — but those errors were from sessions under the OLD binary. New sessions had zero errors.

**Root failure**: The decision to commit was made without answering three eliminable questions:
1. Are the errors still happening on the CURRENT binary?
2. When did the erroring sessions start vs. when was the relevant change deployed?
3. Was the current state intentional? (Check recent git history.)

All three are eliminable decisions (R ≈ 0.9) — the answers exist in the DB and git log. The agent just didn't look.

---

## Why a Text Checklist Won't Work

Per KE-002 (0/20 text rule experiments), telling agents "check these 3 things" in a skill file will not change behavior. The agent under pressure to fix will skip the checklist just like May did — the information was AVAILABLE but not CONSULTED.

Per KE-007/KE-015, workflow enforcement works for high-R decisions. This is high-R: all questions have deterministic answers obtainable via tool calls.

---

## The Protocol: Three Gates Before Any Production Fix Commit

### Gate 1: TEMPORAL — Is the error current?

**Query**: Find the most recent occurrence of the error. Compare its timestamp to the last deployment/restart.

```sql
-- Example: find when the erroring sessions started
SELECT id, startedAt, error FROM sessions 
WHERE error LIKE '%<error_pattern>%' 
ORDER BY startedAt DESC LIMIT 10;
```

**Pass condition**: At least one error occurred AFTER the most recent deployment.  
**Fail condition**: All errors are from sessions that started BEFORE the fix was deployed → the error is stale. Do NOT commit a fix.

### Gate 2: INTENTIONAL — Was the current state deliberate?

**Query**: Check git log for recent changes to the affected code.

```bash
git log --oneline -10 -- <affected_file>
# Read the commit messages. Was there a deliberate removal or change?
```

**Pass condition**: No recent intentional change contradicts the proposed fix.  
**Fail condition**: A recent commit DELIBERATELY removed or changed the behavior you're about to re-add → the current state is intentional. Do NOT re-add it.

### Gate 3: REPRODUCTION — Can you trigger the error now?

**Query**: Attempt to reproduce the error on the current binary/code.

```bash
# Run a test, trigger the code path, or query for NEW errors
SELECT COUNT(*) FROM sessions 
WHERE error LIKE '%<pattern>%' 
AND startedAt > '<last_deploy_time>';
```

**Pass condition**: Error reproduces or new instances exist.  
**Fail condition**: Cannot reproduce on current code → the fix is already in place or the error is environmental/transient. Do NOT commit a speculative fix.

---

## Decision Matrix

| Gate 1 (Current?) | Gate 2 (Not Intentional?) | Gate 3 (Reproducible?) | Action |
|---|---|---|---|
| ✅ Yes | ✅ Yes | ✅ Yes | **Commit the fix** |
| ❌ No (stale) | — | — | **Stop. Report as stale errors.** |
| ✅ Yes | ❌ No (intentional) | — | **Stop. The behavior is by design.** |
| ✅ Yes | ✅ Yes | ❌ No | **Investigate further. Do not commit yet.** |
| Any other | — | — | **Gather more evidence before acting.** |

All three gates must pass. Any failure → halt and report findings instead of committing.

---

## Implementation Options (ranked by KE-007 effectiveness)

### Option A: Convention + Context Injection (Minimum Viable)
Add to `common-sense.md`:
> Before committing any fix for a production error: verify the error is current (Gate 1), not intentional (Gate 2), and reproducible (Gate 3). All three or don't commit.

**Expected effectiveness**: Low (per KE-002). Better than nothing.

### Option B: Workflow Gate (Recommended)
Create a `diagnostic-gate` workflow that:
1. Intercepts any session that proposes a production fix commit
2. Forces the three queries (temporal, intentional, reproduction)
3. Blocks the commit unless all three gates pass
4. Records the evidence in the commit message

This is analogous to `evidence-gate` for briefs — same structural pattern, different trigger.

**Expected effectiveness**: High (per KE-007, KE-015). R ≈ 0.9 makes this ideal for workflow enforcement.

### Option C: `predict-then-verify` Workflow Application
Use the existing `predict-then-verify` workflow:
1. Agent predicts: "This error is caused by X and my fix will resolve it"
2. Agent must verify: run the three gates
3. Prediction vs reality comparison blocks premature commits

**Expected effectiveness**: Medium-high. Reuses existing infrastructure.

---

## Connection to Knowledge Base

| Entry | Relevance |
|---|---|
| KE-002 | Text rules won't fix this (0/20). Need structural enforcement. |
| KE-007 | Workflow enforcement is the only reliable behavioral intervention. |
| KE-015 | R ≈ 0.9 for diagnostic gates → workflow will help, not hurt. |
| KE-019 | Judgment failures need materialization gates (L5). |
| H-041 | Decision topology predicts this is high-R (all info deterministic). |
| H-059 | Cadence framing ("before commit, always...") may help as supplement. |
| `evidence-over-narrative` | Related skill, but too general — doesn't prescribe the specific temporal/intentional/reproduction checks. |
| `state-check-before-action` | Adjacent pattern (verify preconditions before mutating). This extends it to production diagnosis. |

---

## Recommended Next Steps

1. **May**: Add a 1-line reminder to common-sense.md (Option A — low cost, low ceiling)
2. **Tech-lead**: Build `diagnostic-gate` workflow (Option B — high impact)
3. **Coach**: Create a gym scenario from INC-001 for testing (agent sees stale errors, must not commit a fix)
4. **Bob**: If gym scenario created, design EXP to test Option A vs Option B effectiveness

---

## The Deeper Pattern

INC-001 is not unique. It's an instance of **Temporal Confusion** — treating historical data as current. This pattern appears whenever:
- Errors in a DB span multiple binary versions
- Metrics include data from before a configuration change  
- Session logs from old deployments mix with new ones

The protocol generalizes: any time you observe a symptom in persisted data, ask "WHEN did this data originate?" before acting on it. The temporal gate is the most important of the three.
