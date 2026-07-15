<ai_context>
summary: "arXiv triage — three previously untriaged papers from July 7-13, 2026: norm enforcement for multi-agent systems (Steinhardt lab), provider-side tool memory (ToolAtlas), and large-scale MCP server security measurement (MCPZoo). API frontier remains July 13, 2026."
triggers: ["arXiv triage", "norm enforcement", "ToolAtlas", "tool memory", "MCP security", "MCPZoo", "provider-side memory", "escalating penalties"]
last_updated: "2026-07-14"
source_basis: "arXiv API queries: all:\"AI agent\" AND all:\"multi-agent\", all:\"agent\" AND all:\"safety\" AND all:\"LLM\", all:\"agentic workflow\" OR all:\"agent framework\" — deduplicated against all prior triages"
</ai_context>

# arXiv Triage — Gap Fill (2026-07-14)

*Scanned: 2026-07-14 | Source: arxiv.org API | API frontier: July 13, 2026 (unchanged) | Three previously untriaged papers identified.*

---

## ★★★★ High Relevance

### [2607.09766] Norm Enforcement for AI Agents: Robustly Shaping Behavior in Multi-Agent Systems
- **Authors**: Yaowen Ye, Jacob Steinhardt (UC Berkeley)
- **Source**: https://arxiv.org/abs/2607.09766
- **Categories**: cs.AI, cs.CL, cs.LG, cs.MA
- **Published**: 2026-07-07
- **Venue**: ICML 2026 Trustworthy AI for Good Workshop
- **Summary**: Studies norm enforcement mechanisms for LLM agents in shared competitive environments. Finds that simple enforcement mechanisms are *exploited* by misaligned agents for competitive advantage — even without explicit training to do so. Identifies two design principles for robust enforcement: (1) estimating each agent's reliability over time, and (2) escalating penalties for repeated misbehavior. Mechanisms built on these principles resist exploitation across three environments and varied agent populations.
- **Key finding**: "Simple enforcement mechanisms are exploited by misaligned agents for competitive advantage, even when they are not explicitly trained or prompted to do so." Enforcement must anticipate becoming part of the system it governs — naive norms create exploitable structure.
- **Implication for us**: Directly extends the guardrail/governance theme. Our guard system is a norm enforcement mechanism. The key insight — that enforcement itself becomes exploitable game structure — connects to guardrail inversion (2606.14517). The escalating-penalty + reliability-estimation pattern is a concrete implementation of the Compilation Gradient's "adaptive enforcement" layer. Steinhardt lab credibility adds weight. Links to: governance-compilation-gradient.md, agent-security-governance.md.

### [2607.11126] ToolAtlas: Learning Once, Reusing Everywhere with Tool-Side Memory
- **Authors**: Yue Fang, Zhibang Yang, Fangkai Yang, Xiaoting Qin, Liqun Li, Qingwei Lin, Saravan Rajmohan, Dongmei Zhang (Microsoft Research)
- **Source**: https://arxiv.org/abs/2607.11126
- **Categories**: cs.LG
- **Published**: 2026-07-13
- **Summary**: Argues tool knowledge should live provider-side, not agent-side. Builds graph-based persistent memory of tool capabilities, failure boundaries, and cross-tool compositions through execution-verified probing. Agents query tool memory via adaptive graph traversal at inference time. On MCP-based benchmarks: +21.61% pass@1 over baselines. Same tool memory transfers across environments and agent frameworks without retraining.
- **Key finding**: Provider-side tool memory as reusable paradigm. Tool knowledge maintained once by the provider, queried by any agent — inverting the current pattern where each agent independently learns tool quirks. Transfer across frameworks is the key differentiator.
- **Implication for us**: Important architectural pattern. Our MCP tools could maintain their own capability graphs — recording what works, what fails, and how tools compose — rather than relying on agents to rediscover this. The "execution-verified probing" approach (test tool combos, store results) is a form of compiled operational knowledge at the infrastructure layer. Connects to: agent-protocols-mcp-a2a.md, the-compilation-gradient theme.

---

## ★★★ Moderate Relevance

### [2607.11086] Rethinking MCP Security: A Large-Scale Study of Runtime MCP Servers and Security Scanner Reliability
- **Authors**: (multiple, not extracted)
- **Source**: https://arxiv.org/abs/2607.11086
- **Categories**: cs.CR (likely)
- **Published**: 2026-07-13
- **Summary**: Presents MCPZoo — 64,611 unique MCP servers (37,288 supporting dynamic analysis) built via multi-agent framework that transforms static repos into running services. First ecosystem-scale security measurement finds existing scanners report 96.89% of servers as risky, but <50% of alerts are true positives on manual validation. Scanner outputs are mutually inconsistent.
- **Key finding**: MCP security scanning is currently unreliable — high false-positive rates and cross-scanner inconsistency mean risk assessments cannot be trusted. The scale (64K servers) makes this the definitive MCP ecosystem measurement.
- **Implication for us**: Relevant to our MCP tool adoption posture. If security scanners are unreliable, the practical implication is that MCP server trust must come from operational verification (runtime behavior observation) rather than static scanning — another validation of the "trust through observation" pattern over "trust through certification." Connects to: agent-protocols-mcp-a2a.md.

---

## Frontier Status

The arXiv API continues to return papers only through **July 13, 2026**. No new papers beyond this date are available. Library is at API frontier.
