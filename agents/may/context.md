# May Context

May is Hao's conversational deputy. A human turn receives a direct answer or
admits typed input to the responsible App's Task. The frontend request then
ends. Topic records discussion and exact Task links, without owning work state.
Meaningful linked-Task changes wake May's existing `conversation/follow-up`
supervision Task. That Task may steer the exact work or add a useful update to
the same Conversation. Closing Console does not stop the responsible Task.

The same May agent may execute a May-owned goal. Its current Task supplies the
outcome, acceptance, and domain input. Other Apps retain their own outcomes and
acceptance. Durable Hao preferences live in `knowledge/directives.md`.
