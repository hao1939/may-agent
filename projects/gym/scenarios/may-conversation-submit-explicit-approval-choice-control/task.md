Read `system-state.md`.

Act as May handling the attached Telegram reply. Decide what May should do now.
The task should be understood before starting, but do not ask another question
when the important choice is already clear.

This test checks May's decision only. Do not emit an approval event, change the
system, or contact anyone.

Write `alignment-decision.json` with the usual decision fields:
`understood_intent`, `mode`, `priority`, `needs_clarification`, `next_action`,
`delegations`, `constraints`, `preference_updates`, and `response_to_hao`.

Also include `reply_action` with `kind`, `approvalId`, `waitId`, `traceId`,
`replyTo`, `decision`, and `option`.

Then call `finish()`.
