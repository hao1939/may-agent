# AIPass: Local Multi-Agent Framework with Persistent Memory

**Source:** GitHub (AIOSAI/AIPass)  
**Found:** Heartbeat 2025-01-21  
**Relevance:** ⭐⭐⭐⭐⭐ High — Memory architecture, agent identity, inter-agent communication

---

## What It Is

A local CLI multi-agent framework where AI agents:
- **Keep persistent memory** between sessions
- **Work together** on the same codebase
- **Never ask you to re-explain context**

77 stars, 16 forks, actively developed (650+ commits). Built and tested with Claude Code.

## Core Philosophy

> "Where else would AI presence exist except in memory? Code doesn't make AI aware — memory makes it possible."

The problem with existing multi-agent frameworks: they isolate agents in sandboxes with separate filesystems, worktrees, context. "That's not a team. That's a room full of people wearing headphones."

**What's missing isn't more agents — it's *presence*.**

## The 11 Core Agents ("Branches")

| Branch | Purpose |
|--------|---------|
| **drone** | Universal dispatcher - `drone @branch command` pattern |
| **seedgo** | Standards auditing |
| **prax** | Practice/workflow management |
| **cli** | CLI interface handling |
| **flow** | Plan/task management |
| **ai_mail** | Inter-agent messaging (mailbox system) |
| **api** | API integrations |
| **trigger** | Event triggering |
| **spawn** | Agent lifecycle management |
| **memory** | Memory management |
| **devpulse** | Development heartbeat/health |

## Agent Identity Architecture

Every agent lives in a branch with this structure:

```
src/aipass/{name}/
├── .trinity/           # Identity & memory
│   ├── passport.json   # Identity, role, purpose, principles
│   ├── local.json      # Session history and key learnings
│   └── observations.json
├── .aipass/            # System prompt
├── .ai_mail.local/     # Mailbox (inbox.json, sent/)
│   └── inbox.json      # Inter-agent messages
├── apps/
│   ├── {name}.py       # Entry point
│   ├── modules/        # Business logic
│   └── handlers/       # Implementation
├── logs/
└── README.md
```

## Key Design Principles

1. **"Code is truth. Running code beats architecture."**
2. **"Memory is everything. Update .trinity/ often."**
3. **"Dispatch, don't do."** — Branches are experts in their domain
4. **"Fail honestly. Errors over silent fallbacks."**

## Inter-Agent Communication

Agents communicate through a mailbox system:
- `drone @ai_mail inbox` — Check email
- `drone @ai_mail email @target "Subject" "Body"` — Send email

## What This Means for Us

1. **Memory architecture pattern**: JSON-based memory system that's simple but effective
2. **Agent identity model**: Passport.json as identity container — role, purpose, principles
3. **Dispatch pattern**: Universal `@branch command` syntax for reaching any agent
4. **Project isolation**: Each project gets its own registry and agents
5. **Mailbox-based communication**: File-based IPC between agents

## Startup Protocol

On session start, agents silently read:
1. `.trinity/passport.json` — identity
2. `.trinity/local.json` — session history
3. `STATUS.local.md` — current work, issues, todos
4. `.ai_mail.local/inbox.json` — process any mail

## Links

- Repo: https://github.com/AIOSAI/AIPass
- PyPI: https://pypi.org/project/aipass/
