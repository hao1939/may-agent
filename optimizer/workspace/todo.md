# TODO

## 🟢 FOCUS AREAS (from Hao — these define your mission)

1. **Proven Patterns → Workflows / Tools / Skills** — Turn reliable patterns into permanent workflows, tools, or skills.
2. **Performance & Efficiency Investigation** — Find what's slow or wasteful: costly sessions, redundant reads, unnecessary round-trips.
3. **Tool Efficiency — Right Tools, Fewer Tools** — Remove unused tools, fix misuse patterns, reduce tool count per agent.
4. **Waste Elimination** — Kill idle heartbeats, redundant reads, failed tool calls, work that belongs in JS handlers.

**When other agents send you tasks that don't fit these areas → push back or ignore.**

## 🔴 ACTIVE

- ✅ **Evaluator heuristic fix** — Commit a6250b0 DEPLOYED. Data repair deployed. Today's good rate: 45.5% → 74.5%, 7-day: 73.5% → 82.2%.
- ✅ **Scout reliability investigation** — Full report at `workspace/finding-scout-reliability-0404.md`. Issues MOSTLY RESOLVED: malformed tool calls stopped 72h ago, maxTurns increased to 40, 71% of "done" sessions were skipIfIdle (by design). Sent to May.
- ✅ **Workflow collapse investigation** — Root cause: NOT agent avoidance. No production code work happening since Mar 29. Updated REGISTRY.md. See `workspace/finding-system-waste-0404.md`.
- ✅ **System waste analysis** — 34% of sessions had 0 ops (360/1074 in 7d). True waste 13% after excluding skipIfIdle. Report at `workspace/finding-system-waste-0404.md`.
- ✅ **maxTurns guardrail deployment** — All agents now at maxTurns: 40. Config on disk, cron reloaded. **Also fixed:** maxTurns restore bug — sessions lost their turn limit after process restart. Fix in manager.ts + persistence.ts (uncommitted).
- **Coach training-sprint reliability** — INVESTIGATED: 60% interrupt rate caused by `gracefulRestart()` aborting sessions. Root cause shared with interrupted-waste issue. Wrote detailed finding: `workspace/finding-training-sprint-reliability-0404.md`. Quick fix: convert cron entry from run-agent-task to direct workflow dispatch (saves wrapper LLM session). Medium fix: move planning mechanics to JS.
- ✅ **Zombie-cleanup cron** — VERIFIED + ENHANCED. Handler exists, DB has 0 zombies. Phase 2 fix (DB-only zombie cleanup) deployed. **NEW**: Found and fixed zombie archival gap — 109 terminal sessions (42.6 MB) in active dir never moved to history. Added Phase 2 (archive terminal sessions) to `cleanupZombieSessions()`. Uncommitted in `src/lib/manager.ts`.
- **Request aborted waste** — P0 ROOT CAUSE FOUND: `gracefulShutdown()` and `gracefulRestart()` in `src/app/may.ts` cancel all running sessions. `resumeStaleSessions()` then finds nothing to resume. Fix: skip cancel loop in `gracefulRestart()` (hot-reload path). 15.7% of ops wasted (2066/wk). See `workspace/finding-interrupted-waste-0404.md`.
- **Skip rate investigation** — Skip rate stable: 50w 12%, 200w 6.5%. Monitoring continues.
- **Skill lifecycle weekly** — Cooldown (last: Mar 30, next: Apr 6). 54 skills, 5 saturations. Weekly only.
- ✅ **Workflow consolidation P1-P3** — DONE (2026-04-04). 9 duplicate files deleted, 3 canonical versions in `shared/workflows/`. REGISTRY.md updated.
- ✅ **Workflow audit & REGISTRY correction** — DONE (2026-04-04). Found 9/11 shared workflows NEVER USED (0 runs). REGISTRY had fabricated data (60 "code-review-loop" runs were actually implement-and-review). implement-and-review had 6% done rate (14/16 escalated). Fixed verdict parsing (default-to-fail → default-to-conditional). Removed "contradicts" from critical rejection. See `workspace/finding-workflow-audit-0404.md`.
- ✅ **Dead workflow cleanup** — DONE (2026-04-04). 9 dead shared workflows archived to `shared/workflows/archive/`.
- ✅ **LLM-to-JS: analyze-failures** — DONE (2026-04-04). Converted from Bob LLM session (~11 ops/run, 78 ops/week) to pure JS handler. Queries SQLite, computes verdicts/trends/costs, writes to `agents/bob/workspace/analysis.md`. Commit 4eae3a45.
- **LLM-to-JS candidates (next)** — Remaining targets by ops/week: common-sense-verify (680 ops/wk, needs LLM judgment but could be partially replaced), common-sense-infra (165 ops/wk, needs LLM), reflect (208 ops/wk, classifies human inputs). All require LLM judgment — no easy mechanical conversions left.
- **Cost/cache analysis** — NEW P0: $1,409/wk total, top 3 agents (bob/optimizer/coach) have 0% cache hit rate = $1,129/wk (80%). Quick fixes: increase Bob heartbeat interval, lower maxTurns. See `workspace/finding-cost-cache-miss-0404.md`. Escalated to May.
- **Coach model misconfiguration** — NEW finding: `opus` model → `claude-opus-4.6` not available in LiteLLM proxy. Coach gets 400 errors. See `workspace/finding-coach-model-misconfig-0404.md`. Needs Hao/May fix.
- **LLM evaluations dead since Mar 31** — Finding: all evals are heuristic-only because all sessions are root (no parent-child). evaluateTask() LLM path never fires. NOTE: the `usage` field in evaluations contains SESSION LLM costs ($135/day), not eval costs — eval cost is effectively $0. 26 needs_improvement verdicts in 7 days (feedback works for shallow/waste). See `workspace/finding-eval-heuristic-only-0404.md`.

- **Turn limit waste — #1 error source** — NEW P0 finding (2026-04-04). 45 turn-limit errors in 7d = 1,457 wasted ops (43% of all errors, 63% of error ops). Tech-lead worst at 46.6% success rate. **Config reload possibly broken** — maxTurns: 50 in cron.json not applying. Sent to May (req:20690a74). See `workspace/finding-turn-limit-waste-0404.md`.
- **Workflow usage collapsed to 0%** — ROOT CAUSE FOUND (2026-04-05, EXP-028): Heartbeat rewrite on Apr 1 (db9b0ba9) removed all workflow.run() instructions. Coach done rate dropped 85%→34%. Fix: restore instructions to heartbeat.md. Sent to May (req:de3c001e). See `agents/shared/knowledge/experiments/EXP-028/results.md`.
- **EXP-031: On-Demand Workflow Discovery** — DESIGNED (2026-04-05). 5-arm experiment testing escalating prompt interventions for workflow discovery (baseline → nudge → hint → directive → JS injection). Isolates F1/F2/F3 failure modes. Ready for Phase 1 gym execution (12 runs, ~$17). Design at `agents/shared/knowledge/experiments/EXP-031/design.md`.

## ⚠️ SENT/ESCALATED (awaiting others)

- **Workflow collapse fix** — Sent to May (req:de3c001e). 2026-04-05. P0. Restore workflow.run() instructions to coach heartbeat.md. See EXP-028.
- **Turn limit waste** — Sent to May (req:20690a74). 2026-04-04. P0. Config reload + turn budget guidance for all heartbeats.
- **Knowledge consumability response** — Sent to May (req:57edcfe3). 2026-04-04. Core finding: KB is write-only (0 consumer sessions in 7d). Fix: active injection via JS knowledge router.
- **meta.json cost tracking broken** — Sent to tech-lead (req:0f5e25e7). 2026-03-18.
- **Coach cost dominance** — Sent to May (req:8804a514, req:fd4d0e4b). 2026-03-18.
- **Optimizer self-cost dominance** — Escalated to May (req:93d7d0ea). 2026-03-24.
- **Scout synthesis loop** — Sent to May (req:49215e05, req:0857a641). 2026-03-18.
- **Interrupted session waste (15.7%)** — Sent to May (req:c7f404c5). 2026-04-04. Fix: skip cancel in gracefulRestart(). See `workspace/finding-interrupted-waste-0404.md`.

## 📋 PENDING (awaiting Hao review)

- **Memory Redesign Brief** — At `workspace/brief-memory-redesign.md`. Needs Hao decisions. 2026-03-17.

## ✅ DONE (28 items completed Mar 17-Apr 1, pruned 2026-04-01)

Key deployments: cron config reload, skipIfIdle, evaluator cascade, session-read-guard,
finish() evidence+verification guards (FM-3.3), empty-args-guard, circuit breaker job-handler,
skill-lifecycle early-exit, vitest cache pollution fix, LESSONS.md dedup (59% reduction),
workspace compaction handler, tool-as-agent guard, Amy read loop fix, Bob API circuit breaker,
finish() status preserve, streaming truncation retry, eval re-eval loop, gym stale binary,
QA npx fix, classifyFailure() sub-classification, coder prompt slimming (20KB→7KB),
PATH_HALLUCINATION analysis, zombie sessions fix, process restart (resolved — now on 849c340),
gym baseline on 849c340 (15/16 pass, 94% — up from 85%),
common-sense-status.md compaction (186KB→89KB, 52% reduction — archived 25 superseded entries).
Findings archived in `workspace/finding-*.md` and `workspace/brief-*.md`.

- [x] **[tool-quality-regression]** RESOLVED: bash:other regression was misclassification. Added 5 new categories (exit-code-nonzero, test-failure, cmd-aborted, env-mismatch, git-error). bash:other reduced 109→8 (7d). See tool-quality-report.md.
- [x] **[tool-quality-regression-2]** RESOLVED (2026-04-04 17:15): bash:exit-code-nonzero 4 (was 0). All from coach training sprints — `cat` on missing scenario files, `cp -r` failures during gym runs. Expected behavior during experimentation, not systemic. No fix needed.
- [x] **[turn-budget]** DEPLOYED (2026-04-04 17:15): Added turn-budget section to `heartbeat.md` — explicit "pick ONE task, plan to finish by turn 25, exit partial at turn 20+" guidance. 3 turn-limit errors in 12h = 99 ops wasted. Also addresses May's P1 request (req:8d9f1961).
