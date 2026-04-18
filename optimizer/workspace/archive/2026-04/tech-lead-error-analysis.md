# Tech-Lead Error Rate Analysis — Deep Investigation

**Date**: 2026-04-05  
**Author**: Optimizer (investigating tech-lead 100% heartbeat error rate)  
**Status**: ROOT CAUSE IDENTIFIED + RECOMMENDATIONS

---

## Executive Summary

Tech-lead has a **100% heartbeat failure rate** (11/11 sessions since April 3) due to a **platform-level 40-turn limit** that the heartbeat task cannot complete within. This is NOT a tech-lead-specific bug — it's a system-wide issue that hits all agents, but tech-lead is uniquely affected because:

1. Its heartbeat.md requires 5+ exploratory sections (hypotheses, experiments, system improvement, code changes, journaling)
2. It naturally uses 40+ turns per heartbeat execution
3. Other agents' heartbeats are either simpler (evaluator: 9 avg ops) or stochastically faster (may: 18 avg ops)

---

## Data Summary

### Tech-Lead Heartbeat Timeline (7 days)
```
Mar 29-30: ❌❌❌❌ (SCHEMA_BUG — different issue, now fixed)
Mar 30-31: ✅✅✅✅✅✅✅ (working, ops=2-46)
Apr 1-3:   ✅✅✅✅✅✅✅✅✅ (working, but ops=0 — doing nothing productive)
Apr 3:     ✅ last success (ops=0, dur=138s)
Apr 3-5:   ❌❌❌❌❌❌❌❌❌❌❌ (11-session TURN_LIMIT streak — 100% failure)
```

### Cross-Agent Comparison (since Apr 3, heartbeats only)
| Agent     | Model  | Total | Done | Turn-Limit Errors | Error Rate |
|-----------|--------|-------|------|-------------------|------------|
| tech-lead | opus   | 11    | 0    | 11                | **100%**   |
| optimizer | opus   | 30    | 10   | 16                | **53%**    |
| coach     | ?      | 28    | 14   | 10                | **36%**    |
| bob       | opus   | 30    | 15   | 9                 | **30%**    |
| scout     | ?      | 14    | 6    | 6                 | **43%**    |
| qa        | gpt52  | 37    | 31   | 5                 | **14%**    |
| may       | opus   | 47    | 40   | 4                 | **9%**     |
| amy-kimi  | kimi   | 39    | 35   | 0                 | **0%**     |
| evaluator | gpt52  | 11    | 11   | 0                 | **0%**     |

### Direct (Non-Heartbeat) Tasks: 0% Error Rate
Tech-lead's direct tasks (dispatched by may or humans) have **0% turn-limit errors** in 48h (9/9 succeeded), completing at up to 119 ops. This is because:
- Child sessions (spawned via `agents.call`) are NOT subject to platform turn limits (0 child-session turn-limit errors in 7 days across ALL agents)
- ROOT direct tasks also succeed — they may use a different execution path

### Key Stat: ALL 61 turn-limit errors in 7 days are from heartbeat/cron ROOT sessions. Zero from child sessions. Zero from non-heartbeat tasks.

---

## Root Cause Analysis

### The Turn Limit

A **platform-level turn limit** (currently 40, previously 30) started being enforced around April 3. This is NOT our `maxTurns` field — our code deprecated that to 0 (unlimited). The limit comes from the runtime/platform that hosts our agents.

**Evidence:**
- Error messages: `"Turn limit reached: 41/40 turns. Session terminated."`
- Our code has no logic that generates this error (searched all of `src/`, SDK, node_modules)
- `cron.ts` line 774 comments "maxTurns removed — watchdog handles runaway sessions"
- The `handlerConfig.maxTurns: 50` in `agents/may/cron.json` for tech-lead's heartbeat is **configured but never passed** to `manager.run()`

### Why Tech-Lead is 100% Affected

1. **Heartbeat scope**: The heartbeat.md has 5 sections requiring exploration:
   - Check pending tasks
   - Check hypotheses (read directory)
   - System improvement (query DB, check recent sessions)
   - Implementation (delegate to coder, run checks)
   - Record and evolve (write journal, update docs)
   
2. **Turn consumption**: Each "read" or "bash" call is 1 turn. To explore hypotheses alone requires reading the directory listing (~1 turn) + reading files (~2-5 turns) + thinking (~1 turn) = 4-7 turns. With 5 sections, that's 20-35 turns just to READ, leaving 5-20 turns for actual work.

3. **Opus model behavior**: Opus tends to be thorough — reading more files, doing deeper analysis. This burns turns faster than lighter models.

4. **No early-exit mechanism**: The heartbeat says "exit at 35 turns" but the agent has no way to count its own turns. By the time it's working, the platform kills it at 40.

### Why Other Agents Sometimes Succeed

The turn limit enforcement appears **stochastic** or session-dependent:
- Optimizer: 289 ops succeeded one session, 42 ops failed the next
- This might be related to: context size, concurrent sessions, or platform-side rate limiting
- Agents with simpler heartbeats (evaluator: 9 avg ops, amy-kimi: 17 avg ops) stay under 40 turns consistently

---

## Recommendations

### Immediate Fix (P0): Reduce Tech-Lead Heartbeat Scope

The heartbeat must complete within ~30 turns (leaving buffer for the 40 platform limit).

**Current heartbeat (5 sections):**
1. Pending tasks
2. Check hypotheses (directory exploration)
3. System improvement (DB queries)
4. Implementation (code changes)
5. Record and evolve

**Proposed heartbeat (2-3 focused sections):**
1. **Pending tasks** — process injected tasks (required)
2. **One item from backlog** — pick ONE thing: hypothesis, improvement, or build
3. **Finish** — call finish() immediately

Remove the journaling, multi-directory exploration, and "check everything" approach. The heartbeat should do ONE THING per session.

### Medium-Term Fix (P1): Pass handlerConfig.maxTurns to manager.run()

The cron system has `handlerConfig.maxTurns` configured but never passes it. Fix in `src/app/cron.ts`:

```typescript
// Line 775-776: Currently
const sessionId = this.manager.run(agentName, taskMessage, {
  kind: "job",
});

// Should be:
const sessionId = this.manager.run(agentName, taskMessage, {
  kind: "job",
  maxTurns: entry.handlerConfig?.maxTurns ?? undefined,
});
```

This doesn't fix the platform limit, but it would let our code enforce a LOWER limit gracefully (e.g., `finish(partial)` at 35 turns instead of hard-kill at 40).

### Long-Term Fix (P2): Turn-Aware Agents

Add a `remaining_turns` field to the agent's context so it can self-manage:
- Inject remaining turn count into each assistant response
- Agent can choose to `finish(partial)` before the hard limit
- This requires SDK/platform changes (expose turn counter)

### Alternative: Split Heartbeat into Multiple Cron Jobs

Instead of one mega-heartbeat, create separate cron entries:
- `heartbeat-tech-lead-tasks`: Process pending tasks only (5-10 turns)
- `heartbeat-tech-lead-build`: One implementation cycle (15-30 turns)
- `heartbeat-tech-lead-review`: Check hypotheses/experiments (10-20 turns)

Each runs at different cadences and can individually complete within the 40-turn limit.

---

## Impact Assessment

- **Lost productivity**: 11 failed heartbeats × ~300s avg = ~55 minutes of wasted compute
- **Missing work**: Tech-lead has done ZERO heartbeat work since April 3 (all output lost at turn-limit kill)
- **System-wide**: 61 turn-limit failures across all agents = significant waste
- **Workaround active**: May dispatches direct tasks to tech-lead which succeed (0% error rate for non-heartbeat tasks)

---

## Files Analyzed
- `agents/may/cron.json` — tech-lead heartbeat cron entry (handlerConfig.maxTurns: 50, unused)
- `agents/tech-lead/heartbeat.md` — overly broad heartbeat scope
- `src/app/cron.ts:774-776` — maxTurns not passed to manager.run()
- `src/lib/manager.ts:886` — maxTurns defaults to 0
- `src/lib/manager-utils.ts:169` — deprecated comment about turn limits
- `.state/may.db` — session data (16,432 sessions analyzed)
