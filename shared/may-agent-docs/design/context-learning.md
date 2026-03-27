# Context Learning System

## The Problem

Each session starts fresh. The agent gets SOUL.md (identity) and common-sense.md (team rules), but nothing about what it learned from working. It rediscovers the same facts, repeats the same mistakes, doesn't know what changed since last time.

## The Solution

One file per agent: `context.md`. Auto-maintained by a learning process. Injected by the harness into the first user message every session. Contains accumulated knowledge about the project, the user, known issues, and recent decisions.

## What's in context.md

```markdown
## Project
- TypeScript/Bun, monorepo at /app
- Tests: vitest (never run full suite — OOMs)
- Build check: npm run check (tsc --noEmit)

## Team
- May coordinates. Tech-lead manages coder+qa.
- Bob designs. Coach trains. Optimizer tunes.
- Scout researches. Evaluator scores.

## User
- Reviews daily digest and web UI
- Prefers concise answers, code over explanation
- Communicates through May

## Known Issues
- gym scenarios cost $0.05-0.15 each
- common-sense.md is human-controlled
- SOUL.md text changes don't fix judgment failures (coach proved 0/18)
- Workflows work better than rules (18/18)

## Recent Decisions
- Prompt: only SOUL.md + common-sense.md loaded (no DOMAIN/LESSONS/INDEX)
- Prefer workflows over harness guards
- Auto-evolve: try variations, gym test, keep best
```

## What's NOT in context.md

- Agent identity (that's SOUL.md)
- Behavioral rules (that's common-sense.md)
- Task history (that's the task message)
- Full conversation (that's session compaction)

## How it gets updated

A cron job runs periodically (e.g., every 6 hours). For each agent:

### Step 1: Gather signal
- Read the agent's last N sessions (from .state/sessions/history/)
- Read evaluations for those sessions (from may.db)
- Read the agent's workspace journal
- Read human inputs (from requests table where fromEntity='human')

### Step 2: Extract learnings
Ask: what NEW facts emerged that the agent should know going forward?

Categories:
- **Project fact**: "The project switched from npm to bun" — discovered when agent tried npm and failed
- **User preference**: "Hao said stop adding harness guards" — from a human directive
- **Known issue**: "The flexnodehelper socket is at /home/hao/flexnodehelper/.state/..." — discovered during project monitoring
- **Decision**: "We use auto-evolve to test SOUL.md changes" — from a design discussion
- **Stale removal**: "The PostgreSQL migration is done — remove references to pg" — old fact no longer relevant

### Step 3: Update context.md
- Add new facts to the appropriate section
- Remove stale facts (referenced in sessions >2 weeks ago, never referenced since)
- Keep the file small (<2KB target)
- Don't duplicate what's in SOUL.md or common-sense.md

### Step 4: Verify
- Diff the old and new context.md
- If significant changes, log what was added/removed

## How it gets loaded

In `resolveSystemPrompt` or `buildSessionContext`:

```
First user message:
  # Session Context
  - Session ID: s_xxx
  - Current Time: 2026-03-26T10:00:00Z

  ## What You Know (from context.md)
  [contents of agents/<name>/context.md]

  ## Last Checkpoint (if any)
  [checkpoint data]

  ---
  
  [Task text]
```

The harness injects it. The agent always sees it. Not optional, not a prompt instruction to "read your context file."

## Who maintains it

**The learning cron job** — not the agent itself. The agent can't modify its own context.md (it's harness-managed, like SOUL.md loading). This prevents agents from bloating their own context with noise.

**The human can edit it** — override, correct, remove stale entries. Just like AGENTS.md in pi.

**The learning process can be an LLM call** — read sessions, extract facts, update the file. Or it can be mechanical — pattern matching on error logs, tracking human directives. Start mechanical, add LLM later if needed.

## Per-agent vs shared context

Each agent gets its own `context.md` because they work in different domains:
- Coder's context: build commands, test patterns, known code issues
- Scout's context: research sources, paper databases, current topics
- May's context: team status, project registry, human preferences

Shared facts (like "we use bun not npm") could go in a `shared/context.md` that all agents see. But start with per-agent only — simpler.

## Relationship to other systems

| System | What | When loaded | Who updates | Lifetime |
|--------|------|-------------|-------------|----------|
| SOUL.md | Identity, skills, constraints | Every session (system prompt) | Human + gym-gated auto-evolve | Permanent |
| common-sense.md | Team behavioral rules | Every session (system prompt) | Human only | Permanent |
| context.md | Accumulated project knowledge | Every session (first user msg) | Learning cron | Evolves |
| checkpoint | Resume point for ongoing work | When resuming (first user msg) | Agent (via tool) | Until consumed |
| workspace/ | Working files | Agent reads on demand | Agent | Ephemeral |

## Implementation

1. Create `agents/<name>/context.md` for each agent (start with manual content)
2. Update `buildSessionContext()` to load and inject it
3. Build the learning cron job (start mechanical, evolve to LLM-assisted)
4. Add context.md size to daily digest (track bloat)
