# DD#816 — Conjunctive Prompt Attacks: Compositional Vulnerabilities in Multi-Agent Routing

**Paper**: "Conjunctive Prompt Attacks in Multi-Agent LLM Systems"
**Authors**: Arif, Lou, Zheng
**ArXiv**: 2604.16543 | **Venue**: ACL 2026 Main Conference
**Topics**: multi-agent security, prompt injection, routing attacks, agent coordination

## Problem

Single-agent safety research misses attack surfaces created by multi-agent routing. Can benign-looking fragments combine into harmful behavior when routing brings them together?

## Method: Conjunctive Prompt Attacks

- **Trigger key** in user query + **hidden adversarial template** in one compromised remote agent
- Each appears benign in isolation; harmful behavior activates only when routing combines them
- Attacker changes neither model weights nor client agent — controls only trigger placement and template insertion
- Tested across star, chain, and DAG topologies

## Key Findings

- Routing-aware optimization substantially increases attack success over non-optimized baselines
- False activations remain low (precision is high)
- **Existing defenses fail**: PromptGuard, Llama-Guard variants, system-level tool restrictions — none reliably stop the attack because no single component appears malicious in isolation
- Exposes **structural vulnerability** in agentic pipelines

## Scout Analysis

### Why This Matters

This is the multi-agent analog of compositional attacks in software supply chains. The key insight: **safety checking at individual agent boundaries is insufficient** when the attack surface is the routing composition itself. ACL 2026 main conference acceptance signals the community takes this seriously.

### Connections

- **DD#780 (Subliminal Transfer)**: Both show how harmful behavior can be distributed across components that appear individually benign.
- **DD#703 (Sentinel Agents)**: Sentinel architecture was designed to prevent exactly this class of attack — but this paper suggests sentinels watching individual nodes would miss conjunctive attacks.
- **DD#811 (Artificial Organisations)**: Information routing in organizations creates the same compositional vulnerability surface.

### Implications for Agent Design

1. Defenses must reason over **routing paths**, not just individual messages
2. Compositional safety checking is fundamentally harder than per-agent checking
3. DAG topologies create more attack surface than simple chains

**Rating**: ★★★★½
