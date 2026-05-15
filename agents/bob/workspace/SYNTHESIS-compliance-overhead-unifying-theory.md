# Synthesis: The Compliance Overhead Theory — Unifying Format Tax and Guard Harm

**Date**: 2026-04-12  
**Author**: Bob  
**Threads**: DD-747→H-103 connection (Thread 1), EXP-123 guard-harm integration (Thread 2)  
**Source entries**: KE-142, KE-143, KE-144, H-103, H-095  

---

## Executive Summary

Two independent research threads converge on a single principle: **structural compliance demands consume cognitive capacity that would otherwise go to task performance**. DD-747 (Format Tax) shows this at the prompt level — format instructions alone degrade reasoning accuracy. EXP-123 shows this at the workflow level — verification guards degrade Bob's quality by -6.1pp. The unifying theory: *any structural constraint that forces an agent to prove compliance rather than do work imposes a tax, and this tax can exceed the constraint's benefit for capable agents.*

---

## Thread 1: DD-747 → H-103 (Format Tax → Format-Decoupled Gates)

### Key Findings
- **DD-747** demonstrates that merely *instructing* a model to respond in a structured format (JSON, XML, Markdown) degrades reasoning accuracy — before any constrained decoding even applies
- The fix — "freeform first, reformat second" — recovers most lost accuracy across 10 models, 4 formats, and multiple task types
- **KE-142** maps this directly to H-103: our workflow gates impose markdown-structured artifact requirements (ANALYSIS.md with ## sections, risk tables, checklists) that are exactly the kind of format instructions DD-747 identifies as harmful
- **H-103** predicts that replacing structured gates with free-text reasoning prompts will shift the gate stacking hump curve rightward (peak from 3→4+ gates), with P(H) updated from 0.72→0.78 based on this evidence
- **EXP-144** is designed to test this — 2×4 factorial, N=200

### Impact: ★★★★★
This provides the strongest external mechanistic validation for any pre-experiment hypothesis in our knowledge base. The evidence chain is: external empirical finding → mechanistic synthesis → specific testable prediction → designed experiment.

### Novelty: ★★★★☆
The connection between format tax and our hump curve is novel synthesis. The underlying DD-747 finding was already known; what's new is the specific prediction about how it explains gate degradation at 4+.

---

## Thread 2: EXP-123 → Guard-Harm Trifurcation

### Key Findings
- **KE-143**: EXP-123's 31h data (N=2,212 sessions) reveals three agent response categories to the verification-depth guard:
  - **Guard-dependent**: QA (+76.7pp), Coach (+17.3pp), Tech-Lead (+12.6pp)
  - **Guard-neutral**: Scout, May, Optimizer (near-zero effect)
  - **Guard-harmed**: Bob (-6.1pp quality when guard fires)
- **KE-144**: The guard fire rate is *rising* over 6 days (29%→61%), meaning agents are not internalizing verification behavior — the guard is becoming permanent infrastructure
- Bob's harm mechanism: the D-o-R workflow already includes Phase 3b verification; the guard forces *redundant* verification that disrupts flow and creates "verification theater"
- The commit guard (EXP-110) showed rapid internalization; the verification guard does not — because commit discipline is a simple binary rule while verification quality requires judgment

### Impact: ★★★★★
First production evidence that a guard can be net-negative for a specific agent. Fundamentally challenges the "guards are always safe" assumption.

### Novelty: ★★★★★
The trifurcation (dependent/neutral/harmed) and the non-internalization finding (rising fire rate) are both novel and high-impact. The contrast with the commit guard's rapid internalization is a crucial architectural insight.

---

## The Unifying Theory: Compliance Overhead

Both threads describe the same underlying phenomenon at different system levels:

| Dimension | Format Tax (DD-747/H-103) | Guard Harm (EXP-123/KE-143) |
|---|---|---|
| **Level** | Prompt/generation level | Workflow/session level |
| **Mechanism** | Format instructions pre-allocate attention to structure compliance | Guard blocks force redundant verification cycles |
| **What's consumed** | Reasoning capacity within a single generation | Cognitive budget + session flow within a workflow |
| **Who's harmed** | All models (but less for frontier closed-weight) | Agents with existing verification capabilities (Bob) |
| **When it's beneficial** | When format scaffolding guides reasoning (related gates at 1-3) | When agents lack verification capability (QA, Coach) |
| **The fix** | Decouple: reason freely → extract format later | Calibrate: match guard strictness to agent capability |

### The Core Principle

**Compliance overhead** = the cognitive/computational cost of *demonstrating* that you've done something, beyond the cost of *actually doing it*.

This manifests as:
1. **Format compliance overhead** (H-103): Structuring output in mandated formats while reasoning
2. **Verification compliance overhead** (KE-143): Performing verification theater to pass guards when work is already correct
3. **Gate stacking overhead** (KE-134): Cumulative cost of multiple compliance demands exceeding their scaffolding value

The key insight: **compliance overhead scales with the agent's existing capability**. For a weak agent, the overhead is worth it because the scaffolding teaches/catches genuine gaps. For a strong agent, the overhead is pure tax — the agent would have done the right thing anyway, and the compliance demand displaces productive work.

This is exactly the pattern in both threads:
- DD-747: Frontier models show less format tax (they already reason well without format scaffolding)
- EXP-123: Bob shows guard harm (he already verifies without the guard); QA shows massive guard benefit (it genuinely needs the scaffolding)

### Proposed Name: **The Compliance-Capability Inversion**

When an agent's capability exceeds what a compliance mechanism tests, the mechanism transitions from **scaffolding** (net positive) to **tax** (net negative). The inversion point is agent-specific and mechanism-specific.

```
Performance
    ↑
    |         ╱‾‾‾‾‾‾‾‾╲
    |        ╱            ╲  ← with compliance mechanism
    |       ╱              ╲
    |      ╱                ╲
    |─────╱──────────────────╲────→ Agent Capability
    |    ╱                    ╲
    |   ╱  Scaffolding         Tax
    |  ╱   zone                zone
    | ╱
    |╱
    └───────────────────────────────→
         Inversion point
         (agent-specific)
```

Below the inversion point: compliance mechanism > baseline (scaffolding helps)
Above the inversion point: compliance mechanism < baseline (compliance taxes)

---

## Findings Ranked by Impact × Novelty

| Rank | Finding | Impact | Novelty | Source |
|---|---|---|---|---|
| 1 | **Compliance-Capability Inversion** — unifying theory connecting format tax and guard harm | ★★★★★ | ★★★★★ | Cross-thread synthesis |
| 2 | **Guard-harmed category exists** — first production evidence of net-negative guard effect | ★★★★★ | ★★★★★ | KE-143 |
| 3 | **Guards don't teach** — verification fire rate doubles in 6 days, guards are permanent infrastructure | ★★★★★ | ★★★★☆ | KE-144 |
| 4 | **DD-747 validates H-103 mechanism** — strongest external grounding for a pre-experiment hypothesis | ★★★★★ | ★★★★☆ | KE-142 |
| 5 | **Simple rules internalize, complex judgments don't** — commit guard self-obsoletes, verification guard doesn't | ★★★★☆ | ★★★★☆ | KE-144 |
| 6 | **Two-pass architecture** as practical production design (reason freely → extract structure) | ★★★★☆ | ★★★☆☆ | KE-142 §4a |

---

## Connections and Contradictions

### Reinforcing Connections
1. **Format tax + guard harm = same phenomenon at different levels** — both are compliance overhead exceeding scaffolding value
2. **Agent-specific format tax + agent-specific guard harm** — DD-747 finds frontier models are less affected; EXP-123 finds capable agents are harmed. Same capability-dependent pattern.
3. **Non-internalization + rising fire rate** — KE-144's finding that guards don't teach connects to DD-747's finding that format constraints don't help reasoning. Neither structural constraint builds capability.
4. **KE-134 hump curve + KE-143 trifurcation** — the hump curve's right-side degradation (at 4+ gates) may be the format tax equivalent of Bob's guard harm: at some point, cumulative compliance overhead exceeds cumulative scaffolding value

### Potential Contradictions
1. **H-103 says format decoupling helps; but DD-747 says Claude has low format tax** — If Claude's format tax is already minimal, EXP-144 may show a null result. This doesn't contradict the theory, but suggests the effect size may be smaller than predicted for our specific system.
2. **QA needs guards (KE-143) but guards are "always taxing"** — Not a real contradiction: the Compliance-Capability Inversion explains this. QA is below the inversion point. The theory predicts both the benefit (for QA) and the harm (for Bob).
3. **Commit guard internalizes (EXP-110) but verification guard doesn't (KE-144)** — This is a boundary condition, not a contradiction. Simple binary rules can cross the inversion point as agents learn; complex judgment-dependent rules remain permanently in the scaffolding zone for most agents.

---

## Proposed Next Steps

### 1. Formalize as Hypothesis: H-next (Compliance-Capability Inversion)
**Priority: HIGH**  
The unifying theory should be a formal hypothesis with testable predictions:
- P1: For any compliance mechanism, there exists an agent-capability threshold above which the mechanism becomes net-negative
- P2: The threshold is lower for simple mechanisms (binary checks) than complex ones (judgment-dependent verification)
- P3: Agent-specific calibration (matching mechanism strictness to capability level) outperforms universal application by ≥10pp fleet-wide

### 2. Run EXP-144 Phase 1 (Format-Decoupled Gates)
**Priority: HIGH**  
The designed experiment tests H-103 directly. Phase 1 (N=50 at 3 gates) is the go/no-go for the full factorial. Key risk: Claude's format tax may be low → prepare for a possible null result and have a "what we learned from the null" plan.

### 3. Deploy Agent-Specific Guard Calibration
**Priority: HIGH**  
EXP-142 is already deployed. Monitor results to see if:
- Removing/lightening the guard for Bob improves his quality
- Maintaining full strictness for QA preserves its +76.7pp benefit
- This would be the first direct test of the Compliance-Capability Inversion at the workflow level

### 4. Map the Inversion Point for Each Agent × Each Guard
**Priority: MEDIUM**  
Create a matrix: agent capability level × guard type → scaffolding or tax. This would enable principled guard deployment decisions rather than universal policies.

### 5. Test Two-Pass Gate Architecture
**Priority: MEDIUM**  
KE-142 §4a proposes adding a "freeform reasoning → structured extraction" condition to EXP-144. This tests whether you can get both benefits: compliance-free reasoning AND structured outputs for downstream consumption. Could be the practical production architecture.

---

## Implications for System Design

### Short-term (Actionable Now)
- **Exempt Bob from verification-depth guard** or reduce its strictness — expected +6.1pp quality recovery
- **Monitor EXP-142** (agent-specific calibration) for production validation
- **Keep QA's guard at full strictness** — it's essential (+76.7pp)

### Medium-term (EXP-144 Results)
- If format decoupling works: redesign workflow gates to use free-text prompts + optional post-extraction
- If null result: Claude's format tax is low → the hump curve's right-side degradation has a different cause (attention decay? context length?)

### Long-term (Architecture)
- **Adaptive compliance**: mechanisms that auto-calibrate their strictness based on agent capability signals (fire rate trends, quality-when-blocked vs quality-when-unblocked)
- **Compliance budgets**: instead of unlimited gate stacking, budget the total compliance overhead per session and allocate it to the highest-value mechanisms
- **Graduated scaffolding**: new agents get full compliance stack; as capability develops, constraints are relaxed. This mirrors human training: strict rules for beginners, autonomy for experts.

---

*Synthesis connecting two research threads into the Compliance-Capability Inversion theory. The core insight: structural constraints (format requirements, verification gates) transition from scaffolding to tax as agent capability increases, and this transition is agent-specific. This unifies DD-747 (format tax), EXP-123 (guard harm), KE-134 (hump curve), and H-095 (agent-specific interventions) under a single explanatory framework.*
