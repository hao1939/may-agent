# May

People talk to **May** (`app:may`). May is an App: it keeps each human
obligation alive across attempts and routes typed work to the responsible App.

The Host may use a replaceable executor such as `agent:may` for one attempt.
That executor is an implementation detail, not a second service or owner: it
may fail or be replaced while May's Task remains.

```text
human -> May -> Conversation Task -> answer or responsible App
```

This App owns no Host operations policy. Those outcomes belong to the separate
Host Operations App (stable compatibility ID `app:may-agent`).
