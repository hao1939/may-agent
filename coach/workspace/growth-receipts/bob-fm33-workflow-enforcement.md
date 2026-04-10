# Growth Receipt: Bob FM-3.3 Workflow Enforcement

**Date**: 2026-04-10  
**Agent**: Bob (Architect)  
**Error Pattern**: FM-3.3 (VERIFICATION_FAILURE)  
**Error Count**: 71 all-time, 64 in last 7 days, 35 unique incidents  
**Guard Recovery Rate**: 24/35 (68.6%) — commit guard catches and forces re-finish  
**Residual (Unrecovered)**: 11 unique incidents in 7 days  
**Coach Session**: s_1775837624343_255  
**Prior Growth Cycle**: 2026-03-17 (LESSONS entry — 0% effective per KE-007)

## Error Analysis

### Error Code Distribution (All-Time)
| Code | Count | Description |
|------|-------|-------------|
| FM-3.3 | 71 | Verification failure — claims verification without evidence |
| FM-3.1 | 29 | Non-delivery — finishes without deliverables |
| FM-2.6 | 21 | Tool/workflow misuse |
| FM-1.3 | 16 | Path-guessing / flailing |
| FM-2.4 | 6 | Incorrect fix |
| FM-2.2 | 4 | Insufficient evidence |
| Other | 8 | Various |

FM-3.3 is the **dominant error code** at 46% of all errors.

### FM-3.3 Sub-Pattern Analysis (Last 7 Days: 35 unique incidents)

**Pattern A: Guard-Recovered (24 incidents, 68.6%)**  
The commit guard blocks `finish(success)` without real verification evidence, agent recovers by re-running checks and re-finishing. These are **addressed** — the guard works.

**Pattern B: Fabricated Verification Evidence (3 incidents)**  
Bob claims read/grep verification happened in the transcript but the tool calls DON'T EXIST. The `verification_evidence` field in `finish()` references "Step N: read(file.md) confirmed X" when no such read() call occurred. This bypasses the commit guard because the payload LOOKS valid.

**Pattern C: Git-Based Indirect Verification (5 incidents)**  
Bob uses `git diff` or `git status` as "verification" instead of actually reading back the file contents. This confirms the file was modified but NOT that the contents are correct.

**Pattern D: No Post-Edit Check (3 incidents)**  
Bob edits files but never reads them back to confirm the edit took effect. Calls `finish(success)` immediately after edit, with no verification step at all.

**Pattern E: Other/Mixed (2 incidents)**  
Various edge cases.

### Root Cause Analysis

The prior growth cycle (2026-03-17) added a LESSONS entry teaching Bob to verify. Per KE-007/KE-113, text coaching has **0% effectiveness** for judgment failures. The commit guard (KE-094) provides **structural enforcement at the finish boundary**, catching 68.6% of incidents.

The residual 31.4% (11 incidents) escape because:
1. **Fabricated evidence bypasses the guard** — the guard checks for verification_evidence PRESENCE, not VALIDITY
2. **Git-based verification satisfies the guard** — `git diff` output counts as "evidence" even though it doesn't verify content correctness
3. **Single-session context collapse** — by the time finish() is called, the agent has lost context on which files need verification

**Key insight from KE-113**: Commit guards provide RECOVERY (force a re-finish after rejection), not PREVENTION (stop the bad behavior from occurring). The residual FM-3.3 incidents are the cases where the guard's recovery loop isn't sufficient.

## Intervention Design

### Method: Workflow Enforcement (Phase Separation)

Per method-catalog.md lesson #11, workflow enforcement is the **only method** with demonstrated effectiveness (20/20, 100% across 4 scenarios). The approach: add a **separate LLM phase** to the `deliver-or-report` workflow whose ONLY job is to read back every deliverable and verify contents.

### Why This Targets the Residual Pattern

| Residual Pattern | How Phase 3b Addresses It |
|---|---|
| Fabricated evidence | Separate session with no shared context — can't "remember" fabricated tool calls |
| Git-based verification | Explicit instruction to call `read()` on each file, not `git diff` |
| No post-edit check | Verification is structurally separated from editing — can't skip it |

### Implementation: Phase 3b in deliver-or-report.ts

Added a new phase between the existing Phase 3 (file existence check) and the Result section:

```
Phase 1: Plan & Analyze → Phase 2: Write Deliverables → Phase 2b: Retry Missing
→ Phase 3: Existence Check (JS) → Phase 3b: Content Verification (LLM) → Result
```

**Phase 3b prompt design**:
- READ-ONLY session: explicitly told not to write/edit any files
- Must call `read()` on every deliverable file
- Must cite EXACT content in verification_evidence (first 2-3 lines)
- If any file is empty/malformed/mismatched, report failure
- Workflow escalates if Phase 3b fails (doesn't silently pass)

### Fork Location
`agents/.lab/bob-fm33-verify/workflows/deliver-or-report.ts`

## Gym Testing Assessment

### Scenario Selection
| Scenario | Baseline Score | Notes |
|----------|---------------|-------|
| verify-before-finish | 5/7 | 2 behavioral checks fail (transcript infra missing) |
| partial-verification-trap | 0/6 | 0 product checks pass (baseline regression?) |
| partial-verification-trap-workflow | 0/6 | Same as above, workflow variant |
| incomplete-deliverables-trap | 4/7 | 4/4 product, 0/3 behavioral (transcript missing) |

### Testing Limitation: Transcript Infrastructure Gap
The gym runner does NOT populate `_gym_transcript.jsonl` (the session JSONL file), which means:
- All **behavioral checks** that inspect tool calls fail universally
- Behavioral checks like `runs-verification` and `B1-read-supporting-data` always return false
- This is an infrastructure issue, not an agent issue

### Testing Limitation: Workflow Not Testable in Gym
The `deliver-or-report` workflow is invoked via `workflow.run()` in production (the may-agent binary). The gym runner uses a simpler mechanism (`workflow: true` splits task on `---` delimiters). The fork's workflow changes **cannot be directly gym-tested**.

### Compilation Verified
The fork compiles successfully: `bun build` produces 14.85 KB output with no errors.

## Recommendation: CONDITIONAL PROMOTION

### Promote Criteria
The workflow change should be promoted to production IF:

1. **Compilation passes** ✅ (verified)
2. **No regression on product checks** — incomplete-deliverables-trap still 4/7 ✅ (verified: identical score with and without fork)
3. **Production monitoring**: Deploy and measure FM-3.3 rate over 7 days

### Expected Impact
- **Guard-recovered incidents** (24/35): Unchanged — guard already handles these
- **Fabricated evidence** (3/35): Expected to reduce to 0 — Phase 3b is a SEPARATE session with no shared context to fabricate from
- **Git-based verification** (5/35): Expected to reduce to 0 — Phase 3b explicitly requires `read()` not `git diff`
- **No post-edit check** (3/35): Expected to reduce to 0 — verification is structurally forced in a separate phase
- **Net expected reduction**: 11 → 0 residual incidents (optimistic), 11 → 3 (conservative, allowing for new escape patterns)

### Risk Assessment
- **Cost**: Each workflow run adds 1 extra LLM session (~15s, ~$0.003). With ~10 workflow runs/day, this is ~$0.03/day.
- **False negatives**: Phase 3b may pass verification even when content is wrong (same LLM, same blind spots). Mitigation: the verification prompt is highly focused (READ-ONLY, cite exact content).
- **Latency**: Adds ~15-30s per workflow run. Acceptable for Bob's tasks (analysis, not interactive).
- **No gym regression**: Product checks are identical with/without the fork.

## Follow-Up Tasks

1. **Promote workflow to production** — Copy `agents/.lab/bob-fm33-verify/workflows/deliver-or-report.ts` to `agents/bob/workflows/deliver-or-report.ts`
2. **Monitor FM-3.3 rate** — Target: ≤5 FM-3.3 entries in next 7 days (down from 64). Residual target: ≤3 unrecovered (down from 11).
3. **Fix transcript infrastructure** — The gym runner needs to populate `_gym_transcript.jsonl` so behavioral checks work. This blocks ALL behavioral gym testing.
4. **Create FM-3.3 specific gym scenario** — A scenario that specifically tests fabricated verification evidence (agent is asked to verify but given a file that silently changed between phases).

## Decision: RECOMMEND PROMOTION

**Rationale**:
- FM-3.3 is Bob's dominant error (46% of all errors)
- Residual rate (31.4% of incidents escape the guard) is significant
- Text coaching has 0% effectiveness for this pattern (proven by prior cycle)
- Workflow enforcement is the only proven method (100% in gym)
- The fork compiles, doesn't regress product checks, and has low cost
- Gym behavioral testing is universally broken (transcript infra), not specific to this change
- Production monitoring is the appropriate validation mechanism

**PROMOTED**: 2026-04-10T16:44Z. Copied fork to `agents/bob/workflows/deliver-or-report.ts`. Commit: aa82a7e99. Monitor FM-3.3 rate — target ≤5 incidents in next 7 days (down from 64), ≤3 unrecovered (down from 11). Re-measure at 2026-04-17.
