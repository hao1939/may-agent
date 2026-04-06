# CR#297 — The Input Quality Thesis: Why Agent Output Can't Exceed Input Quality

**Connecting**: DD#541 (BenVanik Case Study) ↔ DD#551 (Agent-Friendly Docs Spec) ↔ DD#522 (Karpathy LLM Wiki) ↔ Bram Cohen "Cult of Vibe Coding"

## Core Thesis

**Agent output quality is bounded by input quality at three levels:**

1. **Knowledge input** — What the agent reads (documentation, code, context)
2. **Instruction input** — What the human tells the agent to do
3. **Reasoning input** — How much thinking budget the agent has

When any of these degrade, output quality cascades downward multiplicatively, not additively.

## Three Converging Evidence Streams

### Stream 1: BenVanik Case Study (DD#541) — Reasoning Input
- Reducing thinking depth (3.5→4.0 Sonnet regression) caused 15-20× cost multiplication
- Read:Edit ratio collapsed from 6.6 to 2.0
- **Mechanism**: Less reasoning → more trial-and-error → more edits → compounding errors
- The agent knew the same things, had the same tools — only reasoning budget changed

### Stream 2: Agent-Friendly Docs Spec (DD#551) — Knowledge Input
- 22 documented failure modes in how agents read web content
- CSS walls, truncation, SPA rendering, soft 404s — each degrades what the agent "knows"
- A 97-line HTML page can be **invisible** to an agent due to inline CSS
- **Mechanism**: Degraded input → agent falls back on training data → stale/wrong information → wrong actions

### Stream 3: Bram Cohen Critique (bramcohen.com, April 5 2026) — Instruction Input
- Anthropic's own leaked code shows quality problems from "pure vibe coding"
- Key insight: "Bad software is a decision you make"
- Human-guided quality audit ("Let's audit this codebase for unreachable code") produces dramatically better results than pure agent autonomy
- **Mechanism**: Vague instructions → agent can't distinguish quality levels → produces median-quality code → tech debt accumulates → codebase degrades exponentially

## The Multiplicative Model

```
Output_Quality = f(Knowledge_Quality × Instruction_Quality × Reasoning_Quality)
```

This is multiplicative, not additive — degradation in any dimension zeros out the others:
- Perfect reasoning + garbage input = garbage output
- Perfect input + zero reasoning = no output  
- Perfect reasoning + perfect input + "just vibe code it" = mediocre output

### Corollary: The Three Levers

To improve agent output, you can pull any of three levers:

| Lever | Example | Who Controls |
|---|---|---|
| Knowledge Quality | llms.txt, .md URLs, compiled wikis | Infrastructure team |
| Instruction Quality | Rules files, AGENTS.md, human review | Human operator |
| Reasoning Quality | Thinking budget, model selection | Platform/config |

### Corollary: Input Quality is Cheapest to Fix

Fixing reasoning quality requires better models (hard, expensive).
Fixing instruction quality requires human time (moderate cost).
Fixing knowledge quality requires infrastructure changes (cheapest per-unit improvement).

**This is why llms.txt, the Agent-Friendly Docs Spec, and compiled knowledge bases (Karpathy Wiki) matter so much — they're the cheapest lever with the highest multiplicative impact.**

## The Compilation vs. Fetching Spectrum

| Approach | Knowledge Quality | Latency | Freshness |
|---|---|---|---|
| Training data | Medium (stale) | Zero | Months old |
| Web fetch (raw HTML) | Low (truncated, CSS, SPAs) | High | Current |
| Web fetch + llms.txt | Medium-High | Medium | Current |
| Compiled wiki (Karpathy) | High (curated, indexed) | Low | Maintained |
| Project memory (AGENTS.md) | Highest (domain-specific) | Zero | Real-time |

The trajectory is clear: **compile knowledge in advance, don't fetch it on demand**.

## Implications for Our System

### Already Doing Well
- Scout's compiled knowledge base (papers.md, deep-dives, cross-references)
- AGENTS.md and rules files for instruction quality
- Thinking budget management via adaptive reasoning

### Should Improve
- **R56** (from DD#551): Check llms.txt before general scraping
- **R57** (from DD#551): Try .md URLs as fallback
- **R58**: Create our own llms.txt index for project documentation
- **R59**: Measure agent input quality systematically — track how often agents get truncated/garbage inputs

## Connection to Broader Themes

- **DD#525** (Asymmetric Goal Drift): Drift is worse when input quality is low — less anchor to correct course
- **CR#293** (Read:Edit Ratio): Input quality directly affects read:edit ratio
- **CR#295** (Verification × Experience): Verification effectiveness depends on input quality
- **CR#296** (Integration Bottleneck): Integration requires high-quality shared context

## Predictions

- **P299**: Teams that systematically manage all three input quality dimensions will show 5-10× productivity vs teams that only manage one
- **P300**: "Agent-readable" will become a standard property of documentation, like "mobile-friendly" became standard for websites

## Rating: ★★★★★

This synthesis unifies three independent evidence streams into a single actionable model. The multiplicative nature of input quality degradation explains why small improvements in any dimension have outsized effects, and why the cheapest lever (knowledge infrastructure) is underinvested relative to its impact.
