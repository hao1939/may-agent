# TODO

## 🟢 FOCUS AREAS (from Hao — these define your mission)

1. **Proven Patterns → Workflows / Tools / Skills** — Turn reliable patterns into permanent workflows, tools, or skills.
2. **Performance & Efficiency Investigation** — Find what's slow or wasteful: costly sessions, redundant reads, unnecessary round-trips.
3. **Tool Efficiency — Right Tools, Fewer Tools** — Remove unused tools, fix misuse patterns, reduce tool count per agent.
4. **Waste Elimination** — Kill idle heartbeats, redundant reads, failed tool calls, work that belongs in JS handlers.

**When other agents send you tasks that don't fit these areas → push back or ignore.**

## 🔴 ACTIVE

### 🚨 LiteLLM Strips Prompt Caching — $143/day Waste
- LiteLLM proxy strips `cache_control` → 0% Anthropic cache hits. $143/day (~$4,300/month) savings with 70% cache rate.
- Bypass exists at `src/app/may.ts:148-165`, needs `ANTHROPIC_API_KEY` env var.
- **BLOCKED on operator.** Finding: `workspace/findings/2026-04-10-litellm-kills-prompt-caching.md`

### Deliver-or-Report Early Exit — Measuring (commit 914cf230)
- Detects files written in Phase 1 → narrows/skips Phase 2. Pre-fix: 60% of P2 redundant (121 ops/day wasted).
- Post-fix: 2 completed runs. Run 1: P1=87, P2=8, P2b=2 (NARROW path). Run 2: parallel-research (not D-o-R).
- Phase 3b content verification deployed at 16:43 UTC (commit d6c7696). Next D-o-R run will include it.
- Need ~4+ more D-o-R runs for statistically meaningful comparison.

### may.db WAL Bug — FIXED, Monitoring
- Session-sync + evaluation-sync handlers deployed. 1071 evals, 0 unevaluated (as of 17:10 UTC).

## 📊 OBSERVATIONS (no action needed)

- **Bob HB dispatch**: 87% properly dispatched. 13% inline-heavy — not fixable via text rules (KE-002).
- **System waste**: 0-1.9% across all agents. Quality universally "good".
- **Context tax**: 82% of all input tokens are re-sent conversation context. Bob worst at 13.8K tok/op. Prompt caching fix would save ~$128/day.
- **Coach work sessions**: Highest per-session cost ($74/day total, 38 sessions at avg 46 ops). 5 sessions >60 ops = 35.6% of coach cost.
- **Daily cost**: ~$302/day total. Bob $107, Coach $74, May $36, Scout $32.
- **Bob quality scores**: Artificially low (2.47) due to Phase 1/2 double-penalization. Actual ~3.87. Low priority.
- **Heartbeat bloat**: 61% of system ops in heartbeats. Only bob/coach dispatch effectively. Needs structural fix.
- **Tool quality**: Waste rate 3.6% (stable). All regressions are bob INDEX.md noise.
- **LLM evaluations**: All heuristic-only. By design if JS evaluator sufficient.
- **Dead workflows**: may/coach ~367 lines never-used code. Low-priority cleanup.
- **Workflow adoption**: Only 2.5% of sessions use workflows (4/160 today). Coach last used workflows Mar 23 (18 days). Bob uses D-o-R and parallel-research.
- **Optimizer heartbeat cost**: 56 ops avg (highest of any agent HBs). Driven by open-ended DB exploration. Bob HBs avg 4 ops, coach 20 ops.
- **Bob P1 read-loop**: 87 ops in Phase 1 of D-o-R for a KB integration task. "Don't write, just plan" instruction enables endless reading.

## ⚠️ SENT/ESCALATED

- **Amy-kimi API billing** — 429 errors. Sent to May (req:b2b4d1bc). 2026-04-07.

## 📋 PENDING (awaiting Hao)

- **Memory Redesign Brief** — `workspace/brief-memory-redesign.md`. 2026-03-17.

## ✅ DONE

48+ items Mar 17 – Apr 10. Detailed logs: `workspace/todo-archive-20260410.md`
