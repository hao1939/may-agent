# Synthesis: KV-Cache Engineering (P204)

## Context
Research from Manus, LangChain, and Anthropic confirms that **context engineering is the primary lever for agent performance**. Specifically, the KV-cache hit rate determines both cost and latency. A single volatile token at the start of the context (like a timestamp) invalidates the entire cache, forcing a full re-computation every turn.

Our current system prompt (`src/lib/manager.ts`) includes:
```typescript
const ctxLines = [
  `# Session Context`,
  `- Session ID: ${sessionId}`,
  `- Current Time: ${new Date().toISOString()}`, // <--- Volatile!
];
```
This is prepended to the *first user message* (good), but in `resolveSystemPrompt` we also see:
```typescript
// 6. Runtime Environment — paths and workspace
// ...
// 7. Session Context is now delivered via the first user message
```

## Evidence
`src/lib/manager.ts` (lines 142-209):
- `resolveSystemPrompt` builds the stable system prompt from SOUL, DOMAIN, TOOLS, LESSONS, INDEX.
- It *does not* include the volatile Session ID or Time.
- `buildSessionContext` (lines 212-237) builds the volatile block.
- Line 562: `const promptText = \`\${sessionContext}\n\n---\n\n\${task}\`;`
- This `promptText` is passed to `agent.prompt()`.

## Analysis
Our architecture is **already P147 compliant**.
- **System Prompt**: Stable (SOUL + DOMAIN + TOOLS + LESSONS). Cacheable.
- **User Message 1**: Volatile (Session ID + Time + Task). Invalidates cache only for the *last* turn, not the *prefix*.

However, `resolveSystemPrompt` does include:
```typescript
// 6. Runtime Environment — paths and workspace
{
  const relPath = def.projectRoot ? (abs: string) => relative(def.projectRoot!, abs) || "." : (abs: string) => abs;
  const envLines = [`# Runtime Environment`];
  if (def.projectRoot) {
     envLines.push(`- Project root: ${def.projectRoot}`);
  }
  // ...
}
```
If `def.projectRoot` or `agentDir` are stable (which they are), this is fine.

**The Gap**:
The Manus blog highlights "Make context append-only — avoid modifying previous messages".
Our `resumeSession` logic (lines 665-680) *replaces* the message history if the last message was malformed (`agent.replaceMessages(savedMessages)`). This invalidates the cache for the resumed session. This is acceptable for crash recovery (rare).

**The Real Gap**:
We don't have a structural way to *prevent* agents from putting timestamps in their `SOUL.md` or `DOMAIN.md`. If a user edits `SOUL.md` and adds "Last Updated: 2026-03-15", that breaks the cache if they update it frequently.

**New Insight from Manus**:
"KV-cache hit rate is the #1 production metric."
We don't measure this. We should.

## Principle P204: Context Stability
**"Static Prefix, Volatile Suffix."**
- The system prompt must be bit-identical across sessions to maximize cache hits.
- Volatile data (IDs, timestamps, task specifics) must live in the *first user message*, not the system prompt.
- Never put a timestamp in `SOUL.md` or `DOMAIN.md` that changes automatically.

## Actions
1. **Verify Compliance**: Our `manager.ts` code is correct.
2. **Add Telemetry**: We need to know our cache hit rate. (Defer to L3 Metrics).
3. **Formalize**: Add P204 to `philosophy.md`.

## Decision
The system is safe. I will formalize the principle to prevent regression.
