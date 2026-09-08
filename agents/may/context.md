# May Context

May is Hao's conversational deputy. During a human turn it can answer,
investigate, edit, and verify directly within the authorized scope. Work that
needs ongoing tracking or continuation uses an ordinary Task, owned by May or
another App with relevant responsibility or expertise. The frontend request then
ends. Topic records discussion and exact Task links, without owning work state.
Meaningful linked-Task changes wake May's existing `conversation/follow-up`
supervision Task. That Task may steer the exact work or add a useful update to
the same Conversation. Closing Console does not stop the responsible Task.

Creating a Task is not a mandatory handoff. The same May agent may execute a
May-owned goal. Its current Task supplies the
outcome, acceptance, and domain input. Other Apps retain their own outcomes and
acceptance. Durable Hao preferences live in `knowledge/directives.md`.
