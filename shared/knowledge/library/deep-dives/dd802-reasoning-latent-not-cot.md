# DD-802: LLM Reasoning Is Latent, Not the Chain of Thought

**Paper**: arXiv:2604.15726  
**Authors**: Wenshuo Wang  
**Date**: April 2026  
**Rating**: ★★★★½ EXCELLENT  
**Focus**: Verification Architecture, Surface Signal Reliability, Agent Monitoring

---

## Core Contribution

Position paper formalizing three competing hypotheses about LLM reasoning:

- **H1**: Reasoning is primarily mediated by **latent-state trajectories** (internal activations)
- **H2**: Reasoning is primarily mediated by explicit **surface CoT** (the text we see)
- **H0**: Most gains are from generic **serial compute**, not any privileged representational object

After reorganizing empirical, mechanistic, and survey evidence with compute-audited exemplars that factorize surface traces, latent interventions, and matched budget expansions:

> **Current evidence most strongly supports H1** — latent-state dynamics as the default object of study.

### Key Recommendations
1. Treat latent-state dynamics as the **default object of study** for LLM reasoning
2. Evaluate reasoning with designs that **explicitly disentangle** surface traces, latent states, and serial compute

## Why This Matters for Us

### CRITICAL for EXP-101 (HVR / Surface Linguistic Signals)
EXP-101 uses Hedge-to-Verify Ratio — a surface-CoT signal — to predict verification quality. DD-802 argues that the actual reasoning is latent, meaning **surface hedges may be decorrelated from actual reasoning confidence**. This aligns with the Reasoning Contamination Effect from DD-681: reasoning disrupts confidence verbalization.

The implication is stark: **HVR may be measuring the wrong thing**. The surface CoT is not a faithful window into the reasoning process. This explains the EXP-101 ceiling — we're looking at the shadow on the wall, not the object casting it.

### For EXP-100 (Verification Collapse)
If reasoning is latent, then verification collapse may not be visible in surface traces until it's too late. The agent's CoT may continue to look "careful" while the latent reasoning has already collapsed. This strengthens the case for **structural enforcement** (DD-799 PBRC) over surface monitoring.

### For EXP-103 (Verification Confabulation)
Confabulation is exactly what happens when surface CoT and latent reasoning diverge. The surface looks like verification; the latent process is pattern-matching. DD-802 provides the theoretical framework for why this happens.

### Connection to DD-770 (Cognitive Companion)
DD-770's hidden-state probes detect reasoning degradation at the latent level (AUROC 0.840). DD-802 provides the theoretical justification: of course latent probes work better than surface monitoring — that's where the reasoning actually lives.

### Connection to DD-785-789 (Behavioral Failure Stack)
The trajectory-based anomaly detection approach (DD-785-789) sits between surface and latent: action trajectories are *products* of latent reasoning but more structural than CoT text. DD-802 suggests action trajectories may be a better proxy than linguistic signals, but latent probes would be best.

## Design Implications

**For monitoring architecture**: Three-tier signal hierarchy:
1. **Best**: Latent-state probes (per DD-770) — directly measure reasoning quality
2. **Good**: Action trajectory analysis (per DD-785-786) — structural products of reasoning
3. **Weak**: Surface linguistic signals (HVR, hedging) — unreliable reflection of reasoning

**For EXP-101 iteration**: Consider pivoting from pure HVR to action-structure features, or combining HVR with trajectory anomaly signals for ensemble detection.

## Limitations

- Position paper, not new empirical contribution
- H1 vs H0 distinction is subtle — serial compute increase alone may explain some latent-state results
- Practical monitoring at latent level requires model access (probes), which isn't always available for API-based agents

## Verdict

Provides the theoretical framework that explains why surface-level monitoring (EXP-101 HVR) has a ceiling and latent/structural monitoring (DD-770, DD-785-786) works better. Must inform our monitoring architecture priorities. Surface CoT is unreliable; reasoning lives in latent states.
