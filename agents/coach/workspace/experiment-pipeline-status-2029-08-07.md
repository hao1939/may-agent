# Experiment Pipeline Status — 2029-08-07

## Changes This Session
- **EXP-740**: Wall-clock duration gate CONFIRMED DEPLOYED in heartbeat-data.ts (lines 477-502). 90s threshold, re-prompt on fast sessions. Commit 925bc7bbb.
- **EXP-735**: Impact gate fix NOT YET implemented (no changes in heartbeat-data.ts)
- **EXP-725**: Anti-shallow structural gate NOT YET implemented
- **Gate logs**: Both duration-gate-triggers.log and impact-gate-triggers.log still EMPTY (0 triggers)
- **EXP-745 Phase 3**: Cannot run — gym runner requires GYM_AGENT_BIN (no agent binary available in this environment)

## Active Experiments

### 🟢 READY FOR TRIALS (blocked on infrastructure)
| ID | Name | Status | Next Step |
|----|------|--------|-----------|
| EXP-745 | Few-Shot Coverage Expansion | Phase 3 DESIGNED | Run gym validation — needs GYM_AGENT_BIN |

### 🟡 AWAITING DATA
| ID | Name | Status | Blocker |
|----|------|--------|---------|
| EXP-740 | Wall-Clock Duration Gate | **DEPLOYED ✅** (confirmed this session) | Zero triggers so far — monitor duration-gate-triggers.log |
| EXP-720 | Few-Shot in master-worker.ts | Phase 2 DEPLOYED | Zero log entries — no worker sessions since deployment |
| EXP-540 | Path Normalization | DEPLOYED | Awaiting sufficient sessions for re-measurement |

### 🔴 BLOCKED ON TECH-LEAD (2 remaining items)
| ID | Name | Status | Blocker |
|----|------|--------|---------|
| EXP-735 | Impact Gate Trigger Fix | DESIGNED | Tech-lead needs to fix keyword detection (grep appears in all sessions) |
| EXP-725 | Structural Anti-Shallow Gate | DESIGNED | Tech-lead needs to implement finish() rejection when tool_call_count < 10 |

## Assessment

### EXP-740 Implementation Review
The wall-clock duration gate implementation is clean:
- Timer starts before `ctx.runAgent()` (line 435)
- Check after artifact gate (correct ordering — artifact gate first, then duration)
- 90s threshold matches EXP-705 finding (<60s=shallow, >90s=substantive)
- Logs to `duration-gate-triggers.log` with timestamp, agent, elapsed_sec
- Re-prompt message is substantive (asks 3 diagnostic questions)
- **Concern**: Artifact gate re-prompt returns early (line 471), so if artifact gate fires AND session is <90s, duration gate is SKIPPED. This is acceptable — artifact gate addresses the more critical issue.

### Why 0 triggers?
Possible explanations:
1. No heartbeat sessions have run since deployment (most likely)
2. All sessions take >90s (unlikely given historical 59% <90s rate)
3. Sessions that would be fast hit artifact gate first and return early

**Action**: Wait for data accumulation. If still 0 after 20+ sessions, investigate.

## Key Metrics
- **Total experiments closed**: 50+ (EXP-250 through EXP-850)
- **Proven interventions deployed**: 10 (EXP-500/510/520/530/540/560/565/630/650/720)
- **Core findings**: Text coaching dead for verification (KE-480). Threat framing works for priority gaps (KE-560). Concrete thresholds work (KE-715). Task distraction nullifies all text (KE-655).
- **Current bottleneck**: 2 gate fixes still blocked on tech-lead (EXP-735, EXP-725)

## Recommendations
1. **Monitor EXP-740 trigger rate** — check duration-gate-triggers.log after 20+ sessions
2. **Re-escalate EXP-735 and EXP-725** to tech-lead — these are the last 2 gate fixes
3. **EXP-745 Phase 3** — needs gym agent binary to run trials; consider alternative validation approach
