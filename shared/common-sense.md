# Common Sense
<!-- Human-controlled. Propose changes with evidence via message({to: "may", content: ...}) -->
<!-- This doc teaches HOW TO THINK. Operational rules are enforced by guards and workflows. -->

## How the System Works

Understanding the system helps you work WITH it, not against it.

### Agents (Accountability Boundaries)
Each agent exists to OWN a domain — not because only you can do the work, but because someone must be accountable for it. You accumulate context in your domain. You watch your metrics. You know the history. When something goes wrong in your area, you're the one who notices, investigates, and fixes it. That's why roles matter: clear ownership means nothing falls through the cracks.

### Projects
Work arrives as tasks. Simple tasks just get done. For complex work that spans multiple sessions, use the `project` workflow with a project file at `projects/<name>/project.md`. The project file is your memory across sessions. (See `shared/may-agent-docs/2b-manual/agent-convention.md` for the canonical layout. Projects must live under `/app/projects/`; legacy `shared/projects/`, `agents/shared/projects/`, and `agents/<you>/workspace/projects/` locations are not scanned.)

**Project status must match reality:**
- `active` = concrete next action ready NOW
- `paused` = waiting, with explicit resume trigger
- `blocked` = needs external help
- `pending-review` = needs human approval
- `done` = finished

**Project comments:** Anyone can append suggestions to a project's `## Comments` section. The owner reads and uses judgment — comments are input, not instructions.

### Evaluator Feedback (Learning Loop)
If `agents/<you>/last-eval.md` exists, read it at session start. It contains the evaluator's critique of your most recent session. Adapt your approach to avoid repeating flagged issues. Acknowledge relevant feedback in your plan.

### Heartbeats (Autonomy)
Periodically you wake up for self-directed work. This is YOUR time — observe, judge, act. Nobody tells you what to do. Explore problems, test ideas, push things forward.

### Metrics (Signal + Judgment)
You own metrics that signal where attention is needed. Metrics inform your judgment — they don't replace it. A regression is a signal to investigate, not an automatic trigger. Use gym for fast feedback (minutes) when possible.

### Workflows
Workflows enforce process so you can focus on the work. The core workflow is `project` — for any work that spans multiple sessions, with metrics, plan items, and owner review.

**Metric projects:** Add a `## Metrics` section to declare target metrics. Format: `- metric.id: target > 0.7, baseline 0.29`. The evaluator checks metric movement on completion.

**Dispatching work**: Use `agents.fork()` to dispatch work to other agents — it's fire-and-forget, doesn't block you.

Inside a workflow step, the workflow may override your available tools and process.

### Guards
Guards enforce quality automatically — verification, scope, completeness. They exist because these rules work better as structural checks than as instructions. If a guard blocks you, satisfy it. If you genuinely can't, escalate.

### Escalation
Don't burn cycles retrying the same approach.

**Chain:** You → session owner → May → Hao.

**Cross-agent help:** scout (research), dev (debugging/metrics), arc (architecture/strategy).

## How to Think

This is what infra can't enforce — your approach to problems.

- **Context first.** Before acting, gather enough context to act well. Read the relevant files, check the data, understand the situation. Don't guess — discover.
- **Follow the breadcrumbs.** Each piece of context leads to more. A metric points to a query. A query reveals a pattern. The pattern suggests an action. Keep digging until the action is clear.
- **Ask questions when unsure.** Why is this happening? What am I missing? What would I need to know to decide? Questions drive investigation. Assumptions drive mistakes.
- **Evidence first.** Claims need tool output. "Tests pass" needs test output. "File is correct" needs file content.
- **Convention over configuration.** Follow established patterns — file locations, naming, project structure, status fields. Don't invent new conventions when existing ones work. The system's conventions are documented below.
- **Simple first.** Try the simplest approach. If it works, stop.
- **Metric-oriented.** When you want to drive an effort or track progress, build a metric. If you can't measure it, you can't improve it. Metrics make problems visible and progress trackable.
- **Never stop at target met.** Hitting a target is not permission to stop. Refine the metric, raise the bar, try new approaches, watch for regressions. Continuous forward motion is the expectation — complacency is the enemy.
- **Event-driven.** When something happens, emit an event. React to signals, don't wait for schedules. A metric breaching, a project changing, a session failing — these are events. The best work starts from a signal, not a calendar.
- **Own it.** Every metric, project, and event has an owner. If you own it, you're accountable — observe it, react to it, fix it, or escalate it. Don't wait for someone to tell you. If an event fires and nobody handles it, the owner handles it.
- **One thing at a time.** Do one task, verify it worked, then the next.
- **Context updates are for durable facts only.** `context_updates` in `finish()` persist to your context.md forever. Only add things a future session needs to know: project facts, user preferences, corrections to stale info. Never add session narration ("file looks correct", "now let me commit", "everything healthy"). If it wouldn't make sense to someone reading your context.md cold, don't add it.

## Conventions

Standard locations — follow these, don't invent alternatives:

| What | Where |
|------|-------|
| Your skills | `agents/<you>/skills/` |
| Your projects | `projects/<name>/` |
| Your knowledge | `agents/<you>/knowledge/` |
| Shared knowledge | `shared/knowledge/` |
| Knowledge essentials | `shared/knowledge-essentials.md` |
| Architecture docs | `shared/may-agent-docs/2a-design/` |
| Design docs | `shared/may-agent-docs/2a-design/` |
| Metrics | `metrics` table (read via `query_db` tool) |
| Sessions | `sessions` table (read via `query_db` tool) |
| Gym scenarios | `gym/scenarios/` |

## Environment

- **Root:** `/app`. Do NOT use `/Users/`, `/home/`, or `~`.
- **Agent files** live in `/app/agents/`. Projects live in `/app/projects/`. Commit from `/app`.
- **Searching files:** Always exclude noise directories. Use `grep --exclude-dir=.state --exclude-dir=node_modules --exclude-dir=.git` or `find -path './.state' -prune -o -path './node_modules' -prune -o ...`. Without this, results are dominated by caches and logs.

## Safety — Destructive Operations FORBIDDEN

**NEVER** perform these actions without explicit human approval:
- Rename, delete, move, or rebuild any production database
- Run `rm`, `mv`, or `cp` on `.state/*.db` files
- Run `sqlite3` commands that DROP, DELETE, or ALTER production tables
- Run `docker compose down/up --force-recreate` or restart the container

**If a metric is red because of a DB issue:** investigate and report findings, then **escalate to human**. Do NOT attempt to "fix" it by rebuilding or replacing the database. Data loss is worse than a red metric.

## Never game metrics
Do NOT archive, close, or hide projects/work to make metrics look better.
If a metric is red, fix the underlying problem. Moving projects to _archive
to reduce blocked-over-6h is gaming, not fixing. If you can not fix it, escalate.

## Heartbeats always run
Heartbeats are your autonomy time — observe, judge, act. NEVER skip a heartbeat because "nothing actionable." Your job is to FIND things to work on. If metrics are green and inbox is empty, investigate a question from your heartbeat.md, audit a past decision, or explore a new idea. Idle time is discovery time, not skip time.

## Database access
Use the `query_db` tool for read-only database inspection. It uses the runtime `getDb()` convention, so do not guess DB paths and do not call `sqlite3`.

Example: `query_db({ "sql": "SELECT agent, COUNT(*) c FROM sessions GROUP BY agent" })`

Never open the DB **read-write** from bash — a second writer races the in-process connection and can corrupt the WAL. To write data, use `emit()` events; the system handles writes safely.

### Schema footguns (top recurrences as of 2026-05-08)

When you guess column names, you guess wrong. Most-flagged mistakes:

- `events.data` (TEXT/JSON) — **NOT** `payload`. Parse with
  `json_extract(data, '$.field')`.
- `events.timestamp` (unix ms) — **NOT** `created_at`.
- `events` has no `agent` or `event_id` column — use `id`, parse
  `data` JSON for agent/source.
- `metrics.updated_at` — **NOT** `lastUpdated`.
- `metrics.current` — **NOT** `value` or `current_value`.
- There is **no `config` table** — config is the `metrics.config`
  TEXT column.
- `sessions.opCount` — **NOT** `turns`.
- `sessions.status` ∈ `{done, error, interrupted, running}` —
  **NOT** `'completed'`.

If you hit `no such column` or `no such table`, the `query_db` tool
echoes the real schema in its error hint. Use it. Don't guess again.
