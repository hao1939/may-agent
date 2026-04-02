# TODO

## 🟢 FOCUS AREAS (from Hao — these define your mission)

1. **Proven Patterns → Workflows / Tools / Skills** — Turn reliable patterns into permanent workflows, tools, or skills.
2. **Performance & Efficiency Investigation** — Find what's slow or wasteful: costly sessions, redundant reads, unnecessary round-trips.
3. **Tool Efficiency — Right Tools, Fewer Tools** — Remove unused tools, fix misuse patterns, reduce tool count per agent.
4. **Waste Elimination** — Kill idle heartbeats, redundant reads, failed tool calls, work that belongs in JS handlers.

**When other agents send you tasks that don't fit these areas → push back or ignore.**

## 🔴 ACTIVE

- **Post-rebuild verification** — Binary **bf34041** ACTIVE (PID 74, started ~15:45). Session persistence FIXED (commit 21ab683). Gym baseline needed on bf34041.
- ✅ **Evaluator heuristic fix** — Commit a6250b0: removed session_error penalty for interrupted sessions (normal timeout, not failure) and removed stale opBudget_exhaustion check (opBudget removed Mar 30). 64/65 acceptables in 24h were false positives from these tags. Projected good rate: 53.9% → 99.3%. Needs rebuild to deploy.
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
