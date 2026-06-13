# Delegation Memo Post-Adoption Audit

**Date**: 2026-05-22  
**Auditor**: may (automated)  
**Convention**: contracts/delegation-memo-convention.md (published 2026-05-22)

## Summary

**Adoption rate: N/A — 0 agent-initiated delegations exist post-convention.**

## Methodology

1. Identified all `fork`/`call` sessions created after convention publication (startedAt > 1779366447769).
2. Found 14 post-convention sessions with kind=fork/call.
3. Checked whether any of these were **agent-initiated** (i.e., an agent used the `agents` tool with action fork/call to delegate work to another agent).

## Findings

All 14 post-convention fork/call sessions are **platform-dispatched**:
- 5 evaluator aftermath reviews (source: `workflow:evaluator-aftermath`)
- 1 metric-alert triage (source: `workflow:metric-alert-triage`)
- 1 scout explore (source: `workflow:scout-explore`)
- 5 may project-tasks (source: `project-task:*`)
- 2 may project-owner loops (source: `project-owner`)

**Zero** sessions were initiated by an agent calling `agents.fork()` or `agents.call()` within a session. Verified by:
- All sessions have `parentSessionId = NULL`
- No session transcripts contain `"action":"fork"` or `"action":"call"` tool invocations
- No entries in `.state/delegations.jsonl` after March 2026

## Analysis

The delegation-memo convention targets **agent-to-agent delegation** — when an agent decides mid-session to fork/call another agent. However, the current system architecture routes all work through:
1. **Workflow dispatchers** (cron-triggered evaluator, scout heartbeats)
2. **Project-task runners** (platform dispatches task to assigned agent)
3. **Project-owner loops** (platform triggers owner agent)

Agents don't delegate to other agents; the platform orchestrates all dispatch. The convention is solving a problem that doesn't currently manifest in the live system.

## Adoption Rate

**Cannot compute** — denominator is 0. No agent-initiated delegations have occurred since convention publication.

## Recommendation: Enforcement Mechanism

Since adoption rate is undefined (not <30%), the convention doesn't need enforcement yet. However, the convention has a **relevance problem**: the system doesn't produce the behavior it governs.

### Proposed Actions

1. **Reframe the convention scope** — extend it to cover platform-dispatched tasks too (the `task` field in workflow/project-task dispatches). These already partially comply: project-tasks include Goal, Context, Finish Contract. But they lack `scope_boundary` and `success_criteria` as discrete fields.

2. **If agent-to-agent delegation is reintroduced** — inject the convention template into the `agents` tool description so agents see the required fields when composing a fork/call. This is prompt injection at the tool-definition level.

3. **Evaluator signal** — add a check in the evaluator aftermath flow: if a session transcript contains `agents.fork`/`agents.call` without the 4 required memo fields, flag it as a convention violation.

## Verdict

Convention is valid but currently inert — no agent-initiated delegations exist to measure. The platform's task-dispatch format already provides partial structure (goal, context). Recommend closing this measurement loop and reopening only if agent-to-agent delegation resumes.
