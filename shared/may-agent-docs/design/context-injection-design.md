# Design: Context Injection — Fundamentals

## Core Idea

Agents resolve problems through context discovery — they explore, gather related context, and keep digging until they have enough to act. The system prompt gives them enough to START discovering. Common-sense is the map. SOUL is the character. Tools and workflows are the capabilities.

## System Prompt Assembly

In order:

```
1. SOUL.md                — who you are (fixed)
2. common-sense.md        — how to think, how the system works, conventions (fixed)
3. Preferred Workflows    — what works for your role (evolving, replaceable per step)
4. Available Tools        — what you can do (replaceable per step)
5. Runtime environment    — paths, workspace (fixed)
```

### Fixed layers

| Content | Source | Purpose |
|---------|--------|---------|
| **SOUL.md** | `agents/<name>/SOUL.md` | Agent identity — character, role, mission. Different per agent. |
| **common-sense.md** | `agents/shared/common-sense.md` | How to think (context discovery, evidence, breadcrumbs, conventions). Same for all agents. The map for discovering everything else. |
| **Runtime environment** | Generated | Paths, workspace. |

### Replaceable slots

| Content | Default | Override |
|---------|---------|---------|
| **Preferred Workflows** | From agent config — workflows proven useful for this agent's role | Workflow step can replace with step-specific process |
| **Available Tools** | From agent.json tools list | Workflow step can add/remove/replace tools |

How override works: the persistent-task workflow (or any workflow) can pass different workflows/tools when calling `ctx.runAgent()`. The worker session gets the overridden versions instead of defaults.

## User Message

Just the task. Nothing else injected.

## What Agents Discover On-Demand

Common-sense.md has the conventions table — agents know WHERE things are. They read what they need:

| What | Convention location | When to read |
|------|-------------------|-------------|
| Skills | `agents/<you>/skills/` | When you need behavioral guidance for a specific situation |
| Knowledge | `agents/<you>/knowledge/`, `agents/shared/knowledge/` | When you need findings or verified knowledge |
| Knowledge essentials | `agents/shared/knowledge-essentials.md` | When starting research or brainstorming |
| Project files | `agents/<you>/workspace/projects/` | When resuming multi-session work |
| Architecture/design docs | `agents/shared/may-agent-docs/` | When you need to understand how something is built |
| Metrics | `.state/may.db` | When you need to check system health or progress |

## What Infra Enforces (not in prompt)

| What | Mechanism |
|------|-----------|
| Standing orders | Handler checks compliance every 30min — not injected into prompt |
| Verify after write | Finish guard |
| Commit before finish | Commit guard |
| Scope compliance | Completeness guard |

**In system prompt:** SOUL.md, common-sense.md, available tools, runtime environment.  
**NOT in system prompt (on-demand):** standing-orders.md, knowledge-essentials.md, skills/*.md — agents read these when needed, guided by the conventions table.  
**Note:** `src/lib/manager.ts` line 479 tells agents these are "already in context" — this is wrong and needs fixing in code.

## Not Yet Implemented

| Item | Status |
|------|--------|
| Preferred Workflows slot | Need to define: where default comes from, how workflow overrides at runtime |
| Standing orders guard | Need to build: guard that checks finish() output against orders |
| Skill injection per workflow step | Need to define: how workflow specifies which skills to load |
| Tool override per workflow step | Need to implement: ctx.runAgent() with custom tool set |
| Learned experience (future) | Deferred — evolving system prompt section, design separately |
