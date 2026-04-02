# Finding: Analysis Review — 2026-03-19T06:49 UTC

## Session Volume
- **118 sessions** in 6h = ~20/hr
- 21.5MB total session data
- Top agents: coach (34, 7.6MB), tech-lead (20, 4.3MB), evaluator (19, 1.7MB), may (18, 868KB)

## Error Rate: 17% (20/118)

| Error Type | Count | Agents |
|---|---|---|
| Truncated toolUse response (proxy/network) | 8 | optimizer(4), tech-lead(3), scout(1) |
| "Cannot continue from message role: assistant" | 4 | coach(3), may(1) |
| JSON Parse error | 4 | tech-lead(2), coach(2), optimizer(1) |
| ENOENT file not found | 2 | tech-lead(1), may(1) |
| LiteLLM service unavailable | 2 | bob(2) |

### Impact
- 17% of sessions produce no useful work due to infrastructure errors
- The "truncated toolUse" errors (8 sessions) are from a proxy/network issue that truncates streaming responses
- Each error session still consumes time, tokens for the initial prompt, and disk space

## Worst Session: s_1773899695055_13 (coach)
- **Cost: $6.49** (2.1M input tokens, 59 turns, 78 tool calls)
- **Task**: "Record experiment results and decide whether to promote or discard"
- **Root cause**: Step 4 of growth-cycle was still running as an LLM session, using 63 bash calls to:
  - Wander trying to find gym scenarios (commands 1-9)
  - Try to run gym tests but fail because bun isn't installed (commands 21-39)
  - Read experiments.jsonl 4 times (commands 40-43)
  - Review evaluations unrelated to the task (commands 45-57)
  - Random cleanup (commands 58-63)

## Step 4 Pure-JS Fix: VERIFIED WORKING
- `agents/coach/workflows/growth-cycle.ts` (line 185): "Step 4: Record and decide (pure JS — no LLM session needed)"
- `agents/coach/workflows/training-sprint.ts` (line 179): Same pure-JS Step 4
- Both use `promoteAgent()`/`discardAgent()` from `src/lib/growth.ts` directly
- Workflows loaded dynamically via `import()` with cache-busting — current version is active
- **No more Step 4 LLM sessions observed after fix deployment**

## Evaluator Quality Issues
- 3 coach sessions rated "needs_improvement" due to "[EVIDENCE_GAP]" — evaluator couldn't see transcript content (empty "Your previous response was:" field)
- These appear to be evaluator bugs, not actual coach quality issues

## Recommendations
1. ~~Step 4 JS conversion~~ — Already done and verified ✅
2. **Investigate truncated toolUse errors** — 8 sessions wasted on proxy/network truncation. Is there a retry mechanism? Could the agent recover gracefully?
3. **Fix evaluator evidence gap** — Coach sub-sessions from workflows may not have proper transcript data for the evaluator. The evaluator should skip these rather than rating "needs_improvement"
4. **Reduce "cannot continue from assistant" errors (4 sessions)** — This suggests message history corruption. Check if interrupted sessions leave broken state.
