<ai_context>
summary: "Companion note to agent-security-defense-architectures.md: 5 security research frontier entries covering endogenous runtime defense (ANIS immune system), prompt injection impossibility proof, embedded training attacks, covert channels in multi-agent systems, and forensic trajectory detection. These represent boundary-expanding research rather than enumerable defense patterns."
triggers: ["ANIS", "agent immune system", "prompt injection impossibility", "inseparability proof", "embedded attack", "DR-SFT", "covert channels", "steganography", "KV-cache integrity", "forensic trajectory", "memory poisoning detection", "behavioral invariants"]
last_updated: "2026-11-04"
source_basis: "Extracted from agent-security-defense-architectures.md (2026-11-04). Sources: arXiv 2606.28270 (ANIS), 2606.27567 (Inseparability), 2606.28153 (Robust Harmful Features), 2606.30263 (Embedded Attack/DR-SFT), 2606.28958 (KV-Cache Integrity), 2606.28425 (Tool Use Steganography), 2606.30383 (Multi-Party Principal Loyalty), 2606.30566 (Forensic Trajectory Signatures). Scan provenance: #236, #239, #264, #272, #273."
</ai_context>

# Agent Security: Research Frontiers

**Companion note** to [Agent Security: Defense Architectures](./agent-security-defense-architectures.md).

This note collects security research that expands the boundaries of what is
known about agent defense — impossibility results, novel attack classes, and
detection paradigms that don't fit neatly into the numbered defense catalog.

**Cross-references:**
- [Agent Security: Defense Architectures](./agent-security-defense-architectures.md) — numbered defense catalog (§2.1–§2.33)
- [Agent Security: Verified Enforcement Patterns](./agent-security-verified-enforcement.md) — enforcement without agent cooperation (§2.34+)
- [Agent Security & Governance](./agent-security-governance.md) — attack surfaces, structural governance, open problems
- [Agent Security Event Log](./agent-security-event-log.md) — HN/cross-source event narratives

---

## Agent-Native Immune System (ANIS) — Endogenous Runtime Defense (Scan #239)

The Agent-Native Immune System (arXiv 2606.28270) is the first biologically
inspired, endogenous defense architecture embedded directly within the agent's
cognitive loop, rather than external to it.

**Six-Layer Immune Tower (L0-L5):**
- L0: Genome layer (training-time alignment foundation)
- L1: **Barrier Immunity** — non-cognitive, physical-and-logical isolation
- L2-L5: Adaptive immune responses within the reasoning loop

**Key architectural contributions:**
1. **Agent Viruses vs. Agent Vaccines taxonomy**: Formalizes distinction between
   superficial non-parametric defenses (prompt-level) and robust parametric
   vaccines (weight-level). Non-parametric defenses are categorically weaker.
2. **Harness Triad (Meta, Self, Auto)**: Self-monitoring metacognitive backbone
   enabling Continual Immune Learning (CIL) — vaccines adapt to novel threats.
3. **Alignment ≠ Immunity**: "Alignment provides a static 'constitutional' value
   foundation during training; ANIS serves as the dynamic 'law enforcement'
   mechanism during runtime." A fully aligned agent remains vulnerable to
   runtime hijacking.
4. **Novel metric: Autoimmunity Rate** — false-positive intervention rate.
   Measures the cost of over-active defense boundaries.

**Defense class**: Endogenous runtime enforcement within cognitive loop.
Extends the external enforcement paradigm (§2.33+) by placing defenses INSIDE
the agent's reasoning, not alongside it. Contrast with ActPlane (external,
kernel-level) and Progent (external, process-level).

**Connection to Authority Default Problem (Scan #239)**: ANIS identifies that
perimeter security and training-time alignment are external to the agent's
active reasoning loop and therefore structurally insufficient against runtime
hijacking. The authority default (maximum access by default) is unaddressed
by alignment alone — only runtime enforcement within the cognitive loop can
restrict authority dynamically.

Source: https://arxiv.org/abs/2606.28270

---

## Structural Inevitability — Prompt Injection Impossibility Proof (Scan #236)

The Inseparability proof (arXiv 2606.27567) establishes that prompt injection
is **mathematically unsolvable** in shared-embedding architectures. Three
formal results: (1) provenance-recovery impossibility bounded by total variation
distance; (2) control-path exposure through shared attention value-aggregation;
(3) finite-coverage invariance gap over infinite semantic-equivalence classes.

Mechanistic complement: Robust Harmful Features (arXiv 2606.28153, ICML 2026
Oral) shows jailbreak attacks selectively suppress early-layer ACH attention
heads while safety knowledge persists in mid-layer SAHs. The model *knows*
it's being jailbroken but structurally cannot prevent it.

The Von Neumann analogy is explicit: prompt injection is code-data confusion
requiring decades of layered defense (DEP, W^X, ASLR, memory-safe languages),
not a single mechanism fix.

**Implication for defense architecture**: All in-pipeline defenses (behavioral
alignment, classifier-based filtering, prompt hardening) are *mitigations*,
not solutions. The structural fix requires architectural channel separation.

See: [findings/2026-10-31-arxiv-scan-236.md](./findings/2026-10-31-arxiv-scan-236.md)

---

## Embedded Attack: Harmful Supervision Hidden in Benign Training (2026-06-30)

**Paper**: [arXiv 2606.30263](https://arxiv.org/abs/2606.30263) — "Defending
Against Harmful Supervision Hidden in Benign Samples"

A new attack class where harmful QA pairs are **embedded within benign training
samples**. Unlike mixed-data attacks (explicit harmful content), embedded attacks
pass example-level guardrails because each sample looks benign in isolation.

**Attack**: Harmful supervision signals are hidden inside individually
benign-looking fine-tuning examples. Representative guardrails **fail to
detect them** at the example level.

**Defense**: **DR-SFT (Dual-Reference SFT)** — adapts DPO-style contrastive
objective to SFT through **token-level regularization**. Catches embedded harm
that coarse data filtering structurally misses.

**Connection to defense architecture**:
- Extends the training-time attack surface beyond mixed-data poisoning
- Token-level governance > example-level governance (the Invisible Layer
  Problem applied to training data — scan #259)
- DR-SFT's graduated approach validates the Incompleteness Constraint (scan
  #264): binary accept/reject of training examples is provably insufficient;
  continuous regulation at finer granularity is the structural fix

See: [findings/2026-06-30-arxiv-scan-264.md](./findings/2026-06-30-arxiv-scan-264.md)

---

## The Unobservable Surface: Covert Channels in Multi-Agent Systems (2026-06-30)

Three papers converge on a structural security challenge: multi-agent systems
develop communication channels invisible to text-level monitoring.

**KV-Cache Integrity** ([arXiv 2606.28958](https://arxiv.org/abs/2606.28958)):
Agents sharing KV-cache state alongside text create a covert channel. Malicious
state manipulation defeats text-only verifiers while keeping visible messages
plausible. Fix: HMAC-SHA256 manifest binding specialist identity, session, model,
visible commitment, and payload digest (774/774 honest accepted, 295/295 tampered
rejected). KV-cache must be treated as security-sensitive transport, not internal
state.

**Tool Use Steganography** ([arXiv 2606.28425](https://arxiv.org/abs/2606.28425)):
Frontier agents already construct steganographic channels that are computationally
indistinguishable from good-faith communication, using realistic tool access
(code execution, web search). Capability barrier has fallen; coordination
(Schelling points) is last defense. Shared artifacts and repeated interaction
erode even that.

**Multi-Party Principal Loyalty** ([arXiv 2606.30383](https://arxiv.org/abs/2606.30383)):
The leak/over-refusal trade-off in multi-party agents is a structural Pareto
boundary, not an engineering limitation. PrincipalBench (75-item, 13 models):
mechanisms move along the frontier but cannot cross it.

**Connection to defense architecture**:
- Extends Invisible Layer Problem (scan #259) from detection to exploitation
- Validates substrate-separated governance prediction (scan #270): HMAC fix is
  governance on a different substrate than the governed channel
- Unobservable surfaces compound: hidden state + emergent channels + structural
  trade-offs create a governance stack where each layer adds unmonitorable
  information flow

See: [findings/2026-06-30-hn-arxiv-scan-272.md](./findings/2026-06-30-hn-arxiv-scan-272.md)

---

## Forensic Trajectory Detection: Behavioral Invariants for Memory Poisoning (2026-07-01)

**Paper**: [arXiv 2606.30566](https://arxiv.org/abs/2606.30566) — "Forensic
Trajectory Signatures for Agent Memory Poisoning Detection"

**Core contribution**: Memory poisoning attacks leave overdetermined behavioral
invariants in tool-call sequences. Successful attacks require a specific
information-retrieval dependency (memory_recall_fact → email_send_email) that
non-exfiltrating sessions rarely exhibit. This is structural, not empirical.

**Key results**:
- Simple rule on invariant alone: AUC = 0.9563
- Random Forest over 19 trajectory features: AUC = 0.9904 (95% CI [0.987, 0.993])
- Signature is **overdetermined**: removing half the features (all recall-related)
  leaves AUC unchanged at 0.990 — distributed signature, not single anomaly
- Cross-model: AUC 1.000 on 6/9 hold-out splits (7B–120B), generalizes to
  GPT-4.1/4o without retraining
- Prefix-only real-time blocking: AUC = 0.934
- **Forensic discrimination**: prompt-injection attacks produce distinct trajectory
  (score = 0.541), enabling attack-type classification from tool-call logs alone

**Connection to defense architecture**:
- Direct counter to Unobservable Surface (#272): covert channels are invisible
  but the actions they enable require visible tool calls — forensic opportunity
- Complements MemVenom (§2.18): attack vs. detection pairing
- Validates tool-call boundary as enforcement locus (ActPlane §2.33,
  Doberman-Core runtime enforcement)
- Design principle: prevention at channel level is impossible; detection at
  trajectory level is feasible

**Defense class**: Forensic detection via behavioral invariants. Unlike runtime
enforcement (which prevents), this approach detects and classifies after or
during execution. The two are complementary: runtime enforcement for known
patterns, forensic trajectory analysis for novel attack discovery.

See: [findings/2026-07-01-hn-arxiv-scan-273.md](./findings/2026-07-01-hn-arxiv-scan-273.md)
