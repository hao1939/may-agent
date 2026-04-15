# Improvement Proposals Review — Cycle 16
**Date**: 2026-03-27T03:03
**Since last review**: Cycle 15 was 2026-03-26T04:38 (22.4 hours ago)
**System uptime**: Continuous since 2026-03-24 (~75+ hours, no restart)

## System Snapshot
| Metric | Cycle 15 | Cycle 16 | Delta |
|--------|----------|----------|-------|
| HEAD commit | f10cfde | 8eb7eda | +5 commits |
| Binary (symlink) | f10cfde | f10cfde | unchanged |
| Running PID binary | b9ef77e | b9ef77e | unchanged (37 behind HEAD!) |
| Skills (SKILL.md) | 40 | 54 | +14 |
| Skills deployed | 18 | 18 | unchanged |
| Handlers | 22 | 22 | unchanged |
| Guards (src/lib/guards/) | 4 active in binary | 5 files, 0 active in PID | new guard architecture not in running binary |
| Total sessions (history) | ~15,500 | ~15,552 | +52 (low overnight rate) |
| Active agents | All except Bob | All except Bob | Bob down 10+ hours |

## New Commits Since Cycle 15 (5 commits)
1. **8eb7eda** — Harness guards batch 2: BinaryGuard, WorkVerifyGuard, ToolSyntaxGuard (+474 lines, 6 files)
2. **8c5e5d5** — Prompt simplification: remove DOMAIN.md, archetype SOUL.md loading, Safety First section (Hao directive)
3. **3e87e1e** — Revert LESSONS.md loading from resolveSystemPrompt (Hao directive)
4. **e0a0d4b** — P78 skill scanner deployment + Guard Architecture Phase 1 (+484 lines, 7 files)
5. **510622c** — Read safety guards: directory block, size cap, binary detection (+112 lines, 2 files)

**Theme**: Guard architecture + prompt simplification. Hao directed removal of DOMAIN.md/LESSONS.md loading and archetype SOUL.md. System shifting from "more context = better" to "leaner prompts = cheaper + less confusion."

## Critical Issues

### 🔴 P0: Bob Down 10+ Hours (gemini-3-pro-preview deprecated)
- **Impact**: Bob is the architect — no design work, no briefs, no common-sense updates for 10+ hours
- **Root cause**: Github Copilot backend deprecated `gemini-3-pro-preview` model
- **Escalation**: Two P0 requests sent to May (req:fe5595d9, req:26b8505b) — no resolution observed
- **Wasted ops**: ~4 ops per failed Bob session, ~24-40 ops/day wasted
- **Fix needed**: Update bob's model mapping in litellm config or bob's agent.json to use a different model
- **Status**: UNRESOLVED — may need human intervention

### 🟡 P1: Process Restart Still Pending (37 commits behind)
- **Impact**: 12+ improvements blocked on restart including:
  - Guard architecture (5 guard files, not active)
  - Prompt simplification (DOMAIN.md/LESSONS.md removal)
  - Read safety guards
  - Skill scanner (P78)
  - isToolError false-positive fix
  - LESSONS.md loading restore → revert
  - Agent archetype inheritance → removed
  - Zombie cleanup
  - All 22 handlers running on stale logic
- **Duration**: PID 52 has been running for 75+ hours
- **Status**: P0 restart requested (req:e535d4d8) — unresolved

### 🟡 P1: Improvement Pipeline Stalled
- No new skills deployed since Cycle 15 (54 SKILL.md files, 18 deployed — unchanged)
- Skill lifecycle at saturation — 3 consecutive discovery runs found "no new pattern"
- Guard architecture is the new paradigm but none active in running process
- Code improvements shipping to HEAD but accumulating behind the restart wall

## Improvement Categories & Counts

### Code Improvements (HEAD, not yet active)
| Category | Count | Status |
|----------|-------|--------|
| Harness guards (runtime) | 5 files | In HEAD, blocked on restart |
| Read safety guards | 1 file | In HEAD, blocked on restart |
| Skill scanner (P78) | 1 file | In HEAD, blocked on restart |
| Prompt simplification | 3 files | In HEAD, blocked on restart |
| LESSONS.md revert | 1 file | In HEAD, blocked on restart |
| **Total blocked** | **11 files** | **37 commits behind** |

### Skills (SKILL.md files)
- 54 total, 18 deployed, 36 undrafted/untested/not-deployed
- Last deployment: build-activation-verification (Mar 25)
- Saturation confirmed: 3 consecutive lifecycle runs → no new pattern
- **Recommendation**: Pause skill lifecycle. Focus on guard architecture as the higher-leverage approach.

### Handlers (JS, running in PID)
- 22 total, unchanged since Cycle 14
- All functional but running on stale binary (b9ef77e, built ~75h ago)
- Tool quality report still generating (last: 01:07 UTC)
- System status handler lacking consecutive-error detection (Bob outage not auto-detected)

## Assessment

### What's Working
1. **Tool waste rate declining**: 4.7% → 4.3% → 4.1% (trending down)
2. **Guard architecture landing**: 5 new guard files with tests, structured approach
3. **Prompt simplification**: Hao-directed cleanup reducing token bloat
4. **Skill lifecycle early-exit**: Saves ~90 ops per wasted run
5. **Cost awareness**: Optimizer staying within 35-op budget (most sessions)

### What's NOT Working
1. **Restart wall**: 37 commits accumulated, nothing activates until PID restart
2. **Bob outage**: 10+ hours, no automated recovery, no model fallback
3. **No automated model fallback**: When a model is deprecated, the system has no circuit breaker that switches to an alternative model
4. **Improvement velocity**: Shipping to HEAD but not to runtime — zero user-facing improvement in 75+ hours
5. **System-status handler gap**: Didn't detect Bob's model deprecation as an anomaly

### Priorities for Next Cycle
1. **🔴 P0**: Get Bob back online (human intervention likely needed for model config)
2. **🔴 P0**: Process restart to activate 37 accumulated commits
3. **🟡 P1**: Add model-fallback circuit breaker to prevent future agent outages
4. **🟡 P1**: Extend system-status handler with consecutive-error detection
5. **🟢 P2**: Gym baseline on new binary (after restart)
6. **🟢 P2**: Evaluate guard architecture effectiveness (after restart)

## Comparison: Cycle 15 → Cycle 16
- **Commits behind PID**: 26 → 37 (+11) — gap widening
- **Bob status**: working → down 10+ hours — regression
- **Tool waste**: 4.7% → 4.1% — improvement
- **Skills**: 40 → 54 SKILL.md (+14), deployed unchanged at 18
- **Guards**: 4 in binary → 5 in HEAD (+1 guard architecture), 0 active in PID

**Bottom line**: The system is shipping code improvements faster than they can activate. The restart wall is the #1 bottleneck. Bob's outage is the #1 operational issue. Both require human intervention.
