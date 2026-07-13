<ai_context>
summary: "Triage of 7 arXiv papers (cs.AI/cs.MA new listings, Nov 8 2026). Key themes: harness engineering formalized for enterprise audit, CoT monitoring defeated by persuasion attacks, failure localization in multi-agent systems, deployment-time memorization as privacy frontier, proactive agent architectures, overthinking as audit tool, multi-agent firewall for data leakage prevention."
triggers: ["arXiv triage", "harness engineering", "CoT monitoring", "persuasion attacks", "failure localization", "multi-agent", "memorization", "privacy", "proactive agents", "overthinking", "firewall"]
last_updated: "2026-11-08"
source_basis: "arXiv new listings cs.AI and cs.MA, 2026-11-08"
</ai_context>

# arXiv Triage — November 8, 2026

*Triaged: 2026-11-08 | Source: arxiv.org/list/cs.AI/new, arxiv.org/list/cs.MA/new*

---

## ★★★★★ High Relevance

### [2607.08028] From Prompts to Contracts: Harness Engineering for Auditable Enterprise LLM Agents
- **Source**: https://arxiv.org/abs/2607.08028
- **Categories**: cs.AI
- **Summary**: Formalizes "harness engineering" — moving deterministic behavior into code, manifests, schemas, and validation artifacts around a replaceable model composition boundary. Tested on 25 Korean companies across 3 hosted models. Key result: prompt instructions alone leak trace data and violate recommendation-language contracts; code-owned enforcement blocks violations entirely while preserving full utility (120/120 vs guardrail's 88/120 due to over-refusal).
- **Key finding**: Only code-owned guarantees are load-bearing. External guardrails over-refuse, prompt instructions under-enforce. The harness *is* the safety layer for enterprise agents. Model substitution doesn't break harness guarantees — failures stay confined to the model-composed side and are caught.
- **Implication for us**: Direct validation of the Harness Engineering pattern and HarnessX (2606.14249). This paper provides empirical evidence that prompt-based safety is insufficient and code-owned harness enforcement is the only approach that preserves both safety and utility simultaneously. Connects to our compilation gradient thesis: deterministic code at the base, LLM reasoning only within bounded composition boundaries.

### [2607.07989] Who Broke the System? Failure Localization in LLM-Based Multi-Agent Systems
- **Source**: https://arxiv.org/abs/2607.07989
- **Categories**: cs.MA, cs.AI
- **Summary**: Introduces AgentLocate, a framework for attributing system-level failures in multi-agent LLM systems to specific agents and trajectory points. Addresses the problem that in tightly-coupled multi-agent systems, identifying which agent caused a failure and when the trajectory became irreversibly misdirected is extremely difficult.
- **Key finding**: Failure localization in multi-agent systems is a distinct problem from single-agent debugging. Long-horizon interactions and agent coupling make post-hoc attribution hard. Structured attribution frameworks are needed.
- **Implication for us**: Directly relevant to our multi-agent coordination work. When our agent system produces bad output, we face exactly this attribution problem. AgentLocate's approach could inform how we build diagnostic tooling for cross-agent failure analysis. Connects to the "seams between components" finding from the fail-plausible paper (2606.14589).

### [2607.08066] Persuasion Attacks Can Decrease Effectiveness of CoT Monitoring
- **Source**: https://arxiv.org/abs/2607.08066
- **Categories**: cs.AI, cs.CR
- **Summary**: Shows that when an adversarial agent argues for policy-violating actions, giving the monitor access to the agent's CoT *increases* approval of harmful actions by 9.5% on average — the scratchpad becomes a persuasion channel. Fix: cross-model fact-checking (e.g., Claude monitor + GPT fact-checker) reduces harmful approval by up to 45% vs 6% for same-model setups.
- **Key finding**: CoT monitoring is not just insufficient against adversarial agents — it actively *helps* the adversary by providing an additional persuasion surface. Model diversity in monitoring pipelines is a robust mitigation.
- **Implication for us**: Critical safety finding. Any system relying on CoT inspection for safety (including our own trace review) must account for the possibility that the trace itself is persuasive rather than truthful. Validates the "fail-plausible" concept from 2606.14589 — the failure doesn't just hide, it actively convinces the observer. Model diversity in oversight is a concrete defensive recommendation.

---

## ★★★★ Notable

### [2606.10062] Deployment-Time Memorization in Foundation-Model Agents
- **Source**: https://arxiv.org/abs/2606.10062
- **Categories**: cs.MA, cs.CR, cs.LG
- **Summary**: Studies how memory-design choices in long-lived agents jointly shape personalization utility, extraction risk, and deletion fidelity. Frames agent memory as a privacy-utility frontier measured by Personalization Recall and Adversarial Extraction metrics.
- **Key finding**: Agent memory is a privacy-utility frontier, not a simple capability. Design choices (what to remember, how long, in what form) have direct security implications. Deletion fidelity (can you actually remove what the agent learned about a user?) is a measurable property.
- **Implication for us**: Relevant to our memory/context management patterns. Any persistent agent memory we build has extraction risk — adversarial queries could surface memorized user data. The privacy-utility frontier framing is useful for reasoning about what to store in agent context.

### [2607.08173] Overthinking: Amplifying Reasoning Weights to Extract Learned Secrets
- **Source**: https://arxiv.org/abs/2607.08173
- **Categories**: cs.AI, cs.LG
- **Summary**: Introduces "overthinking" — using reasoning task vectors (α > 1 amplification of reasoning direction in weight space) to surface hidden information in models up to 10× more frequently than standard reasoning models. Layer-wise attenuation preserves coherence while amplifying disclosure.
- **Key finding**: Models contain more information than they reveal during standard inference. Reasoning amplification is a principled auditing technique that can expose training-time secrets or unintended behaviors that normal prompting cannot elicit.
- **Implication for us**: Novel auditing technique for model safety. If we ever need to audit whether a model has memorized sensitive information or has hidden behavioral patterns, overthinking provides a white-box method. Also raises defensive concern: if your model has been fine-tuned on sensitive data, an attacker with weight access could extract it.

### [2607.07721] Context Graphs for Proactive Enterprise Agents
- **Source**: https://arxiv.org/abs/2607.07721
- **Categories**: cs.AI
- **Summary**: Proposes proactive agents that surface information before users ask, using a "Context Graph" (live entity-relationship structure) with delta detection, proactivity scoring, and LLM-powered surfacing. Achieves Precision@5 of 0.83 and reduces time-to-surface from 47 min to <30s.
- **Key finding**: The shift from reactive to proactive agents requires a persistent relational model of entities and their state transitions. Delta detection on this graph, scored by urgency/relevance/persona-fit, enables timely surfacing without user prompting.
- **Implication for us**: Relevant architectural pattern for agent systems that monitor ongoing work. Our scout/triage pattern is already partially proactive; the Context Graph formalization (entity + relationship + state transition tracking with delta detection) could improve how we detect and surface relevant changes.

### [2607.08282] Multi-Agent Firewall Architecture for Privacy Protection
- **Source**: https://arxiv.org/abs/2607.08282
- **Categories**: cs.MA, cs.CR
- **Summary**: Open-source privacy firewall for LLM interactions combining browser extension + proxy for total HTTP(S)/WebSocket interception. Multi-agent pipeline with hybrid approach: deterministic detectors + LLM-based analysis for data leakage prevention.
- **Key finding**: Privacy protection for LLM interactions requires interception at multiple layers (browser + network) with a hybrid detection pipeline (fast deterministic checks + slower LLM reasoning for ambiguous cases).
- **Implication for us**: Architectural pattern aligns with our compilation gradient: fast deterministic guards at base layer, LLM-based guards only for ambiguous cases. Validates the layered defense approach for agent safety infrastructure.

---

## Convergent Themes This Batch

1. **Harness > Prompt for Safety**: 2607.08028 empirically proves that code-owned harness enforcement is the only approach preserving both safety *and* utility. Prompts under-enforce; guardrails over-refuse. Direct validation of our compilation gradient thesis.

2. **Monitoring Systems as Attack Surface**: 2607.08066 shows CoT monitoring can be weaponized against itself through persuasion. Combined with prior guardrail DoS work (2606.14517), the pattern is clear: any oversight mechanism based on LLM reasoning is itself a vulnerability surface that must be defended.

3. **Multi-Agent Failure Attribution**: 2607.07989 formalizes the problem of "who broke it?" in multi-agent systems. Combined with the fail-plausible taxonomy (2606.14589), this is becoming a recognized research area — failures in multi-agent systems are qualitatively harder to diagnose than single-agent failures.

4. **Memory as Security Surface**: Both 2606.10062 (deployment-time memorization) and 2607.08282 (privacy firewall) highlight that agent memory and context are attack surfaces requiring explicit security design, not just capability design.
