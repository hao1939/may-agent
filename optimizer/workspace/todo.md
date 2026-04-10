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
- **20h post-fix data (16 D-o-R runs)**: 3 FAST (skipped P2), 1 NARROW (9 ops), 12 NORMAL (avg 18 ops). 25% of runs benefit from early exit.
- Fast path saves ~15 ops per run (full P2 avg = 18 ops). Narrow saves ~9 ops. Estimated savings: ~54 ops/day.
- Phase 3b content verification deployed at 16:43 UTC (commit d6c7696).
- Continue monitoring — 16 runs is decent sample but more data welcome.

### Coach Session Efficiency — FINDING COMPLETE
- 2,175 coach sessions analyzed. 50.3% zero-op, 64% of ops in top sessions are exploration waste.
- Top 15 sessions avg 24% productivity. Two sessions 3% productive (68 calls, 2 productive).
- Key waste: file discovery spirals (32.7%), gym run proliferation (11.2%), growth-trigger 52% error rate.
- 5 concrete fixes identified: state index, gym batch runner, growth-trigger guards, fast nothing-to-do path, read-then-act discipline.
- Estimated savings: ~750 ops/day, ~$35/day.
- Finding: `workspace/finding-coach-session-efficiency-0410.md`

### Optimizer Heartbeat Bloat — FIX DEPLOYED
- Avg 56 ops/heartbeat (highest of any agent). Bob avg 4 ops. My min was 19 — proves lean is possible.
- Root cause: heartbeat.md encouraged inline exploration (multi-query DB analysis, file reads).
- Fix: Rewrote heartbeat.md to "Dispatcher Mode" — observe in 1-2 ops, fork all analysis work. Target: ≤15 ops.
- Baseline: 8 heartbeats in 12h, avg 56 ops, total 451. Measuring post-fix.
- Last exploration mode: **D** (Workflow Health — Apr 10 ~17:19 UTC). Next: **A** (Session Archaeology).

### may.db WAL Bug — FIXED, Monitoring
- Session-sync + evaluation-sync handlers deployed. 1071 evals, 0 unevaluated (as of 17:10 UTC).

## 📊 OBSERVATIONS (no action needed)

- **Bob HB dispatch**: 87% properly dispatched. 13% inline-heavy — not fixable via text rules (KE-002).
- **System waste**: 0-1.9% across all agents. Quality universally "good".
- **Context tax**: 82% of all input tokens are re-sent conversation context. Bob worst at 13.8K tok/op. Prompt caching fix would save ~$128/day.
- **Coach work sessions**: Highest per-session cost ($74/day total, 38 sessions at avg 46 ops). 5 sessions >60 ops = 35.6% of coach cost.
- **Coach exploration waste**: 64% of tool calls in high-op sessions are file discovery/read. Two heartbeats were 3% productive (68 calls → 2 writes). 50.3% of all coach sessions are zero-op.
- **Coach growth-trigger**: 52% error rate (115/222 sessions fail). Needs precondition guards.
- **Daily cost**: ~$302/day total. Bob $107, Coach $74, May $36, Scout $32.
- **Bob quality scores**: Artificially low (2.47) due to Phase 1/2 double-penalization. Actual ~3.87. Low priority.
- **Heartbeat bloat**: 61% of system ops in heartbeats. Only bob/coach dispatch effectively. Needs structural fix.
- **Tool quality**: Waste rate 3.6% (stable). All regressions are bob INDEX.md noise.
- **LLM evaluations**: All heuristic-only. By design if JS evaluator sufficient.
- **Dead workflows**: may/coach ~367 lines never-used code. Low-priority cleanup.
- **Workflow adoption**: 7% of sessions use workflows (35/503 today, up from 2.5%). All bob D-o-R and parallel-research. Other agents don't use workflows.
- **Optimizer heartbeat cost**: Was 56 ops avg. Fix deployed (Dispatcher Mode heartbeat). Measuring.
- **Bob P1 read-loop**: 87 ops in Phase 1 of D-o-R for a KB integration task. "Don't write, just plan" instruction enables endless reading.

## ⚠️ SENT/ESCALATED

- **Amy-kimi API billing** — 429 errors. Sent to May (req:b2b4d1bc). 2026-04-07.

## 📋 PENDING (awaiting Hao)

- **Memory Redesign Brief** — `workspace/brief-memory-redesign.md`. 2026-03-17.

## ✅ DONE

- **Gym Results Data Gap** — Both paths now record: `gym-helpers.ts` has `recordGymResult()` (commit 961d892f0), `run-gym.sh` pipes to `record-result.ts` (commit 2c8c7dcd). 22 runs + 156 checks verified in DB. (2026-04-10)

48+ items Mar 17 – Apr 10. Detailed logs: `workspace/todo-archive-20260410.md`
