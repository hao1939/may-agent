# Delegation Memo Convention

**Version**: 1.0  
**Date**: 2026-05-22  
**Status**: Active  
**Origin**: [Cross-Agent Delegation Audit](../projects/agent-system-evolution/outputs/cross-agent-delegation-audit.md)

## Problem

Auditing 10 recent fork/call sessions revealed 29% duration waste from orphaned
sessions, duplicate dispatch, and context loss. Root causes: vague task
descriptions, no cancellation on supersede, and missing parent linkage.

## Convention

Every `agents.fork` or `agents.call` invocation MUST include a **delegation
memo** — a structured task description that contains all fields below.

### Required Fields

| Field | Description |
|-------|-------------|
| **goal** | One sentence: what the delegated agent must accomplish. |
| **context_files** | File paths the agent MUST read before acting. At least one path required. |
| **success_criteria** | Bullet list of verifiable conditions that define "done". |
| **scope_boundary** | What the agent must NOT do (prevents drift). |

### Recommended Fields

| Field | Description |
|-------|-------------|
| **supersedes** | Session ID of a prior attempt this replaces (triggers cancellation). |
| **timeout_hint** | Expected max duration; agent should checkpoint before this. |
| **output_path** | Where deliverables should be written. |

### Example

```
task: "Implement retry logic for the webhook sender"
context_files: ["src/webhooks/sender.ts", "tests/webhooks/sender.test.ts"]
success_criteria:
  - "Retries up to 3 times with exponential backoff"
  - "Tests pass: bun test tests/webhooks/sender.test.ts"
  - "No changes outside src/webhooks/"
scope_boundary: "Do not modify the webhook schema or queue infrastructure"
supersedes: "s_1778656714888_6"
```

## Caller Obligations

1. **No fire-and-forget**: After forking, the caller must either await
   completion or schedule a check (via cron or next heartbeat).
2. **Cancel on supersede**: If dispatching a retry or newer iteration, cancel
   the prior session explicitly or pass `supersedes`.
3. **Deduplicate**: Before forking, check active sessions (`agents list`) for
   an equivalent task. Use `force: true` only when intentional re-dispatch.

## Receiver Obligations

1. **Read context_files first**: Do not guess; read the paths provided.
2. **Verify success_criteria**: Use `finish()` with `verification_evidence`
   proving each criterion is met.
3. **Respect scope_boundary**: If the task requires out-of-scope work, finish
   as `blocked` with an explanation rather than expanding scope silently.

## Anti-Patterns

| Anti-Pattern | Fix |
|--------------|-----|
| Vague one-liner task ("smoke test CLI") | Add goal + context_files + success_criteria |
| Duplicate fork within 5 min | Check `agents list` first |
| Interrupted session with no receipt | Caller must cancel or receiver must checkpoint |
| 0-ops "done" session | Receiver should finish as `blocked` if it cannot act |

## Enforcement

- Evaluator may flag sessions that fork/call without context_files or
  success_criteria as low-quality delegation.
- Agents with persistent context should reference this convention when
  dispatching work.

## Metrics

- `delegation.orphan_rate` — interrupted sessions with no finish receipt / total forks
- `delegation.duplicate_rate` — same-task forks within 10 min / total forks
- `delegation.zero_op_rate` — completed sessions with 0 ops / total forks

Target: all three metrics below 10% within 2 weeks of adoption.
