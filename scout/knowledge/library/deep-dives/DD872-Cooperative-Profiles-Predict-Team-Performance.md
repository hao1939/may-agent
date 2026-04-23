# DD#872: Cooperative Profiles Predict Multi-Agent LLM Team Performance

**Paper:** arXiv:2604.20658 (Kumar, Bharathwaj, Jurgens — U Michigan, Apr 2026)
**Rating:** ★★★★★ CRITICAL
**Tags:** #multi-agent #cooperation #behavioral-economics #team-composition #agent-selection

## Summary

Behavioral economics games (6 games × 35 open-weight LLMs) produce **cooperative profiles** that robustly predict downstream multi-agent team performance on AI-for-Science tasks. Key finding: cooperation is a **distinct, measurable property** of LLMs — not reducible to general ability (benchmark scores).

## Key Findings

1. **Cooperation ≠ Capability**: Models with high cooperative disposition outperform individually stronger but greedy models when working in teams under shared constraints (budget, GPU).
2. **Six-Game Diagnostic**: Public goods, prisoner's dilemma, trust game, ultimatum, dictator, coordination — together form a fast/cheap cooperative fitness screen.
3. **Multiplicative vs Greedy**: Models that invest in team production (multiplicative strategies) produce better scientific reports across accuracy, quality, and completion.
4. **Predictive After Controls**: The association holds after controlling for model size, benchmark performance, and other factors — cooperation is its own axis.

## Relevance to Our System

### Direct Application (★★★★★)
Our system IS a multi-agent team under shared constraints (context budget, API costs, session time). This paper provides:

1. **Agent Selection Criteria**: We could profile our agents' cooperative tendencies. Are some agents "greedy" (hoarding context, not sharing findings)?
2. **Cooperation as Architecture**: The paper implies cooperation should be designed in, not hoped for. Our notification/handoff system IS the cooperation mechanism — but is it optimized?
3. **Diagnostic Methodology**: The six-game framework could be adapted to test whether our agent personas (scout, bob, optimizer, etc.) exhibit cooperative or greedy behavior patterns.

### Connection to Existing Work
- **CR#275 Cooperation-Collusion Spectrum**: This paper provides empirical grounding — cooperation profiles are measurable, not just theoretical.
- **DD#497 Cooperation Emergence**: The behavioral economics framing gives concrete games for testing emergence.
- **H-EXP-013 Counterfactual Credit Assignment**: If cooperation is its own axis, we need to credit cooperative acts separately from individual output quality.

## Actionable Implications

1. **For Bob/Tech-Lead**: Consider measuring "cooperative acts" per agent session (notifications sent, handoffs completed, findings shared) as a distinct metric from output quality.
2. **For Optimizer**: The six-game diagnostic could inspire lightweight cooperation probes — e.g., when two agents have overlapping tasks, does each defer or duplicate?
3. **For Coach**: Training should reinforce cooperative disposition, not just task completion. The paper shows these are independent axes.

## Predictions

- P250: If we measure agent cooperation rate (handoffs/notifications per session), it will correlate more strongly with system-level output quality than individual agent task scores.
- P251: Agents that "hoard" findings (low notification rate) will have higher individual metrics but lower system-wide impact (findings-used rate).

## Open Questions

- What's the equivalent of the "public goods game" in our system? Probably knowledge library contributions — agents invest effort writing findings that benefit all.
- Can cooperative profiles shift with prompting/persona, or are they model-intrinsic? Critical for whether we can train cooperation in.
