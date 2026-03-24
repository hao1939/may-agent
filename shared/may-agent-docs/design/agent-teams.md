# Agent Teams — Architecture

**Status: DRAFT — needs review from bob, tech-lead, coach, optimizer**

## Core Model

A **team** is a directory of agents that work together on a project. Each agent has an identity (SOUL.md) and the team shares behavioral rules (common-sense.md). Agents cooperate within their team — delegate, escalate, share work. The **meta team** improves other teams' agents from the outside.

## Layout

```
agents/
├── meta/                       # The meta team (us)
│   ├── shared/
│   │   └── common-sense.md     # How meta agents operate
│   ├── may/                    # Coordinates meta work
│   ├── coder/                  # Codes may-agent
│   ├── qa/                     # Reviews may-agent code
│   ├── scout/                  # Researches
│   ├── bob/                    # Architects
│   ├── tech-lead/              # Builds
│   ├── coach/                  # Trains agents
│   ├── optimizer/              # Tunes efficiency
│   ├── evaluator/              # Scores sessions
│   └── gym/                    # Test scenarios
│
├── acme/                       # Product team (example)
│   ├── shared/
│   │   └── common-sense.md     # How Acme agents operate
│   ├── coder/
│   │   ├── agent.json
│   │   ├── SOUL.md
│   │   └── knowledge/
│   └── reviewer/
│       ├── agent.json
│       └── SOUL.md
```

## What goes in each file

### SOUL.md (~2-4KB) — who the agent is
- Identity: who you are, your mission
- Role boundaries: what you do vs teammates
- Methodology: how you do your work
- Skills: curated list with trigger conditions
- Constraints: things only you need to follow
- References: where to find knowledge

### common-sense.md (~2-3KB) — how the team operates
Not tool tips (that's harness engineering). How to be an effective autonomous worker:
- How we work: delegate to specialists, escalate when stuck, verify delegated work
- How we think: claim then act, evidence first, simple first
- How we communicate: summary first, be specific, be honest, finish clearly
- What quality means: correct > fast, verified > confident

Each team has its own common-sense.md. The meta team's says "check gym before shipping changes." The acme team's says "run npm test before finishing."

### agent.json — operational config
```json
{
  "name": "coder",
  "model": "opus",
  "tools": ["coding", "finish"],
  "opBudget": 40
}
```

## Within a team: direct cooperation

Agents in the same team call each other directly:
```
acme/coder → agents.call("reviewer", "review this change") → acme/reviewer
```

They share the same common-sense.md, same project knowledge, same context. Fast, in-process.

## Between teams: meta team works ON product agents

The meta team has full access to all teams' files and state. It works ON product agents, not WITH them.

### Meta team CAN:
- Read any team's .state/ (sessions, may.db)
- Edit any team's SOUL.md, common-sense.md, agent.json
- Run any team's agents through gym scenarios
- Score any team's sessions
- Push updated config

### Meta team DOES NOT:
- Delegate tasks to product agents (no cross-team agents.call/send)
- Assign work to product teams
- Run product agents' cron jobs

### Product team DOES NOT:
- Call meta agents
- Modify meta team config

The meta team is like a platform/DevOps team — maintains the infrastructure (agent configs), monitors health (evaluations), improves performance (coaching). Doesn't do the product work.

## Every agent knows how to operate

Every agent — meta or product — understands:
- **I have a goal. I pursue it.** Read the task, plan, execute, verify.
- **I'm stuck. I escalate.** With context: what I tried, where I'm stuck, what I think the issue is.
- **I finished. I report.** Clear status, summary, deliverables.
- **I need help. I delegate.** To a teammate, with clear context and artifacts.
- **I found something. I persist it.** Write to workspace so the next session can pick up.
- **I don't know. I look it up.** Read knowledge files, not guess.

This is what makes an agent autonomous rather than a chatbot executing one prompt.

## Development lifecycle

```
1. Create
   Human tells may-agent: "I need an agent team for the Acme project"
   Meta team creates agents/acme/ with SOUL.md, agent.json, common-sense.md

2. Run
   Human gives tasks to acme team: "fix the login bug"
   Acme agents work. Sessions recorded to .state/

3. Improve
   Meta team monitors acme team's output:
   - Evaluator scores sessions
   - Coach spots gaps → runs gym → patches SOUL.md
   - Optimizer finds waste → trims prompts → verifies
   Agent gets better at the Acme project over time

4. Ship (when needed)
   Slim binary + agents/acme/ = standalone deliverable
   No meta agents in the bundle
   May-agent can still monitor remotely via .state/
```

## Runtime changes needed

### Team-aware agent loading
- `--team meta` loads agents/meta/* (current default)
- `--team acme` loads agents/acme/*
- Agents can only call/send within their team

### Meta team cross-team access
- Coach/evaluator/optimizer get read access to all teams' .state/
- Coach gets write access to all teams' SOUL.md, common-sense.md
- This is filesystem access, not agent protocol

### Slim binary for shipping
- Same may-agent binary minus meta-specific handlers
- Or: same binary, just don't include agents/meta/ in the bundle

## Migration from current layout

```
Current:
  agents/
    may/, coder/, qa/, scout/, bob/, tech-lead/,
    coach/, optimizer/, evaluator/, shared/, gym/

After:
  agents/
    meta/
      may/, coder/, qa/, scout/, bob/, tech-lead/,
      coach/, optimizer/, evaluator/, shared/, gym/
```

One directory move. Update AGENTS_ROOT to point at `agents/meta/` by default. Everything else works as before.

## Questions for reviewers

1. **Bob**: Does the team/meta separation make architectural sense? Any gaps in the cross-team access model?

2. **Tech-lead**: What runtime changes are needed for team-aware loading? How hard is the --team flag? What about the slim binary?

3. **Coach**: How would you train a product agent you didn't create? What do you need from .state/ to coach effectively? Do you need project-specific gym scenarios?

4. **Optimizer**: What metrics would you track for a product team? Same as meta (token cost, waste rate) or different?
