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
Tool quality regression #8 (2026-04-09 07:23) — bash:exit-code-nonzero 21 (+91%), read:nonexistent-path 8 (+167%), bash:nonexistent-path 8 (+300%), edit:other 5 (+150%). Root cause: bob 104-op gym remediation session + coach wave-2 validation/few-shot deployment. Same development-activity pattern as #6/#7. Not actionable.
Tool quality regression #9 (2026-04-09 11:23) — bash:exit-code-nonzero 52 (+148%), bash:other 49 (+81%), plus bash:nonexistent-path, edit:other. Root cause: bob heavy research sessions (79-op HB, multiple 40-70 op research/integration sessions), coach multi-session harness phases 1-3, tech-lead manager.ts bug fixes. Same development-activity pattern as #6/#7/#8. Not actionable.
Tool quality regression #10 (2026-04-09 13:32) — 6 regressed categories. Waste rate 5.2% (was 4.1%). bash:exit-code-nonzero 111 (+127%), edit:edit-match-fail 18 (+200%), bash:git-error 28 (+27%), read:nonexistent-path 47 (+27%), read:other 8 (+33%), bash:nonexistent-path 17 (+31%). Root cause: bob dominates all 6 categories (205/229 regressed errors = 89%) — heavy EXP-087/EXP-089 experiment research (grepping knowledge base, reading nonexistent hypothesis files, edit mismatches). Bob had 169 evals in 24h with clusters at Apr 8 20:49-23:22 (67 sessions) and Apr 9 10:22-10:30 (4 high-waste sessions). Coder contributed 12 read:nonexistent-path and 42 bash:other but at only 0.5% waste rate. Tech-lead had 1 high-waste session (5 wasted from 140 ops). Overall waste rate crossed 5% threshold for first time but is driven entirely by bob's high-volume research activity, not systematic misuse. Same development-activity pattern as #6-#9. Not actionable.
Tool quality regression #11 (2026-04-09 15:23) — 8 regressed categories. bash:exit-code-nonzero 75 (+44%), bash:other 63 (+29%), bash:nonexistent-path 33 (+65%), read:nonexistent-path 9 (+29%), bash:timeout-killed 6 (+100%), bash:git-error 6 (+100%), edit:edit-match-fail 5 (+100%), read:other 5 (+67%). Verified: actual waste rates 0-1.1% across all agents (bob 0.3%, coach 0.3%, qa 1.1%). Elevated absolute counts driven by bob (23 sessions) and coach (13 sessions) heavy development. Same development-activity pattern as #6-#10. Not actionable.
Tool quality regression #12 (2026-04-09 22:29) — 1 regressed category. bash:nonexistent-path 21 (was 17, +24%). Waste rate 5.9% (was 5.2%). bob dominates (19/21 = 90%), tech-lead 2. Only 1 category regressed vs 6-8 in prior scans — activity is winding down. Examples: bob referencing nonexistent knowledge base files (PRIORITY-TRACKER.md, deep-dives, hypotheses). Same development-activity pattern as #6-#11. Not actionable.
Tool quality regression #13 (2026-04-09 23:23) — 1 regressed category. read:nonexistent-path: 10 (was 8, +25%). Tiny absolute increase (+2). System waste rates near 0% across all agents in last 6h. Same development-activity pattern as #6-#12. Not actionable.
