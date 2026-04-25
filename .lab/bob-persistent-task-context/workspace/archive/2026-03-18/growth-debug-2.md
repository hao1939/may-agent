# Agent Growth Debugging

## Problem
The `fork` -> `modify` -> `verify` -> `promote` cycle works on disk (file updated), but the live agent (`amy`) does not pick up the change immediately.

## Cause Analysis
The `SubagentManager` loads the `agent.json` config and constructs the agent instance.

In `src/lib/manager.ts`, `resolveSystemPrompt` reads `LESSONS.md`:
```typescript
    // 4. LESSONS.md — accumulated learnings (near end, changes often)
    const lessons = autoLoadFile(
      agentDir ? join(agentDir, "LESSONS.md") : undefined,
      def.knowledgeDir ? join(def.knowledgeDir, "lessons.md") : undefined,
    );
```
It reads this file *at the time the session starts* (inside `run()`).

However, `loadAgents` (in `src/app/agent-loader.ts`) is called at startup. It registers agents with the manager. The `RegisteredAgent` struct holds the `definition`.

When `promote_agent` runs, it copies files from `.lab/` to `agents/<name>/`. This updates the files on disk.

When `agents.call("amy", ...)` runs:
1. `manager.run("amy", ...)` is called.
2. It looks up `registered = this.agents.get("amy")`.
3. It gets `def = registered.definition`.
4. It calls `resolveSystemPrompt(def, ...)`.
5. `resolveSystemPrompt` reads `agents/amy/LESSONS.md` from disk.

So... if `resolveSystemPrompt` reads from disk every time `run()` is called, it *should* pick up the changes immediately.

**Why did it fail?**

My hypothesis:
1. `promote_agent` updated `agents/amy/LESSONS.md`.
2. I called `agents.call("amy", "What is the Magic Word?")`.
3. `manager.run` spawned a new session.
4. `resolveSystemPrompt` read the file.
5. `amy` still didn't know the word.

Possibilities:
A. `agents.call` didn't spawn a new session? (It says `sessionId: s_...` which is new).
B. `promote_agent` didn't actually update the file *before* I called `amy`. (Race condition?)
C. `amy` ignored the instruction in `LESSONS.md` (LLM failure).
D. The file read in `resolveSystemPrompt` is cached? (Node `readFileSync` is not cached, but maybe the FS is slow?)

**Investigation Step 1**: Verify `agents/amy/LESSONS.md` content *again*.
**Investigation Step 2**: Try asking Amy again. Maybe it was a transient LLM failure.
**Investigation Step 3**: Check if `promote_agent` overwrote the file correctly.

Let's do Step 2 first.
