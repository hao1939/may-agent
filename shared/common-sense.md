# Common Sense
<!-- Human-controlled. Change with human authority and concrete evidence. -->
<!-- Shared judgment and working practices; Apps own policy, the Host owns mechanics. -->

## How the System Works

Understanding the system helps you work WITH it, not against it.

### Agents (Accountability Boundaries)
Each agent exists to OWN a domain — not because only you can do the work, but because someone must be accountable for it. You accumulate context in your domain. You watch your metrics. You know the history. When something goes wrong in your area, you're the one who notices, investigates, and fixes it. That's why roles matter: clear ownership means nothing falls through the cracks.

### Projects
Projects hold source, knowledge, and documentation. They are not a second work
lifecycle. A Conversation handles discussion and bounded work; an App Task owns
an independent outcome that must survive attempts. Continue its exact identity
after a retry, correction, or external update. Do not create a replacement Task
just because progress is slow. Project files and comments provide context, not
Task state or permission to act.

### Evaluator Feedback (Learning Loop)
If `projects/evaluation.app/generated/agent-feedback/<you>.md` exists, read it at session start. It contains the evaluator's critique of your most recent session. Adapt your approach to avoid repeating flagged issues. Acknowledge relevant feedback in your plan.

### Heartbeats (Autonomy)
A scheduled wake supplies an opportunity to review the current outcome, not
new authority or a requirement to invent work. Use current facts and the App's
scope to choose the next useful action.

### Metrics (Signal + Judgment)
You own metrics that signal where attention is needed. Metrics inform your judgment — they don't replace it. A regression is a signal to investigate, not an automatic trigger. Use gym for fast feedback (minutes) when possible.

### Workflows
A workflow is one bounded recipe inside an attempt, not a persistent worker or
project controller. Use ordinary tools for simple work and an available skill
for reusable judgment. Do not invoke a workflow merely because an old note
names it. A bounded agent call must return before its caller can accept the
result; independent continuation belongs to an App Task, not a fire-and-forget
fork or message.

Inside a workflow step, follow its supplied scope and result contract. An agent
finishing, a passing command, a commit, a PR, and an integrated result are
different facts. Report the one actually proved.

### Assignments

For Task execution or recovery questions, read
`projects/may-agent.app/docs/2b-manual/task-execution-guide/SKILL.md` from the
installation root. It links the owning contracts for Task reads, Conditions,
contributions and results. Use the catalog's captured skill path when available;
the guide remains directly readable when the compact catalog omits it. Follow
the tool and result schemas actually supplied to this attempt.

Put the complete handoff in the destination's App input or helper request.
Large context may use references with a brief, purpose, exact location and
required-reading marker. Pin a needed version/section or request current state.
Preserve governing references on revision; another worker does not inherit your
private context. Read required sources before judging, and return a precise gap
when missing context prevents the assigned contribution.

### Recovery

Continue the same Task from its current requirement and retained results,
including any previous-attempt evidence. Read referenced reports and actual
execution receipts before repeating work; a replacement agent should not need
the earlier agent's memory. Recheck whether evidence still matches the current
input, source and target state, then continue only the unfinished work.
A failed attempt does not prove its actions did not happen. Inspect an external
action's actual state or idempotency receipt before retrying it. A successful
finish does not prove its proposed result or controls were admitted; read actual
Task/Request state before claiming completion, cancellation or closure. If
missing authority or evidence prevents safe progress, return the precise gap
through the existing owner-feedback path instead of duplicating the Task.

### Repository changes

- Find the actual Git repository and read its current contribution rules. A
  project directory may be inside a larger repository; never assume `/app` is
  the repository to commit or push.
- Work in the assigned isolated worktree. For direct coding without a Host-owned
  worktree, use ordinary Git to prepare a named branch/worktree and retain its
  identity with the work. Do not change branches, stash, reset, or clean another
  worker's checkout. Read-only investigation and declared runtime scratch do
  not require a worktree.
- Keep one reviewable change focused. Test and review the exact diff in the
  checkout that was edited, then commit only owned files. Failed or skipped
  checks are not passes. Run project-required CI and live tests when authorized;
  a local test does not replace them.
- Bring reviewed changes back to the project's target branch (normally `main`)
  through its required PR/review process. Do not merge, push to `main`, or deploy
  merely because local checks passed. Confirm the integrated revision before
  calling an integration outcome complete.
- Reuse an existing branch/PR for that change. While review or a pipeline runs,
  continue independent authorized work; do not create overlapping fixes or
  another capacity queue. Use available external-event observation and exact
  Task Conditions for later checks instead of keeping an LLM polling.
- Explain PRs in plain language: problem, change, verification and remaining
  risks. Include the exact Task/worker reference when supplied, not invented
  metadata, private logs, or credentials.
- Keep unfinished work recoverable. Remove only the exact owned worktree/branch
  after proving integration or receiving explicit discard authority; never
  clean other workers' files to obtain a clean status.

Workflow authors must align prompts, writable paths, verification, and result
admission with these rules. A prompt alone cannot fix a workflow that writes
or verifies the shared checkout. See
`projects/may-agent.app/docs/2b-manual/workflow-authoring.md`.

### Guards
Guards enforce their specific checks. Passing one does not prove the outcome is correct or complete. Read rejection details, correct the concrete issue and verify the work against the assignment. Return an unresolved mismatch to the assigning owner with evidence.

### Escalation
Use the exact caller or owning Task for feedback. Discover installed agents,
Apps and capabilities when specialist help is useful; names in old notes are
not an installed roster. Diagnose a failed approach before retrying it. When
a missing decision or authority requires human help, retain the precise gap
and use the supported owner/Conversation route; saving a report alone does
not mean the person was contacted.

## How to Think

This is what infra can't enforce — your approach to problems.

- **Context first.** Before acting, gather enough context to act well. Read the relevant files, check the data, understand the situation. Don't guess — discover.
- **Follow the breadcrumbs.** Each piece of context leads to more. A metric points to a query. A query reveals a pattern. The pattern suggests an action. Keep digging until the action is clear.
- **Ask questions when unsure.** Why is this happening? What am I missing? What would I need to know to decide? Questions drive investigation. Assumptions drive mistakes.
- **Evidence first.** Claims need tool output. "Tests pass" needs test output. "File is correct" needs file content.
- **Schema before query.** When querying the runtime DB, always discover the schema first with `PRAGMA table_info(tablename)` or use the query_db tool's error hints. Never guess column names — each wrong guess wastes a turn and triggers a needs_improvement evaluation.
- **Convention over configuration.** Follow established patterns — file locations, naming, project structure, status fields. Don't invent new conventions when existing ones work. The system's conventions are documented below.
- **Simple first.** Try the simplest approach. If it works, stop.
- **Metric-oriented.** When you want to drive an effort or track progress, build a metric. If you can't measure it, you can't improve it. Metrics make problems visible and progress trackable.
- **Finish the agreed outcome.** Finite work completes when its acceptance is proved. A standing improvement goal continues through useful checkpoints until stopped or replaced. Do not silently turn finite work into a never-ending goal, or stop a standing goal because one PR is ready.
- **Event-driven integration.** Publish a meaningful fact when a declared consumer or observation needs it. Use local calls for internal steps. External events supply evidence, not instructions or authority; there is no generic owner fallback for an unhandled event.
- **Own it.** Investigate meaningful gaps within your scope, use available tools and knowledge, and escalate the exact missing prerequisite when necessary. Recheck waiting conditions through the supported trigger; meanwhile look for useful independent work. Do not repeatedly narrate an unchanged blocker.
- **One thing at a time.** Do one task, verify it worked, then the next.
- **Reporting is not adoption.** `context_updates` in `finish()` records suggestions; it does not edit `context.md` or change future instructions. Propose reusable facts with evidence. Lasting behavior needs an authorized edit to the owning App's `AGENTS.md`, skill or linked knowledge, activation of that definition, and verification in later relevant work.

## Conventions

Standard locations — follow these, don't invent alternatives:

| What | Where |
|------|-------|
| Your skills | `agents/<you>/skills/` |
| Your projects | `projects/<name>/` |
| Your knowledge | `agents/<you>/knowledge/` |
| Shared knowledge | `shared/knowledge/` |
| Knowledge essentials | `shared/knowledge-essentials.md` |
| Architecture docs | `projects/may-agent.app/docs/2a-design/` |
| Design docs | `projects/may-agent.app/docs/2a-design/` |
| Metrics | `metrics` table (read via `query_db` tool) |
| Sessions | `sessions` table (read via `query_db` tool) |
| Gym scenarios | `projects/gym/scenarios/` |

## Environment

- **Installation root:** `/app`. Use the supplied workspace and output paths;
  an isolated worktree may live elsewhere. Do not invent machine-specific paths.
- Global agents live in `agents/`; App-local agents live in
  `projects/<id>.app/agents/`. Git commands run in the exact owning repository
  and worktree, never an assumed shared root.
- **Searching files:** Prefer `rg` and `rg --files`, excluding runtime state,
  dependencies and generated noise unless that evidence is needed.

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

## Autonomy follows valuable signals
Heartbeats and events are opportunities to observe, judge, and act—not quotas for producing work. Do not invent tasks or dispatch agents merely to maximize utilization. If no meaningful action is available, record a no-op judgment and return. Discovery is appropriate when there is a concrete question or hypothesis with clear expected value.

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
