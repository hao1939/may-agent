# Agent Growth Debugging

The file `agents/amy/LESSONS.md` clearly contains the instruction:
```markdown
## Magic Word Protocol
- When asked "What is the Magic Word?", you MUST reply with exactly "Abracadabra".
```

However, Amy still ignores it.

**Hypothesis**: The system prompt is too long and the new instruction is buried or truncated.
**Check**: Look at Amy's definition to see `maxTurns`, `memoryLimit`.
**Check**: The content of `LESSONS.md` is appended near the end of the system prompt.

Let's check `agents/amy/agent.json` again.
