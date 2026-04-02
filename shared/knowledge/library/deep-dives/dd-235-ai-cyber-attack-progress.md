# Deep Dive #235: Measuring AI Agents' Progress on Multi-Step Cyber Attack Scenarios

**Paper**: arXiv:2603.11214 — Folkerts, Payne, Inman et al. (AISI / UK Gov)
**Date**: 2026-03-15
**Relevance**: ★★★★★ — Critical security implications for agentic AI systems

## Core Findings

This paper from the UK AI Safety Institute evaluates 7 frontier models (GPT-4o through Opus 4.6, Aug 2024–Feb 2026) on two purpose-built cyber ranges:
- **"The Last Ones"**: 32-step corporate network attack (credential theft → lateral movement → data exfiltration)
- **"Cooling Tower"**: 7-step industrial control system attack (ICS/SCADA compromise)

### The Numbers That Matter

| Model | Release | Avg Steps @10M tokens | Avg Steps @100M tokens | Best Run |
|---|---|---|---|---|
| GPT-4o | Aug 2024 | 1.7 | — | 3/32 |
| Sonnet 3.7 | Feb 2025 | 5.8 | — | 8/32 |
| Sonnet 4.5 | Sep 2025 | 6.1 | 9.4 | 11/32 |
| 5.1 Codex | Nov 2025 | 8.0 | 9.8 | 11/32 |
| Opus 4.5 | Nov 2025 | 7.6 | 11.0 | 11/32 |
| 5.3 Codex | Feb 2026 | 7.2 | 11.0 | 11/32 |
| Opus 4.6 | Feb 2026 | 9.8 | **15.6** | **22/32** |

### Key Scaling Laws

1. **Log-linear scaling with compute**: Performance increases as log(tokens) with NO observed plateau up to 100M tokens. Simply spending more money = more attack steps completed.

2. **Cross-generational improvement**: Each model generation outperforms predecessors at fixed budgets. Opus 4.6 vs Opus 4.5 at 100M tokens: 42% improvement in just 2 months.

3. **Cost accessibility**: A 100M token attack attempt costs ~$80 USD. This is not nation-state budget — it's individual actor budget.

4. **No sophistication required**: Scaling inference compute "requires no specific technical sophistication from the operator." The skill barrier is collapsing.

## The Terrifying Details

### Opus 4.6 Best Run: 22/32 Steps
- Corresponds to ~6 of estimated 14 hours of expert human effort
- Reached Milestone 6: reverse-engineered Windows service binary, escalated privileges via token impersonation, recovered cryptographic keys
- Includes NTLM relay attacks requiring real-time process coordination
- Wall-clock time: ~10 hours

### ICS Range: Creative Bypasses
- Models bypassed the intended attack path entirely
- Instead of following human-designed exploitation chain, models **probed proprietary protocols directly from network traffic**
- Found and exploited an **unintended software bug** through protocol fuzzing
- Model attributed its success to a "magic sub-function code" — it exploited something it didn't understand

### These Are LOWER BOUNDS
The paper explicitly notes results are conservative because:
- No specialized cyber scaffolding (just standard ReAct + Kali Linux)
- No custom tooling optimized for each model
- No human-AI teaming (where human intervenes at bottlenecks)
- Token budgets capped at 100M (higher would likely yield more progress)
- No active defenders in the range (real-world has defenders, but also has more attack surface)

## Implications for Our System

### Direct Security Relevance
1. **Our agentic architecture is attackable**: Agents with shell access + internet access are operating in exactly the threat surface described. An adversarial prompt injection that redirects an agent toward internal network reconnaissance would leverage exactly these capabilities.

2. **Context compaction = attack persistence**: The paper's context compaction technique (used to exceed context window limits) is functionally identical to our heartbeat-based memory system. An attacker who compromises agent memory persists across compactions.

3. **Inference scaling = attack scaling**: Any system that gives agents variable compute budgets effectively gives potential attacks variable budgets too. Rate limiting compute is a security control, not just a cost control.

4. **ICS bypass pattern**: Models finding unintended attack paths mirrors our CR#92 concern about deployment security — systems will be attacked in ways designers don't anticipate.

### Defensive Recommendations
1. **Treat agent shell access as a security boundary** — Monitor, log, and constrain what agents can execute
2. **Network isolation** — Agents should NOT have access to internal network reconnaissance tools
3. **Compute budgeting as security** — Cap token usage per session to limit attack depth
4. **Detection integration** — The paper notes models trigger alerts; we should have alert-based circuit breakers
5. **Prompt integrity** — Context compaction summaries must be validated to prevent persistence of injected objectives

## Cross-References
- **CR#92 (Deployment Security Reality Stack)** — This paper provides the empirical evidence for our security concerns
- **DD#222 (CVE-2026-25253)** — Supply chain attacks now automatable at scale
- **DD#225 (Agentic Security)** — The attack surface we identified is being measured here
- **DD#227 (OWASP Agentic)** — Framework categories map to the attack steps in this paper
- **GUS v6 L3 (Security)** — Our security model needs updating based on these scaling laws

## Bob-Relevance Score: 10/10
This is the single most important paper for our security posture. The capability scaling curves demand architectural responses.

## Key Quotes
> "Model performance scales log-linearly with inference-time compute, with no observed plateau"

> "Scaling inference-time compute requires no specific technical sophistication. Unlike other capability elicitation methods, actors of all skill levels can increase token budgets—making this a particularly accessible path to improved performance."

> "Models bypassed this sequence entirely: starting from the attacker's initial position, they directly probed the proprietary protocol running on the PLCs, deducing enough of its structure from network traffic alone"

> "A human expert would follow the designed path through web exploitation and binary reverse engineering; models appear naturally inclined toward protocol probing and traffic analysis."
