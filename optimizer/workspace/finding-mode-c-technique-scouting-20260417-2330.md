# Mode C — Skill & Technique Scouting: Lean vs Bloated Heartbeat Divergence Point

**Date**: 2026-04-17 23:30 UTC
**Window**: Last 6h (17:30–23:30 UTC)
**Author**: optimizer

## Context

Following the rotation (prior Mode B, 2300 UTC), pick ONE technique lean heartbeats use that bloated ones don't — with concrete sessionIds and tool-call traces.

Prior hypothesis (from task brief): "High-op heartbeats fail to use combined-snapshot queries and run multiple sequential DB queries before deciding." That hypothesis was **partially rejected**: all sessions (lean and bloated) DO run the combined-snapshot query first — tech-lead/optimizer heartbeat.md has been deploying it for weeks. The divergence happens *after* the snapshot.

## Method

1. Queried `.state/may.db sessions` for `kind='job' AND task LIKE '%[heartbeat]%'` in last 6h, split by opCount.
2. Pulled tool-call sequences from `.state/sessions/history/<id>/session.jsonl` via `jq`.
3. Compared first 10 tool calls between 4 lean (≤7 ops) and 3 bloated (15–25 ops) sessions.

## Population (last 6h)

- 66 heartbeats ≤9 ops (lean)
- 7 heartbeats ≥15 ops (bloated)
- **All 7 bloated sessions are tech-lead (4) or optimizer/coach self-triggered work cycles.** Bob/scout/may/qa had zero bloated heartbeats.

Bloated list:
- `s_1776459642133_628` tech-lead 25 ops
- `s_1776450642165_550` tech-lead 22 ops
- `s_1776448439218_532` coach 18 ops
- `s_1776459639520_626` optimizer 19 ops (Mode A fork; not a normal heartbeat, excluded)
- `s_1776465041817_672` tech-lead 16 ops
- `s_1776466841776_685` tech-lead 16 ops
- `s_1776461442168_641` tech-lead 15 ops

## Lean examples (tool-call traces)

### bob `s_1776468128357_691` — 4 ops
1. `bash`: `ls experiments/ && ls deep-dives/` (observe)
2. `bash`: `cat bob/workspace/todo.md | head -60` (observe)
3. `workflow`: `[WORK SESSION] Design doc: Difficulty-adaptive content-first guard…` — **forked at op 3**
4. `finish`

### scout `s_1776468641816_697` — 3 ops
1. `bash`: `cd agents && git log --oneline -8 -- shared/knowledge/`
2. `bash`: `cat scout/workspace/todo.md | tail -60`
3. `finish` (no-op heartbeat — nothing new, exited cleanly)

### qa `s_1776466841859_686` — 6 ops (peer comparison: a lean QA heartbeat)
1. `bash`: `git log --oneline -10`
2. `bash`: `git status --porcelain`
3. `read`: `test/file-read-tracker.test.ts`
4. `bash`: `tsc --noEmit`
5. `bash`: `vitest --run`
6–8. small journal edit + commit + finish

### coach `s_1776468239011_693` — 3 ops
1. `bash`: snapshot query
2. `bash`: `ls experiments + grep coach/workspace/todo.md`
3. `finish` (triage-only: nothing forkable, clean exit)

**Lean fingerprint**: After 1–2 observe calls, the decision is made. Either `finish()` (no-op) or a single `workflow.run()/agents.call()` dispatches the work. **Op budget ≤3 before a terminal action.**

## Bloated examples (tool-call traces)

### tech-lead `s_1776450642165_550` — 22 ops
1. `bash`: snapshot DB query
2. `read`: tech-lead/workspace/todo.md
3. `bash`: `tsc --noEmit` ← **INLINE verification of red build-health metric**
4. `bash`: `ls projects/ + dispatch-board`
5. `bash`: `git branch -a + git log main`
6–8. 3× DB queries (recent coach activity, requests, evaluator stats)
9. `bash`: `vitest run --reporter=default` ← **INLINE test-suite run**
10. `bash`: `code-search.sh 'VALID_TOOL_PRESETS'`
11. `bash`: `grep VALID_TOOL_PRESETS src/app/agent-loader.ts`
12. `read`: `src/app/agent-loader.ts`
13. `bash`: `grep 'notify' agents/*/agent.json`
14. `bash`: `grep 'notify\|createNotifyTool' src/app/agent-loader.ts`
15. `bash`: `grep 'case' agent-loader.ts`
16. `read`: `src/app/agent-loader.ts` (2nd read)
17–19. `git show <commit> --stat`, show file, etc.
20. `read`: `src/app/agent-loader.ts` (3rd read)
21. `workflow.run('implement-and-verify', ...)` ← **FORK at op 21**
22. `finish`

### tech-lead `s_1776459642133_628` — 25 ops
Similar shape. 1–2 observe, then ops 3–19: inline `tsc`, `vitest run`, `git stash/pop/drop` sequence, 4× DB queries rehashing merged-branch status, 3× `git log` variants — all to "scope" a QA merge. Only at op 20 does an `agents.call("qa", ...)` fire. 5 more post-dispatch ops before finish (violating heartbeat.md's "finish within 3 ops of fork").

### tech-lead `s_1776466841776_685` — 16 ops
Snapshot (1) → todo (2) → projects-ls + dispatch-board (3) → `tsc --noEmit` (4) → 4× DB queries on build-health source (5–8) → 6× `grep` chains across src/ and agents/may/handlers/ searching for `'build-health'` string (9–14) → workflow.run (15) → finish (16). **Spent 11 ops scoping "where does the build-health metric come from?" before dispatching.**

**Bloated fingerprint**: After observe, the agent does **inline diagnostic verification** of an anomaly (red metric, tsc error, failing test) to *confirm the diagnosis* before dispatching. The diagnosis IS the forked work — but the heartbeat agent wants to "scope" it first.

## Divergence point (op 3–8)

| Op | Lean | Bloated (tech-lead) |
|----|------|---------------------|
| 1 | Snapshot DB query | Snapshot DB query |
| 2 | Read todo.md | Read todo.md |
| 3 | **Decide: fork OR finish** | `tsc --noEmit` (verify red metric inline) |
| 4 | (finished or forked) | `ls projects/` + dispatch-board (more context) |
| 5 | — | 2nd–4th DB queries (drill into anomaly) |
| 6–10 | — | grep src/, read source files, git log variants |
| 11–20 | — | More grep/read to confirm root cause |
| 21 | — | Finally `workflow.run()` / `agents.call()` |

**The single technique**: *Lean heartbeats fork on hypothesis; bloated ones fork on confirmed diagnosis.*

- Lean: "coach todo.md has a promoted-skills item → fork it" (no verification — the forked session verifies).
- Bloated: "build-health metric is red → let me run tsc to confirm, grep src/ to find the origin of 'build-health', read agent-loader.ts to identify the broken preset, then fork." This is `10–15 ops of inline diagnosis`, which is exactly what the forked workflow would do anyway.

## Why the current heartbeat.md fails

Both tech-lead and optimizer heartbeat.md already list "Must-fork tasks: Running the test suite, Multi-file code analysis, Investigating dead code, ANY code changes". But tech-lead ran `tsc --noEmit` inline in **3 of 3** bloated sessions and `vitest run` inline in 2 of 3. The rule is written but violated because the agent perceives "quick verification to scope the fork" as distinct from "running the test suite as work."

The lean sessions succeed because they either:
(a) have nothing forkable → clean `finish()`, or
(b) have obvious forkable work (todo.md item) → `workflow.run(task)` immediately, trusting the forked session to do its own scoping.

## Recommendation

**Add ONE rule to `agents/tech-lead/heartbeat.md` Step 3 (ACT)**, in the "Must-fork tasks" list, phrased to block the specific anti-pattern:

> **Do NOT run `tsc`, `vitest`, `grep src/`, or read source files in a heartbeat to "scope" or "verify" an anomaly before dispatching.** If a metric is red or a test is failing, fork `implement-and-verify` with the symptom as the task — let the forked session diagnose. Heartbeat dispatch text can be 1 sentence: *"Build-health red as of <time>. Investigate + fix."* The forked workflow handles scoping.

This is additive (content within existing step — complies with KE-008: no structural changes). It targets the exact mis-categorization ("verification to scope ≠ verification as work") seen in 3/3 bloated tech-lead sessions.

Per KE-123 (no stacked interventions) and KE-020 (wiring, not availability): this is a single prompt addition, not a bundle, and it lives in the dispatch-path prompt (Level 2–3 adoption), not context.md (Level 4 = 0% adoption).

## Dispatch

**Dispatching to tech-lead** via `agents.message()` — P2, prompt-only tweak to `agents/tech-lead/heartbeat.md` Step 3. Expected savings: if bloated tech-lead heartbeats drop from avg 18 ops → 6 ops, that's ~12 ops × ~12 bloated heartbeats/day = **~140 ops/day (~$6/day)**. Low confidence (prompt fixes historically deliver 30–50% of projected savings) but zero risk since additive text only.

Not dispatching to optimizer self — optimizer heartbeats in this 6h window were already lean (3–6 ops each except the Mode A *fork-work* session, which is a work session not a heartbeat).

---

*Sessions inspected (transcript-verified via `.state/sessions/history/<id>/session.jsonl`): s_1776468128357_691, s_1776468641816_697, s_1776466841859_686, s_1776468239011_693, s_1776450642165_550, s_1776459642133_628, s_1776466841776_685.*
