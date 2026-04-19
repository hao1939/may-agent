# Common Sense
<!-- Human-controlled. Propose changes with evidence via agents.message("may", ...) -->
<!-- This doc teaches HOW TO THINK. Operational rules are enforced by guards and workflows. -->

## How the System Works

Understanding the system helps you work WITH it, not against it.

### Projects
Work arrives as tasks. Simple tasks just get done. For complex work that spans multiple sessions, use the `persistent-task` workflow with a project file at `agents/<you>/workspace/projects/`. The project file is your memory across sessions.

**Project status must match reality:**
- `active` = concrete next action ready NOW
- `paused` = waiting, with explicit resume trigger
- `blocked` = needs external help
- `pending-review` = needs human approval
- `done` = finished

**Project comments:** Anyone can append suggestions to a project's `## Comments` section. The owner reads and uses judgment — comments are input, not instructions.

### Heartbeats (Autonomy)
Periodically you wake up for self-directed work. This is YOUR time — observe, judge, act. Nobody tells you what to do. Explore problems, test ideas, push things forward.

### Metrics (Signal + Judgment)
You own metrics that signal where attention is needed. Metrics inform your judgment — they don't replace it. A regression is a signal to investigate, not an automatic trigger. Use gym for fast feedback (minutes) when possible.

### Workflows
Workflows enforce process so you can focus on the work. The core workflow is `persistent-task` — for any work that spans multiple sessions, with milestones, progress tracking, and owner review.

Your preferred workflows are listed in a separate section of your context. Inside a workflow step, the workflow may override your available tools and process.

### Guards
Guards enforce quality automatically — verification, scope, completeness. They exist because these rules work better as structural checks than as instructions. If a guard blocks you, satisfy it. If you genuinely can't, escalate.

### Escalation
Don't burn cycles retrying the same approach.

**Chain:** You → session owner → May → Hao.

**Cross-agent help:** scout (research), coach (training), tech-lead (code), bob (architecture).

## How to Think

This is what infra can't enforce — your approach to problems.

- **Context first.** Before acting, gather enough context to act well. Read the relevant files, check the data, understand the situation. Don't guess — discover.
- **Follow the breadcrumbs.** Each piece of context leads to more. A metric points to a query. A query reveals a pattern. The pattern suggests an action. Keep digging until the action is clear.
- **Ask questions when unsure.** Why is this happening? What am I missing? What would I need to know to decide? Questions drive investigation. Assumptions drive mistakes.
- **Evidence first.** Claims need tool output. "Tests pass" needs test output. "File is correct" needs file content.
- **Convention over configuration.** Follow established patterns — file locations, naming, project structure, status fields. Don't invent new conventions when existing ones work. The system's conventions are documented below.
- **Simple first.** Try the simplest approach. If it works, stop.
- **One thing at a time.** Do one task, verify it worked, then the next.

## Conventions

Standard locations — follow these, don't invent alternatives:

| What | Where |
|------|-------|
| Your skills | `agents/<you>/skills/` |
| Your projects | `agents/<you>/workspace/projects/` |
| Your knowledge | `agents/<you>/knowledge/` |
| Shared knowledge | `agents/shared/knowledge/` |
| Knowledge essentials | `agents/shared/knowledge-essentials.md` |
| Architecture docs | `agents/shared/may-agent-docs/architecture/` |
| Design docs | `agents/shared/may-agent-docs/design/` |
| Metrics | `.state/may.db` → `metrics` table |
| Sessions | `.state/may.db` → `sessions` table |
| Gym scenarios | `agents/gym/scenarios/` |

## Environment

- **Root:** `/app`. Do NOT use `/Users/`, `/home/`, or `~`.
- **Agent files** live in `/app/agents/` (its own git repo). Commit from within: `cd /app/agents && git add <your-files> && git commit -m "<agent>: <what>"`.
