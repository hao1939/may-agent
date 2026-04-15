# DESIGN: May-as-Gatekeeper (v4 — Decoupled Supervision)

**Status:** ✅ APPROVED & IMPLEMENTED  
**Date:** 2026-04-15  
**Revision:** v4 — fully decoupled async supervision. Approved by Hao with two additions: proactive review + code review gate.

---

## How It Works

Agents work independently. May reviews asynchronously. Intervention is the exception.

```
Agents work normally (heartbeats, forks, persistent tasks)
    │
    ├── Write plans, produce outputs, commit code
    │
    └── Meanwhile, on her own schedule:
        │
        May reads what agents are doing
            │
            ├── Normal work → no action
            │
            └── System-scope change detected
                    │
                    ├── Already done → notify Hao, revert if rejected
                    └── Still planned → set pending-review, notify Hao
                            → Hao approves/rejects via telegram
                            → May resumes or reverts
```

## What May Looks At

Things she already reads during her heartbeat — no new sources:

- **Project files** — persistent-task project markdown (status, iteration logs, planned changes)
- **Workspace files** — agent plans, design docs, research outputs
- **Session outcomes** — finish() summaries from recent sessions (visible in system_status)
- **Dispatch board** — her own tracking of what she dispatched and what came back

## System-Scope vs Agent-Scope

**System-scope** (flag for Hao):
- Changes to shared workflows, guards, or manager code
- Edits to another agent's heartbeat, context.md, or SOUL.md
- New cross-agent protocols or conventions
- Deletion of shared infrastructure

**Agent-scope** (proceed, no review needed):
- Own workspace files, own config
- Knowledge base content (hypotheses, experiments, deep dives)
- Code on review branches (already gated by tsc + tests + QA)

## How May Intervenes

When May spots a system-scope change:

1. **If still planned/in-progress:** Edit the project file Status to `pending-review`. Don't dispatch the next step. Send telegram: "🔒 Review needed: [agent] plans [change]. See [file path]."

2. **If already implemented:** Notify Hao with what changed and where. May can revert (git revert, undo edit) if Hao rejects.

## How Hao Responds

Hao sends `/approve` or `/reject` via telegram → reaches May as natural language → May updates the project file Status back to `active` (or reverts the change). No command parser needed.

## What's NOT in This Design

- ~~Anything in the persistent-task loop~~ — agents and workflows run independently
- ~~New polling mechanisms~~ — May reads what she already reads
- ~~New agent protocols~~ — agents don't need to know about gating
- ~~New infrastructure~~ — zero code changes

## Implementation Cost

**Zero lines of code.** This is a behavioral pattern for May, encoded in her existing supervision workflow. The `pending-review` status in project files is a convention, not enforcement — May edits the file, the agent reads it next iteration.
