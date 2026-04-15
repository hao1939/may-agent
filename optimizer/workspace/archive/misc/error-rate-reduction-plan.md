# Error Rate Reduction Plan

**Goal**: Reduce session error rate from 15.6% (historical) / 12.6% (current) to below 10%.

**Date**: 2026-03-16
**Author**: Optimizer

---

## Current State

| Metric | Value |
|--------|-------|
| Total sessions (all time) | 10,153 |
| Error sessions (all time) | 1,581 (15.6%) |
| Latest bucket error rate | 268/2,133 (12.6%) |
| Trend | Improving (19.7% → 12.6% over 5 time periods) |

### Latest Bucket Error Breakdown (268 errors)

| Error Type | Count | % of Errors | Retried? | Agent(s) |
|------------|-------|-------------|----------|----------|
| **Shallow heartbeat** | 143 | 53.4% | N/A | amy (72), may (71) |
| **Empty response** | 87 | 32.5% | Yes (P93 #2) | bob (dominant), scattered |
| **Aborted** | 17 | 6.3% | No (not retryable) | Various |
| **JSON parse** | 11 | 4.1% | Yes (P93 #4) | Various |
| **Cannot continue: assistant** | 6 | 2.2% | No | Various |
| **tool_use_missing** | 2 | 0.7% | Yes (P93 #3) | Various |
| **undefined content.type** | 2 | 0.7% | No | Various |

---

## Reduction Plan

### Fix 1: Shallow Heartbeat Guard — Reclassify or Fix (~143 errors, -6.7pp)

**Problem**: The "shallow heartbeat" guard (manager.ts:548-558) flags heartbeat sessions that complete with 0 tool calls. This accounts for **53% of all recent errors** and hits only amy (72) and may (71). These are sessions where the agent responded from compacted context without reading heartbeat.md.

**Root cause analysis**: Amy and May's compaction is likely including enough context that the LLM can respond meaningfully without any tool calls. The LLM thinks it already has the information it needs.

**Options** (in order of preference):
1. **Fix at source**: Ensure compacted context for amy/may does NOT include heartbeat.md content, forcing tool use. This is the right fix — compacted prompts should not contain stale heartbeat instructions.
2. **Make retryable**: Instead of marking as error, retry with a steering message like "You must read your heartbeat.md file — use the read tool." This gives the agent a second chance.
3. **Reclassify**: Change from `error` to `warning` — these sessions aren't failures, they're low-quality completions. This reduces error rate on paper but doesn't fix the behavior.

**Recommended**: Option 2 (retry with steering message) — it's a code-level fix we control, doesn't require model behavior changes, and actually corrects the problem.

**Implementation**: In `src/lib/manager.ts` handleCompletion, instead of setting `session.error`, push a steering/follow-up message and retry:
```typescript
// Instead of marking error, retry with instruction
if (!wasAborted && !session.error && session.totalToolCalls === 0 && session.task.startsWith("[heartbeat]")) {
  if (!session.shallowHeartbeatRetried) {
    session.shallowHeartbeatRetried = true;
    session.agent.appendMessage({
      role: "user",
      content: [{ type: "text", text: "You completed this heartbeat without using any tools. You MUST read your heartbeat.md file using the read() tool and follow its instructions. Try again." }],
      timestamp: Date.now()
    });
    // Re-run the agent
    session.promise = runAgentWithRetry(session, session.agent.continue(), this._infraRetryMax, (s) => this.handleCompletion(s));
    return;
  }
  // Second attempt also shallow — mark as error
  session.error = "Shallow heartbeat: completed with zero tool calls after retry.";
}
```

**Expected impact**: If 70% of retries succeed → reduces errors by ~100, bringing rate from 12.6% to ~7.9%.

---

### Fix 2: Empty Response Retry Improvement (~87 errors, partial reduction)

**Problem**: Empty responses (0 output tokens) are already retried by P93 Pattern 2, but 87 still persist. This means 3 retries are exhausting without success.

**Root cause**: Bob (Gemini model) produces 83.6% of empty_response errors. This is a provider-specific issue where the Gemini API returns empty completions under load.

**Options**:
1. **Increase retry count for Gemini agents**: Set `infraRetryMax: 5` for bob specifically in agent.json
2. **Add exponential backoff**: Current backoff is linear (1s, 2s, 3s). Change to exponential (1s, 2s, 4s, 8s) to give the proxy more recovery time
3. **Add jitter**: Randomize delays to avoid thundering herd when multiple agents retry simultaneously

**Recommended**: Combination of options 2 and 3 — exponential backoff with jitter.

**Implementation**: In `src/lib/manager-retry.ts`:
```typescript
// Change from linear to exponential backoff with jitter
const baseDelay = INFRA_RETRY_BASE_DELAY_MS; // 1000ms
const exponentialDelay = baseDelay * Math.pow(2, attempt - 1); // 1s, 2s, 4s
const jitter = Math.random() * 500; // 0-500ms jitter
const delayMs = exponentialDelay + jitter;
```

**Expected impact**: ~30% reduction in empty_response errors → -26 errors, rate drops ~1.2pp.

---

### Fix 3: "Cannot continue from assistant" Bug Fix (~6 errors)

**Problem**: `agent.continue()` throws "Cannot continue from message role: assistant" when the last message is from the assistant and there are no queued steering/follow-up messages. This happens during retry logic when the retry pops the assistant message but the continue() is called before a new user message is injected.

**Root cause**: Race condition in `runAgentWithRetry` — after popping the bad assistant message, the retry calls `agent.continue()`, but if the message list is now empty or ends with another assistant message, it throws.

**Fix**: In `runAgentWithRetry`, after popping the assistant message, verify the last message is a user/toolResult role before calling continue(). If not, inject a minimal retry user message.

**Implementation**: In `src/lib/manager-retry.ts`, after `messages.pop()`:
```typescript
// Ensure message list doesn't end with assistant (would cause continue() to throw)
const lastAfterPop = messages.length > 0 ? messages[messages.length - 1] : null;
if (!lastAfterPop || lastAfterPop.role === 'assistant') {
  // Inject retry prompt so continue() has a user message to work from
  session.agent.appendMessage({
    role: 'user',
    content: [{ type: 'text', text: 'Please continue.' }],
    timestamp: Date.now()
  });
}
```

**Expected impact**: -6 errors, rate drops ~0.3pp.

---

### Fix 4: Content Type Guard (~2 errors)

**Problem**: `undefined is not an object (evaluating 'content.type')` — a content block with undefined type crashes the processing pipeline.

**Fix**: Add defensive null check wherever content blocks are iterated. Search for `content.type` access patterns and add optional chaining.

**Expected impact**: -2 errors, negligible rate change but prevents crashes.

---

## Priority Order

| Priority | Fix | Effort | Impact (errors saved) | Rate Change |
|----------|-----|--------|----------------------|-------------|
| 1 | Shallow heartbeat retry | Medium | ~100 | -4.7pp |
| 2 | Exponential backoff + jitter | Low | ~26 | -1.2pp |
| 3 | Continue-from-assistant bug | Low | ~6 | -0.3pp |
| 4 | Content type guard | Low | ~2 | -0.1pp |

**Combined expected impact**: ~134 fewer errors per 2,133 sessions → new rate **~6.3%** (well below 10% target).

---

## Non-Addressable Errors

| Error Type | Count | Why Not Fixed |
|------------|-------|---------------|
| Aborted (17) | Request was aborted — external cancellation, not retryable |
| Auth expired (context_limit bucket) | Token expiry — infrastructure issue outside our control |
| Rate limit (14 all-time) | 429 errors — already handled by provider-level retry |

---

## Metrics to Track

After implementing fixes, measure:
1. Overall error rate (target: <10%)
2. Shallow heartbeat rate per agent (target: <5%)
3. Empty response retry success rate (target: >80%)
4. "Cannot continue" occurrences (target: 0)

## Implementation Order

1. **Fix 2** (exponential backoff) — lowest risk, pure infrastructure improvement
2. **Fix 3** (continue bug) — small defensive fix
3. **Fix 4** (content type guard) — small defensive fix
4. **Fix 1** (shallow heartbeat retry) — most impactful but requires careful testing of the retry flow
