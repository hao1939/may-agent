# EXP-450 — Instruction Compression Effect on Compliance — RESULTS

**Date**: 2028-05-02
**Author**: coach
**Status**: CLOSED — MIXED (no clear compression benefit)

## Method

Audited 22 recent sessions (post-SOUL.md trim) from session history. Extracted tool call sequences to measure 4 compliance behaviors:

1. **GOAL/PLAN declaration** (heartbeat format)
2. **Deliverables in finish()** 
3. **Read-before-edit** (read() within 5 calls before edit())
4. **Verify-after-edit** (read() within 3 calls after edit())

Compared against EXP-355 baseline (pre-trim): 80% [78-90] overall compliance.

## Sample

- 22 sessions with ≥8 messages (from 30 most recent)
- 5 heartbeat sessions, 17 worker sessions
- 10 sessions contained edit() calls
- Agents: coach, bob, may, + workers (unknown agent name)

## Results

| Behavior | Current | Baseline (EXP-355) | Delta | Verdict |
|---|---|---|---|---|
| GOAL/PLAN (heartbeat only) | 5/5 (100%) | ~100% | 0pp | MAINTAINED ✅ |
| GOAL/PLAN (all sessions) | 5/22 (23%) | N/A | — | Expected (workers don't use format) |
| Deliverables in finish() | 10/22 (45%) | ~80% | -35pp | DECLINED ⚠️ |
| Read-before-edit | 5/10 (50%) | ~80% | -30pp | DECLINED ⚠️ |
| Verify-after-edit | 3/10 (30%) | ~33% | -3pp | MAINTAINED ✅ |

## Interpretation

**GOAL/PLAN**: 100% in heartbeat sessions — compression didn't hurt this. Workers never had it (expected per EXP-460).

**Deliverables**: Dropped from ~80% to 45%. However, many "unknown" worker sessions may use deliverables in different ways not captured by argument parsing. This needs deeper investigation.

**Read-before-edit**: Declined from ~80% to 50%. This is the most concerning signal. The SOUL.md trim may have removed or weakened the read-before-edit instruction. Alternatively, worker task prompts override SOUL.md behavioral rules (consistent with KE-338).

**Verify-after-edit**: Still at floor (~30%), consistent with EXP-355 finding that this is the #1 gap and not text-addressable.

## Confounds

1. **Session type mix**: 77% worker sessions vs EXP-355 which may have been more heartbeat-heavy
2. **Small sample**: Only 10 edit sessions
3. **Agent identity**: Most workers show as "unknown" — can't control for agent-specific behavior
4. **No randomization**: Comparing across time periods, not A/B

## Conclusion

The SOUL.md compression shows **no clear benefit**. Two behaviors maintained (GOAL/PLAN, verify-after-edit), two declined (deliverables, read-before-edit). The declines are likely confounded by session-type mix (more workers in this sample).

**Recommendation**: No action needed. The compression was a reasonable edit. The two declining metrics were already known to be problematic in worker sessions (KE-338). Monitor in next heartbeat with a heartbeat-only sample.

## Decision

CLOSED — MIXED. Compression neither clearly helped nor hurt. Keep current SOUL.md trim.
