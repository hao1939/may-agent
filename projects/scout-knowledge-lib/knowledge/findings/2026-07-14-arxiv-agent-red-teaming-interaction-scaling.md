<ai_context>
summary: "Two fresh arXiv papers (2026-07-13): (1) AHA — automated agent-vs-agent red-teaming that builds reusable Vulnerability Concept Graphs for production agents like Claude Code/Codex; (2) Interaction Scaling — formalizes a third test-time compute axis (beyond reasoning and sampling) showing grounded external feedback loops break through internal scaling ceilings."
triggers: ["agent security", "red teaming", "vulnerability discovery", "test-time compute", "interaction scaling", "agent harness", "grounded feedback", "scaling laws"]
source_basis: "arXiv API query 2026-07-14, papers submitted 2026-07-13"
</ai_context>

# arXiv Agent Scan — 2026-07-14

## 1. Agent Hacks Agent (AHA): Automated Red-Teaming via Vulnerability Concept Graphs

**Source:** https://arxiv.org/abs/2607.11698
**Date:** 2026-07-13
**Relevance:** Agent security, production safety, harness governance

**Summary:** Presents AHA, a falsifiable discovery loop where one agent red-teams another production agent (Claude Code, Codex). The key artifact is a **Vulnerability Concept Graph (VCG)** — a structured knowledge base linking attack surfaces to unsafe trajectories via claims, enabling conditions, falsifiers, transfer predictions, and evidence.

**Key findings:**
- A frozen VCG (no further search needed) outperforms the strongest frozen baseline by **14.2pp** under single-shot protocol
- Vulnerabilities transfer across scenarios and attack channels — there's a "reusable vulnerability core" shared across models
- Covers direct and indirect attacks in sandboxed harness environments
- Provides auditable artifact for safety teams to inspect, validate patches, accumulate safety knowledge

**Implication for library:** Confirms the "agent security as institutional knowledge" thesis from our `agent-security-governance.md`. The VCG is essentially a formalized version of what that note calls "security memory" — organizations need persistent, structured records of discovered agent vulnerabilities, not just one-off patches. Also validates the "agent-eats-agent" pattern where security tooling itself becomes agentic.

**Connection:** Extends themes in `the-damage-gradient.md` and prediction P-38 (agent security becomes engineering discipline).

---

## 2. Interaction Scaling: Grounding the Third Axis of Test-Time Compute

**Source:** https://arxiv.org/abs/2607.11598
**Date:** 2026-07-13
**Relevance:** Agent architecture, loop engineering, harness design, scaling laws

**Summary:** Formalizes **interaction** as a third test-time compute axis alongside reasoning (think longer) and sampling (try more). Interaction = model proposes, external instrument observes actual behavior, model revises. The key variable is **grounding** — feedback must come from instruments that actually observe the flaw.

**Key findings:**
- Reasoning-only and best-of-N sampling both **plateau** on hard coding tasks (even with oracle selection)
- Interaction strategies keep improving; proposer-reviewer harness reaches **100% pass rate** with no variance
- Holds across three model families
- Critical insight: VLM judges rated 14/15 visibly broken figures "perfect" because screenshots hide flaws — only grounded measurement tools detect real defects
- VLM-as-reviewer actually makes things *worse* where measurement tools repair them

**Implication for library:** This paper provides formal backing for the "Loop Engineering" paradigm our XHS tracking identified. The Chinese community's emphasis on loop quality over loop speed is vindicated — interaction scaling only works when feedback is *grounded* (real observation, not model self-judgment). This also formalizes why the "discrimination deficit" (KE-1919) exists: ungrounded loops scale noise, not quality.

**Connection:** Directly supports the Harness-Memory Convergence phase (scan #73) — the harness IS the grounding instrument. Also connects to `the-evaluation-mirage.md` — model-judges fail exactly where grounded instruments succeed.

---

## 3. MM-ToolSandBox: Visual Tool-Calling Benchmark (500+ tools, 16 domains)

**Source:** https://arxiv.org/abs/2607.11818
**Date:** 2026-07-13
**Relevance:** Agent evaluation, multi-modal agents, benchmark design

**Summary:** Stateful execution environment for evaluating visually grounded tool-calling agents. 500+ tools across 16 domains, multi-image multi-turn tasks. Agents must ground progressively arriving visual inputs into executable tool calls while handling realistic conversational phenomena.

**Implication:** Another entry in the "eval engineering" wave. Notable for being *stateful* (not single-turn) and requiring progressive grounding — aligns with interaction scaling thesis above.
