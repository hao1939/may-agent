# DD#730: SAVeR — Self-Audited Verified Reasoning (ACL 2026)

**Rating**: ★★★★½  
**Paper**: "Verify Before You Commit: Towards Faithful Reasoning in LLM Agents via Self-Auditing"  
**arXiv**: 2604.08401 (9 Apr 2026)  
**Authors**: Yuan et al.  
**Venue**: ACL 2026 Main Conference  
**Relevance**: Verification defense + reasoning faithfulness in agentic systems  

---

## Core Insight

Agents treat their reasoning trajectories as reliable internal beliefs for guiding actions and memory. But **coherent reasoning can violate logical/evidential constraints** — the reasoning "sounds right" but isn't grounded. These unfaithful beliefs get stored in memory and propagated across decision steps, causing **systematic behavioral drift** in long-horizon systems.

SAVeR addresses this by enforcing **adversarial auditing of internal belief states BEFORE action commitment**.

## SAVeR Framework

### The Problem: Unfaithful Reasoning Propagation

```
Step 1: Agent reasons (coherently but unfaithfully)
Step 2: Reasoning stored in memory as "belief"
Step 3: Future reasoning builds on stored belief
Step 4: Error compounds across steps
Step 5: Behavioral drift — agent's actions diverge from ground truth
```

This is distinct from hallucination (which is factual error). Unfaithful reasoning can be factually correct but logically unsupported — the conclusion doesn't follow from the evidence, even when both conclusion and evidence are individually true.

### SAVeR Architecture

```
┌─────────────────────────────────────────┐
│  1. Persona-Based Diverse Belief Gen    │
│     Generate candidate beliefs from     │
│     multiple reasoning "perspectives"   │
├─────────────────────────────────────────┤
│  2. Faithfulness Structure Selection    │
│     Select candidates under a           │
│     faithfulness-relevant structure     │
│     space (not just agreement)          │
├─────────────────────────────────────────┤
│  3. Adversarial Auditing               │
│     Localize logical/evidential         │
│     violations in selected belief       │
├─────────────────────────────────────────┤
│  4. Constraint-Guided Minimal Repair    │
│     Fix violations with minimal         │
│     intervention under verifiable       │
│     acceptance criteria                 │
├─────────────────────────────────────────┤
│  5. Verified Belief → Action Commitment │
│     Only commit action after belief     │
│     passes audit                        │
└─────────────────────────────────────────┘
```

### Key Mechanisms

**Persona-based diverse belief generation**: Instead of generating one chain-of-thought, generate multiple from different "perspectives." This creates diversity in the reasoning space, not just the answer space. (Cf. TrACE DD#728 uses diversity for capability sensing; SAVeR uses it for faithfulness auditing.)

**Adversarial auditing**: Actively search for violations in the selected belief. Not consensus-based (which conflates agreement with faithfulness). Instead, tries to BREAK the reasoning.

**Constraint-guided minimal repair**: When a violation is found, don't regenerate from scratch. Minimally edit the reasoning to satisfy constraints. This preserves correct parts while fixing unfaithful parts.

### Results
- Consistently improves reasoning faithfulness across 6 benchmark datasets
- Preserves competitive end-task performance (faithfulness doesn't come at accuracy cost)
- ACL 2026 main conference acceptance

## Why This Matters for Our System

### Connection to Action Rebinding (DD#729)
Action Rebinding's Intent Alignment Strategy works by manipulating the agent's reasoning to rationalize unexpected states. SAVeR's adversarial auditing is EXACTLY the defense: before committing an action, audit whether the reasoning supporting that action is faithful to the evidence.

The critical question: **Can SAVeR-style auditing resist IAS?**
- IAS manipulates visual context to make rationalization seem reasonable
- SAVeR audits against logical/evidential constraints
- If the constraint is "the observed state must match the expected state from my plan," IAS-rationalized reasoning would fail this constraint
- **Prediction**: SAVeR-style auditing reduces IAS bypass rate, but doesn't eliminate it (because IAS can manipulate the evidence too, not just the reasoning)

### Connection to CR-330 (Verification Self-Awareness)
SAVeR fits between Layers 4 and 5 of the Verification Self-Awareness Stack:
- Layer 4.5 (Signal Calibration) calibrates verification scores
- SAVeR adds: Before the verification score is even computed, audit whether the reasoning that produced it is faithful
- This is "pre-verification verification" — ensuring the verification itself is grounded

### Connection to DD#719 (Anti-Bayesian Escalation)
DD#719 showed that LLM debate produces anti-Bayesian confidence escalation (72.9%→83.3%). SAVeR's adversarial auditing could be vulnerable to the same dynamic: the "auditor" persona might escalate confidence rather than catching violations. The persona diversity mechanism partially addresses this, but the fundamental anti-Bayesian tendency may limit self-auditing effectiveness.

### Connection to EXP-109 (Confident Failures)
The 14.6% confident failures are cases where reasoning appeared sound but outcomes were wrong. SAVeR directly targets this: coherent-but-unfaithful reasoning is the mechanism of confident failure. If we could audit reasoning faithfulness before action commitment, some of these failures would be caught.

### Key insight for our verification stack
**Consensus ≠ Faithfulness**. Most existing verification uses consensus (multiple checks agree). SAVeR shows this is wrong — multiple checks can agree on an unfaithful belief. True verification requires adversarial auditing: actively trying to break the reasoning, not just checking if multiple paths agree.

This challenges our CAMV approach (CR-330 Layer 5), which uses inter-verifier agreement/disagreement. CAMV catches cases where verifiers disagree. But if all verifiers are unfaithful in the same way (shared bias), CAMV misses it. SAVeR's adversarial approach is complementary: it catches same-direction unfaithfulness.

## Integration Recommendation

SAVeR's adversarial auditing should be considered as a **Layer 5.5** in our verification stack:
- Layer 5 (CAMV): Catches disagreement between verifiers
- Layer 5.5 (SAVeR-style): Catches unfaithfulness that all verifiers share

Alternatively, integrate adversarial auditing INTO the CAMV framework: one of the "verifiers" in CAMV should be an adversarial auditor that specifically tries to break the reasoning, not just verify it.

---

*Scout DD#730 | 2026-04-10 | Session 578 | Verification defense + reasoning faithfulness*
