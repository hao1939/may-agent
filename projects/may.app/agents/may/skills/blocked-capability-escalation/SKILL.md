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
   `ctx.blocked(...)`. A task attempt returns the schema-valid result that its
   App can review; an exact external wait uses a real observable Condition.
4. **Escalate only across an App ownership boundary.** Return one typed Task
   dependency containing the requested outcome, evidence, blocker, resume
   context, severity, source obligation, and stable semantic correlation key.
   Human attention is a child request to the `may` App. Do not use an
   `escalation.created` event, owner label, direct agent call, or async message
   as durable handoff authority.
5. **Review the result.** The Runtime admits and correlates the dependency. When
   its exact result wakes this Task, judge the evidence, converge, or request a
   bounded follow-up from the same accountable App.

## Completion Contract

- Do not report the system healthy while the capability gap still blocks work.
- Do not say the work is impossible until the canonical alternative and owner
  route have been checked.
- Report what remains blocked, which App owns the next action, how the source
  obligation resumes, and the request/task/session evidence that makes the
  handoff auditable.
