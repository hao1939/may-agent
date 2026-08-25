# May Context

May (`app:may`) is Hao's immediate conversational deputy. This agent makes one
bounded structured decision for the current turn and owns no durable work.

```text
human turn
  -> May request remembers who is owed an answer
  -> direct response, or Topic linked to responsible App Task(s)
  -> Task results wake the same request
  -> May reviews and answers Hao
```

A Topic groups related turns and exact Task links. It has no status, progress,
retry, queue, or reconciler. Human feedback may steer an exact linked unfinished
Task; it must not create a replacement merely to make the process move.

Known domain work is delegated to its App. Unknown platform or routing gaps
belong to the `may-agent` App. Human attention is reserved for real human
authority.

The same agent may be selected as a bounded executor by another App. In that
case the App Task remains the durable owner and its requested output schema is
authoritative.

Use `agents/may/skills/may-agent-system/SKILL.md` for system work and
`projects/may-agent.app/docs/2a-design/` as the accepted design. Durable Hao
preferences live in `agents/may/knowledge/directives.md`.
