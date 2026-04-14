### arXiv:2603.27539 — Coordination Primacy Hypothesis: MAS Taxonomy + CBS Metric (Nguyen & Pham, PAKDD 2026 Workshop)

| Field | Value |
|-------|-------|
| Authors | Phat Nguyen, Thang Pham |
| Venue | DMO-FinTech Workshop, PAKDD 2026, Hong Kong |
| Rating | ★★★★★ CRITICAL |
| Relevance | Formal hypothesis that coordination > model scaling. Introduces CBS metric. Directly validates our research thesis. |

**Three contributions:**

**1. Four-Dimensional Taxonomy for Financial MAS:**
Applied to 12 multi-agent systems + 2 single-agent baselines:
- **Architecture pattern**: How agents are structurally organized
- **Coordination mechanism**: How agents communicate and synchronize
- **Memory architecture**: How agents store and retrieve information
- **Tool integration**: How agents interact with external resources

This taxonomy maps almost perfectly onto our GRA layers: Architecture → L1, Coordination → L2-L3, Memory → L2, Tool Integration → L1. The overlap validates our independent decomposition.

**2. Coordination Primacy Hypothesis (CPH):**
> "Inter-agent coordination protocol design is a primary driver of trading decision quality, often exerting greater influence than model scaling."

**This is the single most important external validation of our research thesis to date.** We've been arguing since CR#259 that coordination is the primary constraint, not raw capability. CPH formalizes this as a falsifiable hypothesis.

Key nuance: The authors are careful to present CPH as a *structural hypothesis* supported by tiered evidence, not an empirically validated conclusion. They acknowledge the evaluation infrastructure required to definitively test CPH doesn't yet exist. This scientific rigor strengthens rather than weakens the claim.

**Connection to our work:**
- **CR#262 GRA**: Our six-layer architecture places coordination (L2-L3) as the critical middle layer between infrastructure and governance — exactly CPH's claim
- **DD#482 Autoresearch**: Subagent vs. team topology tradeoff = coordination mechanism comparison, not model comparison
- **DD#616 Agent Q-Mix**: QMIX learns optimal coordination; CPH predicts this should matter more than using a better model
- **CR#300 Harness Engineering**: The harness IS the coordination mechanism. CPH validates harness > model scaling.

**3. Coordination Breakeven Spread (CBS):**
A metric for determining whether multi-agent coordination adds genuine value net of transaction costs. CBS answers: "At what point does the coordination overhead exceed the benefit?"

This is the first formal metric for coordination ROI in MAS. It connects to:
- **DD#468 ABSTRAL**: 26% turn efficiency = coordination tax. CBS would formalize when this tax is worth paying.
- **DD#470 ETD-MAPPO**: 73.6% compute reduction. CBS gives a framework to measure when compute savings justify coordination complexity.
- **Agent Q-Mix (DD#616)**: Token cost in the reward function is an implicit CBS optimization.

**Five Pervasive Evaluation Failures identified:**
1. **Look-ahead bias** — using future data in training
2. **Survivorship bias** — only testing on surviving assets  
3. **Backtesting overfitting** — optimizing on historical data
4. **Transaction cost neglect** — ignoring execution costs
5. **Regime-shift blindness** — testing only in one market regime

These can **reverse the sign of reported returns** — a devastating critique. Directly applicable to MAS evaluation generally (not just finance). Our harness engineering evaluations may suffer from analogous biases.

**GUS/GRA mapping:**
- **Validates Law 44 (Topology-Coordination Equivalence)** from DD#616: If coordination > model scaling, then topology (which determines coordination) is the primary optimization target
- **Extends CR#300**: The Harness Engineering Maturity Model gains a formal economic justification via CBS
- **Proposes evaluation infrastructure gap**: Minimum evaluation standards needed before CPH can be validated — maps to our evaluation reform work

**Predictions:**
- **P434**: CBS or a CBS-like metric will become standard in MAS evaluation papers within 18 months
- **P435**: CPH will be empirically validated (at least in constrained domains) by Q4 2026, using Agent Q-Mix or similar as the test vehicle
- **P436**: The five evaluation failures will be shown to apply beyond finance to general MAS benchmarking, leading to evaluation reform

**Mechanism — M48 (Coordination Breakeven):** The minimum performance improvement from multi-agent coordination that justifies the overhead cost (token cost, latency, failure propagation risk). Below CBS, single-agent execution is strictly preferred.

---
*DD#617 — Scout Session 298, 2026-04-07*
