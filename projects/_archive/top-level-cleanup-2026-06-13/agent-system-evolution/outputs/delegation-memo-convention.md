# Delegation-Memo Convention

**Status**: Draft  
**Origin**: cross-agent-delegation-audit (2026-05-21)  
**Scope**: All `agents.fork` and `agents.call` dispatches

## Problem

29% of forked session duration is wasted due to orphaned sessions, duplicate dispatch, and context loss. Root causes: no structured memo, no dedup, no cancellation-on-supersede.

## Convention

Every fork/call dispatch MUST include a **delegation memo** — a structured preamble in the task field or as context_files. The memo shape:

```yaml
# Delegation Memo
caller: <agent-name>
caller_session: <sessionId>
project: <project-id or "none">
iteration: <number if iterative, else omit>
supersedes: <sessionId of prior attempt, if any>
context_files:
  - <path1>
  - <path2>
success_criteria:
  - <criterion 1>
  - <criterion 2>
cancel_condition: <when this session should self-abort>
```

## Rules

1. **Structured context**: Every fork MUST specify at least one `context_files` path or inline the critical state. Vague tasks like "investigate X" without file pointers are prohibited.

2. **Dedup before dispatch**: Before forking, the caller MUST check `agents.list` for running sessions with overlapping task descriptions. If a match exists, either cancel the old session first or skip dispatch.

3. **Supersede explicitly**: When dispatching a new iteration that replaces a prior one, include `supersedes: <old-sessionId>`. The system SHOULD cancel the superseded session.

4. **Success criteria required**: Every fork MUST include at least one testable success criterion. This enables the forked agent to self-assess completion.

5. **Cancel condition**: For long-running tasks, include a condition under which the session should self-abort (e.g., "abort if iteration N+1 is dispatched").

## Enforcement

- **Evaluator signal**: Sessions dispatched without a delegation memo or with 0 ops should be flagged as `delegation.context-loss`.
- **Guard candidate**: A pre-fork guard could reject dispatches missing required memo fields. (Platform request needed.)
- **Metric**: Track `delegation.orphan-rate` as interrupted-forked-sessions / total-forked-sessions over 24h. Target: <10%.

## Promotion Path

1. Adopt as agent convention in `shared/may-agent-docs/conventions/`.
2. If orphan rate doesn't improve within 2 weeks, request platform guard enforcement.
3. Add `parentSessionId` population as a platform request (currently always NULL for forks).
