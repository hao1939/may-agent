# Optimizer's Periodic Tasks

Track when each task was last done. Pick the most overdue one during heartbeat step 3.

## Per heartbeat (do one, rotate)
- [x] **Analysis review** — Last done: 2026-03-25
  Read agents/bob/workspace/analysis.md or recent Bob synthesis outputs.
  Any findings that need optimization work? Cost issues? Efficiency problems?
  If found → add specific task to workspace/todo.md.
  Latest: Found and fixed critical bug — all detached cron jobs failing with ERR_MODULE_NOT_FOUND
  because Cron.projectRoot was computed as 1 level up from cron.json instead of 2 levels.

- [x] **Cost outlier scan** — Last done: 2026-03-25
  Check recent evaluations — any sessions > $2.00?
  What caused the high cost? Too many turns? Large tool calls? Model choice?
  If pattern found → design fix, add to workspace/todo.md.
  Latest: 139/674 sessions (20.6%) > $2. Key findings: (1) maxTurns-capped sessions cost 5-7x normal (tech-lead $7.70 vs $1.11), (2) most agents have 0% prompt cache hit rate — only bob (84%) and qa (62%) get cache hits, (3) recurring tool schema errors waste turns. See improvement-proposals.md Finding 6.

- [x] **LLM-to-JS opportunity scan** — Last done: 2026-03-11
  Read recent sessions. Any agent doing predictable, deterministic work via LLM?
  Could it be replaced with a JS handler? (See cron-graduation-process.md Stage 3.)
  If found → write proposal in workspace/improvement-proposals.md.

- [x] **Handler health check** — Last done: 2026-03-25
  Review existing JS handlers in agents/may/handlers/.
  Any errors in recent logs? Any handler that's not firing?
  If issues → add fix to workspace/todo.md.
  Latest: All 8 handlers present. 44/44 handler tests pass (6 test files). Log errors found are all transient/resolved: (1) ENOENT session.jsonl errors from ~06:16-06:23 Mar 12 — likely restart/migration event, not handler bug. (2) Old `buildProjectStructure`/`createValidateWorkflowTool` import errors from Mar 9-10 — already fixed by refactors. (3) "LLM returned stopReason toolUse but no tool call" — network/proxy issue, not handler code. No handler-specific issues found.

## Weekly
- [x] **Improvement proposals review** — Last done: 2026-03-24. Reviewed all proposals. P2, P3, P4 done. O1 (heartbeat pre-check) done. Remaining: P1/P5 (metadata backfill — medium/low priority), O4 (periodic task scheduler — medium), O2 (lesson consolidation hybrid — medium). No proposals ready for immediate implementation without new analysis work.

---

## How to use this file
1. Read this file during heartbeat step 3
2. Find the most overdue task
3. Do it
4. Update "Last done" date
