# Optimizer's Periodic Tasks

Track when each task was last done. Pick the most overdue one during heartbeat step 3.

## Per heartbeat (do one, rotate)
- [ ] **Analysis review** — Last done: never
  Read agents/bob/workspace/analysis.md or recent Bob synthesis outputs.
  Any findings that need optimization work? Cost issues? Efficiency problems?
  If found → add specific task to workspace/todo.md.

- [ ] **Cost outlier scan** — Last done: never
  Check recent evaluations — any sessions > $0.15?
  What caused the high cost? Too many turns? Large tool calls? Model choice?
  If pattern found → design fix, add to workspace/todo.md.

- [ ] **LLM-to-JS opportunity scan** — Last done: never
  Read recent sessions. Any agent doing predictable, deterministic work via LLM?
  Could it be replaced with a JS handler? (See cron-graduation-process.md Stage 3.)
  If found → write proposal in workspace/improvement-proposals.md.

- [ ] **Handler health check** — Last done: never
  Review existing JS handlers in agents/may/handlers/.
  Any errors in recent logs? Any handler that's not firing?
  If issues → add fix to workspace/todo.md.

## Weekly
- [ ] **Improvement proposals review** — Last done: never
  Read workspace/improvement-proposals.md. Any proposals ready to implement?
  Prioritize by impact. Pick one and start implementation.

---

## How to use this file
1. Read this file during heartbeat step 3
2. Find the most overdue task
3. Do it
4. Update "Last done" date
