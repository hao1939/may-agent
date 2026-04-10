# EXP-114a Results: Tool Schema Guard Prototype

**Status**: COMPLETE
**Date**: 2026-04-10
**Author**: Coach
**Prototype**: `agents/coach/workspace/tool-schema-guard-draft.ts`

---

## Summary

Built a `createToolSchemaGuard()` prototype that intercepts 8 common tool misuse patterns using the existing `beforeToolCall` hook architecture. Retrospective analysis against 96 FM-2.1 tool schema issues from may.db shows the guard would catch **52 issues (54%)** affecting **52 unique sessions**.

The guard is pure argument inspection — no LLM judgment, no filesystem access, no async operations. It follows the same fail-open architecture as the commit guard and finish guard.

---

## Guard Design

### Architecture

```
                    ┌──────────────────────┐
  Agent tool call → │  composeGuards()     │
                    │  ├─ schemaGuard()  ← NEW (cheapest, runs first)
                    │  ├─ finishGuard()    │
                    │  └─ commitGuard()    │
                    └──────────────────────┘
                           ↓
                    block + helpful error message
                           OR
                    allow through (fail-open)
```

### Hook Interface

Same as existing guards — implements `(BeforeToolCallContext, AbortSignal?) → Promise<BeforeToolCallResult | undefined>`:
- Returns `{ block: true, reason: "..." }` to block the call
- Returns `undefined` to allow the call through
- Never throws — catches all internal errors (fail-open)

### Patterns Detected

| # | Pattern ID | Tool | Misuse | Fix Message | Observed (may.db) |
|---|-----------|------|--------|-------------|-------------------|
| 1 | BASH_EMPTY | bash | `bash({})` — no command | "bash() requires a `command` argument. Usage: bash({command: '...'})" | **39 instances** |
| 2 | READ_EMPTY | read | `read({})` — no path | "read() requires a `path` argument. Usage: read({path: '...'})" | **17 instances** |
| 3 | FINISH_EMPTY | finish | `finish({})` — no status/summary | "finish() requires `status` and `summary`. Usage: finish({status: '...', summary: '...'})" | **14 instances** |
| 4 | READ_WRONG_ARG | read | `read({command: '...'})` — wrong arg name | "read() takes 'path', not 'command'. Did you mean bash({command: '...'}) or read({path: '...'})?" | **6 instances** |
| 5 | EDIT_EMPTY | edit | `edit({})` — no args | "edit() requires `path`, `oldText`, and `newText`" | **4 instances** |
| 6 | BASH_WRONG_ARG | bash | `bash({path: '...'})` — wrong arg name | "bash() takes 'command', not 'path'. Did you mean read({path: '...'})?" | **2 instances** |
| 7 | AGENTS_EMPTY | agents | `agents({})` — no action | "agents() requires an `action` argument" | **2 instances** |
| 8 | WRITE_EMPTY | write | `write({})` — no args | "write() requires `path` and `content`" | **1 instance** |

---

## Retrospective Validation

### Method

Analyzed all 96 FM-2.1 issues from may.db that were tagged with tool schema/misuse sub-types (TOOL_SCHEMA_ERROR, TOOL_MISUSE, TOOL_ERROR, TOOL_HALLUCINATION, HALLUCINATION, MINOR_TOOLING_WASTE, etc.). For each issue, determined whether the guard's 8 patterns would have caught the error before it occurred.

### Results

| Category | Issues | % | Sessions |
|----------|--------|---|----------|
| **Would catch** | 52* | 54.2% | 52 |
| Would NOT catch — tool hallucination | 17 | 17.7% | 17 |
| Would NOT catch — truncated/malformed JSON | 5 | 5.2% | 5 |
| Would NOT catch — write shrink block | 4 | 4.2% | 4 |
| Would NOT catch — read directory (EISDIR) | 1 | 1.0% | 1 |
| Would NOT catch — other tactical | 17 | 17.7% | 17 |
| **Total** | **96** | **100%** | **95** |

*Some issues match multiple patterns (e.g., a session with both bash({}) and read({}))

### Catch Rate by Agent

| Agent | Catchable | Total Tool Schema FM-2.1 | Catch Rate |
|-------|-----------|--------------------------|------------|
| coach | 40 | 61 | 65.6% |
| optimizer | 8 | 18 | 44.4% |
| tech-lead | 3 | 4 | 75.0% |
| coder | 1 | 1 | 100% |
| amy | 0 | 1 | 0% |

### Impact on Overall FM-2.1

- 52 of 219 total FM-2.1 instances (23.7%) are catchable by this guard
- 52 of 202 sessions with FM-2.1 (25.7%) would have the guard fire
- For coach specifically: 40 of 83 FM-2.1 sessions (48.2%)

---

## What The Guard Cannot Catch (And Why)

### 1. Tool Hallucination (17 issues, 17.7%)

Agents calling non-existent tools: `checkpoint`, `Read` (case error), `agents.send`, `socket_watch`, `fork_agent`. The `beforeToolCall` hook only fires for *registered* tools, so hallucinated tool names never reach the guard.

**Potential fix**: A separate mechanism at the tool dispatch level that returns "Tool 'X' does not exist. Available tools: bash, read, write, edit, finish, agents, workflow, checkpoint."

### 2. Truncated/Malformed JSON (5 issues, 5.2%)

Agent emits tool call with JSON that's cut off mid-string: `finish({summary: "I did things and then the JSON ends here`. This happens at the model output level before argument parsing.

**Not addressable by beforeToolCall** — the args object is already parsed (or unparseable) before the hook fires.

### 3. Write Shrink Block (4 issues, 4.2%)

Agent calls `write()` with content smaller than 50% of existing file. Already handled by the platform's write safety guard.

**No action needed** — already mitigated.

### 4. Other Tactical Errors (17 issues, 17.7%)

These are varied: `cp /.* ` glob errors, `diff` exit code misinterpretation, P53 guard blocks, permission errors, ENOENT on wrong paths. Each is a distinct pattern that would need its own detection logic. Too varied and too few instances each to justify guard patterns.

---

## Key Design Decisions

### 1. Fail-Open

If any pattern's detection function throws, the guard skips that pattern and continues. This ensures the guard never blocks legitimate tool calls.

### 2. Pattern Order

Patterns are ordered by frequency (bash_empty first, write_empty last) so the most common errors short-circuit earliest. This is a micro-optimization but aligns with the data.

### 3. Helpful Error Messages

Each block message includes:
- What went wrong (specific)
- Correct usage syntax
- A concrete example

This mirrors the commit guard's approach where specific instructions achieve 58% → 1% error reduction (KE-094).

### 4. Cross-Tool Confusion Detection

Patterns 4 (READ_WRONG_ARG) and 6 (BASH_WRONG_ARG) detect when agents swap arg names between tools — e.g., using `read({command: "ls"})` when they meant `bash({command: "ls"})`. The error message suggests BOTH the intended tool and the correct arg name.

### 5. No Async, No IO

The guard is pure synchronous argument inspection. This keeps it fast (~0ms overhead per tool call) and eliminates failure modes from network/filesystem.

---

## Deployment Recommendation

### Phase 1: Log-Only Mode (1 week)

Deploy the guard but set `block: false` and log matches. This validates:
- Zero false positives (guard doesn't flag valid tool calls)
- Detection rate matches retrospective estimate
- No performance regression

### Phase 2: Block Mode

Flip to `block: true` after Phase 1 confirms no false positives.

### Phase 3: Measurement

After 100+ sessions post-deployment, compare:
- FM-2.1/TOOL_SCHEMA rate before vs after
- Wasted call rate
- Session quality scores

**Target**: ≥50% reduction in TOOL_SCHEMA FM-2.1 (from ~96 to ~48 over equivalent session volume).

---

## Comparison to Commit Guard (EXP-110)

| Dimension | Commit Guard | Tool Schema Guard |
|-----------|-------------|-------------------|
| Hook point | `beforeToolCall` (finish only) | `beforeToolCall` (all tools) |
| Signal type | git status (binary) | Arg inspection (binary) |
| Requires IO | Yes (git commands) | No (pure arg check) |
| Failure mode | Fail-open (git errors) | Fail-open (pattern errors) |
| Target FM code | FM-3.1, FM-3.3 | FM-2.1 |
| Observed impact | 58% → 1% (commit errors) | Est. 54% catch rate |
| Confidence | HIGH (measured) | HIGH (retrospective) |
| Composition | In composeGuards() | In composeGuards() |

The tool schema guard is architecturally simpler than the commit guard (no git subprocess, no filesystem access) but addresses a broader set of tools (8 patterns across 6 tools vs 1 pattern on 1 tool).

---

## Hypotheses Validated

### H2 (from design.md): Tool Schema Hardening Reduces Tactical FM-2.1

**Verdict**: SUPPORTED (retrospective)

The guard would catch 52 of 96 tool schema FM-2.1 issues (54%). This is slightly above the 50% threshold predicted in the design. However, this is a retrospective estimate — actual impact depends on:
1. Whether agents learn from the error message (commit guard evidence: yes)
2. Whether blocked calls are retried correctly vs looped (risk)
3. Whether new tool misuse patterns emerge that aren't covered

**Next step**: Deploy and measure actual FM-2.1 rate change (needs ≥100 post-guard sessions).

---

## Limitations

1. **Retrospective, not prospective**: The 54% catch rate is from historical data. Real-world effectiveness may differ.
2. **Doesn't prevent, only catches**: The guard fires AFTER the agent emits the bad call. It prevents the call from executing but doesn't prevent the agent from attempting it.
3. **Tool hallucination uncatchable**: 17.7% of tool schema errors are calls to non-existent tools, which can't be intercepted by beforeToolCall hooks.
4. **May shift errors**: Agents blocked by the schema guard might make different errors instead — the net FM-2.1 reduction may be less than 54%.
5. **Evaluator overlap**: Some of these 52 issues might not count as FM-2.1 if the tool call is blocked (the evaluator might code the block itself differently).

---

## Files

- **Prototype**: `agents/coach/workspace/tool-schema-guard-draft.ts` (445 lines)
- **Design**: `agents/shared/knowledge/experiments/EXP-114/design.md`
- **This report**: `agents/shared/knowledge/experiments/EXP-114/results-phase-a.md`

---

## Next Steps

1. **EXP-114a deployment**: Move prototype to `src/lib/tools/tool-schema-guard.ts`, add to `composeGuards()`
2. **EXP-114b**: Build approach-validation-trap gym scenario for strategic FM-2.1
3. **Tool hallucination guard**: Separate mechanism at tool dispatch level for non-existent tool names
4. **Path hint system**: ENOENT error enhancement with "Did you mean...?" suggestions

[SIG: EXP-114a-RESULTS]
