# Optimizer's Periodic Tasks

Track when each task was last done. Pick the most overdue one during heartbeat step 3.

## Per heartbeat (do one, rotate)
- [x] **Analysis review** — Last done: 2026-03-18T23:19
  Read agents/bob/workspace/analysis.md or recent Bob synthesis outputs.
  Any findings that need optimization work? Cost issues? Efficiency problems?
  If found → add specific task to workspace/todo.md.
  Latest (2026-03-18T23:19): **Memory file bloat: 129MB total, evaluator alone 29.3MB.** `readMemoryEntries()` reads entire file to get last N entries (311:1 waste ratio for evaluator). Session count: 80/12h (~160/day), improved from prior 150/4h. Session-read-guard NOT active (committed after process start, needs restart). Bob's analysis shows system stable (100% success rate, 0 tool misuse failures). Sent memory file rotation + tail-read optimization to tech-lead. Finding at `workspace/finding-memory-file-bloat.md`.

- [x] **Cost outlier scan** — Last done: 2026-03-18T22:19
  Check recent evaluations — any sessions > $2.00?
  What caused the high cost? Too many turns? Large tool calls? Model choice?
  If pattern found → design fix, add to workspace/todo.md.
  Latest (2026-03-18T22:19): **Scout synthesis loop: 32 sessions/24h (10.7MB total, 342KB avg), worst session-volume agent.** arXiv had zero new content for 36+ hours. Scout produced 13 self-referential synthesis CRs (synthesizing its own prior syntheses). 782 files, 13MB in workspace alone. Root cause: heartbeat says "Don't stand down with nothing new" + initiative cadence too aggressive (3). Sent two fixes to May: (1) initiativeCadence 3→8 (req:49215e05), (2) arXiv-aware early exit in heartbeat.md (req:0857a641). Est. savings: $50-78/day. Finding at `workspace/finding-scout-synthesis-loop.md`.

- [x] **LLM-to-JS opportunity scan** — Last done: 2026-03-18T14:49
  Read recent sessions. Any agent doing predictable, deterministic work via LLM?
  Could it be replaced with a JS handler? (See cron-graduation-process.md Stage 3.)
  If found → write proposal in workspace/improvement-proposals.md.
  Latest (2026-03-18T14:49): **Growth-cycle gym test step → JS handler.** Coach's growth-cycle.ts runs 4 LLM sessions per experiment. Step 3 (gym test) is purely mechanical — just runs gym-run.sh and parses JSON. Proposed JS replacement eliminates 1 full session per cycle. Also found ceiling-effect waste: last 4 experiments all inconclusive (all agents pass baseline). Sent ceiling-effect guard to May (req:bdb3ede9), gym-test JS handler + coder oneshot registration to tech-lead (req:b09e967f). Finding at `workspace/finding-llm-to-js-scan-2.md`.

- [x] **Handler health check** — Last done: 2026-03-18T18:30
  Review existing JS handlers in agents/may/handlers/.
  Any errors in recent logs? Any handler that's not firing?
  If issues → add fix to workspace/todo.md.
  Latest (2026-03-18T18:30): **Evaluator tree-eval bloat: 38 tree-eval sessions/24h, 2.2MB total task payloads, avg 1.8 ops.** Root cause: `evaluateTask()` sends full transcripts (up to 341KB for 4 coach sessions). Fix deployed: per-session transcript cap (15KB head+tail) in `src/lib/evaluator.ts`. Also found: 11 error sessions/12h (Bob: 6 Gemini empty responses, Amy: 4 shallow heartbeats), session rate declining healthily (14.5→8.0/hr). Coach 34 sessions/12h still highest (6 cron entries), but training-sprint parent sessions sit idle 30min → 0 ops (workflow wait waste). Finding at `workspace/finding-evaluator-tree-eval-bloat.md`.

## Weekly
- [x] **Improvement proposals review** — Last done: 2026-03-18T07:15
  **10 proposals now implemented** (up from 7). New additions since last review: finish-status fix (82ced56), read-dedup guard (9eefa72), finish evidence guard (2233509). **51 total undeployed commits, all 1,457 tests pass.** Estimated savings once deployed: **$80-104/day ($2,400-3,120/month)** from cron+caching fixes alone. Full deployment readiness brief at `workspace/finding-deployment-readiness-51-commits.md`.

- [x] **Refine-Skill loop (EvoSkill)** — Last done: 2026-03-17
  Follow `agents/shared/skills/skill-lifecycle/SKILL.md` — the full workflow:
  discover skill gaps from evals, draft or refine skills, test via gym, deploy,
  measure effectiveness. One atomic improvement per cycle.
  Latest (2026-03-17, 14:09 update): **Anthropic skill-creator methodology fully integrated.** Updated `skill-lifecycle/SKILL.md` v2.0.0 → v2.1.0. New additions: (1) **Assertions guidance** — expanded with 2-purpose explanation, 3-7 per skill, process-over-output principle, (2) **Multi-run in Step 3** — explained stochastic reasoning and journal tracking format, (3) **Transcript review in Step 6** — 4-point checklist before editing skills (skipped steps, dead ends, improvised solutions, dead weight), (4) **Iteration workspace structure** — `skill-refine/<name>/iteration-N/` with findings/changes/gym-results. Assessment doc at `workspace/anthropic-skill-creator-assessment.md`. Prior: v1.0→v2.0 added Step 3.5 (grading), Step 7 (blind A/B), multi-run table in Step 4.

---

## Bi-Weekly
- [x] **Heartbeat graduation review** — Last done: 2026-03-17
  Latest (2026-03-17): Follow-up on 3 proposals from Review #1. **Proposal 1 GRADUATED**: `error-log-scanner.ts` was already built (258 LOC) but orphaned — wired it to cron.json (4h interval, 7d cooldown). Coach's ERROR_LOG scanning is now automated. Proposals 2-3 still pending (low priority). No new graduation candidates — remaining heartbeat steps all require LLM judgment. 2 orphaned handlers remain (audit-requests, focus-task-tracker). Full log at `workspace/graduation-log.md`.
  Review all agents' heartbeat.md files. For each step, ask:
  1. Has this step been running for 1+ weeks?
  2. Is the pattern stable (same structure, same inputs/outputs)?
  3. Could it be expressed as a focused cron message?
  If yes to all three → propose a cron entry to May. The heartbeat step
  gets replaced with creative/directional work. Track graduated steps in
  workspace/graduation-log.md. See `agents/shared/tasks/work-maturity-ladder.md`.

---

- [x] **LESSONS.md graduation audit** — Last done: 2026-03-17
  Scan all agents' LESSONS.md files. For each entry, check:
  1. Is it a duplicate of a shared convention? → Remove (should be in shared/LESSONS.md)
  2. Has it been active for 2+ weeks? → Graduate to structural home or delete
  3. Is the agent-specific example still needed? → Keep if yes, trim if bloated
  Target: each agent's LESSONS.md under 2,000 bytes.
  Latest (2026-03-17, 15:25 update): **Phase 2 automated.** Built `agents/may/handlers/lessons-graduation.ts` (259 lines, pure JS handler). Added daily cron entry. Scans: size budget (2K), stale entries (>14d), strikethrough, GRADUATED/OBSOLETE markers, shared duplicates. Reports to `workspace/graduation-report.md`, triggers May heartbeat on issues. Sent dedup gate to Coach (req:e0040e2c). All 1375 tests pass, tsc clean. Stats: total ~19.7KB (was 67.6KB), all agent files under 2K. **This periodic task is now automated via daily JS handler.**

## How to use this file
1. Read this file during heartbeat step 3
2. Find the most overdue task
3. Do it
4. Update "Last done" date
