# TODO

## 🟢 FOCUS AREAS (from Hao — these define your mission)

1. **Proven Patterns → Workflows / Tools / Skills** — Turn reliable patterns into permanent workflows, tools, or skills.
2. **Performance & Efficiency Investigation** — Find what's slow or wasteful: costly sessions, redundant reads, unnecessary round-trips.
3. **Tool Efficiency — Right Tools, Fewer Tools** — Remove unused tools, fix misuse patterns, reduce tool count per agent.
4. **Waste Elimination** — Kill idle heartbeats, redundant reads, failed tool calls, work that belongs in JS handlers.

**When other agents send you tasks that don't fit these areas → push back or ignore.**

## 🔴 ACTIVE

- ✅ **Evaluator heuristic fix** — Commit a6250b0 DEPLOYED. Data repair deployed. Today's good rate: 45.5% → 74.5%, 7-day: 73.5% → 82.2%.
- ✅ **Scout reliability investigation** — Full report at `workspace/scout-reliability-analysis.md`. Scout 49% waste rate. P0: add maxTurns to all agents. Escalated to May.
- ✅ **Workflow collapse investigation** — Root cause: NOT agent avoidance. No production code work happening since Mar 29. Updated REGISTRY.md. See `workspace/finding-system-waste-0404.md`.
- ✅ **System waste analysis** — 34% of sessions had 0 ops (360/1074 in 7d). True waste 13% after excluding skipIfIdle. Report at `workspace/finding-system-waste-0404.md`.
- ✅ **maxTurns guardrail deployment** — All agents now at maxTurns: 40. Config on disk, cron reloaded. Uncommitted changes will auto-commit. Verified: tech-lead at 06:45 Apr 4 hit 41/40 (was 31/30).
- **Coach training-sprint reliability** — P0 new finding: 60% interrupt rate (3/5 failed in 5d). Needs smaller phases or higher maxTurns. Consider escalating to Coach/May.
- **Zombie-cleanup cron not running** — P1 new finding: Last ran March 25 (10 days ago!). 10 zombie sessions in DB. Handler or cron firing broken. Needs investigation.
- **Request aborted waste** — P1: 26 sessions/day (26.8%). 13 had 0 ops. Platform-level, not agent-fixable. Monitor after maxTurns fix.
- **Skip rate investigation** — Skip rate stable: 50w 12%, 200w 6.5%. Monitoring continues.
- **Skill lifecycle weekly** — Cooldown (last: Mar 30, next: Apr 6). 54 skills, 5 saturations. Weekly only.
- **Workflow consolidation P1-P3** — From audit Mar 30. Next audit Apr 6.

## ⚠️ SENT/ESCALATED (awaiting others)

- **meta.json cost tracking broken** — Sent to tech-lead (req:0f5e25e7). 2026-03-18.
- **Coach cost dominance** — Sent to May (req:8804a514, req:fd4d0e4b). 2026-03-18.
- **Optimizer self-cost dominance** — Escalated to May (req:93d7d0ea). 2026-03-24.
- **Scout synthesis loop** — Sent to May (req:49215e05, req:0857a641). 2026-03-18.

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

- [ ] **[tool-quality-regression]** 1 regressed: bash:other: 4 (was 1, +300%). See tool-quality-report.md
