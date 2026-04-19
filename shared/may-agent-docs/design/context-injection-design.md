# Design: Context Injection — Fundamentals

## Core Idea

Agents resolve problems through context discovery — they explore, gather related context, and keep digging until they have enough to act. The system prompt gives them enough to START discovering.

## System Prompt (auto-injected)

Two fixed layers + two replaceable slots:

| Content | Type | What it provides |
|---------|------|-----------------|
| **SOUL.md** | Fixed | Agent identity — character, role, mission |
| **common-sense.md** | Fixed | How the system works — projects, heartbeats, metrics, escalation. Pointers to where knowledge, skills, and resources live. The map for context discovery. |
| **Preferred Workflows** | Evolving, replaceable | Workflows the agent has PROVEN work for their role. Not a generic list — earned experience. Grows as agent discovers what works. Replaced by workflow when inside a workflow step. |
| **Available Tools** | Replaceable | Tools available NOW. Default from agent.json. Replaced by workflow when inside a step (e.g., reviewer gets read-only tools). |
| **Runtime environment** | Fixed | Paths, workspace |

### Replaceable slots

- **Preferred Workflows:** Default from agent config. Inside a workflow step, the workflow overrides with step-specific guidance.
- **Available Tools:** Default from agent.json. Inside a workflow step, the workflow can add/remove/replace tools.

## User Message (the task)

Just the task. What the caller wants the agent to do. The starting breadcrumb for context discovery.

## What's NOT auto-injected

| Content | How agent gets it |
|---------|-----------------|
| Skills | On-demand: common-sense points to skills directory. Agent reads when needed. Workflow can inject per step. |
| Standing orders | Guard on finish() enforces compliance structurally |
| Knowledge | On-demand: common-sense points to knowledge locations. Agent reads when needed. |
| Session history | Not injected. Agent queries DB if needed. |
| Learned experience | Future work — will be an evolving system prompt section once we design the learning process |

## Future: Learned Experience

Deferred. When ready, this becomes an additional evolving section in the system prompt — curated, bounded, accumulated knowledge so agents don't start from zero. Design separately.
