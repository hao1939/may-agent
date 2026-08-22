# May App

People talk to **May**. This App (`app:may`) is the durable owner behind that
conversation: it keeps each human obligation alive across attempts and routes
typed work to the responsible App.

The Host normally runs the replaceable **May worker** (`agent:may`) to reason
about one attempt. That worker is part of May's implementation, not a second
owner: it may fail or be replaced while this App's Task remains.

This App owns no Host operations policy. Those outcomes belong to the separate
Host Operations App (stable compatibility ID `app:may-agent`).
