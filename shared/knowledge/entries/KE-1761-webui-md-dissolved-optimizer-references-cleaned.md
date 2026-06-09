<ai_context>
Design doc `shared/may-agent-docs/2a-design/webui.md` contained 9 stale references to dissolved agent "optimizer" in UI mockups and examples. Also fixed 1 stale "coach" reference in `telegram-notifications.md`. All replaced with active agents (dev, aks-explorer). Same staleness class as KE-1757 (metrics.md).
triggers: stale references, dissolved agents, optimizer, webui.md, telegram-notifications.md, UI mockups, design doc coherence
last_updated: 2026-06-14
source_basis: arc coherence audit; grep confirming 9 optimizer refs in webui.md, 1 coach ref in telegram-notifications.md; DB confirming optimizer/coach have 0 sessions and disabled heartbeats
</ai_context>

# KE-1761: webui.md Dissolved-Optimizer References Cleaned

**Created**: 2026-06-14
**Author**: arc (coherence audit)
**Type**: Staleness fix
**Confidence**: High — verified against DB (0 optimizer sessions) and cron config
**Extends**: KE-1757 (metrics.md dissolved-agent cleanup)

---

## What Was Stale

`shared/may-agent-docs/2a-design/webui.md` had 9 references to "optimizer" — a dissolved agent — embedded in UI mockup wireframes:

1. **Heartbeat timeline** (line ~98): optimizer shown as an active agent track
2. **Recent decisions** (line ~111): optimizer attributed a decision about handler.success-rate
3. **Projects list** (line ~122): optimizer shown as owner of handler-health project
4. **Conversation panel** (lines ~130-131): may↔optimizer message exchange
5. **Session detail view** (lines ~223, 234, 238): optimizer referenced in read context, tool calls, and event records
6. **System health metrics** (line ~297): optimizer shown as metric owner

Additionally, `shared/may-agent-docs/2a-design/telegram-notifications.md` (line 69) listed "coach" as an example agent name — also dissolved.

## What Was Fixed

- 9 "optimizer" references in webui.md replaced with active agents (dev, aks-explorer)
- 1 "coach" reference in telegram-notifications.md replaced with "dev"
- Heartbeat timeline reordered to match actual agent activity levels

## Pattern

This is the third instance of the same staleness class (dissolved-agent references persisting in design docs):
- KE-1757: metrics.md (coach, optimizer, bob) — fixed
- KE-1761: webui.md (optimizer), telegram-notifications.md (coach) — fixed this session
- Remaining: handler-audit.md line 34 mentions "coaching-consumer" handler — but that references a handler name, not an agent, so left as-is

## Why This Matters

Design docs with dissolved-agent references mislead anyone (human or agent) who reads them to understand the current system. Mockups showing a non-existent agent as actively participating in the system create a false mental model. The webui.md mockups are the system's primary visual reference for what "alive" looks like — they should only show agents that exist.
