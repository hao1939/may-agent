# Agent Growth Debugging

**Conclusion**: The file `agents/amy/LESSONS.md` IS on disk, and contains the magic word instruction.

**Why is Amy not following it?**

1. **System Prompt Construction**:
   - `src/lib/manager.ts` reads `LESSONS.md`.
   - It appends it to the system prompt.
   - The file is relatively short.

2. **Model**: Amy uses `opus`.

3. **Behavior**:
   - `agents.call("amy")` spawns a new session.
   - `new Agent(...)` calls `resolveSystemPrompt`.
   - `resolveSystemPrompt` reads `LESSONS.md`.

Wait. `resolveSystemPrompt` logic:
```typescript
    // 4. LESSONS.md — accumulated learnings (near end, changes often)
    const lessons = autoLoadFile(
      agentDir ? join(agentDir, "LESSONS.md") : undefined,
      def.knowledgeDir ? join(def.knowledgeDir, "lessons.md") : undefined,
    );
    if (lessons) sections.push(lessons);
```
Where `agentDir` is `agents/amy`.

Is it possible that `resolveSystemPrompt` is using a cached/stale `def`? No, `def` is just config.

**Is it possible that the file system read is cached?** `readFileSync` is synchronous and reads from disk. Unless `fs` is mocked or overlayed (Docker volume delay?), it should be instant.

**Test**: Let's create a *new* agent `amy-test` via `fork_agent` that has the instruction pre-baked, and see if it works. This will tell us if it's an Amy-specific issue or a general issue.

Coach already did this with `amy-magic` and it worked!
The report said:
> **3. Verify** | Confirmed `amy-magic` contains "Abracadabra" | ✅ PASS

So `amy-magic` (the fork) worked. The live `amy` (after promotion) failed.

**Why did the fork work but the promoted live agent fail?**
- `amy-magic` was a *new* agent registered dynamically.
- `amy` is an *existing* agent registered at startup.

Maybe `manager` caches file contents for existing agents?
I don't see any caching in `resolveSystemPrompt`. It calls `readFileSync`.

**Wait!**
`SubagentManager` keeps `agents` in a Map: `private agents = new Map<string, RegisteredAgent>();`.
The `RegisteredAgent` struct has `definition`.
The definition has `knowledgeDir` etc.

When `promote_agent` runs:
1. It copies `LESSONS.md` to `agents/amy/LESSONS.md`.
2. It does NOT reload the agent definition (because `amy` is already registered).

But `resolveSystemPrompt` reads the file *content* every time. It doesn't cache the content in `definition`.

Let's look at `resolveSystemPrompt` again.

```typescript
    const agentDir = def.knowledgeDir ? dirname(def.knowledgeDir) : undefined;
```

For `amy`:
`knowledgeDir` is `agents/amy/knowledge` (implied by convention in `agent-loader.ts`?).
Let's check `agent-loader.ts`:

```typescript
            const knowledgeDir = resolve(agentDir, "knowledge");
            const workspace = resolve(agentDir, "workspace");
            // ...
            manager.register({
              // ...
              knowledgeDir: existsSync(knowledgeDir) ? knowledgeDir : undefined,
```

If `agents/amy/knowledge` exists, `def.knowledgeDir` is set.
Then `agentDir` (in `resolveSystemPrompt`) becomes `agents/amy`.
Then it looks for `agents/amy/LESSONS.md`.

This all seems correct.

**Is it possible that the `agents` tool in Bob's session is holding a stale session for Amy?**
No, `agents.call` (with no sessionId) creates a new session.

**Wait. I see something in `manager.ts`**:
```typescript
    // 4. LESSONS.md — accumulated learnings (near end, changes often)
    const lessons = autoLoadFile(
      agentDir ? join(agentDir, "LESSONS.md") : undefined,
      def.knowledgeDir ? join(def.knowledgeDir, "lessons.md") : undefined,
    );
```
It tries `agents/amy/LESSONS.md` first.

Maybe the issue is that `amy` has a *very strong* system prompt or identity that overrides the magic word?
But `amy-magic` (the fork) worked, and it's a clone of `amy`.

**Difference between `amy-magic` and `amy`**:
- `amy-magic` was registered *after* the change (or during fork).
- `amy` was registered at startup.

If `agent-loader.ts` pre-reads anything...
`loadAgents` calls `validateAgentConfig`. It doesn't read `LESSONS.md`.

**What if the `promote` operation failed silently?**
Coach reported success.
I verified the file content with `read`. It *is* there.

**Is there a character encoding issue?**
The file ends with `Abracadabra".` (with a newline?)
Let's check the exact bytes if we can. Or just `cat -e`.

**Another possibility**: `amy` has a `knowledge` directory with `lessons.md` inside it?
If both exist, which one wins?
`autoLoadFile` takes `primary` and `fallback`.
Primary: `agents/amy/LESSONS.md`.
Fallback: `agents/amy/knowledge/lessons.md`.

If `agents/amy/LESSONS.md` exists, it uses it.

**Let's try to debug by making Amy read her own LESSONS.md.**
