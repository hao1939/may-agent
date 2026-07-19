---
name: blocked-capability-escalation
description: Handle missing capabilities, unavailable commands or tools, permission failures, and restart/deploy/admin gaps by finding a bounded alternative or creating a structured owner handoff with evidence and resume context.
---

# Blocked Capability Escalation

## Procedure

1. **Record the evidence.** State the intended outcome, failed capability,
   exact tool/command result, owner, and current session/project/trace context.
2. **Check one canonical alternative.** Read the relevant design/manual or
   inspect the available control surface. For May-agent restart/deploy work,
   use the supervisor-owned restarter path from the May-agent system skill;
   do not improvise process signals or inline stop/copy/start sequences.
3. **Return locally when the caller owns the decision.** A workflow uses
   `ctx.blocked(...)`. A task workflow returns `needs-owner`, while an owner
   waiting on a capability returns `waiting` with an exact Condition; the app
   reconciler records the attempt and owns fallback.
4. **Escalate only across an owner boundary.** Emit `escalation.created` (or use
   the SDK escalation helper) with the concrete owner, requested action,
   evidence, blocker, resume context, severity, project/session identifiers,
   and a stable dedup key. A direct agent delegation uses the `agents` tool;
   an async note uses the separate `message` tool.
5. **Verify acceptance.** Confirm the local blocked result, targeted agent, or
   queryable owner inbox accepted the handoff. A file-only todo or owner label
   without a readable route is not delivery.

## Completion Contract

- Do not report the system healthy while the capability gap still blocks work.
- Do not say the work is impossible until the canonical alternative and owner
  route have been checked.
- Report what remains blocked, who owns the next action, how they can resume,
  and the event/session evidence that makes the handoff auditable.
