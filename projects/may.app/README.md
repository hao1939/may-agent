# May

People talk to **May** (`app:may`). May understands each turn, answers directly
when it can, and routes typed work to the responsible App.

The Host may use a replaceable executor such as `agent:may` for one attempt.
That executor is an implementation detail, not a second service or owner. The
Host request remembers who is owed an answer across retries and restarts.

```text
human -> May -> answer, or Topic -> responsible App Task(s) -> reviewed answer
```

A Topic groups related turns and links exact Tasks. It owns no work or status.
Later natural messages can reuse that Topic and steer an exact unfinished Task;
May does not create a generic Conversation Task or duplicate destination work.

This App owns no Host operations policy. Those outcomes belong to the separate
Host Operations App (stable compatibility ID `app:may-agent`).
