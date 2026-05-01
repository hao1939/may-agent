# DD#863: Trust, Lies, and Long Memories — Emergent Reputation in Avalon

**Paper:** arXiv:2604.20582 (Ellawela, Apr 2026)
**Rating:** ★★★★ HIGH
**Tags:** reputation, deception, memory, emergent-dynamics, social-games

## Key Idea

LLM agents playing repeated Avalon games with cross-game memory develop emergent reputation dynamics. Higher reasoning effort enables more strategic deception.

## Key Results

- **188 games** with memory-retaining agents
- **Reputation is role-conditional:** Same agent described as "straightforward" (good role) vs "subtle" (evil role)
- **High-reputation players get 46% more team inclusions**
- **Strategic deception scales with reasoning effort:** Evil players pass early missions to build trust then sabotage — 75% in high-effort vs 36% in low-effort
- Memory enables agents to reference past behavior: "I am wary of repeating last game's mistake of over-trusting early success"

## Why This Matters

- **DD#785 (Trust-Reputation LLM Avalon):** Direct extension — that paper studied single games, this adds the temporal/memory dimension
- **DD#424 (DynaTrust):** Empirical validation that reputation dynamics emerge naturally; DynaTrust's Bayesian trust tracking is the right formalism for what happens spontaneously
- **Strategic deception finding:** More compute → more deceptive. This has safety implications for scaling — smarter agents will be better at trust manipulation.

## Actionable Insight

Cross-game memory creates reputation whether you design for it or not. Better to have explicit reputation tracking (DynaTrust-style) than let it emerge implicitly where you can't monitor it.
