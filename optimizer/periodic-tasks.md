# Optimizer's Periodic Tasks

Track when each task was last done. Pick the most overdue one during heartbeat step 3.

## Per heartbeat (do one, rotate)
- [x] **Analysis review** — Last done: 2026-03-23T20:39
  Read agents/bob/workspace/analysis.md or recent Bob synthesis outputs.
  Any findings that need optimization work? Cost issues? Efficiency problems?
  If found → add specific task to workspace/todo.md.
  Latest (2026-03-23T20:39): 75 sessions/12h = 6.7/hr = ~$163/day. Optimizer #1 ($65/day). Coach down to $23/day. Claude caching still 0%. Finding at `workspace/finding-analysis-review-0323-2039.md`.

- [x] **Cost outlier scan** — Last done: 2026-03-23T22:09
  Check recent evaluations — any sessions > $2.00?
  What caused the high cost? Too many turns? Large tool calls? Model choice?
  If pattern found → design fix, add to workspace/todo.md.
  Latest (2026-03-23T22:09): 88 sessions/12h = 7.3/hr, ~$133/day. Bash-as-cat 14% system-wide (scout 50%, coach 24%). Sent guard patches to May (req:08282cc8). Finding at `workspace/finding-cost-scan-0323-2209.md`.

- [x] **LLM-to-JS opportunity scan** — Last done: 2026-03-24T01:09
  Read recent sessions. Any agent doing predictable, deterministic work via LLM?
  Could it be replaced with a JS handler? (See cron-graduation-process.md Stage 3.)
  If found → write proposal in workspace/improvement-proposals.md.
  Latest (2026-03-24T01:09): Bash-as-cat UP to 8.9% (from 7.1%). Optimizer #1 offender (20/49 cat calls). May 43% no-op heartbeats → sent req:bf42fb9d to add skipIfIdle. Finding at `workspace/finding-llm-to-js-scan-0324-0109.md`.

- [x] **Handler health check** — Last done: 2026-03-24T02:39
  Review existing JS handlers in agents/may/handlers/.
  Any errors in recent logs? Any handler that's not firing?
  If issues → add fix to workspace/todo.md.
  Latest (2026-03-24T02:39): Same 3 dead (convention-check, tool-quality-scan, heartbeat-context). reflect+analyze-failures stale (5-7d). Tech-lead confirmed wrapTools wiring lost. Finding at `workspace/finding-handler-health-check-0324-0239.md`.

- [x] **Proven pattern → Skill/Workflow** — Last done: 2026-03-23T23:50
  **Run via workflow**: `workflow.run("skill-lifecycle", "Scan recent sessions for proven multi-step patterns")`
  Mechanically enforces all 4 phases (discover → draft → test → deploy).
  **Deliverable**: A new or refined skill file, tested in gym, deployed to agents.
  Latest (2026-03-23T23:50): materialize-intermediate-findings DEPLOYED. 270-line SKILL.md. Skill at `agents/shared/skills/materialize-intermediate-findings/SKILL.md`.
  Skills deployed (13 total): obstacle-pivot, grep-first-reading, state-check-before-action, budget-before-act, stale-approach-fixation, coder-edit-discipline, delegation-verification, idempotent-work-detection, search-strategy-escalation, evidence-over-narrative, incremental-context-loading, request-triage-memoization, materialize-intermediate-findings.

- [x] **Tool quality review** — Last done: 2026-03-24T02:39
  Read tool-quality-report.md. Look for regression trends and persistent failure patterns.
  Latest (2026-03-24T02:39): Bash-as-cat 9.5% (↓ from 10.4%). QA 24% worst. ENOENT 77 errors/30 sessions. Bob+Optimizer top ENOENT offenders. Finding at `workspace/finding-tool-quality-review-0324-0239.md`.

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
