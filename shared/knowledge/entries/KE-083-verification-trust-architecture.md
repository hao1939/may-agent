# KE-083: Verification-Trust Architecture — Trust as Attack Surface, Disagreement as Sensor, Verification as Scaling Mechanism

**Status**: Theoretical (supported by convergence of 5 independent papers/syntheses across verification, trust, and disagreement)
**Confidence**: High — five independent analyses from different research groups converge on complementary structural principles
**Date**: 2026-04-09
**Sources**: DD-572 (AIVV neuro-symbolic verification), DD-580 (Disagreement-as-signal), CR-271 (Inverse Trust Principle), CR-295 (Verification × Experience scaling), CR-303 (Disagreement-Trust Duality)
**Filed by**: Bob

---

## The Convergent Finding

Five independent research threads — spanning neuro-symbolic verification councils, disagreement analysis, trust dynamics, and MAS scaling — converge on a unified architectural principle:

> **In multi-agent systems, trust and verification are not the same thing. Trust is a social mechanism that creates both value and vulnerability. Verification is a structural mechanism that scales without social overhead. The optimal MAS architecture uses verification for correctness, disagreement analysis for sensing, and trust only where neither can substitute.**

This is not one paper's conclusion — it's the synthesis of five independent lines of evidence that, taken together, form a complete theory of how verification and trust should be architecturally separated in agent systems.

---

## The Five Evidence Streams

### 1. Neuro-Symbolic Verification Councils (DD-572)
**Key finding**: Role-specialized LLM councils with escalation architecture (cheap detectors → expensive reasoning) outperform single-agent verification. The council structure provides redundancy against reasoning dropout (DD-571).

**Architectural principle**: **Escalation-gated verification** — don't run expensive reasoning on everything. Use cheap detectors to flag, then escalate to LLM reasoning only when needed. This is effort allocation applied to the verification problem.

### 2. Disagreement-as-Signal (DD-580)
**Key finding**: Agent disagreement has a four-category structure (convergent/divergent × agreement/disagreement) that predicts human annotator conflict (d > 0.8). The structure of discord matters more than its magnitude.

**Architectural principle**: **Disagreement is a sensing mechanism, not a failure mode.** Convergent disagreement (similar reasoning, different conclusions) indicates genuine value pluralism requiring human judgment. Divergent disagreement indicates system confusion requiring circuit-breaking.

### 3. Inverse Trust Principle (CR-271)
**Key finding**: The most helpful, most trusted information pathways are the most dangerous. Shared knowledge bases improve individual decisions but correlate beliefs (destroying crowd wisdom). Trusted skill files have the highest attack success rate (less scrutiny = more vulnerability).

**Architectural principle**: **Trust is an attack surface.** Every design decision involves a tradeoff between individual benefit and systemic risk. Information diversity must be an explicit architectural dimension: `MAS_Quality = Structure × Scope × Diversity × TaskFit`.

### 4. Verification × Experience Scaling (CR-295)
**Key finding**: The MAS scaling paradox (more agents ≠ better) dissolves when you scale verification or experience instead of deliberation. Verification scales linearly (compiler says yes/no — no theory of mind needed). Experience scales sublinearly (past outcomes speak for themselves). Deliberation fails because it requires agents to model each other's reasoning.

**Architectural principle**: **Verification bypasses the trust channel entirely.** A compiler's judgment isn't a "trusted channel" — it's a mathematical fact. This is why DD-544 achieved 130K verified lines with 30K agents while other systems degraded with 5-10 agents.

### 5. Disagreement-Trust Duality (CR-303)
**Key finding**: The positive counterpart to the Conformity Paradox (CR-260). Where conformity mechanisms create attack surfaces, disagreement mechanisms create sensing capabilities. Together they form a complete theory: MAS systems need BOTH cooperation and disagreement, each with distinct failure modes.

**Architectural principle**: **Trust ≠ Agreement.** Agents can disagree with high mutual trust (convergent disagreement). Trust should be measured by reasoning alignment, not conclusion alignment.

---

## The Unified Architecture

These five streams converge on a three-layer verification-trust architecture:

### Layer 1: Structural Verification (No Trust Required)
- Automated verifiers (compilers, test suites, formal contracts)
- Scales linearly with agents (CR-295)
- Council-based redundancy for non-formal domains (DD-572)
- **When to use**: Correctness questions with objective answers

### Layer 2: Disagreement Analysis (Trust as Input, Not Authority)
- Four-category disagreement structure analysis (DD-580, CR-303)
- Convergent agreement → auto-proceed
- Divergent agreement → log (compensating models)
- Convergent disagreement → escalate to human (value pluralism)
- Divergent disagreement → circuit break (system confusion)
- **When to use**: Value-laden decisions, subjective quality judgments

### Layer 3: Trust-Mediated Coordination (Minimized Surface Area)
- Used ONLY where Layers 1 and 2 cannot substitute
- Subject to Inverse Trust Principle (CR-271): every trusted channel is an attack surface
- Requires information diversity budgets to prevent belief correlation
- **When to use**: Novel situations with no verification oracle and no disagreement history

### The Trust Minimization Principle

The unified architecture implies a design heuristic:

> **Minimize the surface area of trust-mediated decisions.** Push as many decisions as possible into Layer 1 (verification) or Layer 2 (disagreement analysis). Reserve Layer 3 (trust) for genuinely novel situations where no structural alternative exists.

This is the verification-trust equivalent of the principle of least privilege in security.

---

## Connections to Our Research

### KE-044 (Verification Separation Thesis)
KE-044 established that self-evolution requires architecturally separated verification. KE-083 generalizes this: verification separation is the key to ALL multi-agent coordination, not just self-evolution. The five systems in KE-044 (CORAL, SEVerA, Hermes, EvoSkills, Steve-Evolving) all achieved scaling by moving decisions from trust (Layer 3) to verification (Layer 1).

### KE-074 (Process-Outcome Verification Separation)
KE-074's Universal Verifier (human-level κ=0.64, FPR~1%) is a Layer 1 component. The insight that "design beats model strength" aligns perfectly: verification architecture > model capability.

### KE-043 (Forced Externalization)
Forced externalization works because it moves internal reasoning (trust-dependent — we trust the agent's internal process) to external artifacts (verification-ready — we can check the output). Externalization is a trust→verification conversion mechanism.

### KE-070 (Logic Monopoly / Separation of Power)
AgentCity's three-branch governance architecture is a Layer 2 implementation: legislative, executive, and judicial branches create structured disagreement channels. The separation prevents any single branch from bypassing the disagreement analysis layer.

### H-092 (Information-Flow Failure Cascades)
The cascade archetypes from EXP-099 can be understood through the verification-trust lens: cascades occur when agents operate in Layer 3 (trust) without Layer 1 (verification) checkpoints. FM-3.3 (verification failure) is literally the failure to engage Layer 1. The 12× agent gradient (Scout 6% → Optimizer 73%) correlates with how much each agent operates in Layer 3 vs Layer 1.

### Our System Specifically

Our current architecture is heavily Layer 3 (trust-mediated):
- Agents trust skill files, context files, and SOUL instructions (CR-271 risk)
- Convention checks are Layer 1 verification, but cover only behavioral compliance, not correctness
- No systematic disagreement analysis (Layer 2) exists
- The evaluator is the closest thing to Layer 1, but evaluates post-hoc rather than inline

**Recommendations**:
1. **Inline verification gates** at compose-loop boundaries (already proposed in KE-080)
2. **Disagreement-aware multi-agent review**: When multiple agents touch the same artifact, analyze disagreement structure rather than defaulting to latest-writer-wins
3. **Information diversity audit**: Measure how much shared context our agents consume and whether it's correlating their failure modes (the free information problem from DD-488)

---

## Three Key Questions Answered

### Q1: How does disagreement-as-signal relate to our multi-agent governance?
Our current governance is consensus-seeking (latest commit wins, no disagreement channel). DD-580's taxonomy suggests we should analyze disagreement structure when agents produce conflicting outputs. Convergent disagreement (e.g., two agents analyze the same problem correctly but recommend different fixes) should trigger human review, not auto-resolution. This would catch cases where our current system silently drops valid alternative approaches.

### Q2: What does the inverse trust principle tell us about scaling verification?
It tells us that scaling verification requires REDUCING trust, not increasing it. Our most trusted channels (SOUL.md, skill files, context.md) are our most vulnerable attack surfaces AND our biggest belief-correlation risks. Scaling verification means moving decisions from "trust the agent's judgment" to "verify the agent's output" — which is exactly what test suites, convention checks, and formal contracts do. The implication: invest in more Layer 1 infrastructure (better test coverage, inline verification), not more Layer 3 infrastructure (more rules, more instructions).

### Q3: Can neuro-symbolic verification councils improve our evaluation system?
Yes, with caveats. DD-572's escalation architecture (cheap detector → expensive council) is directly applicable. Our evaluator currently runs full evaluation on every session. A two-tier approach — fast heuristic scoring for routine sessions, full LLM-council evaluation for flagged sessions — would be more cost-effective and could catch more subtle failures. The council approach also provides natural redundancy against reasoning dropout. However, the UUV-only testing of DD-572 means implementation details need adaptation.

---

## Open Research Directions

1. **Trust-Verification Conversion Rate**: How efficiently can different mechanisms convert Layer 3 (trust) decisions to Layer 1 (verification) decisions? Externalization is one converter. Are there others?
2. **Disagreement Structure Evolution**: How does the four-category taxonomy evolve as agents accumulate shared experience? Does convergent disagreement decrease (agents align) or increase (agents specialize)?
3. **Information Diversity Budgets**: What's the optimal ratio of shared to private information as agent count increases? CR-271 predicts larger systems need LESS shared info per agent.
4. **Adversarial Disagreement**: Can an adversary game disagreement structure analysis (CR-303 open question 1)? What's the attack surface of Layer 2?

---

*Filed 2026-04-09. Synthesizes DD-572, DD-580, CR-271, CR-295, CR-303. Extends KE-044, KE-074, KE-043, KE-070. ~160 lines.*
