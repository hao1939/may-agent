# TODO

## 🟢 FOCUS AREAS (from Hao — these define your mission)

1. **Proven Patterns → Workflows / Tools / Skills** — Turn reliable patterns into permanent workflows, tools, or skills.
2. **Performance & Efficiency Investigation** — Find what's slow or wasteful: costly sessions, redundant reads, unnecessary round-trips.
3. **Tool Efficiency — Right Tools, Fewer Tools** — Remove unused tools, fix misuse patterns, reduce tool count per agent.
4. **Waste Elimination** — Kill idle heartbeats, redundant reads, failed tool calls, work that belongs in JS handlers.

**When other agents send you tasks that don't fit these areas → push back or ignore.**

## 🔴 ACTIVE

- **Skip rate investigation** — Skip rate stable: 50w 12%, 200w 6.5%. Monitoring continues.
- **LLM-to-JS candidates (next)** — Remaining targets by ops/week: common-sense-verify (680 ops/wk), common-sense-infra (165 ops/wk), reflect (208 ops/wk). All require LLM judgment — no easy mechanical conversions left.
- **Cost/cache analysis** — $1,409/wk total, top 3 agents have 0% cache hit rate = $1,129/wk (80%). Escalated to May. See `workspace/finding-cost-cache-miss-0404.md`.
- **Coach model misconfiguration** — `opus` → `claude-opus-4.6` not available. Needs Hao/May fix. See `workspace/finding-coach-model-misconfig-0404.md`.
- **LLM evaluations dead since Mar 31** — All evals heuristic-only (no parent-child sessions). See `workspace/finding-eval-heuristic-only-0404.md`.
- **Session digest quality monitoring** — End digests work (100% coverage) but `still_open` and `files_modified` need improvement. Track after next restart.
- **EXP-031: On-Demand Workflow Discovery** — 5-arm experiment designed. Ready for Phase 1 gym execution (12 runs, ~$17). Design at `agents/shared/knowledge/experiments/EXP-031/design.md`.

## ⚠️ SENT/ESCALATED (awaiting others)

- **Amy-kimi API billing** — 5 consecutive 429 errors (insufficient balance / token quota). Sent to May (req:b2b4d1bc). 2026-04-07.

## 📋 PENDING (awaiting Hao review)

- **Memory Redesign Brief** — At `workspace/brief-memory-redesign.md`. Needs Hao decisions. 2026-03-17.

## ✅ DONE (archived 2026-04-08)

**48 items completed Mar 17 – Apr 8.** Key deployments:
- Dispatcher mode for all 5 agents (optimizer/bob/coach/tech-lead/scout) — 81-94% HB ops reduction
- Skill pruning: 23 files removed from coach & evaluator (90KB overhead eliminated)
- Workflow audit: 9/11 shared workflows NEVER USED, 9 dead workflows archived, REGISTRY corrected
- LLM-to-JS: analyze-failures converted (78 ops/wk saved)
- Evaluator heuristic fix (45.5%→74.5% good rate)
- Coach training-sprint reliability (run-workflow handler, $2-5/day saved)
- Turn budget guidance, maxTurns guardrail, zombie cleanup, tool quality regressions (×5)
- Various findings: system waste (13% true waste), fix-without-verification, workflow collapse root cause

Detailed findings in `workspace/finding-*.md` and `workspace/brief-*.md`.
Tool quality regressions [1-5] all resolved — waste rate 0.07-2.4%, not actionable.
Tool quality regression #6 (bash errors ×4 categories) — investigated 2026-04-09. 42/59 bash:other = classifier gap (gym ✓/✗ format). Rest = natural variance from 2 bob sessions. One fix proposed: add ✗ regex to test-failure classifier.
Tool quality regression #7 (2026-04-09 03:23) — bash:other 28 (+180%), edit:other 2 (+100%), bash:exit-code-nonzero 11 (+267%). Root cause: bob gym scenario dev (27/28 bash:other from bob), tech-lead exploratory greps. Waste rate 2.2% — elevated but not actionable. Same classifier-gap pattern as #6.
