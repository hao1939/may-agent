# Evaluation summary (5 most recent sessions)

Reviewed the 5 most recent evaluation records in `.state/evaluations/`:
- `s_1772563001689_1` (coder) — error/aborted
- `s_1772562859790_0` (coder) — error/context window exceeded
- `s_1772562547322_0` (coder) — error/aborted
- `s_1772560225808_3` (optimizer) — done
- `s_1772559353568_2` (optimizer) — done

## Most critical recurring structural failure pattern

### **Unbounded multi-file reads → token/context blowups + aborted runs (coder)**
Three of the five sessions are coder runs attempting to *read and summarize every file in `test/` (56 files)* in a single session, with “present everything at the end” output constraints.

**Observed failure modes (recurring):**
1. **Context window overflow (hard 400):**
   - `s_1772562859790_0` fails with `prompt token count 134,722 exceeds limit 128,000`.
   - Root trigger: at least one `read` result for a huge test file (e.g. `cascading-cancel.test.ts`) returned extremely large content even with truncation (`... [1,056,777 characters truncated] ...`). That tool output still consumed enough tokens to push the next model call over the limit.
2. **External abort/cancellation after large parallel read batches:**
   - `s_1772562547322_0` and `s_1772563001689_1` terminate with `Request was aborted` mid-run, after initiating big batches of `read` calls and before producing any summaries.

**Why this is structural (not a one-off hallucination):**
- The task shape (“read *all* files”, “table at end”) forces accumulation: large tool outputs are kept in the conversation, and no value is delivered until late.
- The `read` tool, when faced with huge files, still returns a large head/tail even when truncating; this makes token usage unpredictable and can spike suddenly.
- There is no configured model fallback for over-context errors (`Available Model Group Fallbacks=None`), so the failure is fatal rather than recoverable.

**Impact:**
- High likelihood of **0 output delivered** despite multiple tool calls.
- Wasted compute/time due to inevitable cancellation or context overflow on repo-wide enumeration tasks.

## Secondary recurring inefficiency

### Path/command guardrail collisions (optimizer, minor)
- `s_1772560225808_3` includes an unnecessary attempt to search outside project root (`find / ...`) that was blocked, plus a brief path guess (`agents/bob/workspace/src/manager.ts`).
- This did not prevent completion, but it’s a recurring class of waste across runs: attempts to use absolute filesystem searches or workspace-mirror paths.

## Recommendations (structural, high-leverage)

1. **Add a token-aware `read` guardrail:**
   - If a file is above a size threshold (or if the tool detects it would return >N characters/tokens), automatically:
     - require `startLine/endLine`, or
     - return only metadata + a small excerpt, and
     - include guidance: “File is large; use line-range reads/grep.”

2. **Introduce a “directory summarization” workflow/pattern:**
   - Enforce chunking: summarize per file immediately; emit partial results every 5–10 files.
   - Avoid “all at the end” constraints; allow streaming tables that grow.

3. **Preflight near-context-limit detection:**
   - Before sending the next model call, estimate prompt size (or track cumulative tool output). If near limit, force compaction/summary or stop and return partial results.

4. **Configure model fallback for over-context errors (if supported):**
   - Convert hard-fail 400s into recoverable behavior (e.g., retry with a smaller context window strategy).

## Quick per-session notes
- **Coder sessions (3/5):** All failed due to the same class of issue: large batch reads + deferred summarization → abort or over-context.
- **Optimizer sessions (2/5):** Both completed. One had minor waste from blocked outside-root search and path-guessing; one noted risk of committing with a dirty tree.
