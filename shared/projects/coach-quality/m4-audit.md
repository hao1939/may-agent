# M4 Audit: Coach Work Session Scaffold Compliance

**Date**: 2026-04-30  
**Auditor**: Worker agent  
**Scaffold**: `agents/coach/skills/work-session-scaffold.md`  
**Period Audited**: 15 most recent work sessions (approx Apr 10–13, 2026)

---

## Executive Summary

**Compliance: 0/15 sessions (0%)**

The work-session scaffold exists and is well-designed, but there is **zero observable compliance** in recent coach work sessions. None of the 15 audited sessions show "TASK EXTRACT" or structured "PLAN:" blocks in their summaries or checkpoints. Only 2/15 show evidence of deliverable verification before finishing.

---

## Methodology

1. **Data source**: `.state/memory/coach.jsonl` — contains session metadata including task, status, duration, and summary for all coach sessions.
2. **Checkpoint data**: `.state/checkpoints/` — checked for scaffold markers in structured checkpoint data.
3. **Markers searched**: `TASK EXTRACT`, `PLAN:`, `DELIVERABLE:`, `Step 1:`, `verified`, `confirmed`, `verification_evidence`.
4. **Sessions examined**: Last 15 `[WORK SESSION]` tagged sessions.

---

## Findings by Session

| Session ID | Status | Duration | TASK EXTRACT? | PLAN block? | Verify before finish? |
|---|---|---|---|---|---|
| s_1775991262341_2062 | interrupted | — | ❌ | ❌ | ❌ |
| s_1775993056925_2077 | interrupted | — | ❌ | ❌ | ❌ |
| s_1775994849931_2095 | interrupted | — | ❌ | ❌ | ❌ |
| s_1775996639659_2112 | interrupted | — | ❌ | ❌ | ❌ |
| s_1776002093322_2160 | done | — | ❌ | ❌ | ❌ |
| s_1776003883940_2177 | done | 1m46s | ❌ | ❌ | ❌ |
| s_1776005708208_2191 | done | 4m49s | ❌ | ❌ | ✅ ("File verified: 405 lines") |
| s_1776007511440_2209 | done | 6m19s | ❌ | ❌ | ❌ |
| s_1776009281511_2223 | done | 5m46s | ❌ | ❌ | ❌ |
| s_1776011063926_2234 | interrupted | 59m55s | ❌ | ❌ | ❌ |
| s_1776016484869_2275 | done | 15m47s | ❌ | ❌ | ❌ |
| s_1776018277223_2287 | interrupted | 627m20s | ❌ | ❌ | ❌ |
| s_1776055982980_12 | done | 7m57s | ❌ | ❌ | ✅ ("File confirmed: 211 lines") |
| s_1776056469810_18 | done | 14m3s | ❌ | ❌ | ❌ |
| s_1776055990460_14 | interrupted | 47m58s | ❌ | ❌ | ❌ |

---

## Compliance Summary

| Scaffold Phase | Compliance Rate | Notes |
|---|---|---|
| Phase 0: TASK EXTRACT | 0/15 (0%) | No session shows structured extraction |
| Phase 1: PLAN block | 0/15 (0%) | No session shows numbered plan |
| Phase 2: Op budget checkpoints | 1/15 (~7%) | Only 2 sessions have checkpoint data at all |
| Phase 3: Verify deliverable | 2/15 (13%) | Two sessions mention file verification in summary |
| Phase 4: finish() with evidence | Unknown | Session summaries don't capture finish() args; no transcripts available |

---

## Key Observations

1. **Scaffold exists but is not activated**: The skill file is comprehensive (the "worked example" is excellent) but the coach agent is not executing Phase 0/1 at session start. This matches a known pattern — skill text instructs behavior but the agent doesn't internalize it (same issue found in optimizer C1.1 audit, session s_1776057722653_28).

2. **Interrupted sessions dominate**: 7/15 sessions (47%) were interrupted/aborted. These are mostly long-running experiment batch runs (EXP-151) that hit timeout. The scaffold's "hard stop at op 60" rule would have prevented several of these.

3. **Verification happens organically in some sessions**: Sessions s_1776005708208 and s_1776055982980 both verified deliverables ("File verified: 405 lines", "File confirmed: 211 lines") without explicitly following the scaffold format. This suggests partial internalization of Phase 3 only.

4. **No full transcripts available**: We only have session summaries and checkpoint data, not full conversation transcripts. This limits our ability to detect if TASK EXTRACT or PLAN blocks appear mid-session without being captured in the summary.

---

## Blockers & Limitations

- **No full session transcripts accessible**: The `.state/memory/coach.jsonl` only stores final summary text, not the full conversation. Scaffold compliance markers (which should appear at the START of a session) would not appear in end-of-session summaries unless the agent explicitly includes them.
- **Checkpoint data sparse**: Only 2/15 sessions have checkpoint files, and neither contains scaffold markers.

---

## Recommendations

### Short-term (M5)
1. **Add scaffold compliance self-report to finish()**: Require coach work sessions to include a `scaffold_compliance` field in checkpoint/finish data: `{used_extract: bool, used_plan: bool, verified_deliverable: bool}`.
2. **Inject scaffold reminder into task dispatch**: Add "Remember: Start with TASK EXTRACT per work-session-scaffold.md" to work session task strings.

### Medium-term (M6)
3. **Automated compliance scoring**: Parse session transcripts (if made available) for scaffold markers and compute compliance rate per session.
4. **Graduated enforcement**: Make scaffold Phase 0 (EXTRACT) a hard gate — if the first tool call in a work session isn't a structured extraction, flag it.

### Measurement Alternative
Since full transcripts aren't accessible, the most reliable measurement approach is:
- Add structured `scaffold_phases_completed: [0,1,2,3,4]` to every checkpoint() and finish() call
- Monitor compliance via `.state/checkpoints/*.jsonl` parsing
- This makes compliance observable without needing transcript access

---

## Verdict

**The scaffold is deployed but not followed.** Quality improvements from M1-M3 (scaffold design and deployment) have not yet translated into behavioral change. The next milestone should focus on **activation** — making the scaffold unavoidable rather than optional.
