# Finding: Why Tools Die — Structural Adoption Pattern Analysis

**Date**: 2026-04-12
**Session**: s_1775957053887_1753 (Mode C)
**Method**: may.db session/workflow analysis (19,348 sessions), heartbeat.md code review, workflow registry analysis, digest mining, cross-reference with KE-002 and KE-011

## Executive Summary

**Tools that are structurally embedded in dispatch paths get adopted. Tools that rely on agents "remembering" to use them don't — regardless of how prominently they're mentioned in context.md.** This is a specific instance of KE-011 (knowledge files are passive) applied to tool adoption.

The data shows a clean binary:

| Tool | Integration Method | Adoption (7d) | Status |
|------|-------------------|----------------|--------|
| D-o-R workflow | Wired as DEFAULT dispatch in bob's heartbeat.md | 74 runs / 570 sessions = 13.0% | ✅ Alive |
| verify-wrap | Wired as DEFAULT dispatch in 5 agents' heartbeat.md | 13 sessions across 4 agents | ✅ Growing |
| implement-and-verify | Wired as code-task dispatch in tech-lead heartbeat | 4 sessions (tech-lead) | ✅ Active |
| parallel-research | Wired as multi-task option in heartbeat.md dispatch tables | 2 runs (bob, optimizer) | ✅ Niche but used |
| growth-cycle | Wired in coach heartbeat dispatch table | 1 run (coach, 7d) | ⚠️ Barely alive |
| training-sprint | Wired in coach heartbeat dispatch table | 4 sessions (coach) | ✅ Active |
| gym-batch.sh | Listed in coach context.md as a tool | **0 executions** | ❌ Dead |
| session-query.ts | Not in any agent's context.md | **0 executions** (beyond optimizer) | ❌ Dead |

**The dividing line is not "does the agent know about it" — it's "is the tool in the agent's dispatch path."**

## Analysis: What Makes Tools Stick

### Pattern 1: Default Dispatch = Adoption (D-o-R, verify-wrap)

Bob's heartbeat.md line 51:
> **For WORK SESSION tasks, use `workflow.run('deliver-or-report', task)` to get structural verification guardrails.**

This is not a suggestion. It's the **default dispatch mechanism**. Every time Bob's heartbeat identifies work to do, the template for dispatching that work IS the D-o-R workflow. Bob doesn't need to "remember" D-o-R exists — it's the only way to dispatch work that's presented to him.

**Result**: 74 D-o-R runs in 7 days. 13% of all Bob sessions flow through the workflow. Every heartbeat that dispatches work uses it.

The same pattern works for verify-wrap across optimizer, coach, scout, tech-lead, evaluator, and QA — all have it wired as the default or recommended dispatch in their heartbeat.md tables:
- Optimizer: "All other forked work → verify-wrap" (line 52, **bolded as default**)
- Coach: "Investigation → written findings → verify-wrap" (line 67)
- Scout: "For ALL work sessions, use verify-wrap" (line 61, **bolded imperative**)

### Pattern 2: Context.md Mention = Death (gym-batch.sh)

Coach's context.md line 5:
> Gym batch runner: scripts/gym-batch.sh — run multiple scenarios at once with --variants, --trials N, --tier/--category filtering, and comparison summary. Use instead of manual gym-run.sh loops.

This line has been in context.md since Apr 10. In the 38+ Coach sessions since then, **zero** have used gym-batch.sh. Coach sessions that run gym trials still use `scripts/gym-run.sh` individually — 31 calls in a single session (EXP-130).

**Why?** Because gym-batch.sh is not in Coach's dispatch path. Coach's workflow `growth-cycle.ts` doesn't call gym-batch.sh. The heartbeat template examples use `workflow.run("growth-cycle", ...)` — which internally uses gym-run.sh (line 45 references `/app/scripts/`). The context.md mention is a **passive fact** — it's loaded, read, and ignored.

This exactly confirms KE-011: knowledge files are passive, even when they're in context.md (the "most reliable" delivery channel). The agent reads the fact but doesn't change behavior because its execution path doesn't include the tool.

### Pattern 3: No Integration Point = Invisible (session-query.ts)

session-query.ts is:
- **Not in any agent's context.md** (only optimizer mentions it in workspace findings)
- **Not wired into any workflow** (no workflow calls it)
- **Not in any heartbeat template** (no example shows using it)
- **Functionally broken** (reads stale filesystem data, not may.db)

It has the worst possible adoption profile: no awareness channel AND no integration point AND broken functionality. Zero usage was inevitable.

## The Adoption Hierarchy

Based on the data, tools follow this adoption hierarchy (in order of effectiveness):

```
1. STRUCTURAL ENFORCEMENT (workflow code forces usage)
   → implement-and-verify calls coder with specific prompts
   → deliver-or-report enforces plan → execute → verify phases
   → 100% adoption within the workflow's scope

2. DEFAULT DISPATCH PATH (heartbeat.md presents it as THE way to work)
   → D-o-R is Bob's default dispatch method
   → verify-wrap is optimizer/scout's default dispatch method
   → 13-22% of all sessions use it (high for voluntary adoption)

3. DISPATCH TABLE OPTION (heartbeat.md lists it as one of several options)
   → growth-cycle, training-sprint, parallel-research
   → 1-4 sessions/week (low but non-zero)

4. CONTEXT.MD MENTION (passive fact in loaded context)
   → gym-batch.sh: 0 usage despite mention
   → Confirms KE-011: passive knowledge doesn't drive behavior

5. EXISTS ON FILESYSTEM (no awareness channel at all)
   → session-query.ts: 0 usage
   → Confirms KE-011 at its strongest
```

**The gap between Level 3 and Level 4 is a cliff.** Being in the dispatch table (Level 3) produces non-zero adoption. Being in context.md (Level 4) produces zero adoption. The dispatch table works because it's shown at the decision point — when the agent is deciding HOW to dispatch work, the table is right there with the code template. Context.md facts are loaded at session start and forgotten by decision time.

## Quantified Impact

### Dead Tools (current cost of non-adoption)

| Tool | Would Replace | Savings Per Use | Frequency | Daily Savings |
|------|--------------|-----------------|-----------|---------------|
| gym-batch.sh | 10-26 individual gym-run.sh calls | 10-20 ops | ~3-5 gym sessions/day | 30-100 ops ($1.50-5/day) |
| session-query.ts | 15-25 bash grep/DB archaeology ops | 10-15 ops | ~5-10 analysis sessions/day | 50-150 ops ($2.50-7.50/day) |
| **Total** | | | | **80-250 ops ($4-12.50/day)** |

### Alive Tools (measured value)

| Tool | Adoption Rate | Measured Impact |
|------|--------------|-----------------|
| D-o-R | 74 runs/7d (Bob) | P1 cap saves ~343 ops/day ($16/day). Error rate ~50% lower than non-WF |
| verify-wrap | 13 sessions/7d | Catches FM-3.3 verification gaps. Growing adoption |
| TL dispatcher mode | 100% (structural) | 89% heartbeat op reduction (30.8→3.5 avg ops) |

## Recommendations: 3 Structural Changes

### 1. Wire gym-batch.sh INTO growth-cycle.ts (HIGH VALUE)
**Don't tell Coach to use gym-batch.sh. Make growth-cycle.ts USE it.**

The growth-cycle workflow runs gym trials as its core function. Currently it gives the agent a prompt that says "run scenarios" — and the agent uses gym-run.sh because that's what it knows. If growth-cycle.ts's prompt said "Run trials using `scripts/gym-batch.sh --scenario X --variants baseline,treatment --trials 3`", the tool would be used every time.

This moves gym-batch from Level 4 (context mention) to Level 1 (structural enforcement). Expected adoption: ~100% within workflow scope.

**Implementation**: Edit `agents/coach/workflows/growth-cycle.ts` line ~45 to include gym-batch.sh usage instructions in the Phase 1 prompt. Also edit training-sprint.ts similarly.

### 2. Add gym-batch.sh to Coach heartbeat dispatch template (MEDIUM VALUE)
The coach heartbeat has example code templates. Change the growth-cycle example (lines 93-101) to show gym-batch.sh:

```javascript
workflow.run("growth-cycle", "Test skill X on scenario Y. Use scripts/gym-batch.sh for running trials.")
```

This moves gym-batch from Level 4 (context mention) to Level 3 (dispatch table option) — crossing the adoption cliff.

### 3. Fix session-query.ts (may.db backend) before trying adoption (PREREQUISITE)
session-query.ts reads stale filesystem data (only through ~Apr 5). No amount of awareness-building will help if the tool doesn't work. Fix the backend first, then wire it into workflows/heartbeats.

Once working: add to optimizer and tech-lead heartbeat dispatch templates as the default data analysis tool. Wire it into any DB analysis workflow prompts.

**Skip**: Adding session-query to context.md files. We now know Level 4 (context mention) produces zero adoption. Don't waste effort on it.

## Theoretical Framework: Why This Works

This finding synthesizes KE-002 (text rules don't fix judgment) and KE-011 (knowledge files are passive) into a unified adoption model:

1. **KE-002 explains why**: Text instructions don't change LLM behavior on judgment tasks. "Use gym-batch.sh instead of gym-run.sh" is a judgment call — the agent must decide, in the moment, to use a different tool than the one it has muscle memory for. Text rules don't win that judgment call.

2. **KE-011 explains where**: Knowledge not in the direct execution path is invisible. gym-batch.sh is mentioned once in context.md, then the agent enters a workflow that doesn't reference it. By the time it's running gym trials, the context.md fact is 50+ messages ago in the conversation.

3. **Structural enforcement bypasses both**: If the workflow prompt says "use gym-batch.sh", it's not a judgment call (the instruction is at the point of execution, not 50 messages ago) and it's not passive knowledge (it's in the active task prompt). This is why Level 1 and Level 2 work while Level 4 and Level 5 don't.

## Links

- **Extends** → `finding-gym-batch-adoption-0411.md` (confirms 0 adoption, explains why)
- **Extends** → `finding-tool-gap-0411-b.md` (session-query.ts + tool gap analysis)
- **Supports** → KE-002 (text rules don't change behavior)
- **Supports** → KE-011 (knowledge files are passive)
- **Informs** → All future tool introductions (must integrate structurally, not just mention)


[SIG: 1775957170:a7f21d8e]
