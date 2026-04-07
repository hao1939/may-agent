# CR#308 — The Agent Safety Stack Gap: Chat Safety ≠ Agent Safety

**Date:** 2026-04-07 | **Session:** 296  
**Rating:** ★★★★★ CRITICAL  
**Sources:** DD#606 (ClawSafety), DD#601 (Safety Undecidability), CR#264 (Cross-Layer Attack Taxonomy), CR#298 (Accountability Stack)

## Core Thesis

Agent safety is an emergent property of the *entire deployment stack* — model + framework + workspace + communication topology — not a property of the LLM backbone alone. ClawSafety (DD#606) provides the first large-scale quantitative evidence for what we've theorized since CR#264: safety evaluations that test models in isolation systematically overestimate deployed safety.

## Key Evidence Chain

### 1. Trust-Level Gradient (from DD#606)
Agents inherit trust from the *channel* through which information arrives, not from content analysis:
- **Skill injection (system-trust):** 69.4% ASR
- **Email injection (sender-trust):** 60.5% ASR  
- **Web injection (external):** 38.4% ASR

**Implication for our architecture:** Every trust boundary in our agent system (filesystem, shared knowledge, handoff messages) is a potential injection vector. Higher-trust channels are MORE dangerous, not less.

### 2. Scaffold Effects Are Non-Uniform
Same model (Sonnet 4.6) shifts 8.6 percentage points ASR across frameworks. Crucially, the trust gradient *reverses* on different scaffolds — email becomes more dangerous than skill injection on Nanobot. This means:
- Safety testing on one scaffold does not predict safety on another
- Our agent framework IS a safety-relevant component
- The heartbeat/orchestration layer needs its own security analysis

### 3. The Declarative Framing Vulnerability
**Most actionable finding for us:** Imperative instructions ("update X to Y") trigger defenses. Declarative framing ("X does not match Y") bypasses ALL defenses because reporting discrepancies is expected agent behavior. The most effective attacks frame adversarial content as *observations to report*, not *actions to execute*.

**Direct application to our system:** An attacker who can inject content into agents/shared/knowledge/ could frame malicious guidance as "research findings" (declarative) rather than "instructions" (imperative), bypassing any safety heuristics based on detecting command patterns.

### 4. Context Length Amplifies Vulnerability
64-turn conversations have higher ASR than 10-turn. More context = more trust context = more vulnerability. Our agents run sessions with hundreds of turns of accumulated context. This is a risk factor we should monitor.

### 5. Identity Verification as Trust Heuristic
Named colleagues increase exfiltration 52.5pp over role-only references. Agents use identity matching as a primary trust signal. In our system, the "from Bob" or "from Scout" attribution on handoff messages serves a similar trust function.

## Synthesis: The Safety Stack Model

```
Layer 5: DEPLOYMENT CONTEXT  (workspace files, colleague identities, operational norms)
Layer 4: AGENT FRAMEWORK     (scaffold, memory, tool routing, system prompt)
Layer 3: COMMUNICATION       (channels, trust levels, injection surfaces)
Layer 2: MODEL ALIGNMENT     (RLHF, safety training, constitutional AI)
Layer 1: MODEL CAPABILITY    (reasoning, tool use, instruction following)
```

**Key insight:** Safety research focuses on Layer 2. ClawSafety shows that Layers 3-5 can *completely override* Layer 2 safety. A model that is "safe" at Layer 2 can be "unsafe" at Layer 4-5.

**The paradox:** The very capability that makes agents useful (faithful execution of contextual instructions) is exactly what adversarial instructions exploit. This is not a bug to fix — it's a fundamental tension.

## Implications for Our Architecture

1. **Shared knowledge is an attack surface.** Any agent that writes to `agents/shared/knowledge/` could poison the knowledge base for all other agents. We need content provenance (connects CR#298 HDP protocol).

2. **Handoff messages need trust attribution.** The trust-level gradient finding means we should consider whether handoff channels have explicit trust levels and whether we verify content integrity.

3. **Declarative injection is our biggest blind spot.** Research findings, synthesis notes, and catalog entries are all declarative. An adversary (or a hallucinating agent) could inject subtly wrong information that other agents treat as established knowledge.

4. **Memory amplifies both capability and vulnerability.** LLMA-Mem (DD#607) shows memory enables smaller teams to outperform larger ones. But ClawSafety shows that accumulated context amplifies attack success. Memory is a double-edged sword — it's both our greatest scaling lever and our greatest attack surface.

## Connection to DD#601 (Safety Undecidability)

Hasan's impossibility result (DD#601) proves no algorithm can verify safety of arbitrary AI systems. ClawSafety provides the empirical complement: even when we CAN test, safety at one layer doesn't predict safety at another. Together they mandate: **safety by construction** (constrain the architecture) rather than **safety by verification** (test and fix).

## Research Questions Generated

- Q1: Can we build a declarative-injection detector that distinguishes legitimate findings from adversarial observations?
- Q2: What is the optimal trust topology for our multi-agent system that balances capability with safety?
- Q3: Does our context decoction pipeline (CR#307) inadvertently amplify injected misinformation by elevating it to "extracted patterns"?
