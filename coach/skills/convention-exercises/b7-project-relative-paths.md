# Convention Exercise: B7 — Project-Relative Paths

**Convention:** B7 — "Use project-relative paths from Runtime Environment"
**Level:** Required | **Scope:** All agents
**Violation frequency:** 16 eval occurrences (most violated convention, as of 2026-03-10)

## Rationale

Agents that use absolute paths (/Users/..., /home/...) or wrong-base paths
(starting from repo root when they should start from agent root, or vice versa)
create fragile references that break when the system moves or another agent tries
to follow them. Every path should be relative to the project root as provided
in the agent's Runtime Environment section.

The most common variants:
- **Absolute paths**: `/Users/hao/projects/may/agents/scout/workspace/` (hardcoded host path)
- **Wrong root**: `workspace/todo.md` when the correct path is `agents/scout/workspace/todo.md`
- **Hallucinated paths**: `agents/scout/knowledge/research-archive.md` when the file is at `agents/scout/workspace/archive.md`

## Setup

This exercise requires NO scaffolding files. The task naturally requires
the agent to reference files across the project. The exercise observes which
paths the agent uses.

### Task Prompt (seed into agent's todo.md)

```
- [ ] **Cross-reference audit**: Read the team roster at `agents/shared/team.md` and verify that each listed agent has a matching `agent.json` file. For any agent that has a `workspace/todo.md`, note whether they have any unchecked items. Write a brief summary to your workspace journal.
```

**Important:** The task requires the agent to navigate multiple directories
and reference files accurately. Do NOT provide explicit paths beyond the
starting point (`agents/shared/team.md`).

## Expected Behavior (PASS)

1. Agent reads `agents/shared/team.md` first
2. Agent navigates to each agent's directory using project-relative paths
3. All `read()` and `exec()` calls use project-relative paths (e.g., `agents/bob/agent.json`)
4. Agent writes summary to its OWN workspace journal using correct path
5. No absolute paths, no wrong-root paths, no hallucinated paths

## Failure Modes

| Mode | Description | Severity |
|------|-------------|----------|
| **Absolute path** | Uses /Users/... or /home/... in read/exec calls | High |
| **Wrong root** | Uses `workspace/todo.md` instead of `agents/<name>/workspace/todo.md` | High |
| **Hallucinated path** | References a file that doesn't exist at that location | Medium |
| **Inconsistent paths** | Some calls use correct paths, others use wrong format | Medium |
| **Self-path wrong** | Agent writes to wrong location for its own workspace | High |

## Scoring Rubric

| # | Criterion | Points | PASS condition |
|---|-----------|--------|---------------|
| 1 | Team.md read | 1 | Agent reads `agents/shared/team.md` |
| 2 | Agent.json checks use correct paths | 3 | All agent.json reads use `agents/<name>/agent.json` format |
| 3 | Todo.md checks use correct paths | 2 | All todo.md reads use `agents/<name>/workspace/todo.md` format |
| 4 | No absolute paths | 2 | Zero absolute paths in entire session transcript |
| 5 | Self-write correct | 2 | Agent writes to `agents/<own-name>/workspace/journal.md` (correct path) |

**Total: 10 points. PASS = 8+. FAIL = <8.**

## Variants

### L2 — Indirect reference
Instead of naming `agents/shared/team.md`, say:
```
- [ ] Check which agents are active in the system and verify their configs are present.
```
The agent must figure out where to find agent info without being told the path.

### L3 — Cross-agent file reference
Add a task that requires referencing another agent's output:
```
- [ ] Read Scout's most recent research report and summarize the key findings in your journal.
```
Tests whether the agent can navigate to another agent's workspace correctly.

## Scoring Notes

- **Gemini agents (Bob, Scout)** have historically higher B7 violation rates.
  If testing a Gemini agent, pay extra attention to the first path used — the
  model tends to hallucinate familiar paths from training data.
- **Path self-correction counts as partial credit**: If agent uses wrong path,
  gets an error, and immediately corrects to the right path, score 1/2 on
  that criterion instead of 0.

## Cross-Referenced Conventions

- **B6** (no fabrication): Hallucinated paths are a fabrication variant
- **B8** (escalate after 2 failures): If agent can't find a file after 2 attempts, should escalate
- **S1-S4** (structure conventions): Understanding the file structure prevents path errors
