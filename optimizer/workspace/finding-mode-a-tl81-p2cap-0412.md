# Finding: TL 81-op Session & D-o-R Phase 2 Cap Early Data (Apr 12, 2026)

## 1. Tech-Lead 81-op Session Analysis

**Session**: `s_1775951649843_1706` — Apr 11 23:54 UTC, 729 seconds, 81 ops  
**Task**: P1 Investigation — evaluation-sync cron handler silently stopped processing sessions (440 backlog)  
**Source**: `agents.fork` from TL heartbeat at 23:53  

### What Happened
The TL heartbeat detected a P1 issue (440 unevaluated sessions accumulated because the evaluation-sync handler silently stopped running). It forked a work session to investigate.

### Root Cause Found
Handlers added to `cron.json` after the may-agent process started (Apr 9) were never registered because `loadAgentHandlers()` only runs once at startup. On `reload()`, `resolveMode()` returned null and entries were silently skipped. This affected evaluation-sync, session-sync, and tracker-compact.

### Fix Shipped
Commit `76972ef` — added `setHandlerResolver()` callback to the Cron class. When `reload()` finds a new entry with a `handler` field but no registered handler function, it dynamically imports and registers it. Includes test.

### Verdict: **Legitimate and productive**
- Found real root cause of a system-wide evaluation outage
- Shipped a tested fix with 3 files changed, 153 insertions
- 81 ops is high but justified: reading handler code, tracing the startup path, writing the fix, adding tests, verifying
- No pattern to fix — this is what P1 investigations should look like

---

## 2. D-o-R Phase 2 Cap Early Data

**Cap deployed**: Apr 11 23:24 UTC (commit `b66e94a5`)  
**Cap**: 25-op limit on Phase 2 prompts, 20-op on Phase 2b

### Post-Cap Phase 2 Sessions (n=2)
| Time | Ops | Task |
|------|-----|------|
| 23:55 | 5 | EXP-144 design deliverables |
| 23:58 | 12 | EXP-144 KB integration deliverables |

**Post-cap avg: 8.5 ops** (max 12)

### Pre-Cap Phase 2 Sessions (12h window, n=8)
| Time | Ops |
|------|-----|
| 11:25 | 57 |
| 11:35 | 60 |
| 12:26 | 31 |
| 12:58 | 21 |
| 14:57 | 7 |
| 16:26 | 18 |
| 17:25 | 15 |
| 21:56 | 16 |

**Pre-cap avg: 28.1 ops** (max 60)

### Reduction: **70% drop** (28.1 → 8.5 avg)
n=2 is too small for statistical confidence, but the direction is very strong and consistent with the P1 cap pattern.

### Phase 1 Cap Compliance Check
Post-cap Phase 1 sessions: 37, 1, 4, 8 ops

**⚠️ One P1 cap violation**: 37-op Phase 1 at 23:24 (workflow `wr_1775949846041_5d4`). This session analyzed EXP-143 results. It blew through the 15-op Phase 1 budget at 2.5x. However, it then skipped Phase 2 entirely (went straight to Phase 3 verify at 1 op), so total workflow was 38 ops — not terrible overall. Still, the P1 cap isn't being enforced mechanically.

---

## 3. Other Noteworthy Patterns (Last 6 Hours)

### Research Thread Bypass (Bob, 209 combined ops)
Three parallel "Research Thread" sessions spawned by workflow `wr_1775946417530_jnv` at 22:26 UTC:
- 79 ops: EXP-131 + EXP-134 integration
- 79 ops: EXP-135 + EXP-140 integration  
- 51 ops: EXP-132 + EXP-138 integration

These bypass D-o-R's phase structure entirely — no Phase 1/2/3 caps apply. Combined 209 ops for KB integration work is expensive. This is a known issue (previously investigated in Mode C scouting).

### Bob 55-op Heartbeat (20:53 UTC)
Single Bob heartbeat at 55 ops. Heartbeat bloat is a known pattern but this is elevated even by Bob standards.

### Coach 64-op Session (23:54 UTC)
EXP-123 production impact analysis. Coach sessions don't have D-o-R budget caps. 64 ops for a comprehensive analysis with 21 sections is reasonable.

### System Health (6h Summary)
- **Total**: 1,941 ops across 150 sessions (12.9 avg)
- **Zero failures**: No error/failed sessions in the period
- **Top consumers**: Bob (502 ops, 28 sessions), Optimizer (394, 33), Tech-Lead (311, 23)
- **Lean agents**: Evaluator (59 ops, 12 sessions = 4.9 avg), Scout (95, 11 = 8.6 avg)

---

## Recommendations

1. **P2 cap: Continue monitoring** — n=2 early data is very promising (70% reduction). Need n=10+ to confirm.
2. **P1 cap enforcement**: The 37-op P1 violation suggests text-based budget caps leak under certain task types. Consider whether Phase 1 needs a mechanical enforcer or if the occasional blowout is acceptable when Phase 2 is skipped.
3. **Research Thread caps**: Bob's parallel research threads (79, 79, 51 ops) operate outside D-o-R. If we want to cap Bob's total per-heartbeat ops, these need their own budget constraints. This is the next biggest savings opportunity.
4. **No action on TL 81-op**: This was a legitimate, productive P1 investigation. High ops were justified by the fix shipped.
