# Optimizer's Periodic Tasks

Track when each task was last done. Pick the most overdue one during heartbeat step 3.

## Per heartbeat (do one, rotate)
- [x] **Analysis review** — Last done: 2026-03-23T20:39
  Read agents/bob/workspace/analysis.md or recent Bob synthesis outputs.
  Any findings that need optimization work? Cost issues? Efficiency problems?
  If found → add specific task to workspace/todo.md.
  Latest (2026-03-23T20:39): 75 sessions/12h = 6.7/hr = ~$163/day. Optimizer #1 ($65/day). Coach down to $23/day. Claude caching still 0%. Finding at `workspace/finding-analysis-review-0323-2039.md`.

- [x] **Cost outlier scan** — Last done: 2026-03-23T17:39
  Check recent evaluations — any sessions > $2.00?
  What caused the high cost? Too many turns? Large tool calls? Model choice?
  If pattern found → design fix, add to workspace/todo.md.
  Latest (2026-03-23T17:39): 30 sessions/6h = 5.0/hr, $51.78/day. Optimizer #1 (37%). Claude caching 0%. Finding at `workspace/finding-cost-scan-0323-1739.md`.

- [x] **LLM-to-JS opportunity scan** — Last done: 2026-03-23T10:09
  Read recent sessions. Any agent doing predictable, deterministic work via LLM?
  Could it be replaced with a JS handler? (See cron-graduation-process.md Stage 3.)
  If found → write proposal in workspace/improvement-proposals.md.
  Latest (2026-03-23T10:09): Bash-as-cat 7.1%. No new LLM-to-JS opportunities. Remaining: bash interceptor, QA commit preflight, Amy read-dedup (all previously identified). Finding at `workspace/finding-llm-to-js-scan-0323-1009.md`.

- [x] **Handler health check** — Last done: 2026-03-23T10:09
  Review existing JS handlers in agents/may/handlers/.
  Any errors in recent logs? Any handler that's not firing?
  If issues → add fix to workspace/todo.md.
  Latest (2026-03-23T10:09): Same 3 handlers dead (convention-check, tool-quality-scan, heartbeat-context). Blocked on binary rebuild/restart.

- [x] **Proven pattern → Skill/Workflow** — Last done: 2026-03-23T19:09
  **Run via workflow**: `workflow.run("skill-lifecycle", "Scan recent sessions for proven multi-step patterns")`
  Mechanically enforces all 4 phases (discover → draft → test → deploy).
  **Deliverable**: A new or refined skill file, tested in gym, deployed to agents.
  Latest (2026-03-23T19:09): request-triage-memoization DEPLOYED. 14/15 behavioral checks (93%). Skill at `agents/shared/skills/request-triage-memoization/SKILL.md`.
  Skills deployed (10 total): obstacle-pivot, grep-first-reading, state-check-before-action, budget-before-act, stale-approach-fixation, coder-edit-discipline, delegation-verification, idempotent-work-detection, search-strategy-escalation, evidence-over-narrative, incremental-context-loading, request-triage-memoization.

- [x] **Tool quality review** — Last done: 2026-03-23T13:09
  Read tool-quality-report.md. Look for regression trends and persistent failure patterns.
  Latest (2026-03-23T13:09): Bash-as-cat 10.4%. ENOENT top waste (30 errors, ~$4.80/day). Edit failures 0%. Finding at `workspace/finding-tool-quality-review-0323-1309.md`.

## Weekly
- [x] **Improvement proposals review** — Last done: 2026-03-21T16:39
  14 deployed ($107-150/day). 8 blocked on handler cache. 9 proposed ($14-21/day). Review at `workspace/improvement-proposals-review-0321.md`.

## Bi-Weekly
- [x] **Heartbeat graduation review** — Last done: 2026-03-17
  Review agents' heartbeat.md for stable patterns that could become cron entries. Log at `workspace/graduation-log.md`.

- [x] **LESSONS.md graduation audit** — Last done: 2026-03-17
  **Automated** via daily JS handler `agents/may/handlers/lessons-graduation.ts`.

## How to use this file
1. Read this file during heartbeat step 3
2. Find the most overdue task
3. Do it
4. Update "Last done" date
