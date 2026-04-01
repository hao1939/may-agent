# Agent Growth: Fork / Coach / Verify / Promote

Status: **Implemented** (tools in `src/lib/tools/agent-growth.ts`, commit `ad262bb`)

## Overview

Agents grow through a cycle: observe behavior, hypothesize improvements,
experiment safely, verify, promote or discard. The system supports this
while keeping live agents undisturbed.

## The Growth Cycle

```
1. Observe    — coach runs agent on tasks, reads results
2. Diagnose   — identify gaps between behavior and SOUL intent
3. Hypothesize — "changing X in LESSONS.md should fix this"
4. Fork       — copy agent to .lab/, modify the copy
5. Verify     — run fork on test tasks, check results
6. Promote    — copy changes back to live agent (or discard)
7. Log        — record what changed and the outcome
```

## Directory Layout

```
agents/
  coder/              ← live agent (auto-loaded, system uses this)
  scout/              ← live agent
  shared/             ← shared knowledge (not an agent)
  .lab/               ← experiment sandbox (NOT auto-loaded)
    coder-v2/         ← fork of coder (isolated, coach-managed)
    coder-v3/         ← another experiment
```

The auto-loader scans `agents/*/agent.json` one level deep. `.lab/` has no
`agent.json` at its root, so it's skipped. Agents inside `.lab/` are invisible
to the live system until explicitly registered.

## Fork

Copy the agent directory. Change the name. Done.

```
fork("coder", "coder-v2")

1. cp -r agents/coder agents/.lab/coder-v2
2. Edit agents/.lab/coder-v2/agent.json → "name": "coder-v2"
3. Optionally: cp .state/memory/coder.jsonl .state/memory/coder-v2.jsonl
4. Register "coder-v2" with the running system
```

### Why there are no conflicts

All paths are derived from the directory location, not hardcoded:

| Resource | Live agent | Fork | Conflict? |
|---|---|---|---|
| agent.json `name` | `coder` | `coder-v2` (changed) | No |
| knowledgeDir | `agents/coder/knowledge/` | `agents/.lab/coder-v2/knowledge/` | No — derived from dir |
| workspace | `agents/coder/workspace/` | `agents/.lab/coder-v2/workspace/` | No — derived from dir |
| skills | `agents/coder/skills/` | `agents/.lab/coder-v2/skills/` | No — derived from dir |
| SOUL/DOMAIN/TOOLS/LESSONS | Read from agent dir | Read from fork dir | No — derived from dir |
| memory | `.state/memory/coder.jsonl` | `.state/memory/coder-v2.jsonl` | No — keyed by name |
| sessions | `.state/sessions/s_...` | `.state/sessions/s_...` (different IDs) | No — unique IDs |
| shared knowledge | `agents/shared/` | Same (read-only) | No — shared is shared |

The system prompt says `Name: coder-v2` automatically (from agent.json). Even
if SOUL.md still says "I am coder", the LLM sees both and uses the name from
the system prompt.

### Memory inheritance

Three options for the fork's memory:

- **Copy memory** — fork starts with the original's full experience. Good for
  testing improvements where the agent needs its history.
- **Fresh memory** — fork starts blank. Good for testing whether the agent
  works well from scratch (onboarding quality).
- **Partial memory** — copy last N entries. Good for testing with recent
  context only.

Default: copy memory. The fork should behave like an improved version of
the original, not a brand new agent.

## Coach Flow

The coach uses standard tools (read, edit, write, bash, callAgent):

```
1. Read agents/coder/SOUL.md — understand design intent
2. Run baseline:
     callAgent("coder", test_task_1) → score
     callAgent("coder", test_task_2) → score
     Baseline: 3/5 pass

3. Fork:
     bash: cp -r agents/coder agents/.lab/coder-v2
     edit agents/.lab/coder-v2/agent.json → name: "coder-v2"
     bash: cp .state/memory/coder.jsonl .state/memory/coder-v2.jsonl
     Register coder-v2

4. Apply changes:
     edit agents/.lab/coder-v2/LESSONS.md → add error recovery patterns
     edit agents/.lab/coder-v2/DOMAIN.md → adjust error handling protocol

5. Verify:
     callAgent("coder-v2", test_task_1) → score
     callAgent("coder-v2", test_task_2) → score
     New: 4/5 pass

6. Promote (or discard):
     If better: copy changed files back to agents/coder/
     Clean up: rm agents/.lab/coder-v2/, deregister
     bash: cd agents && git add coder/ && git commit -m "coach: error recovery"

7. Log:
     Append to agents/coder/GROWTH.md
```

## Test Tasks

Each agent has a verification suite in `tests/`:

```
agents/coder/
  tests/
    fix-type-error.md
    add-error-handling.md
    refactor-function.md
```

### Test task format

```markdown
# Task
Fix the type error in test/fixtures/broken.ts

# Verification
- Command: `npx tsc --noEmit test/fixtures/broken.ts`
  Expected: exit code 0
- Command: `git diff --stat`
  Expected: ≤2 files changed
```

### Verification types

- **Command check** — run a command, check exit code or output. Automated.
- **File check** — verify a file exists or contains specific content. Automated.
- **Coach judgment** — the coach LLM reads the result and scores it. For
  quality, approach, style — things that can't be checked mechanically.

A test task can have both automated checks and coach judgment. Automated
checks run first (fast, cheap). Coach judgment runs only if automated
checks pass.

## Promote

Copy the changed files from the fork back to the live agent.

```
promote("coder-v2", "coder")

1. Diff: which files changed between agents/.lab/coder-v2/ and agents/coder/?
2. Copy changed files → agents/coder/
3. Deregister "coder-v2"
4. rm -rf agents/.lab/coder-v2/
5. rm .state/memory/coder-v2.jsonl
6. git commit in agents repo
```

### What gets promoted

Only config/knowledge files. Not runtime state:

- ✅ SOUL.md, DOMAIN.md, TOOLS.md, LESSONS.md
- ✅ agent.json (except name — stays as original)
- ✅ knowledge/ files
- ✅ skills/ files
- ❌ workspace/ — fork's workspace is scratch, not promoted
- ❌ memory — the live agent keeps its own memory
- ❌ sessions — fork's sessions are archived normally

### Discard

If the fork didn't improve things:

```
discard("coder-v2")

1. Deregister "coder-v2"
2. rm -rf agents/.lab/coder-v2/
3. rm .state/memory/coder-v2.jsonl
4. Log failure in agents/coder/GROWTH.md
```

Discard is as important as promote. The growth log records what was tried
and why it didn't work — preventing the coach from repeating failed
experiments.

## Growth Log

Per-agent file tracking changes and their effects:

```markdown
# agents/coder/GROWTH.md

## 2026-03-05 — Error recovery patterns
- Change: Added retry-with-analysis pattern to LESSONS.md
- Baseline: 3/5 tasks passed
- After: 4/5 tasks passed
- Promoted: yes
- Coach notes: coder now reads error messages before retrying

## 2026-03-03 — Stricter type checking guidance
- Change: Added "always run tsc before committing" to DOMAIN.md
- Baseline: 4/5 tasks passed
- After: 3/5 tasks passed (regression on refactor task)
- Promoted: no (discarded)
- Coach notes: too strict, coder spent extra turns on tsc that weren't needed
```

## Live System Interaction

### No interference with running agents

Agent files are read at session start. A running session uses the system
prompt that was built when it started. Coach editing files mid-session
affects only future sessions.

```
Timeline:
  10:00  coder session starts → reads LESSONS.md v1
  10:05  coach edits agents/coder/LESSONS.md → v2
  10:10  coder session finishes → used v1 the whole time
  10:11  new coder session → reads LESSONS.md v2 ✅
```

### Fork runs alongside live agent

The fork (coder-v2) is a separate registered agent. Both can run
concurrently. They share nothing except shared knowledge in
`agents/shared/` (read-only).

```
Session 1: tech-lead → callAgent("coder", real_task)     ← live
Session 2: coach → callAgent("coder-v2", test_task)      ← experiment
```

No conflict. Different names, different directories, different memory.

### Registration and deregistration

The fork must be explicitly registered (not auto-loaded) and deregistered
after promote/discard. The auto-loader only scans `agents/*/` one level
deep on startup. `.lab/` agents require:

```typescript
// Register fork
manager.register(loadAgentDef("agents/.lab/coder-v2"));

// Deregister after done
manager.deregister("coder-v2");
```

This could be a coach tool or a built-in command.

## Scope and Limitations

### What fork/verify tests

The fork tests the **agent's individual capability** — how it performs
when given a task directly.

- ✅ Does coder write correct code?
- ✅ Does scout find relevant information?
- ✅ Does coder handle errors well?
- ✅ Does the agent follow its SOUL/DOMAIN intent?

### What fork/verify does NOT test

The fork cannot test **how other agents interact with it**. Other agents
call the live agent by name (`callAgent("coder", ...)`), not the fork.

- ❌ Does tech-lead give coder good task descriptions?
- ❌ Does the handoff between tech-lead → coder → qa work?
- ❌ Does coder's output format match what qa expects?

These are **integration** concerns. They require running the real agents
together on real tasks — not something a fork can isolate.

### Why this is fine

Coach's scope is **individual agent growth**. Make each agent better at
its own job. Fork/verify is the right tool for that.

Integration problems are solved differently:
- Bad task descriptions → coach the agent that writes them
- Format mismatches → fix the protocol in both agents' DOMAIN.md
- End-to-end failures → run real tasks with real agents, observe results

The growth cycle is a unit testing analog. Integration testing is a
separate activity that uses the live system directly.

## Summary

The entire growth mechanism uses:
- File copy (fork)
- File edit (coach changes)
- callAgent (verification)
- File copy back (promote)
- File delete (discard)
- Git commit (version history)
- Markdown append (growth log)

No special infrastructure. No database. No branch switching.
Standard file operations on a well-structured directory.
