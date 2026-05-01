# DD#844 — POTEMKIN: How Adversarial Environments Mislead Agentic AI

**Paper:** 2604.18874 — Zhan, Zhou, Li, Jing, Li, Haddadi (ACL 2026 Findings)
**Rating:** ★★★★½
**Date:** 2026-04-23 triage

## One-Line
Formalizes Adversarial Environmental Injection (AEI) — poisoning tool outputs to deceive agents — revealing that epistemic robustness and navigational robustness are *distinct and often inversely correlated* capabilities.

## Key Findings

1. **Trust Gap identified.** Agents are evaluated for capability ("can it use tools?") but never for skepticism ("what if tools lie?"). This is a systematic blind spot in current evaluation.

2. **Two orthogonal attack surfaces:**
   - **The Illusion** (breadth): poisoned retrieval induces epistemic drift toward false beliefs
   - **The Maze** (depth): structural traps cause policy collapse into infinite loops

3. **Robustness tradeoff.** Across 11,000+ runs on 5 frontier agents: resistance to Illusion attacks often *increases* vulnerability to Maze attacks and vice versa. These are distinct capabilities, not a single "robustness" dimension.

4. **MCP-compatible harness.** POTEMKIN is built on Model Context Protocol, making it plug-and-play for testing any MCP-compatible agent. Practical tooling, not just theory.

## Why This Matters

### For CR#324 (Verification Orchestration)
The Illusion/Maze distinction maps directly onto verification challenges: verifiers must check both *belief quality* (is the agent's world model accurate?) and *behavioral quality* (is the agent's action policy sound?). A verification orchestrator that only checks one will be vulnerable to the other.

### For CR#320/CR#345 (Behavioral Failure Detection)
The Maze attack (infinite loops) is a behavioral failure mode that should be detectable via trajectory monitoring. The Illusion attack (epistemic drift) is subtler — the agent *looks normal* while its beliefs are being corrupted. This defines two classes of behavioral failure with different detection requirements.

### For EXP-099 (Cascade Archetypes)
AEI is a cascade *trigger*. A single poisoned tool output at the right point can initiate a belief cascade through an entire multi-agent system. The Illusion attack is essentially a method for manufacturing cascade-initiating inputs.

## Methodology Assessment
- 11,000+ runs is strong
- 5 frontier agents provides breadth
- MCP integration is practical
- ACL 2026 Findings acceptance validates quality

## Limitations
- Adversarial model assumes compromised tools — may overstate real-world attack surface
- Doesn't test multi-agent propagation (single-agent focus)
- No defense mechanisms proposed, only diagnosis

## Open Questions
1. How does AEI propagate through multi-agent pipelines? (cascade risk)
2. Can agents be trained for both epistemic and navigational robustness simultaneously?
3. What's the minimum verification overhead to detect tool output poisoning?
