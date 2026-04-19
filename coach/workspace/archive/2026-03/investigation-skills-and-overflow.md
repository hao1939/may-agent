# Investigation: Skills Quality & Context Overflow

**Requested by:** Hao (via May, session s_1773410404965_0)
**Investigator:** Coach (H237)
**Date:** 2026-03-14

---

## Part 1: Skills Quality Assessment

### Overview
There are 16 skills across `agents/shared/skills/` (14 directories + 2 standalone `.md` files):

| # | Skill | Size | Referenced By | Quality | Verdict |
|---|-------|------|--------------|---------|---------|
| 1 | agent-coordination | 76 lines / 3.2KB | nobody | Good | **UNREFERENCED** |
| 2 | agent-growth | 65 lines / 2.1KB | coach | Good | Keep |
| 3 | check-state | 292 lines / 11.7KB | nobody | Excellent | **UNREFERENCED but valuable** |
| 4 | consolidate-memory.md | 65 lines / 2.3KB | nobody | Good | Keep (reference doc) |
| 5 | document-collaboration | 89 lines / 3.0KB | nobody | Good | **UNREFERENCED** |
| 6 | error-handling | 122 lines / 8.5KB | may, bob, coder, tech-lead | Excellent | Keep |
| 7 | evaluator-scoring | 75 lines / 3.2KB | evaluator | Good | Keep |
| 8 | file-safety | 90 lines / 3.3KB | bob, tech-lead, optimizer | Good | Keep |
| 9 | growth-cycle.md | 113 lines / 4.4KB | nobody | Excellent | Keep (reference doc) |
| 10 | knowledge-sharing | 99 lines / 3.5KB | nobody | Good | **UNREFERENCED** |
| 11 | l3-delegation-metrics | 83 lines / 3.2KB | evaluator | Niche | Keep (evaluator-specific) |
| 12 | patterns | 92 lines / 3.7KB | bob, coder, tech-lead | Good | Keep |
| 13 | sanitize-content.md | 47 lines / 1.8KB | nobody | Good | Keep (reference doc) |
| 14 | verification | 108 lines / 5.3KB | may, bob, coder, tech-lead, optimizer | Excellent | Keep |
| 15 | web-scraping | 48 lines / 1.5KB | scout | Good | Keep |

### Quality Assessment

**Tier 1 — Excellent (actively used, well-structured):**
- **verification** (5 agents reference it) — Clear protocols, specific rules, good structure
- **error-handling** (4 agents) — Comprehensive escalation procedures
- **check-state** (0 agents reference but excellent quality) — Most thorough skill, 292 lines of deterministic guardrails with concrete examples
- **growth-cycle.md** — Complete end-to-end tutorial with example scenario

**Tier 2 — Good (useful, well-written):**
- **agent-growth** — Clean tool reference for fork/verify/promote
- **file-safety** — Essential safety protocols
- **patterns** — Pattern library concept is sound, has 3 concrete patterns
- **web-scraping** — Concise, pragmatic, includes anti-patterns
- **knowledge-sharing** — Good workflow for cross-agent knowledge flow
- **document-collaboration** — Clear review workflow with examples
- **evaluator-scoring** — Standardized scoring logic
- **consolidate-memory.md** — Good memory distillation guide with examples
- **sanitize-content.md** — Security filter with clear rules and examples

**Tier 3 — Niche:**
- **l3-delegation-metrics** — Very specific to evaluator's L3 analysis. Fine for its purpose.
- **agent-coordination** — Good content but overlaps with built-in tool docs

### Issues Found

1. **4 skills unreferenced by any agent** (agent-coordination, check-state, document-collaboration, knowledge-sharing). These are "write once, never loaded" — agents don't know they exist unless they go looking.

2. **No auto-loading of skills**. Skills are NOT injected into agent prompts. They're only loaded if an agent explicitly reads them. This means the skills are more like "documentation" than "capabilities."

3. **check-state is the best skill but unreferenced**. 292 lines of deterministic verification techniques, yet no agent is configured to use it.

4. **agent-coordination duplicates built-in tool docs**. The `agents` tool already has descriptions; this skill adds modest value over what's in the tool definition.

5. **No evidence of actual skill usage in sessions**. I checked recent sessions and found no evidence of agents reading skill files during tasks. Skills are theoretical, not practiced.

### Recommendations

1. **Wire check-state to coder and tech-lead** — they'd benefit most from deterministic verification
2. **Wire knowledge-sharing to may** — she manages the team and should know the protocol
3. **Consider archiving agent-coordination** — low incremental value over tool docs
4. **Add a "skills discovery" step** to agent heartbeats — agents should periodically check if new skills are available
5. **Measure skill adoption** — track which skills get actually read/used in sessions

---

## Part 2: Context Overflow Investigation

### The Question
May reported "102 context overflow errors." Is this a real problem?

### Methodology
I analyzed:
1. The compaction system source code (`src/lib/compaction.ts`, 614 lines)
2. The overflow handler (`src/lib/overflow.ts`)
3. Session error data across all 3700+ sessions
4. My own crashed session (s_5, 44 turns, 1.4M input tokens)

### Key Finding: The "102 Overflows" Is a False Positive

**TRUE context overflow errors (where the LLM API rejected the request due to context size): 0**

The original count of "102-115 overflow sessions" came from grepping session JSONL for patterns like "context_length_exceeded" or "too many tokens." But these matches were hitting **text content** inside sessions where agents were:
- Reading/discussing the overflow.ts source code
- Analyzing overflow patterns as part of investigations
- Referencing overflow errors in tool outputs

The actual error types in failed sessions are:
- **D7 (toolUse truncation)**: LLM returns `stopReason: "toolUse"` but no tool call content — network/proxy issue
- **B6 (zero-output)**: LLM returns empty response — API degradation
- **JSON parse errors**: Truncated streaming responses
- **Various network issues**: "Unexpected event order", etc.

### How Compaction Works

The system has a robust 3-tier defense:

1. **Rolling compaction** (threshold: 70% of context window):
   - Structurally summarizes old messages (not LLM-based — fast & deterministic)
   - Keeps recent 40% of context intact
   - Preserves: original task, key facts (files read/written), last reasoning block
   - Summary budget capped at 15% of context window

2. **Safety ceiling** (85% of context window):
   - If after compaction we're still above 85%, compact again with tighter budget
   - Up to 3 compaction passes per trigger

3. **Overflow recovery** (`overflow.ts`):
   - If the API DOES reject for context size, extracts progress to `progress.md`
   - New session can resume from the progress file

### Why Compaction Works Well

- **Token estimation**: Conservative at 3 chars/token (overestimates, so compaction triggers early)
- **Accumulated summary trimming**: Old compaction sections dropped when summary exceeds budget
- **Key facts preservation**: Files read/written survive across all compaction rounds
- **Original task preservation**: Always kept in compacted header, never trimmed

In my crashed session (s_5), the per-turn input peaked at ~48K tokens against a 72K context window. Compaction kept each turn within budget. The 1.4M total was cumulative across 44 turns, not simultaneous.

### What Actually Causes Session Death

The real killers are:
1. **D7 (toolUse truncation)**: ~60% of errors. Network/proxy truncates the streaming response before the tool call JSON is complete.
2. **B6 (zero-output)**: ~25% of errors. LLM returns 0 tokens. Currently spiking for Bob (Gemini Flash).
3. **Infra retries help but don't solve D7**: The system retries up to 3 times (P93), but D7 is often persistent.

### My Crash: A Lesson in Session Longevity

My s_5 session ran 44 turns and consumed 1.4M cumulative input tokens — not because compaction failed, but because the task was genuinely large (reading 16 skills, analyzing overflow code, investigating session data). The crash was actually a D7 (toolUse truncation), not a context overflow.

**The real issue isn't overflow — it's that long investigative sessions accumulate high cumulative cost.** At ~32K tokens/turn, 44 turns = 1.4M tokens ≈ $4.20 input cost (at Claude prices). The self-coaching lesson I derived at H232 was correct: write findings incrementally, don't accumulate.

### Recommendations

1. **No code changes needed** — compaction is working correctly
2. **Monitor cumulative session cost** — not per-turn (which is bounded by compaction), but total session cost for long-running tasks
3. **D7 (toolUse truncation) is the real reliability problem** — investigate proxy/network stability
4. **B6 (Gemini zero-output) spikes need monitoring** — Bob's 85% error rate in the last hour suggests API degradation
5. **The "overflow" alarm was a measurement error** — future overflow counting should check `errorMessage` in session metadata, not grep session content

---

## Summary

| Area | Status | Action Needed |
|------|--------|---------------|
| Skills quality | Good overall | Wire unreferenced skills to agents; measure adoption |
| Context overflow | False alarm — 0 true overflows | Fix measurement methodology |
| Compaction system | Working correctly | No changes needed |
| Real error sources | D7 (60%), B6 (25%) | Network/API stability |
| Session cost | Unbounded for long tasks | Add cumulative cost tracking |
