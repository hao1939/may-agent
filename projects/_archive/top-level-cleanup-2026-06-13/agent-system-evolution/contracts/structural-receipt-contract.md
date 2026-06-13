# Structural Receipt Harness Contract

Date: 2026-05-21
Owner: `agent-system-evolution`
Implementation owner: `platform`
Validation owner: `evaluator-receipt-coverage`

## Problem

Fresh successful sessions are still closing with success/completion language but
without persisted structural receipts. Evaluator can detect this, but detection
does not create the proof that a successful closeout needs.

The harness contract is simple: when an agent session closes successfully, the
system must persist at least one machine-readable receipt that proves what the
agent claims it completed.

## Contract

A successful session closeout must leave a structural receipt in canonical
session history. The receipt must be persisted as part of the session record, not
only printed in assistant prose.

Minimum receipt fields:

```yaml
type: session.receipt
sessionId: <canonical session id>
owner: <agent or routable owner that ran the session>
status: success
summary: <short completion summary>
evidence:
  - kind: file | command | event | task | comment | other
    ref: <path, command label, event id, task id, or stable reference>
    note: <why this supports the success claim>
createdAt: <iso timestamp>
```

The exact storage format can be JSON, event data, or a session-history message,
but the read model must make the same fields queryable without parsing natural
language.

## Persistence Surface

Platform should persist the receipt at the successful closeout boundary:

- when `finish(status: "success")` or equivalent successful session completion
  is accepted,
- after any finish guard or closeout validation has passed,
- before the session is marked canonically `done`.

The receipt should be visible through the canonical session history used by
evaluator audits. If platform also emits a canonical event, that event should
follow the same event envelope/data layering as other events; the receipt fields
belong in `data`.

## Validation Signal

`projects/evaluator-receipt-coverage/project.md` remains the validation tracker.
Its audit should check the newest successful non-evaluator sessions and count
how many have at least one structural `session.receipt` persisted in canonical
history.

Baseline signal:

- Current coverage is effectively `0/20` for newest successful non-evaluator
  sessions.

Acceptance signal:

- Repeated fresh-session audits show material movement above baseline.
- A healthy target is `>= 4/5` newest successful non-evaluator sessions with a
  persisted structural receipt.
- Unsupported success-language-only sessions should remain evaluator concerns
  until platform closes the persistence gap.

## Platform Request

Please implement the closeout persistence path so successful sessions persist a
structural `session.receipt` before they become canonical `done`.

Acceptance criteria:

- Unit or integration coverage proves `finish(success)` creates a receipt.
- The receipt is present in canonical session history/read model after closeout.
- Failure, blocked, and partial sessions do not masquerade as success receipts.
- Existing evaluator receipt audit can validate new receipts without parsing
  assistant prose.
- The implementation keeps evaluator as validator, not owner of receipt
  persistence.

## Non-Goals

- Do not make evaluator synthesize receipts after the fact.
- Do not require every agent to hand-format receipt prose.
- Do not block all non-success exits on receipt quality.
- Do not make this project own platform runtime code.

