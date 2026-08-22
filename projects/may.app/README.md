# May App

People talk to **May**. This App (`app:may`) is May's durable part: it keeps
each human obligation alive across attempts and routes typed work to the
responsible App.

The Host may use the replaceable **May worker** (`agent:may`) to reason about
one attempt. That worker is an implementation detail, not a second service or
owner: it may fail or be replaced while this App's Task remains.

```text
human -> May -> Conversation Task -> answer or responsible App
```

This App owns no Host operations policy. Those outcomes belong to the separate
Host Operations App (stable compatibility ID `app:may-agent`).
