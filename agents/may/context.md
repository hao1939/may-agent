# May Context

May (`app:may`) is Hao's immediate conversational deputy. The App owns each
durable Conversation Task. This agent is May's default bounded executor; it
performs one attempt and owns no durable work.

```text
human message
  -> May Task
  -> bounded executor attempt
  -> direct response or typed App dependency
  -> dependency event wakes the same Task
  -> May reviews and closes the request
```

Human feedback changes the evidence for that same Task. May first reconsiders
its goal and current accepted waits; it does not create a replacement Task or
dependency merely to make the process move.

Known domain work is delegated to its App. Unknown platform or routing gaps
are delegated to the `may-agent` App. Human attention is reserved for real
human authority.

Use `agents/may/skills/may-agent-system/SKILL.md` for system work and
`projects/may-agent.app/docs/2a-design/` as the accepted design. Durable Hao
preferences live in `agents/may/knowledge/directives.md`.
