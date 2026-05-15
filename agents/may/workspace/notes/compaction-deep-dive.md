# Compaction System Deep Dive

*Generated 2026-04-12 from reading `src/lib/compaction.ts`, `src/lib/persistence.ts`, `src/lib/manager.ts`, and tests.*

---

## 1. What Is Compaction?

Compaction is a **context window management** system that prevents LLM conversations from exceeding the model's token limit during long-running sessions. It works by **summarizing older messages** into a compact text block while keeping recent messages intact.

**Critical design principle:** The original messages on the Agent are NOT modified — `transformContext` only affects what gets sent to the LLM. The full conversation is still persisted to the append-only `session.jsonl`. This means:
- The full history is always recoverable from disk
- Compaction is a **view layer** transformation, not destructive
- However, the LLM only sees the compacted version, so from its perspective, the old details are gone

---

## 2. When Does Compaction Trigger?

### Trigger Condition
Compaction triggers when **estimated token usage exceeds a threshold fraction of the context window**.

```
triggerTokens = contextWindow × threshold (default 0.7 = 70%)
```

For May (using claude-opus-4.6 with 200K context window):
- **Trigger point:** ~140,000 tokens (70% of 200K)
- **Keep budget:** ~80,000 tokens (40% of 200K) of most recent messages preserved intact

### Token Estimation
Tokens are estimated at **1 token ≈ 3 characters** (intentionally conservative — overestimates token count so compaction fires before actually hitting the limit). The comment notes a previous value of 4 chars/token *underestimated*, causing context overflow on LLM calls.

```typescript
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3);
}
```

### When It Runs
The transform function is called **on every LLM request** (it's set as the `transformContext` on the Agent). The check is fast — if under threshold, it returns the original messages array unchanged (same reference, no copy).

### Multi-Pass Safety
If after one compaction pass the result still exceeds 85% of context window (the "safety ceiling"), compaction runs **up to 3 passes** with progressively tighter keep budgets (each pass multiplies keepTokens by 0.6). This handles estimation drift.

---

## 3. What Gets Kept vs. Discarded

### The Split Point
Messages are divided into **old** (to be summarized) and **recent** (kept intact):

1. Walk backward from the end, accumulating tokens until the `keepTokens` budget is reached
2. The split point is adjusted forward to avoid breaking tool call / tool result pairs
3. Must compact at least 2 messages (splitAt > 1), otherwise skip

For May: the most recent ~80K tokens of conversation stay verbatim.

### What Survives Compaction (always preserved)

| Element | How It Survives | Location in Output |
|---------|----------------|-------------------|
| **Original task** | Cached on first compaction, reproduced verbatim in every subsequent round | `[Original task]` block at top of summary |
| **Files read** | Extracted as KeyFacts, merged across rounds (Set union) | `[Key facts across compaction rounds]` |
| **Files written** | Same as above | Key facts block |
| **Files edited** | Same as above | Key facts block |
| **Exec commands** | Extracted with pass/fail status, deduped by command string (latest outcome wins), capped at 15 | Key facts block |
| **Agent calls** | Extracted (agent + task), deduped by agent:task combo | Key facts block |
| **Last substantial reasoning** | The most recent assistant text block ≥100 chars (capped at 2000 chars) from the compacted region | `[Last reasoning before compaction]` |
| **Structural tool call log** | Tool names, file paths for read/write/edit, truncated text blocks | Body of compacted summary |
| **Recent messages** | Kept verbatim (the most recent ~40% of context window) | After `[END COMPACTED CONTEXT]` marker |

### What Gets Lost

| Element | What Happens |
|---------|-------------|
| **Exact file contents** | Read tool results are truncated to 200 chars (300 for errors). The warning "File contents from before compaction are SUMMARIZED, not exact. Re-read any file before overwriting it." is injected. |
| **Full tool output** | Only a preview is kept. Long test outputs, grep results, etc. are reduced to a snippet. |
| **Assistant reasoning history** | Only the LAST substantial text block survives. Earlier reasoning/plans/diagnoses are reduced to 200-char previews. |
| **Thinking blocks** | If >200 chars, reduced to 150-char preview with "(thinking: …)" prefix. If ≤200 chars, kept in full. |
| **User messages** | Truncated to first 200 chars in the summary. |
| **Exact error messages** | Only first 300 chars of error tool results survive. |
| **Conversation flow** | The back-and-forth structure is flattened to `[User] ... [Assistant] ... [exec] ...` log lines. |

### The Accumulated Summary Budget
The accumulated summary (from all compaction rounds combined) is capped at **15% of context window**:
```
summaryBudgetChars = max(8000, contextWindow × 0.15 × 3)
```

For May: `max(8000, 200000 × 0.15 × 3)` = **90,000 characters** (~30K tokens).

When exceeded, **oldest compaction sections are trimmed first** (sections are delimited by `--- (compacted) ---` markers). The trimming algorithm:
1. Split by section delimiter
2. Walk from newest to oldest, adding sections until budget exceeded
3. Prepend notice: "earlier compaction rounds trimmed — key context preserved below"

---

## 4. How KeyFacts Get Extracted

### Extraction (`extractKeyFacts`)
Scans all messages looking for specific tool call patterns:

1. **Files read**: `read` tool calls → `args.path` → added to `filesRead` Set
2. **Files written**: `write` tool calls → `args.path` → added to `filesWritten` Set  
3. **Files edited**: `edit` tool calls → `args.path` → added to `filesEdited` Set
4. **Agent calls**: `agents` tool with `action: "call"` → `{agent, task}` recorded (task truncated to 120 chars)
5. **Exec commands**: `exec` tool calls are paired with their `toolResult` by `toolCallId` to determine pass/fail status

### Merging (`mergeKeyFacts`)
Across compaction rounds:
- **File sets**: Simple union (`Set` merge)
- **Agent calls**: Deduped by `agent:task` key, latest kept
- **Exec commands**: Deduped by command string, latest outcome wins, capped at 15 (oldest dropped)

### Formatting (`formatKeyFacts`)
Output includes the critical warning when files were read:
```
Files read: src/a.ts, src/b.ts
⚠️ File contents from before compaction are SUMMARIZED, not exact. Re-read any file before overwriting it.
Files written: src/c.ts
Files edited: src/d.ts
Exec commands run:
  [ok] npx vitest run
  [FAILED] npx tsc --noEmit
```

---

## 5. The conversation-state.md Mechanism

### What It Is
`conversation-state.md` is a **file-based persistent context** mechanism for May — it's conceptually "RAM" for the human conversation. It's listed in May's `agent.json` as a `context_file`.

### How It's Loaded
In `buildSessionContext()` (manager.ts), context files are loaded and appended to the **first user message** (not the system prompt). This is deliberate — per P147 KV-Cache Discipline:
- System prompt must be identical across sessions for Anthropic prompt caching
- context_files change between sessions, so they go in the user message
- This means conversation-state.md content is visible to the LLM at session start

### What It Contains (current state)
```markdown
# Conversation State
## 🎯 Current Focus (The Stack)
## ⏳ Pending Human Input  
## 🌡️ Interaction Mode
## 📝 Recent Decisions (Last 5)
## 📚 Session Memory (Last 3)
```

### Its Relationship to Compaction
conversation-state.md is a **compaction survival mechanism**. Because:
1. Compaction loses the human conversation context (what Hao cares about, what was decided)
2. context.md (persistent context from `finish(context_updates)`) survives via separate loading
3. conversation-state.md captures the *transient* operational state that context.md doesn't cover

**The three layers:**
| Layer | File | Analogy | What Survives Restart |
|-------|------|---------|----------------------|
| ROM | SOUL.md, common-sense.md | Identity | Always (system prompt) |
| Persistent | context.md | Long-term memory | Always (loaded every session) |
| RAM | conversation-state.md | Working memory | Always (loaded every session as context_file) |
| Volatile | LLM conversation | Short-term memory | **Lost on compaction/restart** |

### How It's Updated
The `extract-directives` skill (in `agents/shared/skills/`) includes Mechanism C which updates conversation-state.md after human conversations. It extracts 5 fields from human interaction and writes them to the file.

---

## 6. Persistence and Resume

### During a Session
When compaction occurs, the compacted messages are **persisted to disk** as `session-compact.jsonl`:
```
.state/sessions/<sessionId>/session-compact.jsonl  (compacted snapshot)
.state/sessions/<sessionId>/session.jsonl           (full append-only log, never modified)
```

The `saveCompactedMessages` function is **atomic**: writes to `.tmp` first, then renames.

### On Resume
When a session is resumed (`resumeSession` in manager.ts):
```typescript
const compactedMessages = readCompactedMessages(persistDir, sessionId);
let savedMessages = compactedMessages ?? readSessionMessages(persistDir, sessionId);
```

**Compacted snapshot takes priority** over full JSONL. This prevents the "168K token crash loop" where the full JSONL always overflows the context window on resume.

### Crash Recovery
If the process crashes mid-tool-call, the resume path:
1. Loads compacted messages (or full JSONL if no compacted snapshot)
2. Detects orphaned tool calls (assistant message with toolCalls but no toolResult)
3. Injects error toolResult messages: "Error: process restarted while this tool call was in progress."

---

## 7. The Complete Message Flow

```
Session Start:
┌─────────────────────────────────────────┐
│ System Prompt (cached, identical)        │
│ ├── SOUL.md                              │
│ ├── common-sense.md                      │
│ ├── skills/*.md                          │
│ └── Runtime Environment (deterministic)  │
├─────────────────────────────────────────┤
│ First User Message (varies per session)  │
│ ├── Session Context (ID, time)           │
│ ├── Recent Task History (digests)        │
│ ├── Active Recall warnings               │
│ ├── Last Checkpoint                      │
│ ├── conversation-state.md (context_file) │
│ ├── context.md (persistent context)      │
│ ├── Knowledge routing (heartbeats only)  │
│ └── The actual task text                 │
├─────────────────────────────────────────┤
│ [Conversation messages…]                 │
└─────────────────────────────────────────┘

After Compaction:
┌─────────────────────────────────────────┐
│ System Prompt (unchanged)                │
├─────────────────────────────────────────┤
│ [COMPACTED CONTEXT] (synthetic user msg) │
│ ├── [Original task] (cached, verbatim)   │
│ ├── [Key facts] (merged across rounds)   │
│ └── Structural summary of old messages   │
│     └── [Last reasoning] (verbatim)      │
├─────────────────────────────────────────┤
│ [Recent messages, kept intact]           │
└─────────────────────────────────────────┘
```

**Note:** After compaction, the original first user message (with session context, conversation-state.md, context.md, etc.) is gone — it's been summarized into the compacted context block. Only the `[Original task]` portion is explicitly preserved. The conversation-state.md content, context.md content, checkpoint data, and digest history from that first message are reduced to whatever the structural summary captured (200-char truncated snippets).

---

## 8. Practical Implications for Agent Memory

### What Agents Can Rely On After Compaction
1. **The original task** — always preserved, up to 500 chars
2. **Which files were touched** — full paths, deduplicated
3. **Which commands were run** — with pass/fail, up to 15 most recent
4. **The most recent reasoning** — up to 2000 chars of the last substantial thought
5. **Recent conversation** — the most recent ~40% of context window is verbatim

### What Agents CANNOT Rely On After Compaction
1. **Exact file contents** — must re-read before editing
2. **Exact error messages** — only 300-char previews survive
3. **Earlier reasoning/plans** — only the LAST substantial block survives
4. **Human priorities from conversation-state.md** — these are in the first user message, which gets compacted. The agent's persistent `context.md` survives (loaded fresh every session), but conversation-state.md content only survives if it was loaded at session start AND the session hasn't compacted yet.
5. **Detailed tool outputs** — grep results, test logs, file listings are heavily truncated
6. **The back-and-forth debugging history** — "I tried X, it failed because Y, then tried Z" collapses to log lines

### Why Context Loss Is Sneaky
The compacted context **looks reasonable** — it has the task, key facts, recent reasoning, and recent messages. The agent doesn't know what it's forgotten. The most dangerous scenario:

1. Agent reads file A early in session
2. Much conversation happens
3. Compaction fires — file A's contents are reduced to "Files read: A"
4. Agent needs to edit file A, but has only a vague summary of its contents
5. **If the agent doesn't re-read**, it may write incorrect changes based on the 200-char preview

The `⚠️ File contents from before compaction are SUMMARIZED, not exact` warning addresses this, but relies on the agent heeding it.

### The Multi-Session Recovery Stack
For truly durable memory, agents rely on **multiple layers** that each survive different failure modes:

| Layer | Survives Compaction? | Survives Session End? | Survives Restart? |
|-------|---------------------|-----------------------|-------------------|
| Recent messages | ✅ (the recent ~40%) | ❌ | ❌ |
| Key facts | ✅ | ❌ (within session only) | ❌ |
| conversation-state.md | ⚠️ (in first user msg) | ✅ | ✅ |
| context.md | ⚠️ (in first user msg) | ✅ | ✅ |
| Session digests | N/A (loaded at start) | ✅ (written at end) | ✅ |
| SOUL.md / common-sense.md | ✅ (system prompt) | ✅ | ✅ |
| Checkpoints | N/A (loaded at start) | ✅ | ✅ |
| Knowledge entries | N/A (routed at start) | ✅ | ✅ |

### Key Numbers (for May, 200K context window)
| Parameter | Value |
|-----------|-------|
| Trigger threshold | 140K tokens (70%) |
| Keep budget | 80K tokens (40%) |
| Safety ceiling | 170K tokens (85%) |
| Summary budget | 90K chars (~30K tokens, 15%) |
| Min summary budget | 8K chars |
| Token estimation | 1 token ≈ 3 chars |
| Original task cap | 500 chars |
| Last reasoning cap | 2000 chars |
| Substantial text min | 100 chars |
| Tool result preview (ok) | 200 chars |
| Tool result preview (error) | 300 chars |
| Max exec commands in facts | 15 |
| Max compaction passes | 3 |

---

## 9. Handoff Integration

The `extractKeyFacts` function from compaction.ts is also used by the **handoff system** (`src/lib/handoff.ts`). When a workflow step completes, `summarizeForHandoff()` uses the same KeyFacts extraction to build a structured summary for the next step. This ensures consistent file/command tracking between compaction and inter-agent handoffs.

---

## 10. Design Insights

### Why Structural Extraction, Not LLM-Based
The summary is built by **parsing message structure** (tool call names, file paths, text snippets), not by asking an LLM to summarize. This makes it:
- **Fast** — no LLM round-trip
- **Deterministic** — same input always produces same output
- **Cheap** — no token cost for summarization
- **Reliable** — no risk of hallucinated summaries

The tradeoff: the structural summary loses semantic understanding. An LLM-based summary could say "the agent discovered the bug was in the auth middleware and proposed a fix involving JWT rotation." The structural summary says `[read: src/auth.ts] [exec ok] npm test [Assistant] The assertion should use toEqual instead…`

### The Statefulness Problem
`createCompactionTransform` returns a **closure** that maintains state across calls:
- `compactionCount` — increments across compactions
- `accumulatedSummary` — grows with each round
- `accumulatedKeyFacts` — merges across rounds
- `cachedOriginalTask` — set once, never changes

This means the transform is **tied to a specific session's lifecycle**. A new session gets a fresh transform with empty state. On resume, a new transform is created — which means accumulated summary/key facts from before the restart are lost (but the compacted snapshot file preserves the last compacted state).

### The First-User-Message Pattern
Volatile context (session ID, time, conversation-state.md, context.md) is injected into the **first user message**, not the system prompt. This keeps the system prompt stable for Anthropic's prompt caching (~40% cost savings). But it creates a subtle interaction with compaction: when the first user message gets compacted, all that volatile context is reduced to a structural summary. The original task is explicitly cached and preserved; everything else in that first message is at the mercy of the 200-char truncation.
