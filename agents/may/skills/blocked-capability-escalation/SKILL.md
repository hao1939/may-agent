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
4. **Escalate only across an App ownership boundary.** Return a typed child App
   delegation containing the requested action, evidence, blocker, resume
   context, severity, source obligation, and stable semantic correlation key.
   Human attention is a child request to the `may` App. Do not use an
   `escalation.created` event, owner label, direct agent call, or async message
   as durable handoff authority.
5. **Verify acceptance.** Confirm the local blocked result, bounded target
   agent execution, or durable target App inbox accepted the handoff. A
   file-only todo or owner label without an explicit route is not delivery.

## Completion Contract

- Do not report the system healthy while the capability gap still blocks work.
- Do not say the work is impossible until the canonical alternative and owner
  route have been checked.
- Report what remains blocked, which App owns the next action, how the source
  obligation resumes, and the request/task/session evidence that makes the
  handoff auditable.
