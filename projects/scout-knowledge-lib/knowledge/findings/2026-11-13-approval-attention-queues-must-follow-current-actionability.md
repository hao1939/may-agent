<ai_context>
summary: "Pinned Lobu source separates approval audit history from the live attention queue. An unread approval counts as actionable only while its current run remains pending and its review resource remains visible and reachable; expired, decided, or unreachable items stay in history without inflating unread counts. Scout reviewed producer-authored source and tests statically but did not run Lobu or its test suite."
triggers: ["agent approval inbox", "actionable notifications", "unread approval", "attention queue", "expired approval", "approval history", "human review queue", "Lobu"]
last_updated: "2026-11-13"
source_basis: "Static review of producer-authored GitHub source and tests at pinned revision 0f69deaf123e5d9d06eedc260cbb4c04615374d9."
</ai_context>

# Approval attention queues must follow current actionability

**Date:** 2026-11-13  
**Disposition:** New source-grounded implementation signal  
**Repo:** https://github.com/lobu-ai/lobu  
**Inspected revision:** [`0f69deaf123e5d9d06eedc260cbb4c04615374d9`](https://github.com/lobu-ai/lobu/commit/0f69deaf123e5d9d06eedc260cbb4c04615374d9)

## Question

How should an agent system keep approval history without letting expired or
unreachable requests pollute the human attention queue?

## What the source implements

Lobu's pinned notification service does not equate an unread bit with current
work for a reviewer. For an agent-action approval, it resolves the notification
back to the proposal event and its current run. The item counts as unread and
actionable only while the run's `approval_status` is still `pending` and any
connection needed to open the review card remains live and visible to that
reader. A deleted, private-to-someone-else, expired, or already-decided approval
therefore stops contributing to the attention queue.

This is a projection over live state, not destructive cleanup. The inspected
integration test creates three unread approvals, then expires one run and
deletes the connection behind another. The unread count falls from three to one
and both the unread and attention lists retain only the still-decidable item.
The ordinary history query still returns all three records, including the two
unread records whose current approval state is now expired.

The implementation centralizes that rule in one `unreadNotificationFilter` and
uses it for the ordinary unread count, notification lists, Slack home inbox, and
per-client activity badges. That reduces a second failure mode: different UI
surfaces independently deciding what “needs attention” means and drifting into
contradictory counts.

## Reusable design signal

**An attention queue is a current-actionability view over durable history, not a
synonym for records that have never been marked read.** Agent approval systems
need at least three distinct facts:

1. **Historical receipt:** the request was emitted and who received it.
2. **Read state:** the recipient has or has not opened the receipt.
3. **Decision liveness:** the requested decision can still produce an effect
   under current run state, resource reachability, visibility, and authority.

Only the third fact determines whether an approval belongs in a live work queue.
Keeping it separate from read state prevents an expired request from remaining
an infinite obligation, while preserving the original unread receipt for audit
and incident reconstruction.

A practical projection is:

```text
attention = visible_to_reviewer
         AND receipt_is_unread
         AND request_is_still_pending
         AND review_target_is_reachable
         AND reviewer_can_still_decide
```

The final authorization and effect checks must still run when the reviewer acts;
queue membership is a discoverability rule, not an execution grant. Systems
should also return an explicit resolution reason—decided, expired, target
removed, or no longer visible—so a disappearing badge is explainable from the
history.

This complements the library's finding that [agent attention is a
provider-specific observation](./2026-09-30-provider-specific-agent-attention-signals.md).
That source focuses on whether a runtime emitted enough evidence to infer human
attention. Lobu contributes the queue-side rule: even a correctly observed
approval request should stop demanding attention when the underlying decision
is no longer live.

## Limits and open boundaries

- Scout reviewed producer-authored source and tests statically. It did not
  install Lobu, start its database or services, execute the test suite, or
  reproduce the inbox behavior.
- The inspected test demonstrates authored behavior for selected expiry and
  deleted-connection cases; it does not prove that every notification producer
  or UI surface uses the shared filter.
- Repository source does not establish production scale, race-free behavior,
  or consistency across concurrent state changes while a reviewer is acting.
- Current reachability is inferred from run, connection, organization, and
  ownership state in the inspected query. Other deployments may need additional
  liveness inputs such as delegated authority, task generation, lease expiry,
  resource version, or effect-specific policy.
- Removing an item from attention does not notify the reviewer why it became
  non-actionable. Explainable resolution still needs a visible history state or
  transition receipt.
- A live notification is not sufficient authorization to execute the action;
  policy and state must be revalidated at the effect boundary.

## Primary inspected sources

- [Pinned repository README](https://github.com/lobu-ai/lobu/blob/0f69deaf123e5d9d06eedc260cbb4c04615374d9/README.md)
- [Commit consolidating live unread semantics](https://github.com/lobu-ai/lobu/commit/0f69deaf123e5d9d06eedc260cbb4c04615374d9)
- [Notification live-state projection](https://github.com/lobu-ai/lobu/blob/0f69deaf123e5d9d06eedc260cbb4c04615374d9/packages/server/src/notifications/service.ts)
- [Approval live-state integration test](https://github.com/lobu-ai/lobu/blob/0f69deaf123e5d9d06eedc260cbb4c04615374d9/packages/server/src/__tests__/integration/notifications/approval-live-state.test.ts)
- [Slack home inbox reuse of the filter](https://github.com/lobu-ai/lobu/blob/0f69deaf123e5d9d06eedc260cbb4c04615374d9/packages/server/src/gateway/connections/chat-instance-manager.ts)
- [Client activity badge reuse of the filter](https://github.com/lobu-ai/lobu/blob/0f69deaf123e5d9d06eedc260cbb4c04615374d9/packages/server/src/lobu/client-activity-scope-routes.ts)

## Discovery record

GitHub Repository Search API query: `topic:ai-agents stars:>100`, sorted by
`updated` descending, 20 results. The API returned `incomplete_results: false`.
Repository contents were inspected only after pinning the revision above.
