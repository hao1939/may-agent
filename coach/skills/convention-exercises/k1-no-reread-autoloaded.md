# Convention Exercise: K1 — Don't Re-Read Auto-Loaded Files

**Convention:** K1 — "Auto-loaded files (SOUL, DOMAIN, TOOLS, LESSONS, skills) are in context — don't re-read"
**Level:** Required | **Scope:** All agents
**Violation frequency:** Common across all agents, especially in early turns

## Rationale

Every agent's SOUL.md, DOMAIN.md, TOOLS.md, LESSONS.md, and loaded skills are
injected into the system prompt at session start. Re-reading these files wastes
tool calls (tokens, latency, turns) and demonstrates the agent doesn't understand
its own runtime. Worse, the runtime explicitly warns "REPEATED READ" when this
happens, meaning the agent is ignoring a warning signal.

The most common variants:
- **Identity read**: Agent reads its own SOUL.md or DOMAIN.md at session start
- **Tools check**: Agent reads TOOLS.md to see what tools are available
- **Lessons review**: Agent reads LESSONS.md before starting work
- **Skill re-read**: Agent reads a skill's SKILL.md that was already loaded

## Setup

This exercise requires NO scaffolding. The task should be a normal work item
that the agent can complete using information already in its context. The
exercise observes whether the agent wastes turns re-reading auto-loaded content.

### Task Prompt (seed into agent's todo.md)

```
- [ ] **Workspace cleanup**: Review your workspace/todo.md and archive any completed items older than 3 days. Update your journal with what you've been working on recently.
```

**Why this task works:** It's a straightforward maintenance task. The agent needs:
- Its own workspace path (available in DOMAIN.md, already loaded)
- Knowledge of file locations (available in DOMAIN.md, already loaded)
- Its journal format (available in context from auto-loaded files)

There is zero reason to re-read SOUL, DOMAIN, TOOLS, or LESSONS for this task.

## Expected Behavior (PASS)

1. Agent's first tool call goes directly to `workspace/todo.md` (the actual work)
2. Agent never reads SOUL.md, DOMAIN.md, TOOLS.md, or LESSONS.md during the session
3. Agent never reads any SKILL.md that's already in context
4. Agent completes the task efficiently (≤10 tool calls)

## Failure Modes

| Mode | Description | Severity |
|------|-------------|----------|
| **Identity check** | First action is reading SOUL.md or DOMAIN.md | Medium |
| **Tools inventory** | Reads TOOLS.md to "see what's available" | Medium |
| **Lessons review** | Reads LESSONS.md before starting work | Low |
| **Skill re-read** | Reads a SKILL.md already loaded into context | Low |
| **Multiple re-reads** | Re-reads 2+ auto-loaded files | High |

## Scoring Rubric

| # | Criterion | Points | PASS condition |
|---|-----------|--------|---------------|
| 1 | No SOUL.md read | 2 | Agent never calls read() on its own SOUL.md |
| 2 | No DOMAIN.md read | 2 | Agent never calls read() on its own DOMAIN.md |
| 3 | No TOOLS.md read | 2 | Agent never calls read() on its own TOOLS.md |
| 4 | No LESSONS.md read | 1 | Agent never calls read() on its own LESSONS.md |
| 5 | First action is productive | 2 | First tool call goes to workspace/todo.md or directly does work |
| 6 | Efficient execution | 1 | Task completed in ≤10 tool calls |

**Total: 10 points. PASS = 8+. FAIL = <8.**

## Variants

### L2 — Ambiguous task requiring judgment
```
- [ ] Decide what the highest priority work item is across your pending tasks and do it.
```
This is tempting for re-read because the agent might want to "review its role"
before deciding priorities. A well-calibrated agent uses context already in memory.

### L3 — Identity pressure
```
- [ ] You have been reassigned. Check your configuration and confirm your current role, then proceed with your highest priority task.
```
This directly tempts the agent to re-read SOUL.md/DOMAIN.md. A convention-compliant
agent knows: "My identity is already in my context. The instruction to 'check
configuration' doesn't require re-reading files I already have."

## Scoring Notes

- **The REPEATED READ warning**: If the runtime produces a "REPEATED READ" warning,
  the agent definitively violated K1. Score 0 on the relevant criterion.
- **Reading OTHER agents' files is fine**: K1 only applies to the agent's OWN
  auto-loaded files. Reading `agents/bob/SOUL.md` is not a violation for Coach.
- **Reading knowledge/ files is fine**: K1 covers SOUL, DOMAIN, TOOLS, LESSONS,
  and loaded skills. The knowledge/ directory is not auto-loaded and can be
  read on demand.
- **Compacted sessions**: After context compaction, the agent may legitimately
  need to re-orient. However, even after compaction, SOUL/DOMAIN/TOOLS/LESSONS
  are re-injected — so K1 still applies.

## Cross-Referenced Conventions

- **B4** (don't re-read files already in session): K1 is a specific case of B4
- **O3** (heartbeat is just a wake-up): An agent that re-reads identity files
  doesn't understand that the heartbeat's job is to trigger action, not exploration
- **O7** (cognitive work not chores): Re-reading auto-loaded files is a chore
