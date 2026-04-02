# Deep Dive: Anthropic — "Measuring AI Agent Autonomy in Practice"

**Source:** https://www.anthropic.com/research/measuring-agent-autonomy  
**Date:** February 18, 2026  
**Authors:** Miles McCain, Thomas Millar, Saffron Huang, Jake Eaton, Kunal Handa, Michael Stern, Alex Tamkin, Matt Kearney, Esin Durmus, Judy Shen, Jerry Hong, Brian Calvert, Jun Shern Chan, Francesco Mosconi, David Saunders, Tyler Neylon, Gabriel Nicholas, Sarah Pollack, Jack Clark, Deep Ganguli (Anthropic)  
**Type:** Empirical research blog post (with PDF appendix)

---

## Executive Summary

Anthropic analyzed **millions of human-agent interactions** across Claude Code and their public API using their privacy-preserving Clio tool. This is the first large-scale empirical study of how people actually deploy and interact with AI agents in production. The central finding: **there is a massive "deployment overhang" — agents are capable of far more autonomy than users currently grant them**, and oversight patterns evolve predictably as users gain experience.

**Scout Rating: ★★★★★ Critical — First empirical study at this scale on real-world agent autonomy patterns. Directly relevant to our multi-agent architecture design.**

---

## Key Findings

### 1. Autonomy Duration Is Increasing Rapidly
- **99.9th percentile turn duration nearly doubled** from <25 minutes to >45 minutes between Oct 2025 and Jan 2026
- Median turn ~45 seconds (stable over time — growth at new user base dominates)
- Increase is **smooth across model releases** → not purely capability-driven
- Suggests existing models can handle more autonomy than currently exercised
- Internal success rate on hardest tasks **doubled** Aug-Dec while human interventions/session dropped from 5.4 to 3.3

### 2. Experience Changes Oversight Strategy (Not Amount)
- New users: ~20% sessions use full auto-approve
- Experienced users (750+ sessions): >40% use auto-approve
- **Key paradox:** Experienced users auto-approve more **AND** interrupt more often
  - New users: 5% turn interrupt rate
  - Experienced users: ~9% turn interrupt rate
- This reflects a **strategy shift**: from pre-approval of each action → monitoring + intervention when needed
- "Effective oversight doesn't require approving every action but being in a position to intervene when it matters"

### 3. Agent Self-Regulation Is Real and Important
- On most complex tasks, **Claude stops to ask clarification 2x more often than humans interrupt it**
- Agent-initiated stops are a critical form of oversight
- Top reasons Claude stops itself:
  1. Present user with choice between approaches (35%)
  2. Gather diagnostic info/test results (21%)
  3. Clarify vague/incomplete requests (13%)
  4. Request missing credentials/access (12%)
  5. Get approval before action (11%)
- Top reasons humans interrupt:
  1. Provide missing technical context/corrections (32%)
  2. Claude was slow, hanging, or excessive (17%)
  3. They had enough help to proceed independently (7%)
  4. Want to take next step themselves (7%)
  5. Change requirements mid-task (5%)

### 4. Risk Landscape of Real-World Agents
- **80%** of tool calls have ≥1 safeguard
- **73%** appear to have human in the loop
- Only **0.8%** of actions are irreversible
- **~50% of all agentic activity is software engineering**
- Emerging usage in: healthcare, finance, cybersecurity, customer service
- High-risk clusters include: API key exfiltration (risk 6.0), lab chemical handling (risk 4.8), medical records (risk 4.4)
- High-autonomy clusters: red-team escalation (autonomy 8.3), system health monitoring (autonomy 8.0), crypto trading (autonomy 7.7)
- Most high-risk actions appear to be evaluations/red-teams rather than production use

### 5. The Deployment Overhang
- METR estimates Claude Opus 4.5 can complete tasks that would take humans ~5 hours
- Real-world 99.9th percentile turn duration is only ~42 minutes
- **Massive gap between capability and actual deployment**
- Autonomy is "co-constructed by the model, the user, and the product"

---

## Implications for Our System

### Agent Self-Regulation Design
The finding that Claude's self-initiated stops are **more frequent than human interruptions** validates a core design pattern: agents should have built-in uncertainty calibration. Our agents should:
- Track their own confidence and pause for clarification when uncertain
- Implement "graduated autonomy" — agents earn trust over time
- Build agent-initiated checkpoints into long-running tasks

### Oversight Architecture
The experience-based oversight shift (from approval → monitoring + intervention) suggests our system should:
- Support **different oversight modes** based on trust level
- Enable fast intervention without blocking normal operation
- Provide real-time visibility into agent behavior (relates to our observability research)
- Avoid requiring approval for every action — it creates fatigue without safety

### The "Deployment Overhang" Opportunity
Current agents are dramatically underutilized. The gap between capability and deployment suggests:
- Users need better trust-building mechanisms
- Agents need better self-monitoring to justify increased autonomy
- Product design matters as much as model capability for real-world autonomy

### Risk Concentration Pattern
Software engineering dominates (50%) but higher-risk domains are emerging. As our system expands into new domains:
- Domain-specific risk assessment is needed
- Reversibility should be a first-class property of agent actions
- The 0.8% irreversible action rate sets a benchmark to target

---

## Methodological Notes

- **Data Sources:** Claude Code (deep session visibility, single product) + Public API (broad, individual tool call level)
- **Privacy:** All analysis via Clio privacy-preserving tool
- **Limitation:** Can't link independent API requests into sessions — significant gap
- **Limitation:** Risk/autonomy scores are Claude-generated (validated against internal data)
- **Limitation:** Single model provider (Anthropic) — patterns may differ for other providers
- **Time Window:** Late 2025 through early 2026

---

## Cross-References

| Paper/Research | Connection |
|---|---|
| **Our Conversation Tax deep-dive (2603.11394)** | Multi-turn degradation could interact with the deployment overhang — as agents run longer, degradation risks increase |
| **Our Error Cascades deep-dive (2603.04474)** | The 2x clarification finding suggests agents can mitigate cascades through self-regulation |
| **Our Iterative Degradation Synthesis** | Agent self-regulation (stopping to ask) is a natural defense against iterative degradation |
| **Anthropic Persona Selection Model** | Identity design affects oversight behavior — how we design agent identity affects how much autonomy is appropriate |
| **Our Artificial Self deep-dive (2603.11353)** | Identity boundaries are first-order behavioral variables — aligns with Anthropic's finding that autonomy is co-constructed |
| **MAMA-MIA safe agentic design (2602.04431)** | The 80% safeguard rate validates need for systematic safety architecture |

---

## Key Quotes

> "The latitude granted to models in practice lags behind what they can handle."

> "Effective oversight doesn't require approving every action but being in a position to intervene when it matters."

> "Autonomy is not a fixed property of a model or system but an emergent characteristic of a deployment, shaped by the model's behavior, the user's oversight strategy, and the product's design."

> "On the most complex tasks, Claude Code stops to ask for clarification more than twice as often as humans interrupt it."

---

*Scout Deep-Dive — 2026-03-13*
