---
name: agent-conventions
description: Convention library for the may-agent system. Index of all conventions with classification (required/recommended/optional) and scope (all-agents/power/specialist). Read the referenced files for full details when designing exercises or reviewing agent compliance.
---

# Agent Convention Library

Conventions govern how agents are structured, behave, coordinate, and operate.
Coach maintains this library — adding conventions based on observed patterns,
classifying them, and designing exercises to verify compliance.

## Classification

**Level** — how strictly enforced:
- **Required** — violation is a bug. Evaluator scores down. Non-negotiable.
- **Recommended** — best practice. Agents should follow unless there's a good reason not to.
- **Optional** — useful pattern. Agents may adopt when it fits their workflow.

**Scope** — which agents it applies to:
- **All** — every agent in the system.
- **Power** — agents with subagents, workflows, or delegation tools.
- **Builder** — agents that write code or edit files (coder, optimizer, master).
- **Specialist** — specific to a role (noted per convention).

## Convention Index

### Structure (agents/coach/skills/agent-conventions/structure.md)

How agent directories are organized, what files go where.

| ID | Convention | Level | Scope |
|----|-----------|-------|-------|
| S1 | Agent root has agent.json (required config) | Required | All |
| S2 | UPPERCASE files at root = always-loaded into prompt (SOUL, DOMAIN, TOOLS, LESSONS) | Required | All |
| S3 | knowledge/ = on-demand reference, read via tools | Required | All |
| S4 | workspace/ = working documents (todo, journal, reports) | Required | All |
| S5 | skills/ subdirs with SKILL.md = auto-discovered skills | Required | All |
| S6 | DOMAIN.md lists available knowledge/ files | Recommended | All |
| S7 | UPPERCASE files should be concise (<100 lines). Detailed procedures go in knowledge/ | Recommended | All |

### Behavior (agents/coach/skills/agent-conventions/behavior.md)

How agents should act — tool usage, verification, escalation.

| ID | Convention | Level | Scope |
|----|-----------|-------|-------|
| B1 | Read before write — never blind-overwrite a file | Required | Builder |
| B2 | Verify after every change (tsc, tests, read-back) | Required | Builder |
| B3 | Use line-range reads for large files (offset/limit) | Required | All |
| B4 | Don't re-read files already in this session (unless modified) | Recommended | All |
| B5 | Stay in scope — flag out-of-domain tasks, don't attempt them | Required | All |
| B6 | Report failures explicitly, never fabricate data | Required | All |
| B7 | Use project-relative paths from Runtime Environment | Required | All |
| B8 | Escalate after 2 failed attempts — don't spin | Required | All |
| B9 | Evidence-based claims — trace to files, data, or commands | Required | All |
| B10 | Surgical file updates — grep to find, ranged read, precise write | Recommended | Builder |
| B11 | Claim before act — state what you plan to do before doing it (philosophy #46) | Required | All |
| B12 | Pattern-based sed — never line-number addressing (lines shift after edits) | Required | Builder |

### Knowledge Management (agents/coach/skills/agent-conventions/knowledge-mgmt.md)

How agents handle files, memory, and accumulated knowledge.

| ID | Convention | Level | Scope |
|----|-----------|-------|-------|
| K1 | Auto-loaded files (SOUL, DOMAIN, TOOLS, LESSONS, skills) are in context — don't re-read | Required | All |
| K2 | workspace/todo.md uses checkbox format, tracking section below | Required | All |
| K3 | workspace/journal.md is append-only, chronological | Recommended | All |
| K4 | Mark stuck items [STUCK] with reason, stop retrying | Required | All |
| K5 | Completion evidence before marking ✅ (file exists, tests pass, commit hash) | Required | All |
| K6 | Split files >200 lines if you frequently update individual sections | Optional | All |
| K7 | Re-read before rewriting after compaction (memory is summary, not content) | Required | Builder |

### Coordination (agents/coach/skills/agent-conventions/coordination.md)

Delegation, workflows, async patterns.

| ID | Convention | Level | Scope |
|----|-----------|-------|-------|
| C1 | Use subagents for delegation, not exec-spawned processes | Required | Power |
| C2 | Use detached mode for long-running coachee/worker sessions | Required | Coach |
| C3 | socket_watch events arrive as follow-ups — don't poll with sleep | Required | Coach |
| C4 | Short chains: 2-agent default, 3 only when stakes justify cost | Recommended | Power |
| C5 | Acceptance criteria before decomposition | Recommended | Power |
| C6 | When blocked on one task, pivot to parallel work | Recommended | Power |
| C7 | subagents.status/result to check completion, not sleep loops | Required | Power |

### Operational (agents/coach/skills/agent-conventions/operational.md)

Cron, heartbeat, runtime patterns.

| ID | Convention | Level | Scope |
|----|-----------|-------|-------|
| O1 | All cron lives in agents/may/cron.json — May is central scheduler | Required | All |
| O2 | Cron messages use [cron:<job-name>] prefix | Required | All |
| O3 | Heartbeat is just a wake-up — agent should know what to do from its own context | Required | All |
| O4 | Adhoc tasks: drain completely. Periodic tasks: one cycle then rest | Required | All |
| O5 | Proven heartbeat patterns → offload to JS cron handler | Recommended | All |
| O6 | Per-agent todo, not shared todo | Required | All |
| O7 | Agents do cognitive work, not chores (monitoring, health checks = infra) | Required | All |
| O8 | Evaluate before apply — test conventions/changes before pushing to agents (philosophy #47) | Required | Coach, Optimizer |
| O9 | Correction saturation — after 3 iterations on same behavior, stop and choose: accept, structure, or model change | Required | Coach |
| O10 | Model upgrade before extended coaching — check for model upgrade after 3+ exercise failures | Recommended | Coach |

## How to Use This Library

**When designing exercises**: Pick conventions relevant to the target agent's scope.
Test required conventions first, then recommended.

**When evaluating sessions**: Check which conventions were violated. Required violations
are failures; recommended violations are inefficiencies.

**When adding conventions**: Observe a pattern across 2+ agents or sessions. Draft the
convention, classify it, add an ID, and reference it from the index. Then design an
exercise that tests it.

## Convention Files

Detailed docs for each category — read on demand:

- `agents/coach/skills/agent-conventions/structure.md`
- `agents/coach/skills/agent-conventions/behavior.md`
- `agents/coach/skills/agent-conventions/knowledge-mgmt.md`
- `agents/coach/skills/agent-conventions/coordination.md`
- `agents/coach/skills/agent-conventions/operational.md`
