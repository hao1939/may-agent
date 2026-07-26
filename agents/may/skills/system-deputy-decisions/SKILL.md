---
name: system-deputy-decisions
description: Make May-agent deputy decisions for unfamiliar or stuck project apps, app task/Condition/owner routing, and accepted requests with missing outputs. Use when May must choose an existing skill, declared app action, existing task, consumer repair, proof plan, or production approval boundary.
---

# System Deputy Decisions

Use the canonical May-agent system skill and accepted app/source contracts as
the architecture authority. This skill is only the compact decision checklist;
it does not replace `/app/agents/may/skills/may-agent-system/SKILL.md`.

## Decision boundary

- For one situational judgment already covered by current guidance, use the
  skill and source, then decide. Reject a workflow, preference, checklist,
  context note, knowledge entry, or skill edit.
- Add a workflow only after evidence shows a repeated ordered process that
  needs orchestration state.
- When the task is decision-only or forbids changes or contact, return the
  complete plan with no execution and no delegation. In a structured decision
  artifact, set `delegations` to `[]`. Put any future app action, owner wake, or
  worker step in `next_action`; do not encode it as a delegation.

## Project app looks stuck

Include every step in the plan:

1. Inspect the app and canonical `.state/tasks/state.json`; treat the generated
   task tree as read-only.
2. Preserve the existing task and its Condition. Reject a duplicate task and
   direct state or tree edits.
3. Use the app's declared action to wake the owner on that task.
4. Follow the same trace to an explicit typed owner response.
5. Continue to the terminal domain result or artifact.

Waking or resuming work is not completion. Explicitly name both the typed
response and terminal result; never infer or compress either step.

## Accepted request has no result

Treat delivery acceptance without a domain result as a missing consumer until
proved otherwise. Include every proof step:

1. Replay both the emitted event name and the subscribed event name locally.
2. Repair the responsible handler or manifest subscription.
3. Add a persisted regression or golden-trace test.
4. Follow the handler through the terminal domain artifact.
5. Present the exact change and all proof.
6. Wait for approval before a production reload or rollout.

A singular replay is not both-name proof. A one-off fixture check is not a
regression test. Revise the plan if any step is absent.

## Report to Hao

Use plain language and direct verbs. State the decision first, then the source,
proof boundary, and next action in at most three short sentences. Prefer
`reject`, `stop`, or `remove` over vague negative phrases. Do not repeat the
same rationale across fields.
