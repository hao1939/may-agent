# DD#531 — Caveman + Brevity Constraints: Token Compression via Output Constraint

**Date**: 2026-04-05
**Sources**: 
- [JuliusBrussee/caveman](https://github.com/JuliusBrussee/caveman) (1k ★)
- [arXiv:2604.00025](https://arxiv.org/abs/2604.00025) "Brevity Constraints Reverse Performance Hierarchies in Language Models" (Hakim, Mar 2026)
**Rating**: ★★★★
**Relevance**: Direct — token efficiency is our #1 cost driver; output compression is low-hanging fruit

---

## One-Line Summary

A Claude Code plugin that forces "caveman-speak" cuts 65% of output tokens while preserving technical accuracy, backed by a paper showing brevity constraints improve large model accuracy by 26 percentage points.

## The Plugin: Caveman

Caveman is a one-line-install skill for Claude Code and Codex that makes the agent talk in compressed speech — dropping articles, pleasantries, hedging, and filler while keeping code blocks, technical terms, and error messages untouched.

### Before/After Examples

| Normal (69 tokens) | Caveman (19 tokens) | Savings |
|---|---|---|
| "The reason your React component is re-rendering is likely because you're creating a new object reference on each render cycle..." | "New object ref each render. Inline object prop = new ref = re-render. Wrap in `useMemo`." | 72% |
| "Sure! I'd be happy to help you with that. The issue you're experiencing is most likely caused by..." | "Bug in auth middleware. Token expiry check use `<` not `<=`. Fix:" | ~80% |

### Benchmark Results

| Task | Normal | Caveman | Saved |
|------|--------|---------|-------|
| Explain React re-render bug | 1180 | 159 | **87%** |
| Fix auth middleware | 704 | 121 | **83%** |
| PostgreSQL connection pool | 2347 | 380 | **84%** |
| Git rebase vs merge | 702 | 292 | 58% |
| Refactor callback to async | 387 | 301 | 22% |
| Architecture comparison | 446 | 310 | 30% |
| PR security review | 678 | 398 | 41% |
| Docker multi-stage build | 1042 | 290 | 72% |
| Debug race condition | 1200 | 232 | 81% |
| React error boundary | 3454 | 456 | **87%** |
| **Average** | **1214** | **294** | **65%** |

Key insight: **Caveman only affects output tokens — thinking/reasoning tokens are untouched.** "Caveman no make brain smaller. Caveman make *mouth* smaller."

### What Gets Compressed vs. Preserved

| Element | Caveman? |
|---------|----------|
| English explanation | 🪨 Smash filler words |
| Code blocks | ✍️ Write normal |
| Technical terms | 🧠 Keep exact |
| Error messages | 📋 Quote exact |
| Articles (a, an, the) | 💀 Gone |
| Pleasantries | 💀 Dead |
| Hedging | 💀 Extinct |

## The Paper: Brevity Constraints Reverse Performance Hierarchies

The paper (arXiv:2604.00025) provides the scientific foundation:

### Key Findings

1. **Scale-dependent verbosity hurts accuracy**: On 7.7% of benchmark problems across 5 datasets, larger models underperform smaller ones by 28.4 percentage points despite 10-100x more parameters.

2. **The mechanism is overelaboration**: Larger models spontaneously generate verbose responses that introduce errors through excessive qualification, hedging, and multi-step decomposition where simpler answers suffice.

3. **Brevity constraints fix it**: Constraining large models to brief responses:
   - Improves accuracy by **26 percentage points**
   - Reduces performance gaps by up to **two-thirds**
   - **Completely reverses** performance hierarchies on math reasoning and scientific knowledge benchmarks

4. **It's a prompting problem, not a capability problem**: Causal intervention experiments show this is correctable prompt design, not fundamental capability limitations. Large models have superior latent capabilities that verbose prompting masks.

### Study Scale

- **31 models** from 0.5B to 405B parameters
- **1,485 problems** across 5 datasets
- **3 independent contamination tests** validating findings
- Inverse scaling operates continuously across the full parameter spectrum

### Critical Finding

> "Maximizing large model performance requires scale-aware prompt engineering rather than universal evaluation protocols."

This means: the same prompt doesn't work best for all model sizes. Larger models benefit from brevity constraints while smaller models may need more verbose prompting.

## Implications for Our System

### Immediate Applicability

1. **Agent output compression**: Our agents (Bob, Scout, Gary) produce substantial output tokens in explanations, analysis, and handoffs. A caveman-style constraint on inter-agent communication could save 50-70% of output tokens.

2. **Cost reduction**: Output tokens are typically 3-5x more expensive than input tokens. A 65% reduction in output tokens translates to significant cost savings per session.

3. **Speed improvement**: Fewer output tokens = faster generation = faster agent loops. A 65% reduction means 3x faster apparent response.

### Design Considerations

**Where to apply:**
- Agent-to-agent communication (handoffs, status updates) — maximum compression
- Internal reasoning summaries — high compression safe
- User-facing explanations — moderate compression, preserve readability
- Code output — no compression (already preserved by caveman approach)

**Where NOT to apply:**
- Deep dive writing (needs full prose for readability)
- Hypothesis documentation (precision matters)
- Error messages and debugging output (exact quotes needed)

### Architectural Pattern: Effort-Aware Output Verbosity

This connects to our adaptive reasoning efficiency work (DD#516 area). The system should:

1. **Calibrate output verbosity to the audience**: Agent-to-agent → caveman. Agent-to-user → full prose.
2. **Calibrate to task complexity**: Simple status updates → extreme compression. Novel analysis → full detail.
3. **Calibrate to model size**: If using smaller models for subtasks, allow more verbose output.

## Connection to Existing Work

- **Adaptive Reasoning Efficiency** (library) — Brevity constraints are the output-side complement to reasoning effort calibration on the input/thinking side
- **DD#521** (Imbue MNGR) — Parallel orchestration would benefit enormously from compressed inter-agent messages
- **DD#530** (OpenHarness) — Their skills system could incorporate caveman as a global output skill
- **Token budget management** — Caveman provides a practical mechanism for staying within token budgets during long sessions

## Key Insight

The paper's finding that **verbosity actively hurts accuracy** is the most important takeaway. It's not just about saving tokens — constrained output is actually *better* output. The model focuses on the essential answer rather than hedging and overelaborating.

This challenges the common assumption that more detailed = more helpful. For many tasks, brevity IS quality.

---

**Bottom Line**: Caveman is a viral meme-tier project that happens to be backed by solid science. The 65% output token reduction is real and reproducible. The underlying paper's finding — that brevity constraints *improve* accuracy in larger models — has deep implications for how we design agent communication protocols. Every agent-to-agent message in our system should be evaluated for compression potential.
