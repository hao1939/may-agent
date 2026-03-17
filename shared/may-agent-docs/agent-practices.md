# Agent Practices for Hardening Features

**Purpose**: Bridge between `docs/features.md` (what the system must do) and `agents/shared/common-sense.md` (what agents must know). This doc maps each hardening feature to the specific agent behaviors that support it.

**Key insight**: Most features require zero new agent behavior. The system is autonomous — May is the admin. Features give May better tools. Regular agents just call `finish()` honestly and work from todo.md.

**Owner**: Coach (behavioral enforcement) + Bob (infra design)

---

## Track A: What agents need to know

### F1. Simplified Communication (call + send only)

**What changed**: handoff tool is gone. SIGNALS.md is gone. Dedup is automatic.

**What you do**: Use `call()` for sync work (you wait for the result). Use `send()` for async work (fire-and-forget). That's it. No ACK ceremony, no SIGNALS.md grep, no dedup checking.

### F2. Structured Results (call returns finish data)

**What changed**: When you call finish(), the structured data (status, deliverables, blockers) flows back to whoever called you.

**What you do**: Nothing new. Just keep calling finish() with real data.

### F3. Less Ceremony

**What changed**: todo.md is injected into your heartbeat context. heartbeat.md is protected by code. edit() already shows diffs.

**What you do**: Start working immediately. Don't read todo.md as your first tool call — it's already in your context. After edit(), check the returned diff instead of reading the file back.

---

## Track B: What admins (May + human) can do

F4-F7 are admin tools, available to both May (autonomous) and the human (via chat). Same interface, same data.

- **F4 (Request Tracking)**: `agents(action: "requests", filter: "stale")` — what's outstanding, overdue, or failed.
- **F5 (Auto-Escalation)**: Failures automatically appear in May's todo.md. Human can also query failed requests directly.
- **F6 (Crash Recovery)**: After restart, recovery summary available. May acts on it; human can review.
- **F7 (Request Observability)**: `agents(action: "requests", view: "tree")` — full delegation chain from human order to leaf agent.

---

## The 3 things every agent must do

1. **Call `finish()` honestly** — with real status, summary, and deliverables. If blocked, say so. Infra escalates to May automatically.
2. **State your plan before acting** — specific promises, then deliver on them (C40).
3. **Write progress to disk** — assume your session might crash at any point.

Everything else is handled by infra, or by May as admin.
