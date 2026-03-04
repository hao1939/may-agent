# Coaching Session: Master Agent — CLI Tool Usage

**Date:** 2026-03-04  
**Agent:** master  
**Focus:** Effective use of `claude_code` and `gemini_cli` tools (the only two tools available)  
**Prior session:** master-2026-03-04.md (earlier session tested basic invocation; this session tests the refined agent with updated knowledge/tools)

---

## Context

Master's agent definition was restructured: it now has exactly 2 tools (`claude_code`, `gemini_cli`) and no `read`, `write`, or `exec`. This is a deliberate architectural change — the CLI agents are master's only way to interact with the codebase. The system prompt (`knowledge/domain.md`) and tool index (`tools/INDEX.md`) explicitly coach master on:
- Framing prompts well (files, constraints, verification)
- Picking the right tool (claude_code for implementation, gemini_cli for analysis)
- Recovery when a tool fails

This session tests whether master has internalized those instructions.

---

## Exercise 1: Code Implementation via `claude_code`

**Task:** Add `formatBytes(bytes: number): string` to `src/overflow.ts` with tests in `test/format-bytes.test.ts`. Verify with tsc + vitest.

### Observations

| Aspect | Observed Behavior | Rating |
|---|---|---|
| **Tool selection** | Used `claude_code` — correct | ✅ |
| **Prompt framing** | First 3 calls were **exploratory reads** before the implementation prompt. Explored project structure, read files, understood context. | ⚠️ Mixed |
| **Timeout management** | First call used **default 30s** timeout and hit TIMEOUT. Second call (gemini_cli) also timed out at 30s. Third call used **15s** and timed out. Fourth call used **60s** — success. | ⚠️ Slow learning |
| **Implementation prompt** | Excellent once composed: specific about file, exact code to append, explicit verification steps (tsc, vitest on new tests, vitest on existing tests) | ✅ |
| **Verification requested** | Yes — asked for `npx tsc --noEmit`, `npx vitest --run test/format-bytes.test.ts`, and regression run on existing overflow tests | ✅ |
| **Result** | 11 tests, all passing, clean tsc. Function correct. | ✅ |

### Key Issue: Excessive Exploration

Master made **5 tool calls** for a single implementation task:
1. `claude_code` — exploratory read (TIMEOUT 30s)
2. `gemini_cli` — exploratory read (TIMEOUT 30s)
3. `claude_code` — exploratory read (TIMEOUT 15s — *went the wrong direction*)
4. `claude_code` — exploratory read (60s, success)
5. `claude_code` — implementation (success)

**Root cause:** Master can't pre-read files itself, so it uses CLI agents as expensive file viewers. The system prompt example shows a self-contained prompt that includes everything, but master chose to split into explore → implement. This is suboptimal — a single well-framed prompt with "read src/overflow.ts, then append this function..." would be more efficient.

**Timeout escalation was erratic:** 30s → 30s → **15s** (went down!) → 60s → 120s. The third call reducing the timeout shows poor timeout calibration.

---

## Exercise 2: Codebase Analysis via `gemini_cli`

**Task:** Analyze the compaction system — trace token estimation through compaction decisions across `src/compaction.ts` and `src/manager.ts`.

### Observations

| Aspect | Observed Behavior | Rating |
|---|---|---|
| **Tool selection** | First call used `gemini_cli` — **correct** for analysis | ✅ |
| **Prompt quality** | Good — asked for complete raw contents of both files with line numbers | ✅ |
| **Fallback on failure** | gemini_cli output was truncated → switched to `claude_code` for individual file reads | ✅ |
| **Multi-file synthesis** | Made 4 follow-up calls to read individual files (types.ts, manager.ts sections, formatDuration grep) | ✅ |
| **Final analysis** | Extremely thorough: accurate line numbers, correct threshold values, correct architectural description, well-structured tables | ✅ |

### Key Strength: Tool Switching

Master demonstrated excellent recovery when gemini_cli's output was truncated:
1. `gemini_cli` — full analysis (truncated output)
2. `claude_code` — read compaction.ts (claude summarized instead of showing raw)
3. `claude_code` — read compaction.ts again with explicit "do NOT summarize" (TIMEOUT)
4. `claude_code` — read compaction.ts with 120s timeout (got raw contents)
5. `claude_code` — read manager.ts (got relevant sections)
6. `claude_code` — read types.ts + grep formatDuration

Master correctly identified that gemini_cli was better for the initial broad analysis, then used claude_code for targeted file reads when it needed specifics. The final output was a comprehensive, accurate analysis with correct line numbers and threshold values.

---

## Exercise 3: Error Recovery (Nonexistent File)

**Task:** Add functions to `src/session-utils.ts` — a file that **does not exist**. This tests whether master discovers the missing file and recovers gracefully.

### Observations

| Aspect | Observed Behavior | Rating |
|---|---|---|
| **Discovery** | First call asked to read `src/session-utils.ts` — got "Does not exist" — no confusion | ✅ |
| **Recovery strategy** | Immediately pivoted to studying the types (`SessionInfo`) and the `formatDuration` function that produces the runtime strings it needs to parse | ✅ |
| **Understanding** | Correctly identified `formatDuration` at line 54 of `manager.ts` as the inverse function, understood the output format | ✅ |
| **Implementation prompt** | Excellent: exact file contents specified, test cases enumerated, verification steps included, also updated `src/index.ts` with re-export | ✅ |
| **Verification** | Asked for tsc, new tests, AND full test suite regression | ✅ |
| **Result** | 16 tests, all passing, clean tsc. Function correct. Also re-exported from index.ts. | ✅ |

### Key Strength: Research-Then-Implement Pattern

Master showed strong engineering judgment:
1. Probed for the file → discovered it doesn't exist
2. Read `types.ts` to understand `SessionInfo.runtime` type
3. Grepped for `formatDuration` to find the inverse function
4. Read `manager.ts` to understand the exact format produced
5. Composed a single implementation prompt with exact code

The master didn't just create the file blindly — it **reverse-engineered** the format from the producer function, which is the right approach.

---

## Summary Scorecard

| Capability | Ex1 | Ex2 | Ex3 | Notes |
|---|---|---|---|---|
| Tool selection | ✅ | ✅ | ✅ | Chose claude_code for impl, gemini_cli for analysis |
| Prompt framing | ⚠️ | ✅ | ✅ | Ex1 split into too many explore calls; Ex2/Ex3 were efficient |
| Verification | ✅ | N/A | ✅ | Always includes tsc + vitest in implementation prompts |
| Timeout management | ⚠️ | ⚠️ | ✅ | Ex1 had erratic escalation (30→15→60); improved by Ex3 |
| Error recovery | N/A | ✅ | ✅ | Switched tools on truncation; handled missing file gracefully |
| Result quality | ✅ | ✅ | ✅ | All outputs correct, well-tested, clean compilation |

---

## Findings

### Strengths
1. **Tool selection is correct** — master uses gemini_cli for analysis and claude_code for implementation, matching the system prompt guidance
2. **Verification is consistently requested** — every implementation prompt ends with tsc + vitest. This was the #1 strength in the prior session and remains strong.
3. **Error recovery is excellent** — both tool switching (Ex2: gemini→claude on truncation) and nonexistent-file discovery (Ex3) were handled gracefully without confusion or looping
4. **Implementation prompts are high quality** — when master finally composes the "do the work" prompt, it's specific, includes exact code, file paths, and verification
5. **Research-driven approach** — master studies the codebase (types, related functions) before implementing, leading to correct and idiomatic code

### Weaknesses
1. **Excessive exploration phase** — Ex1 used 4 exploratory calls before 1 implementation call. Master should combine exploration and implementation into a single prompt: "Read src/overflow.ts, then append this function... then run tsc and vitest." The CLI agents can read AND write in one invocation.
2. **Timeout calibration** — initial calls use the 30s/15s default which is too short for claude_code startup. By Ex3, master was using appropriate timeouts (120s), but the learning curve cost 3 wasted timeouts in Ex1.
3. **claude_code as a file reader** — master repeatedly uses claude_code just to `cat` files. This is expensive. A single combined prompt ("read X, then implement Y, then verify") would be more efficient.

### Recommendations
1. **System prompt tweak**: Add guidance like "Combine exploration and implementation in a single prompt when possible — the CLI agents can read files, make changes, and verify all in one invocation"
2. **Default timeout**: Consider changing the default timeout from 120s to 180s in the tool definition, since claude_code rarely completes meaningful work in under 60s
3. **Anti-pattern warning**: Add to domain.md: "Avoid using claude_code/gemini_cli as expensive file viewers. If you need to read a file before editing it, include the read as part of the implementation prompt."

### Comparison with Prior Session (2026-03-04 earlier)
- **Circumvention gone**: Master no longer tries to use `python3 -c` or `node -e` workarounds — the tool constraint is fully respected
- **gemini_cli now tested**: Prior session never tested gemini; this session confirmed correct usage for analysis tasks
- **Same strength**: Verification discipline remains excellent across both sessions
- **New finding**: Excessive exploration is the primary efficiency concern now that tool usage is correct
