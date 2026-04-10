# TODO

## 🟢 FOCUS AREAS (from Hao — these define your mission)

1. **Proven Patterns → Workflows / Tools / Skills** — Turn reliable patterns into permanent workflows, tools, or skills.
2. **Performance & Efficiency Investigation** — Find what's slow or wasteful: costly sessions, redundant reads, unnecessary round-trips.
3. **Tool Efficiency — Right Tools, Fewer Tools** — Remove unused tools, fix misuse patterns, reduce tool count per agent.
4. **Waste Elimination** — Kill idle heartbeats, redundant reads, failed tool calls, work that belongs in JS handlers.

**When other agents send you tasks that don't fit these areas → push back or ignore.**

## 🔴 ACTIVE

### 🚨 LiteLLM Strips Prompt Caching — $143/day Waste
BLOCKED on operator — cannot set env vars. `ANTHROPIC_API_KEY` not set → all traffic routes through LiteLLM which strips `cache_control`. 75.5M input tokens/day, 0 cache reads. Finding at `workspace/findings/2026-04-10-litellm-kills-prompt-caching.md`.

### Deliver-or-Report Early Exit — Measuring
Fix deployed (commit 914cf230, 2026-04-10 12:59 UTC). Narrow/skip path IS WORKING. **4h post-fix (16:12 UTC)**: 3 workflow runs, 2 completed. WR ipby: narrow path triggered (P2 only 8 ops + 2 retry). WR b06l: full path (may predate fix). Need ~8+ more completed runs. Next measurement: ~Apr 11 01:00 UTC.

### may.db WAL Persistence Bug — MONITORING
Both fixes deployed: `session-sync.ts` (commit e586c1b48) and `evaluation-sync.ts` (standalone heuristic evaluator). Sessions: 812→1071, Evaluations: 733→1062, 0 unevaluated. Finding: `workspace/findings/2026-04-10-evaluation-sync-broken.md`.

### Optimizer Self-Cost — NEW
Optimizer avg 56 ops/heartbeat (8 sessions = 451 ops in 6h). #2 most expensive agent after bob. Primary driver: large todo.md + extensive monitoring queries each heartbeat. **Action taken**: archived resolved items from todo.md (127→~50 lines). Continue monitoring.

## ⚠️ OBSERVATIONS (no action needed, reference only)

- **Bob heartbeat dispatch**: 87% properly dispatched, 13% inline-heavy. Text rules won't fix per KE-002. Accept as residual or structural fix needed.
- **Bob quality score artifact**: 44/97 evals sub-1.0 from Phase 1/2 double-counting. Without artifacts: Q:3.87. Low priority — early exit fix is primary intervention.
- **LLM-to-JS candidates**: Remaining targets require LLM judgment — no easy mechanical conversions left.
- **LLM evaluations**: All evals heuristic-only or JS-evaluated. No LLM evaluator running. By design if JS sufficient.
- **Dead workflow candidates**: may/design-then-build, may/research-pipeline, coach/convention-review, coach/verify-setup (367 lines). Next cleanup round.
- **Tool quality regressions #6-#16** (2026-04-09 to 04-10): All investigated, all "not actionable" — driven by bob's high-volume research activity. Classifier gap fixes deployed (commits 79141deb, 0c2ab70, 48e73ff7). Waste rates 0-2.2%. See git log for details.
- **QA journal token waste**: FIXED — tech-lead deployed `tail -5` for journal reads. QA ops down to 4-11.

## ⚠️ SENT/ESCALATED

- **Amy-kimi API billing** — 429 errors. Sent to May (req:b2b4d1bc). 2026-04-07.

## 📋 PENDING (awaiting Hao review)

- **Memory Redesign Brief** — At `workspace/brief-memory-redesign.md`. Needs Hao decisions. 2026-03-17.

## ✅ DONE (archived 2026-04-10)

**48+ items completed Mar 17 – Apr 10.** Key deployments: dispatcher mode (81-94% HB ops reduction), skill pruning (90KB eliminated), workflow audit (9 dead archived), evaluator heuristic fix (45.5%→74.5%), QA scoring fix, evaluation-sync handler (329 evals recovered), session-sync fix, deliver-or-report early exit (3 bugs fixed, working), QA journal fix ($9.50/day), classifier gap fixes (67% reduction in unclassified), post-restart baseline (~$91/day).
