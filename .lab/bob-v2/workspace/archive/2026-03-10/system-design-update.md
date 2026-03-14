# Agent System Design

This document describes the conceptual model of the agent system — what agents are,
how they collaborate, and how the meta team drives continuous improvement.

## What is an Agent

An agent is an autonomous worker with:
- A **domain** — what it knows about (code implementation, code review, evaluation, etc.)
- A **set of tools** — what it can do (read files, write files, run commands, delegate)
- **Knowledge** — instructions and lessons that shape its behavior
- A **task** — the specific job it was given for this session

Each agent runs in its own session. It receives a task, uses its tools to accomplish it,
and produces a result. Agents communicate through delegation (task descriptions and
results) and through the shared filesystem (code, config, knowledge files).

## The Feature Team

The feature team does the actual work.

### May (Supervisor)
- **Role**: Orchestrator / Interface
- **Input**: User request (natural language), Feedback loop
- **Output**: Completed task, Answer to user, Delegation to sub-agents
- **Capabilities**: Task decomposition, Agent routing, Result synthesis, High-level planning
- **Tools**: `read`, `write`, `exec`, `subagents`, `workflow`, `cron`
- **Model**: opus

### Tech Lead (Builder)
- **Role**: Senior Implementation Lead
- **Input**: High-level design or feature request from May/Bob
- **Output**: Implemented & Tested Code, Technical decisions
- **Capabilities**: Architecture decomposition, Code implementation, Leading Coder+QA teams
- **Tools**: `read`, `write`, `exec`, `workflow`, `subagents`
- **Model**: opus

### Coder (Builder)
- **Role**: Software Engineer
- **Input**: Specific implementation task (from May/Tech Lead)
- **Output**: Code changes (uncommitted), Test results
- **Capabilities**: Writing code, Refactoring, Debugging, Running tests
- **Tools**: `read`, `write`, `exec`
- **Model**: opus

### QA (Builder)
- **Role**: Quality Assurance / Validator
- **Input**: Code changes (diff), Task description
- **Output**: Verdict (PASS/FAIL/CONDITIONAL), Specific issues list
- **Capabilities**: Code review, Type checking, Test verification, Static analysis
- **Tools**: `read`, `write`, `exec`
- **Model**: gpt-5.2

### Master (Builder)
- **Role**: CLI Power User
- **Input**: Complex refactoring or large-scale codebase changes
- **Output**: Codebase modifications via CLI tools
- **Capabilities**: Deep codebase navigation, Automated refactoring via `claude-code`/`gemini-cli`
- **Tools**: `claude-code`, `gemini-cli` (No direct file write)
- **Model**: opus

### Scout (Scholar)
- **Role**: Researcher
- **Input**: Research topic, arXiv ID, Technical question
- **Output**: Synthesis report, Literature review, Tool analysis
- **Capabilities**: Deep web research, Academic paper analysis, Cross-referencing
- **Tools**: `read`, `write`, `exec`
- **Model**: opus

### Amy / Amy-Kimi (Researcher)
- **Role**: Content Researcher
- **Input**: Topic keywords (English/Chinese)
- **Output**: Content summary, Trend analysis
- **Capabilities**: Social media (XHS) exploration, Chinese content analysis (Kimi variant)
- **Tools**: `read`, `write`, `exec`
- **Model**: opus / kimi

## How Agents Work Together

Agents collaborate through **delegation**. May creates sub-agent sessions:

```
User gives task to May
  May delegates "implement X" to coder
  Coder works, finishes
  May delegates "review coder's changes" to QA
  QA reviews, reports verdict
  May examines QA report
  May commits (or re-delegates to coder if QA found issues)
  May reports result to user
```

Each delegation creates a **session**. Sessions are linked via **parent-child
relationships** using `parentSessionId`. When May delegates to coder, coder's session
is a child of May's session. The evaluator finds unevaluated child sessions of a
parent session to build task tree evaluations. Deeper chains are supported (coder
delegates to sub-agents), but evaluation currently scans direct children of a given
parent, not full recursive descendants.

### Task Completion Notifications

The manager owns **task completion delivery** (see `task-completion-notifications.md`).
Agents do not need to register callbacks or poll for results.

1. **Sub-agent finishes**: The manager detects completion.
2. **Notification delivery**: The manager sends a `[task-complete]` message to the parent session.
3. **Cross-process delivery**: If the parent is in another process, the manager writes to `.state/undelivered-notifications.jsonl`, which the parent process watches.

This ensures reliable delivery even across process restarts or detached execution modes.

### Slow Path vs Fast Path

**Slow path**: May delegates step by step — one call per sub-agent, examining each
result before deciding next steps. Flexible but verbose. This is the standard
approach — May uses direct delegation by default.

**Fast path (workflows)**: Pre-defined sequences of agent calls. A workflow like
"implement-and-review" runs coder→QA automatically without May making individual
decisions. If QA rejects with fixable issues, the workflow retries once. If the
rejection is critical (wrong task, policy violation, behavioral regression), the
workflow escalates immediately without retry. Faster but less adaptive. May or the
optimizer chooses when to use a workflow vs direct delegation.

### Escalation Model

Failures propagate upward through the agent chain: sub-agent → agent → human.
The mechanism differs by layer but the pattern is uniform — errors bubble up
until something handles them.

**Workflow layer** — `ctx.escalate(reason, context)`. When a workflow step fails
or a sub-agent errors, the workflow calls `ctx.escalate()` which returns a
structured result `{type: "escalated", reason, steps}` to the calling agent.
The workflow decides per-step whether to retry (with different input) or
escalate. One retry then escalate is the standard pattern.

**Delegation layer** — `TaskResult` with `status: "error"`. When a sub-agent
is invoked via `delegate`, the caller gets back a JSON result containing the
error. The calling agent reads it and decides: retry with different arguments,
delegate to a different agent, or report upward. Retrying the same call with
the same arguments is not valid (hard constraints are facts).

**Agent → human** — The interface agent (May, Bob) reports to the human via
text. When the interface agent can't resolve a failure, it reports what
happened and what it tried. Bob also queues unresolved design questions in
`pending-decisions.md` for async human input.

## Design Principles

### No Silent Failures

When something fails, the agent must know **why**. Tools aim to return explicit error
messages rather than null or empty results with no explanation. Silent failures force
agents to guess what went wrong, which wastes calls on blind recovery attempts.

This applies everywhere: tool results, delegation results, file operations. If a
tool can't do what was asked, it says what happened and why. Note that empty output
can be valid data (e.g., `find` returning no matches) — the system distinguishes
between "no results" and "something went wrong."

### Run First, Then Design

Don't over-design upfront. Let agents run on real tasks, observe what actually goes
wrong, then design solutions based on real data. The entire optimization loop is
built on this principle — evaluate real behavior, not hypothetical scenarios.

This means:
- New agents start with minimal knowledge and simple tools
- Problems are identified from actual session transcripts, not speculation
- Fixes are validated by measuring whether scores improve on subsequent runs
- Premature optimization of agent behavior is avoided

### Role-Based Evaluation

The system is designed around **roles**. Evaluation asks two questions in order:

1. **Did the agent play the right role?** A coder that tries to review code is
   playing the wrong role. A supervisor that writes code directly is playing the
   wrong role. Role violations are the most serious problem.

2. **Did it play that role well?** Given that it stayed in its role, how well did
   it perform? A coder that path-guesses is playing the right role badly. A QA that
   flags non-issues is playing the right role badly.

This two-level view guides both evaluation (what to score) and optimization (what
to fix). Role violations are addressed through structural enforcement where possible
(e.g., tool constraints that prevent an agent from performing actions outside its
role). Poor role execution needs better knowledge or tools.

## The Meta Team

The meta team improves the feature team's performance over time:

### Evaluator (Supervisor)
- **Role**: Performance Analyst
- **Input**: Session transcript, Agent config
- **Output**: Scorecard (Efficiency/Quality), Issue list
- **Capabilities**: Structured evaluation, Pattern recognition, Metric calculation
- **Tools**: `read`, `write`, `exec`
- **Model**: gpt-5.2

### Optimizer (Builder)
- **Role**: System Improver
- **Input**: Evaluation data, Bob's brief
- **Output**: Code/Prompt/Config changes (committed)
- **Capabilities**: Root cause analysis, System modification, Self-correction
- **Tools**: `read`, `write`, `exec`, `subagents`, `workflow`
- **Model**: opus

### Bob (Philosopher)
- **Role**: Architect & Steward
- **Input**: Human intent, Design proposals, System drifts
- **Output**: Design reviews, Philosophy updates, Meta-loop briefs
- **Capabilities**: System design, Philosophy stewardship, Meta-level synthesis
- **Tools**: `read`, `write`, `exec`, `subagents`
- **Model**: gemini-3-pro

### Coach (Philosopher)
- **Role**: Trainer
- **Input**: Target agent, Training scenario
- **Output**: Coaching report, Live intervention
- **Capabilities**: Real-time observation, Feedback generation, Scenario design
- **Tools**: `read`, `write`, `exec` (read-only), `subagents`, `workflow`
- **Model**: opus

### Agent as Feature Unit

Each agent is treated as an independent **feature unit** for evaluation and
improvement. Like a team member in a code review — you evaluate their contribution,
not the whole team's output.

This means:
- Primary scoring is per-agent; an overall task outcome is also recorded for
  triage and convenience
- Issues are attributed to the agent whose action caused them
- Improvements target specific agents
- An agent's track record over time reveals patterns

### Evaluation: Per-Agent by Responsibility

The evaluator scores each agent on what **it controls**. The key question is:
"Could this agent have done better given what it received?"

**Efficiency** — Signal-to-noise ratio of tool usage. Did the agent waste calls?
Path-guess? Re-read files unnecessarily? Do redundant work?

**Quality** — Did the agent produce correct, complete output for its task?

**Attribution** — Waste gets blamed to the agent whose action caused it:

| Situation | Blame |
|-----------|-------|
| Coder guesses file paths instead of exploring | Coder (efficiency) |
| Coder wastes time because May gave a vague task | May (delegation quality) |
| QA flags a non-issue, causing a wasteful coder retry | QA (false positive) |
| Task fails because May picked the wrong agent | May (decision quality) |
| Coder ignores context already provided in the task | Coder (didn't read the task) |

The principle: if the input was good but the output was bad, blame the agent.
If the input was bad, blame the upstream agent that provided it.

### The Optimization Loop

```
Task completes
  → Evaluator scores each agent in the task tree
  → Scores accumulate in evaluation data
  → Optimizer reads evaluations, finds patterns
  → Optimizer identifies highest-impact problem
  → Optimizer implements a fix targeting the specific agent
  → Next task runs with the fix in place
  → Evaluator measures whether scores improved
```

### One Fix Per Optimizer Run

The optimizer targets **one problem per run**. If you fix three things at once and
scores improve, you don't know which fix helped. Isolate changes:

- Identify the highest-impact problem (worst agent, worst metric, most recurring)
- Implement one targeted fix
- Verify it compiles and tests pass
- Commit
- Let the next evaluation cycle measure the effect

This makes the optimization loop debuggable. If scores get worse after a fix, you
know exactly which change caused it and can revert.

### Fix Hierarchy

The optimizer prefers **structural fixes** over behavioral instructions:

1. **Structural** — Make the wrong thing impossible. Change tool code so the error
   can't happen. Example: exec tool auto-injects working directory in error messages
   so agents never lose orientation.

2. **Environmental** — Remove the need for the behavior. Inject runtime facts into
   the system prompt. Pre-populate context with concrete data.

3. **Reductive** — Remove noise. Consolidate duplicate lessons. Shorten prompts.
   Less text = less dilution of important instructions.

4. **Behavioral** — Add instructions to domain.md. Least effective because agents
   don't always follow instructions. Use only when no structural fix exists.

### Knowledge Hot-Reload

Agent knowledge (domain.md, lessons.md) is read fresh at the start of each session.
Changes take effect on the next session without restarting the system. This means
the optimizer's changes are immediately active.

### Shared Knowledge Library

The system maintains a shared knowledge library — a curated collection of documents
about the system's architecture, team composition, and common patterns. It serves
three purposes:

1. **Common ground** — Agents that need system-level context (May, evaluator,
   optimizer) share the same understanding of how things work, what exists, and
   what the constraints are. Without this, each agent builds its own mental model
   from scratch every session.

2. **Selective inclusion** — Not every agent needs every document. Each agent's
   system prompt includes only the docs relevant to its role. Coder and QA don't
   need to know how the optimization loop works — they just need their task. May,
   evaluator, and optimizer do need that context to make good decisions.

3. **Living documentation** — The library evolves with the system. When agents are
   added, models change, or workflows are restructured, the relevant docs get
   updated. The optimizer can update shared docs as part of its improvement work.
   Design reviews can identify gaps. The library stays accurate because it's
   maintained as part of normal operation, not as an afterthought.

The library is organized by topic (architecture, team details, patterns) rather
than by consumer. Agents browse the library when they need context beyond what's
in their prompt — the full library is always accessible via the filesystem.

### Document Ownership

Every document has an **owner** — the agent responsible for keeping it accurate
and up to date. Ownership means:

- The owner updates the doc when the system changes
- Other agents can propose changes, but the owner decides what goes in
- If a design review finds a doc is stale, the owner is responsible for fixing it

The shared knowledge library is owned by the **optimizer**. The optimizer already
maintains agent knowledge (domain.md, lessons.md, tools, workflows) as part of
its improvement work. The shared library is the system-level extension of that
responsibility — when the optimizer changes team composition, adds automation,
or restructures workflows, it updates the shared docs to match.

### Evaluation Data

Evaluations are saved per session ID. Each contains:
- Which agent was evaluated
- Efficiency and quality scores
- Specific issues identified
- Failure chains (auto-extracted error→recovery sequences, identified via heuristic
  pattern matching — signals to aid diagnosis, not definitive causal analysis)
- Overall task-level scores (efficiency, quality, verdict, result delivered)

The optimizer reads this data to find patterns: which agent scores worst, which
issues recur, which failure chain root causes keep appearing.

## Session Lifecycle

The system uses a binary session model: **Chat** (User Interface) and **Task** (Worker).

### Chat Session (The Interface)
- **Role**: Maintains the continuous thread of "User Intent".
- **Lifespan**: Long-lived, persists across restarts, restores from disk.
- **Count**: Exactly ONE active interface agent (default: May).
- **Behavior**: Starts on boot. Enters "idle" state when waiting for user input. Supports `followUp` for notifications.
- **Mechanism**: `persistent: true`.

### Task Session (The Workers)
- **Role**: Executes a specific unit of work (sub-agent, cron job, CLI tool).
- **Lifespan**: Ephemeral. Spawns → Works → Dies. No idle state.
- **Count**: Unlimited.
- **Behavior**: Always starts fresh. Reads `SOUL.md` and `todo.md`, executes the task, writes `journal.md`, and exits.
- **Mechanism**: `persistent: false`. The filesystem (`todo.md`, `journal.md`) is the memory.

### The Runner

The runner manages this distinction. It restores the single Interface Agent session at startup. All other requests (cron, sub-agents, CLI) spawn fresh Task Sessions.

## Agent Team

Concrete details about who's on the team, what they have, and how the runner works.

## Model Assignment

Four model families provide independent perspective.
- **Opus**: Tech Lead, May, Coder, Optimizer, Master, Coach, Amy, Scout.
- **GPT-5.2**: QA, Evaluator (Reviewers).
- **Gemini 3 Pro**: Bob (Design Philosophy).
- **Kimi**: Amy-Kimi (Chinese Language Research).

## Runner

The runner is agent-agnostic. Any registered agent can serve as the interface agent:

- **`AGENT=may`** (default) — May as persistent interface, delegates to team
- **`AGENT=bob`** — Bob as persistent interface, for meta-loop work
- **`AGENT=coach`** — Coach as persistent interface, for training sessions
- **`AGENT=master`** — Master as persistent interface, for direct CLI tool work

The interface agent gets a persistent session with compaction. All other agents run
as ephemeral sessions.

### Input Routing

- **Default input** goes to the interface agent's persistent session
- **`@agent message`** runs a fresh ephemeral session on any agent directly
- **Socket `run` command** does the same: `{"type":"run","agent":"bob","message":"..."}`
- **Socket `input` command** sends to the interface agent

### External Scheduling

Recurring tasks use cron.json (agent-owned cron handlers) or external crontab:
```
# Run meta-loop every 30 minutes
*/30 * * * * echo '{"type":"run","agent":"bob","message":"Run the meta-loop"}' | socat - UNIX-CONNECT:/path/to/.state/may.sock
```

## Workflows

**implement-and-review** — Both May, Tech Lead, and Optimizer have this. Coder implements → QA
reviews → one retry on FAIL/CONDITIONAL → escalate if still failing.

**design-review** — Optimizer only. Evaluator and optimizer independently review
shared docs, then cross-respond.

**coaching-session** — Coach only. Spawns a detached session for the coachee and monitors it.

## Knowledge Hot-Reload

All agent knowledge (SOUL.md, DOMAIN.md, TOOLS.md, LESSONS.md, skills/) is read
fresh at session start. Changes take effect on the next agent session without
restarting.

## Constraints

- **May delegates code changes** — code goes through tech-lead/master, not written directly
- **Coder never commits** — supervisor handles git add/commit after QA review
- **Master cannot write files** — must use CLI agents (claude-code, gemini-cli)
- **One fix per optimizer run** — isolates changes for measurable evaluation
- **Persistent sessions use compaction** — threshold 70%, keep ratio 40%
