# Process Automation

**Owner:** optimizer
**Goal:** Automate repetitive agent tasks that waste budget every session.
**Created:** 2026-04-16
**Status:** Active
**Master project:** [system-evolution.md](../../may/workspace/projects/system-evolution.md) → Gap 5
**Source feedback:** [bob](../../bob/workspace/system-gaps.md), [optimizer](../system-gaps.md), [scout](../../scout/workspace/system-gaps.md), [tech-lead](../../tech-lead/workspace/system-gaps.md), [coach](../../coach/workspace/system-gaps.md)
**Tracked metrics:** `optimizer.tool-adoption`

## Why
Agents manually repeat templated work every session: Bob creates hypothesis files by hand, optimizer rewrites the same SQL queries, scout manages counters in prose. Each repetition costs 3-5 ops that a script could do in 1.

## Milestones

- [ ] **Bob: template scripts** — `new-hypothesis.sh`, `new-experiment.sh`, `new-ke.sh` — scaffold files with correct format, auto-increment IDs, link to related entries.
- [ ] **Optimizer: saved query library** — A `.sql` file or script with common queries (session stats, agent ops, error rates). Stop rewriting from scratch.
- [ ] **Scout: structured counter management** — Move paper counters, search state, and tracking out of todo.md prose into a machine-readable file.
- [ ] **Tech-lead: delegation templates** — Standard task descriptions for common coder dispatches (fix test, implement feature, refactor). Reduce delegation overhead.
- [ ] **Coach: experiment templates** — Quick-setup templates for common experiment types so coach doesn't rebuild scaffolding each time.

## Progress Log
- **2026-04-16**: Optimizer saved query library DONE — `agents/optimizer/workspace/saved-queries.sh` with 6 commands (session-stats, high-op, error-sessions, workflow-adoption, agent-cost, quality-scores). All tested and working.

### Iteration 1 — 2026-04-16T12:40:06.023Z
**Worker task**: Iteration 1 — work toward goal
**Worker result**: **Status:** done (3m54s)

**Files modified:**
- DELIVERABLES_CHECKLIST.md
- workspace/repetitive-task-analysis.md

**Agent response:**
Now verify the checklist and finish:
**Files touched**: (see worker session)
