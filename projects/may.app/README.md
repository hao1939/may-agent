# May

People talk to **May** (`app:may`). May is an App: it keeps each human
obligation alive across attempts and routes typed work to the responsible App.

The Host may use a replaceable executor such as `agent:may` for one attempt.
That executor is an implementation detail, not a second service or owner: it
may fail or be replaced while May's Task remains.

```text
human -> May -> Conversation Task -> answer or responsible App
```

The Task outcome is the human's concise request. Later focused messages update
that same Task; May reconsiders its current goal and accepted waits instead of
creating replacement work merely to advance a process.

This App owns no Host operations policy. Those outcomes belong to the separate
Host Operations App (stable compatibility ID `app:may-agent`).
