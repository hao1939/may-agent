<ai_context>
Every session in the system triggers an evaluator-aftermath session whose prompt embeds the
FULL original task string verbatim. The evaluator thus re-ingests 62.3M chars/day of echo —
49.3% of the system's 126.4M total prompt chars. Agents with large prompts suffer the worst:
arc's 14.8K-char heartbeat prompt becomes an 18.3K-char aftermath prompt; dev's 11.9K becomes
15.5K. The evaluator spends 544 prompt chars per output operation — nearly 2× aks-explorer's
291. For dev specifically, the system processes 8.0M chars of dev prompts and then 8.0M more
chars echoing those prompts back through evaluation, for a total 16M-char footprint that
produces 4,851 ops — 3,260 chars per productive op. The mechanism is structural: the aftermath
workflow template embeds `JSON.stringify(session)` which includes the full task field. No prior
KE measured the prompt-char dimension of the evaluation overhead; KE-1864 (Meta-Work Majority)
counted ops (76% meta) but not the textual amplification that makes each meta-op more expensive
than it appears. The echo tax is not a bug — the evaluator needs context — but the embedded
task string is the session's instruction prompt, not its output. For 673 dev heartbeats that
each produce 7 ops, the evaluator re-ingests 11,888 chars of dev instructions to evaluate
7 operations. A 1,700-char summary of what dev did would serve evaluation equally well.
Tags: echo-tax, evaluator-amplification, prompt-ingestion, textual-overhead, token-cost
Related metrics: session.error-rate-6h, dev.session-error-rate-7d, scout.session-error-rate-7d
</ai_context>

# KE-1908: The Echo Tax — How Evaluator Aftermath Re-Ingests the Entire System Prompt Corpus

**Discovered**: 2026-06-15
**Status**: active
**Confidence**: very high (24h window: 14,630 sessions, 126.4M prompt chars measured; aftermath echo verified by inspecting actual aftermath task templates; agent-level breakdown verified by LIKE-matching embedded agent fields)
**Domain**: token-economics, evaluation-architecture, system-efficiency, prompt-engineering
**Extends**: KE-1864 (Meta-Work Majority), KE-1862 (Orchestration Tax)
**Reframes**: KE-1864's ops-only analysis by adding a textual-cost dimension that reveals evaluation is even more dominant than ops alone suggest
**Novel**: No prior KE measured prompt-character volume. All efficiency analyses to date used opCount or session count as the unit. This is the first measurement of the system's textual throughput and shows it is dominated by one structural echo.

---

## Core Discovery

The evaluator-aftermath workflow embeds the full `session` object — including the complete `task` string — into every aftermath prompt. This means every session's entire instruction prompt is ingested twice: once by the agent executing it, and once by the evaluator reviewing it.

### The system's daily prompt budget

| Prompt category | Chars/day | % of total |
|-----------------|-----------|------------|
| Evaluator aftermath (echo) | **62.3M** | **49.3%** |
| All other sessions combined | 64.1M | 50.7% |
| **Total** | **126.4M** | 100% |

The evaluator aftermath — a single workflow — consumes 49.3% of all prompt characters in the entire system. It does this by re-ingesting the original session task verbatim.

### The echo amplification by agent

The aftermath prompt wraps each session's full task in ~3,000 chars of evaluation instructions. The original task string dominates:

| Agent evaluated | Avg own prompt | Avg aftermath prompt | Echo ratio | Aftermath count |
|-----------------|---------------|---------------------|------------|-----------------|
| **arc** | 14,845 | **18,279** | 1.23× | 607 |
| **dev** | 11,888 | **15,513** | 1.31× | 513 |
| **may** | 9,212 | **9,302** | 1.01× | 1,161 |
| **aks-explorer** | varies | **9,230** | ~1.0× | 2,811 |
| **scout** | 4,545 | **6,815** | 1.50× | 875 |
| **tech-lead** | 1,309 | **4,874** | 3.72× | 112 |

Agents with **large prompts amplify the most**. Arc's 14.8K heartbeat prompt becomes an 18.3K aftermath prompt. Dev's 11.9K becomes 15.5K. These are among the system's largest prompts and they are each processed twice.

---

## The Dev Paradox: Most Text, Least Work

Dev exhibits the most extreme version of the echo tax:

| Metric | Dev | Scout | aks-explorer |
|--------|-----|-------|--------------|
| Own prompt chars/day | 8.0M | 3.0M | 23.6M |
| Eval echo chars/day | 8.0M | 6.0M | 25.9M |
| **Total system footprint** | **16.0M** | **9.0M** | **49.6M** |
| Productive ops/day | **4,851** | **32,489** | **81,099** |
| **Chars per productive op** | **3,297** | **277** | **611** |

Dev's prompt-per-op ratio is **12× scout's** and **5.4× aks-explorer's**. The system ingests 3,297 characters of prompt text for every operation dev produces. Why?

- Dev runs 673 heartbeats/day with ~11,900 chars each, producing ~7 ops per session
- Each heartbeat generates an aftermath evaluation with ~15,500 chars
- Dev's 7 routine ops are evaluated with 15,500 chars of context containing the full dev prompt
- The evaluator spends more text *reading dev's instructions* than dev spends *following them*

### The mechanistic cause

Dev's heartbeat prompt (KE-1902) is 11,889 chars including six "discipline" sections. Dev reads this, does 7 ops in 61 seconds, and finishes. The evaluator then receives a prompt containing:
1. The evaluation template (~3,000 chars of eval instructions)
2. The full session JSON including `task` (the 11,889-char dev prompt, verbatim)
3. Routing metadata (~600 chars)

Total: ~15,500 chars. The evaluator must parse through 11,889 chars of dev's "Low-Signal Heartbeat Discipline" and "DB and Shell Query Discipline" sections to evaluate whether dev's 7 ops were good. The evaluator's instruction to evaluate is buried under the echoed prompt.

---

## Why This Matters More Than OpCount Suggests

KE-1864 measured the system's meta-work overhead in ops:
- Evaluator: 30.6% of system ops (133,914 / ~307,000)

The textual dimension tells a different story:
- Evaluator: **57.6% of system prompt chars** (72.9M of 126.4M own chars)
- Aftermath alone: **49.3% of all prompt chars** (62.3M of 126.4M)

Ops are not equal. The evaluator's average op costs 544 prompt chars of context, while scout's costs 93 chars. The evaluator appears to be 30% of the system by ops but is **58% by text ingestion**. This means:

1. **Token cost**: If the system is token-billed, evaluation costs ~2× what ops-based accounting suggests
2. **Context pollution**: The evaluator processes 10K+ char prompts where most of the text is someone else's instructions, not the output being evaluated
3. **Information density**: The evaluator's effective information density is poor — it's reading arc's git discipline docs to decide if arc's heartbeat was good

---

## The Structural Echo

The echo is not a bug — it's a design choice in the aftermath workflow:

```
Session completes → aftermath template embeds JSON.stringify(session) →
session.task contains full original prompt → evaluator ingests entire prompt
```

The embedded session object serves a real purpose: the evaluator needs to understand what the agent was asked to do. But the task field contains:
- The agent's **standing instructions** (repeated every heartbeat, identical across sessions)
- The agent's **accumulated discipline sections** (historical fixes, never change)
- The agent's **schema cheatsheets** (never change)
- The session's **actual unique context** (metrics, inbox, projects — the part that varies)

For dev, roughly 9,000 of 11,888 chars are standing instructions that are identical in every heartbeat. These are re-ingested by the evaluator 673 times per day — 6.1M chars of identical text.

---

## Cross-KE Synthesis

### KE-1902 (Compliance Trap) compounds the echo tax

KE-1902 showed dev's prompt is dominated by 6 constraint sections (11,889 chars total). These sections make dev do less work (7 ops instead of 22+). Each constraint section added to prevent a past failure *also* adds to the echo tax, because the evaluator re-ingests it:

| Adding a discipline section | Direct cost | Echo cost | Combined |
|----------------------------|-------------|-----------|----------|
| New 500-char "don't do X" rule | 500 chars × 673 sessions = 336K chars/day | 500 chars × 513 evals = 257K chars/day | **593K chars/day** |
| Accumulated 6 sections (~7K chars) | 7K × 673 = 4.7M chars/day | 7K × 513 = 3.6M chars/day | **8.3M chars/day** |

Every constraint added to dev's prompt costs nearly double its face value because of evaluation echo. The compliance trap has a textual twin.

### KE-1864 (Meta-Work Majority) — updated picture

KE-1864 found 76% of compute is meta-work by ops. By prompt chars:

| Role | Own chars | Echo chars (eval about them) | Total footprint | % of system |
|------|-----------|---------------------------|----------------|-------------|
| Evaluator | 72.9M | — | 72.9M | **57.6%** |
| Domain (aks-explorer) | 23.6M | 25.9M | 49.6M | 39.2% |
| Infrastructure (dev+arc+may) | 25.6M | 27.9M | 53.5M | — |
| Scout | 3.0M | 6.0M | 9.0M | 7.1% |

Note: aks-explorer's own-prompt footprint (23.6M) is smaller than the evaluation text generated *about* aks-explorer (25.9M). **The system generates more text discussing aks-explorer's work than aks-explorer spends doing the work.**

### KE-1860 (Goldilocks Prompt) — mechanism identified

KE-1860 found a sweet spot at 1,000–2,000 chars for prompt effectiveness. The echo tax explains why the system drifts away from this sweet spot: every standing instruction, every discipline section, every schema cheatsheet pushes prompts above the sweet spot — and the evaluator doubles the cost by echoing them.

---

## The Minimum Fix: Prompt Summarization in Aftermath

The aftermath template could replace the full `session.task` with a summary:

**Current**: Embed `JSON.stringify(session)` including full `task` field
**Proposed**: Embed session metadata + a truncated or summarized task

Specifically:
1. **For heartbeat sessions** (identical prompts): Replace the task with `"[heartbeat prompt, {N} chars — see workflow:{source} template]"` plus the unique parts (metrics, inbox). Saves ~9K chars × 6,079 sessions = **55M chars/day** (44% of current total).

2. **For task-worker sessions**: Replace the full planner-generated task context with the task summary + relevant file paths. Saves ~3K chars × 1,349 sessions = **4M chars/day**.

3. **For all sessions**: Cap the embedded task at 2,000 chars with a hash reference to the full text. The evaluator can `read()` the session transcript if it needs the full prompt.

Estimated savings: **~59M chars/day**, reducing total system prompt ingestion by 47%.

### What the evaluator actually needs

The evaluator's job is to judge whether the session produced value. For this it needs:
1. What was the agent asked to do? (~200 char summary)
2. What did the agent actually do? (transcript ops)
3. What did the agent produce? (output artifacts)

It does NOT need:
- The agent's git discipline instructions
- The agent's SQL schema cheatsheet
- The agent's closeout checklist
- The agent's standing plan (identical across heartbeats)

A 500-char task summary would provide (1). The transcript provides (2). File inspection provides (3). The remaining 10,000+ chars of echoed prompt are noise.

---

## Evidence Summary

- Total system prompt chars in 24h: 126.4M (SUM(length(task)) across 14,630 sessions)
- Evaluator aftermath prompt chars: 62.3M (49.3% of total)
- Evaluator total chars (all sources): 72.9M (57.6% of total)
- Dev chars-per-productive-op: 3,297 (12× scout's 277)
- Dev heartbeat prompt: 11,888 chars, producing 7 ops in 61s, evaluated with 15,513 chars
- Arc aftermath prompt: 18,279 chars avg (largest in system, driven by 14,845-char heartbeat echo)
- Evaluator chars-per-op: 544 (2× aks-explorer's 291, 6× scout's 93)
- Standing instruction echo for dev: ~9K chars × 673 sessions = 6.1M chars/day of identical text
- All measurements via query_db SUM/AVG(length(task)) on sessions table, 24h window
