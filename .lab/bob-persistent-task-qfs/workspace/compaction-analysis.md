# Compaction.ts Efficiency Analysis

**File**: `src/lib/compaction.ts` (614 lines)  
**Date**: 2026-04-09  
**Analyst**: Bob

---

## 1. Compaction Ratio: How Much Context Is Reduced

### Mechanism

Compaction is **structural extraction**, not LLM-based summarization. The `createCompactionTransform()` function creates a closure that:

1. **Triggers** when estimated tokens exceed 70% of the context window (`threshold = 0.7`)
2. **Keeps** the most recent 40% of the context window intact (`keepRatio = 0.4`)
3. **Compacts** everything before the split point into a synthetic `[COMPACTED CONTEXT]` user message
4. Runs up to **3 passes** with progressively tighter budgets (`effectiveKeepTokens *= 0.6` per pass) if the result still exceeds 85% of context window

### Estimated Ratio

The compaction ratio depends heavily on message content, but we can estimate structural reduction:

- **User messages**: Truncated to 200 chars (`text.slice(0, 200)`) — a user message of 2000 chars becomes ~200 chars = **~10x reduction**
- **Assistant text blocks**: Truncated to 200 chars each, BUT the last "substantial" text block (≥100 chars) is preserved up to 2000 chars — **variable, 1x to 10x+**
- **Tool results**: Truncated to 200 chars (OK) or 300 chars (errors) — tool results can be massive (entire file contents, test output), so **10x-100x+ reduction** is common
- **Tool calls**: Only the tool name is preserved, arguments are dropped — **high reduction** for tools with large arguments (write, edit)
- **Thinking blocks**: Completely dropped in summary (no handling in `summarizeMessages`) — **100% reduction**

**Overall estimate**: For a typical agent session with many tool calls and results, the structural summary is roughly **5-15x smaller** than the original messages. The heaviest reduction comes from tool results (file contents, command output) being truncated to 200-300 chars.

### Summary Budget Cap

The accumulated summary is capped at `SUMMARY_BUDGET_FRACTION = 0.15` of the context window (minimum 8000 chars). For a 200K context window, that's `200000 × 0.15 × 3 = 90,000 chars` (~30K tokens). When exceeded, oldest compaction sections are trimmed via `trimAccumulatedSummary()`.

### Multi-Pass Compaction

If after one pass the result is still above 85% of context, the system re-compacts with `keepTokens * 0.6`, up to 3 times. This is a safety net for token estimation drift.

---

## 2. Message Preservation: What's Lost That Shouldn't Be

### Things Correctly Preserved

- ✅ **Original task**: Cached on first compaction and always included in the header (capped at 500 chars)
- ✅ **Key facts**: Files read/written and exec commands (with pass/fail status) are tracked structurally via `KeyFacts` and merged across compaction rounds
- ✅ **Last substantial reasoning**: The most recent assistant text block ≥100 chars is preserved verbatim (up to 2000 chars)
- ✅ **Error status**: Tool results that errored get `[ERROR]` markers and 300 chars instead of 200

### Potential Issues: Messages That May Be Lost or Under-Preserved

#### 2a. **Thinking blocks are completely dropped** (Medium severity)
In `summarizeMessages()`, the loop over assistant content blocks handles `type === "text"` and `type === "toolCall"` but there's no branch for `type === "thinking"`. Thinking blocks (chain-of-thought/extended thinking from Claude) are silently dropped during compaction. While `messageTokens()` does count thinking blocks for token estimation, the actual content is never included in summaries.

**Impact**: The agent's internal reasoning about decisions, hypotheses, and plans in thinking blocks is entirely lost after compaction. Only "text" blocks (externalized reasoning) survive.

#### 2b. **Tool call arguments are dropped** (Medium severity)
In the summary, tool calls are reduced to just their names: `[tools: read, write, exec]`. The arguments — which file was read, what was written, what command was executed — are lost from the summary text. The `KeyFacts` system partially compensates for `read`, `write`, and `exec` by tracking paths and commands separately, but:

- **`edit()` arguments are completely lost**: What was edited and what the changes were is not tracked in KeyFacts (only `read` and `write` are tracked, not `edit`)
- **`agents()` arguments are lost**: Which agent was called, what message was sent — gone
- **Other tool arguments are lost**: Any custom tools' arguments vanish

**Impact**: After compaction, the agent knows it called `edit` but not which file or what changes were made. This is a significant gap — edits are arguably the most important tool calls to preserve.

#### 2c. **User messages truncated to 200 chars** (Low-Medium severity)
User messages (which may contain system injections, instructions, or context updates from the framework) are truncated to 200 chars. In this agent system, "user" messages are often system-generated and can be quite long (heartbeat instructions, task context, etc.).

**Impact**: Mid-conversation instructions or context updates from the system are heavily truncated. The original task is preserved separately, but subsequent user messages (which may contain important directives) are not.

#### 2d. **All assistant text blocks truncated to 200 chars except the last substantial one** (Low severity)
Only the **last** substantial text block is preserved verbatim. Earlier reasoning blocks — which might contain critical decisions, diagnoses, or plans — are truncated to 200 chars.

**Impact**: In a long conversation, the agent's earlier reasoning and decisions are compressed. If the agent made an important architectural decision or diagnosis 20 messages ago, it's reduced to 200 chars.

#### 2e. **Image content is completely dropped** (Low severity)
`messageTokens()` assigns 1000 tokens to images, but `summarizeMessages()` has no handling for image blocks. They're silently dropped.

**Impact**: Any screenshots, diagrams, or visual context shared during the conversation is lost after compaction. A `[Image]` placeholder would be better than nothing.

#### 2f. **`edit` tool not tracked in KeyFacts** (Medium severity)
`extractKeyFacts()` tracks `read`, `write`, and `exec` tools specifically:
```typescript
if (block.name === "read" && args.path) {
  filesRead.add(args.path);
} else if (block.name === "write" && args.path) {
  filesWritten.add(args.path);
} else if (block.name === "exec" && args.command) {
  pendingExecCalls.set(block.id, args.command);
}
```
There's no tracking for `edit`, `agents`, `checkpoint`, `finish`, or other tools. Files modified via `edit()` don't appear in `filesWritten`, which means the warning "Re-read any file before overwriting it" doesn't list edit targets.

**Impact**: After compaction, the agent doesn't know which files it edited (only which it read or wrote). This can lead to re-reading files unnecessarily or missing that a file was already modified.

#### 2g. **Tool result content for non-exec tools isn't tracked structurally** (Low severity)
Only exec command outcomes (pass/fail) are tracked in KeyFacts. The actual content of `read` results, `write` confirmations, or `agents` responses is only preserved in the 200-char truncated summary.

---

## 3. Token Estimation Accuracy

### The Estimation Function

```typescript
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3);
}
```

This uses a **1 token ≈ 3 characters** ratio. The code comments note this was changed from 4 chars/token to 3 chars/token because the previous value "underestimated, causing context overflow on LLM calls."

### Accuracy Analysis

#### 3a. **The 3 chars/token ratio is intentionally conservative (overestimates)**

For reference, actual tokenization ratios:
- **English prose**: ~4.0-4.5 chars/token (GPT-4/Claude tokenizers)
- **Code**: ~3.5-4.0 chars/token  
- **JSON**: ~3.0-3.5 chars/token (lots of structural characters)
- **Base64/binary-ish**: ~2.5-3.0 chars/token

Using 3 chars/token means the system **overestimates** token usage by roughly 15-30% for typical mixed content. This is a deliberate choice — the comment says "intentionally conservative (overestimates token count) so we compact before actually hitting the limit."

**Trade-off**: The system compacts earlier than strictly necessary (~15-30% early), losing some context that could have been retained. But it avoids context overflow, which would cause LLM call failures.

#### 3b. **No accounting for message structure overhead** (Minor)

LLM APIs add per-message overhead for role tokens, message delimiters, and special tokens. Claude's API adds roughly 3-10 tokens per message for role markers and formatting. For a conversation with 100+ messages, this adds ~300-1000 tokens that aren't counted.

**Impact**: Partially offset by the conservative 3 chars/token ratio, but could matter for conversations with many short messages (lots of tool calls with brief results).

#### 3c. **Image token estimation is a rough fixed constant**

```typescript
} else if (block.type === "image") {
  total += 1000; // rough estimate for images
}
```

Claude's actual image token usage depends on image resolution and can range from ~200 tokens (small) to ~1600+ tokens (large). A fixed 1000 is reasonable as an average but can be off by 60%+ in either direction.

**Impact**: Low in practice — images are rare in this agent system.

#### 3d. **Null/undefined content returns 0 tokens**

```typescript
function messageTokens(msg: AgentMessage): number {
  if (typeof msg.content === "string") return estimateTokens(msg.content);
  if (Array.isArray(msg.content)) { ... }
  return 0;  // ← fallback
}
```

If a message has unexpected content format, it counts as 0 tokens. This could cause under-estimation if message formats evolve.

#### 3e. **JSON.stringify overhead for tool arguments**

```typescript
} else if (block.type === "toolCall") {
  total += estimateTokens(block.name) + estimateTokens(JSON.stringify(block.arguments));
}
```

This is actually **good** — `JSON.stringify` captures the structural overhead of the arguments object (braces, quotes, colons, commas). The 3 chars/token ratio then applies, which is appropriate for JSON content.

#### 3f. **The multi-pass safety mechanism compensates for estimation errors**

The 3-pass compaction loop with an 85% safety ceiling is an effective backstop:
```typescript
const safetyCeiling = Math.floor(contextWindow * 0.85);
// ...
for (let pass = 0; pass < 3; pass++) {
  // ...
  effectiveKeepTokens = Math.floor(effectiveKeepTokens * 0.6);
}
```

Even if the token estimate is off, subsequent passes will catch it. Pass 2 keeps only 24% of context window, pass 3 only 14.4%.

---

## Summary of Findings

| Question | Finding | Severity |
|----------|---------|----------|
| **Compaction ratio** | ~5-15x overall reduction; tool results get 10-100x+ reduction | N/A (by design) |
| **edit() not tracked in KeyFacts** | Files modified by edit() aren't listed in preserved key facts | Medium |
| **Thinking blocks dropped** | Chain-of-thought thinking blocks are silently lost | Medium |
| **Tool arguments dropped** | Which file was read/written, edit contents — gone from summary text | Medium |
| **User messages truncated to 200 chars** | System injections and mid-conversation instructions heavily compressed | Low-Medium |
| **Earlier reasoning lost** | Only last substantial text block preserved; earlier decisions truncated | Low |
| **Image blocks dropped** | No placeholder or tracking for images in summaries | Low |
| **Token estimation ~20% conservative** | Compacts earlier than necessary, losing retainable context | Low (acceptable trade-off) |
| **No per-message overhead** | Missing ~3-10 tokens/message for API formatting | Minor |
| **Multi-pass safety net** | Effective backstop for estimation errors | Positive |

### Top 3 Recommendations

1. **Track `edit()` in KeyFacts**: Add `edit` alongside `read` and `write` in `extractKeyFacts()`. This is a simple fix with high value — edits are the most important mutations to track.

2. **Preserve tool call arguments in summary**: Instead of just `[tools: read, write]`, include brief argument info like `[read: src/foo.ts] [write: src/bar.ts] [edit: src/baz.ts]`. The 200-char limit can stay, but critical path information should be visible.

3. **Add thinking block handling**: Either preserve a truncated version of the last thinking block alongside the last substantial text block, or at minimum add a `[thinking: N chars]` placeholder so the agent knows reasoning occurred.
