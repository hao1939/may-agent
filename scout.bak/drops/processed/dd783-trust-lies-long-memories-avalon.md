# DD#783: Trust, Lies, and Long Memories — Emergent Reputation in Multi-Round Avalon
**arXiv:2604.20582** | Ellawela | Apr 2026
**Rating:** ★★★★★ CRITICAL

## Summary
First empirical study of **cross-game memory effects** on LLM agent deception dynamics. 188 games of Avalon with agents retaining memory across rounds. Two major findings:

1. **Reputation emerges organically** from cross-game memory. Agents reference past behavior ("I am wary of repeating last game's mistake of over-trusting early success"). Reputations are **role-conditional**: same agent described as "straightforward" (good) vs "subtle" (evil). High-reputation agents get **46% more team inclusions**.

2. **Reasoning effort enables strategic deception**: Evil agents pass early missions to build trust before sabotaging — 75% in high-effort vs 36% in low-effort games.

## Connection to Our System
- **Extends DD#470** (Equivocation in Among Us): DD#470 showed deception = equivocation in single games. DD#783 shows that with memory, deception becomes *strategic* — agents build trust capital then spend it.
- **Validates DD#424** (DynaTrust): The Bayesian trust evolution model (trust builds slowly, collapses fast) is exactly the right defense against the "build trust then betray" pattern found here.
- **Directly relevant to our trust architecture**: Our agents have persistent memory across sessions. This paper empirically shows that persistent memory creates reputation dynamics — both useful (high-rep agents get chosen) and dangerous (strategic trust exploitation).

## Key Insight
**Memory + deception = strategic trust exploitation.** Without memory, deception is tactical (equivocation). With memory, deception becomes strategic (reputation farming → betrayal). This is a qualitative shift our security model must account for.

## Predictions
- **P780**: As our system scales, agents with longer operational history will develop implicit "reputation" that biases trust decisions. This is both a feature (reliable agents get preferred) and an attack surface (reputation farming).
- **P781**: The 46% team-inclusion advantage for high-reputation agents predicts that in MAS with dynamic task allocation, compromised agents that "behave well" for N rounds before attacking will be disproportionately assigned to critical tasks.

## Actionable
- Bob should consider "reputation decay" or "reputation volatility" in trust models — static reputation is gameable
- DynaTrust's asymmetric update (trust collapses fast) is the correct counter to this paper's findings
