# Optimizer's Periodic Tasks

Track when each task was last done. Pick the most overdue one during heartbeat step 3.

## Per heartbeat (do one, rotate)
- [x] **Analysis review** — Last done: 2026-03-18T00:20
  Read agents/bob/workspace/analysis.md or recent Bob synthesis outputs.
  Any findings that need optimization work? Cost issues? Efficiency problems?
  If found → add specific task to workspace/todo.md.
  Latest (2026-03-18T00:20): Reviewed 2 new Bob briefs: (1) **directive-soul-updates-p13-p108.md** — SOUL updates for May/Evaluator, not optimizer-relevant. (2) **brief-turn-budget.md** — proposes `[Ops: N/Max]` injection. **ALREADY DEPLOYED** at `manager-receipts.ts:327-331` (shows `[Ops: N/M]` when >50% consumed, ⚠️ at low threshold). Bob's brief is redundant. OpBudget visibility (item 3 from prior review) is resolved. **Critical finding**: all recent cron fixes (idle-skip, content-hash reload, timer fixes) are committed but NOT running — PID 7 hasn't been restarted. Single process restart unlocks ~$30-50/day savings. Finding at `workspace/finding-process-restart-needed.md`.

- [x] **Cost outlier scan** — Last done: 2026-03-18T01:19
  Check recent evaluations — any sessions > $2.00?
  What caused the high cost? Too many turns? Large tool calls? Model choice?
  If pattern found → design fix, add to workspace/todo.md.
  Latest (2026-03-18T01:19): **ROOT CAUSE CONFIRMED for zero-usage bug.** Two issues: (1) Historical evals pre-date `extractUsage` fix (commit 6c44f0e). (2) Fix committed but process not restarted — 75 evals written AFTER fix still have zeros. Manual simulation confirms code logic works (extracts 732K tokens/$2.25 from transcript). Same blocker as all other pending fixes: PID 7 restart. Also need backfill to regenerate 10,382 stale heuristic evals. Finding updated at `workspace/finding-eval-usage-zero.md`.

- [x] **LLM-to-JS opportunity scan** — Last done: 2026-03-17T22:30
  Read recent sessions. Any agent doing predictable, deterministic work via LLM?
  Could it be replaced with a JS handler? (See cron-graduation-process.md Stage 3.)
  If found → write proposal in workspace/improvement-proposals.md.
  Latest (2026-03-17T22:30): **Major finding: Heartbeat interval mismatch.** 4 agents (bob 660s, optimizer 540s, coach 720s, tech-lead 780s) have intervalMs 3-4x shorter than their "30min" descriptions. 344 heartbeats/day = $27.52/day waste. Also: idle-skip code (848ebf1) deployed but server not restarted — 0 idle skips in 24h. Combined fix potential: ~$24/day = $720/month savings. Brief at `workspace/brief-heartbeat-waste-v2.md`, sent to tech-lead (req:127a5dc2). Prior: Tool Efficiency Audit at `workspace/brief-tool-efficiency-audit.md`.

- [x] **Handler health check** — Last done: 2026-03-18T00:07
  Review existing JS handlers in agents/may/handlers/.
  Any errors in recent logs? Any handler that's not firing?
  If issues → add fix to workspace/todo.md.
  Latest (2026-03-17T22:27): 12 handler `.ts` files present (incl. agents-auto-commit, audit-requests). 32 cron entries, all wired. **Key finding:** `.state/job-history.jsonl` is a dead 2.9MB legacy file — nothing writes to it since cron moved to SQLite (`may.db`). All consumers already updated. Fixed stale comment in daily-brief.ts. Finding at `workspace/finding-dead-job-history.md`. Orphan handlers (audit-requests, focus-task-tracker) now wired to cron — no longer orphaned.

## Weekly
- [x] **Improvement proposals review** — Last done: 2026-05-09 (Finding 18, Cycle 12). **2 new commits since last review**: agent-growth refactor committed (3a6d51e — 16 files, +1725/-168), orphaned test cleanup (85de6e7). Git now clean (0 uncommitted changes — resolved 7+ week risk). 1049/1049 tests pass (87 files), tsc clean. New cross-edit guard (P53) prevents cross-agent identity file modification. Finish tool wired but unadopted. System idle — 0 sessions, evals, job history. Compaction 8/12, prompt caching still 0% for Opus (LiteLLM proxy blocker). **No new optimization work items identified.**

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
