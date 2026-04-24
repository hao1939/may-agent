# Coach Correction Note — 2026-03-17T21:56

## 🛑 STOP calling `agents.call("checkpoint", ...)`

You have a `checkpoint()` tool in your session. Call it directly:
```
checkpoint({ summary: "What I did" })
```

`agents.call("checkpoint", ...)` spawns a full LLM session for what should be a local file write. You've done this 34 times in the last hour, wasting $5+ and 47 minutes of compute. See your LESSONS.md entry "checkpoint() is a Native Tool" for details.
