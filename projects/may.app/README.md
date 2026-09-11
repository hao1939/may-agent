# May

**Implementation note:** This README describes the current separate supervision
Task in `app.ts`. The accepted [shared conversation-input design](../may-agent.app/docs/2a-design/message-lifecycle.md#one-conversation-input-path)
will handle linked Task and timer reviews through the conversation inbox.
That change is [pending implementation](../may-agent.app/docs/proposals/conversation-input-unification.md);
this documentation update does not change the running App.

People talk to **May** (`app:may`). May understands each turn and can answer,
investigate, edit, and verify directly within the authorized scope. An ordinary
Task records work needing continuation or later steering. May may own it;
another App is useful for existing ownership, required authority, or expertise.

The Host may use a replaceable executor such as `agent:may` for one attempt.
That executor is an implementation detail, not a second service or owner. The
Host request remembers who is owed an answer across retries and restarts.

```text
human -> May frontend -> direct work and answer, or input -> owning Task
                                      linked events -> May supervision -> useful update
```

A Topic groups related turns and links exact Tasks. It owns no work or status.
Conversation remembers discussion; Task state remembers the ongoing commitment.
Later natural messages can reuse that Topic and steer an exact unfinished Task;
May owns one normal visible supervision Task for human-linked work, not one
Task per human request. It does not parent, wait on, or duplicate destination
work.

Recovery reviews are not Conversation updates. After checking the exact Task,
an unchanged wait, previously reported unavailable App, or repeated recovery
notice normally ends with a quiet, evidence-backed `converged` result. Omit
`result.conversation` when there is no new useful fact, action or Request
disposition. Keep the review evidence on the supervision Task. A new blocker,
material change, concrete human decision, or explicit human status question
still deserves a clear answer. An intentionally disabled App is not permission
to enable it or replace its work.

Keep new progress separate from old asks. A maintained Task can produce useful
findings after the linked Request is fulfilled. Report those findings on their
own merits; old retry messages do not establish why a later cycle ran. Name a
retry or human-requested run only when current evidence supports that link.

This App owns no Host operations policy. Those outcomes belong to the separate
Host Operations App (stable compatibility ID `app:may-agent`).
