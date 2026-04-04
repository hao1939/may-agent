# Knowledge Topics Index

> **Phase 2 of Knowledge Compilation System** — 10 navigable topic pages organizing 2,575+ posts, 82+ deep-dives, 35+ hypotheses, and 15+ synthesis documents.  
> Created: 2026-04-04 by Bob (Architect)

## How To Use

1. **Start with a topic** you're interested in — each page has key principles, essential reading, and open questions
2. **Follow cross-references** at the bottom of each topic to explore connections
3. **Check hypotheses** linked from topics to find testable claims in your area
4. **Use reading paths** — each topic orders papers from foundational to advanced

## Topics

| # | Topic | Key Question | Files |
|---|-------|-------------|-------|
| 01 | [Multi-Agent Coordination](01-multi-agent-coordination.md) | How should agents work together? | 20+ deep-dives, 7 hypotheses |
| 02 | [Memory & Knowledge](02-memory-knowledge.md) | How should agents remember? | 15+ deep-dives, 4 hypotheses |
| 03 | [Self-Evolution & Learning](03-self-evolution-learning.md) | How can agents improve themselves? | 10+ deep-dives, 5 hypotheses |
| 04 | [Reasoning & Cognition](04-reasoning-cognition.md) | How do LLMs think, and how can we improve it? | 8+ deep-dives, 5 hypotheses |
| 05 | [Security & Safety](05-security-safety.md) | What threatens agent systems and how do we defend? | 18+ deep-dives, 4 hypotheses |
| 06 | [Governance & Institutional](06-governance-institutional.md) | How should agent systems be governed? | 8+ deep-dives, 2 hypotheses |
| 07 | [Tool Use & Workflows](07-tool-use-workflows.md) | How should agents use tools and plan tasks? | 5+ deep-dives, 3 hypotheses |
| 08 | [Evaluation & Benchmarking](08-evaluation-benchmarking.md) | How do we measure agent quality? | 7+ deep-dives, 4 hypotheses |
| 09 | [Emergent Behavior](09-emergent-behavior.md) | When do systems behave unexpectedly? | 10+ deep-dives, 4 hypotheses |
| 10 | [Agent Design Patterns](10-agent-design-patterns.md) | What practical patterns work? | 8+ deep-dives, 6 hypotheses |

## Topic Map (Cross-References)

```
                    ┌─────────────────┐
                    │  01. Coordination│
                    └───┬─────────┬───┘
                        │         │
              ┌─────────▼──┐  ┌──▼──────────┐
              │ 09. Emergent│  │ 06. Govern  │
              └─────────┬──┘  └──┬──────────┘
                        │         │
    ┌───────────┐   ┌───▼─────────▼───┐   ┌────────────┐
    │ 04.Reason │◄──┤ 05. Security    ├──►│ 08. Eval   │
    └─────┬─────┘   └───────┬─────────┘   └────────────┘
          │                 │
    ┌─────▼─────┐   ┌───────▼─────────┐
    │ 02.Memory │◄──┤ 03. Self-Evolve │
    └─────┬─────┘   └───────┬─────────┘
          │                 │
    ┌─────▼─────────────────▼──────────┐
    │ 07. Tools    10. Design Patterns │
    └──────────────────────────────────┘
```

## Statistics
- **Total topic pages**: 10
- **Unique deep-dive references**: 80+
- **Unique hypothesis references**: 35+
- **Cross-topic links**: 30+
- **Last updated**: 2026-04-04

## Missing Coverage (Known Gaps)
- **Community & Ecosystem** — covered in research-digest but no deep-dives yet
- **User Behavior & Product** — under-researched area
- **Cost Optimization** — token economics, budget management (practical but under-theorized)
- **Multilingual/Cross-cultural** — no systematic coverage despite bilingual research sources
