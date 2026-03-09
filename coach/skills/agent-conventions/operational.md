# Operational Conventions

Cron, heartbeat, runtime patterns — how agents operate day-to-day.

## O1: Central Cron via May (Required, All)

All cron jobs live in `agents/may/cron.json`. May is the central scheduler.
Individual agents do NOT have their own cron.json (legacy `cron.json` files
may exist but are not used by the current runner).

To add recurring work for an agent:
1. Add an entry to `agents/may/cron.json`
2. Set `agent` to the target agent name
3. Include `[cron:<job-name>]` prefix in the message
4. Set `enabled: true` (or `false` to stage without firing)

Takes effect on next restart or reload.

## O2: Cron Message Format (Required, All)

Cron messages must include a `[cron:<job-name>]` prefix so the receiving
agent knows this is automated, not human input.

Be specific in the message — include file paths, delegate targets, scope limits.
Don't say "do your thing" — say "Read agents/bob/workspace/todo.md, pick the
top unchecked item, do it."

## O3: Heartbeat Is a Wake-Up (Required, All)

A heartbeat message is just a trigger — it wakes the agent. The agent should
know what to do from its own context (SOUL.md, DOMAIN.md, heartbeat.md, todo.md).

A well-designed agent needs a minimal heartbeat message. If the heartbeat message
has to be a detailed script, the agent's internal knowledge is insufficient.

The heartbeat message should point to `agents/<name>/heartbeat.md` which contains
the structured decision tree (check notifications → check todo → check periodic
tasks → find improvement work → close out).

## O4: Adhoc vs Periodic Execution (Required, All)

Agent tasks divide into exactly two types:

**Adhoc** — has a natural end (drain a TODO queue, answer a question, fix a bug).
Correct behavior: drain completely before resting. Don't stop mid-task because
a heartbeat boundary arrived.

**Periodic** — never fully done (scan feeds, explore topics, review recent work).
Correct behavior: one cycle, then rest. Don't try to process everything forever.

## O5: Heartbeat → JS Handler Lifecycle (Recommended, All)

When an agent discovers a pattern during heartbeat-driven exploration:

1. **Explore** — Agent tries various approaches in heartbeat sessions (expensive, creative)
2. **Prove** — Pattern works reliably across multiple sessions
3. **Offload** — Codify as a JS cron handler (cheap, deterministic, no LLM needed)
4. **Audit** — Heartbeat now just verifies the handler works correctly

Examples of successfully offloaded patterns:
- `daily-brief` — was agent work, now a JS handler that reads files + formats
- `coaching-report` — pure computation over evaluation data
- `evaluate-sessions` — scan for unevaluated sessions, dispatch evaluator

Never use a heartbeat for a task that could be a cron handler.
Never use a cron handler for a task that needs judgment.

## O6: Per-Agent TODO (Required, All)

Each agent owns its own `workspace/todo.md`. Items in an agent's todo are
tasks only that agent will act on.

Cross-agent or system-wide items go in `agents/may/workspace/todo.md`.
Don't pollute the global space with agent-specific tasks.

When one agent needs another to do something, add it to the target agent's
todo.md (or delegate via subagents if it's urgent).

## O7: Cognitive Work Only (Required, All)

Agents exist for reasoning, exploration, creation, and judgment. They should
never do mechanical infrastructure work:

- Monitoring system health or service status
- Checking other agents' status or liveness
- Counting their own failures or tracking retry budgets
- File maintenance, cleanup, or housekeeping chores

If infrastructure detects a problem, it writes to the agent's `workspace/todo.md`.
The agent then responds with *cognitive* work — diagnosing, deciding, fixing —
not the detection.

Rule of thumb: if `setTimeout` or a JS handler can do it, an agent shouldn't.

## O8: Evaluate Before Apply (Required, Coach, Optimizer)

Never push a convention, practice, knowledge update, or systematic change to
agents without first testing it. The sequence is:

1. **Observe** — notice a pattern in evaluation data, session transcripts, or agent behavior
2. **Hypothesize** — draft the convention/fix/improvement
3. **Test** — run it against real data, design an exercise, or verify via convention-review workflow
4. **Apply** — push to agents only after the test confirms it works

Skipping step 3 is how bad conventions propagate. A convention that sounds
reasonable but doesn't match reality is worse than no convention — it teaches
agents to ignore rules.

For coach: before adding a convention to the library, verify it against at
least 2-3 recent sessions. Does the pattern actually occur? Would following
the convention have improved the outcome?

For optimizer: before applying a fix, verify the original problem exists in
current data (not just historical). Problems sometimes resolve themselves
through other changes.

See philosophy.md #47.
