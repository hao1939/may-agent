<ai_context>
summary: "Canonical overview of the agent protocol landscape: MCP (agent→tool), A2A (agent→agent), AG-UI (agent→frontend). Covers what each standardizes, the SDK/ecosystem state, competing protocols, Chinese community sentiment, and research findings."
triggers: ["MCP", "Model Context Protocol", "A2A", "AG-UI", "agent protocol", "agent-to-agent protocol", "tool connectivity protocol", "MCP陨落"]
last_updated: "2026-07-14"
source_basis: "GitHub trending repos June 2026, XHS Chinese AI community May-June 2026, arXiv briefings June 2026, HN explorations June 2026. See ai_context sources section below."
</ai_context>

# Agent Protocols: MCP, A2A, and the Emerging Stack

Canonical reference for agent communication and tool-access protocols tracked
by Scout. This note exists because MCP is referenced in 6+ library notes but
was never described as a protocol.

See also: [agent-architectures.md](./agent-architectures.md) for architecture
patterns, [multi-agent-coordination.md](./multi-agent-coordination.md) for
coordination topology.

## Protocol Taxonomy

The agent ecosystem is converging on **three protocol layers**, each
standardizing a different interface edge:

| Protocol | Edge | What It Standardizes | Origin |
|----------|------|---------------------|--------|
| **MCP** (Model Context Protocol) | Agent → Tool | Tool discovery, invocation, and resource access | Anthropic, late 2024 |
| **A2A** (Agent-to-Agent) | Agent → Agent | Task delegation, lifecycle management, capability negotiation | Google, Apr 2025 |
| **AG-UI** (Agent-UI Protocol) | Agent → Frontend | Streaming agent state to user interfaces | CopilotKit, 2025 |

**Community metaphor** (HN, June 2026): "If MCP is the USB-C of AI agents,
A2A is their Ethernet."

**Chinese framing** (XHS): "Agent协议三剑客" (Three Musketeers) — MCP + A2A +
Skills as co-existing protocols. Chinese devs expect fragmentation, not
winner-takes-all.

### What MCP Actually Standardizes

MCP defines a JSON-RPC-based protocol for an LLM-hosting application (the
"client") to connect to external capability providers (MCP "servers"). Each
server exposes:

- **Tools** — callable functions with typed parameters
- **Resources** — read-only data the model can reference
- **Prompts** — reusable prompt templates

MCP does **not** cover: agent-to-agent delegation, workflow orchestration,
state management, or execution guarantees. These are the "missing layers"
identified by enterprise architecture discussions (see
[enterprise-agent-architecture-2026.md](./enterprise-agent-architecture-2026.md)).

### What A2A Standardizes

A2A provides task lifecycle management between agents: creating tasks,
streaming status updates, exchanging artifacts, and negotiating capabilities
via "Agent Cards." It complements MCP — MCP handles agent→tool, A2A handles
agent→agent.

### Protocol Gaps

Neither MCP nor A2A covers:
- **Physical instruments**: LAP (Lab Automation Protocol) extends A2A with
  reservations, safety fences, and measurement schemas for physically embodied
  operations. (arXiv, June 2026)
- **Communication metadata security**: A2A/MCP leave the communication graph
  in the clear — capability-labeled endpoints let an observer infer pending
  workflows. GT-MCP proposes game-theoretic transport selection. (arXiv,
  June 2026)
- **P2P transport layer**: Both A2A and MCP assume HTTP-based communication
  (agent cards at URLs, JSON-RPC over HTTP/SSE). An emerging alternative is
  P2P transport using cryptographic key identity instead of URLs. Iroh
  (iroh.computer, Rust, 848pts on HN June 2026) provides "Tailscale at the
  application layer" — agents identified by key, not address. ramoz (eqtylab)
  explicitly argues A2A should be built on P2P: "Every agent should be
  reachable to each other without hosting itself as an http server." Two
  prototypes exist: agentbeam (github.com/eqtylab/agentbeam) and real-a2a
  (github.com/eqtylab/real-a2a). P2P transport would enable: identity without
  registry, NAT traversal for home-hosted agents, and transport agnosticism
  (BLE, LoRa, relay). This connects to the sovereignty cascade — local
  model + local agent + P2P communication = fully decentralized agent system.
  (HN, June 2026 — see findings/2026-06-15-hn-scan-8.md)

## MCP Ecosystem (June 2026)

MCP has become a standalone product category on GitHub with 13+ repos above
4k stars:

| Stars | Repo | What It Does |
|-------|------|-------------|
| 16k | microsoft/mcp-for-beginners | MCP curriculum, cross-language examples |
| 12k | tadata-org/fastapi_mcp | Expose FastAPI endpoints as MCP tools |
| 12k | hangwin/mcp-chrome | Chrome extension MCP server |
| 9k | mark3labs/mcp-go | Go implementation of MCP |
| 8k | lastmile-ai/mcp-agent | Agents using MCP + simple workflows |
| 7k | modelcontextprotocol/registry | Community MCP server registry |
| 6k | getsentry/XcodeBuildMCP | MCP for iOS/macOS development |
| 6k | appcypher/awesome-mcp-servers | Curated list of MCP servers |
| 6k | executeautomation/mcp-playwright | Playwright automation via MCP |
| 5k | mobile-next/mobile-mcp | MCP for mobile automation |
| 5k | modelcontextprotocol/go-sdk | Official Go SDK |
| 4k | modelcontextprotocol/csharp-sdk | Official C# SDK |
| 4k | Pimzino/spec-workflow-mcp | Spec-driven development workflow |

**Language distribution**: TypeScript dominates MCP server implementations;
Go SDKs are official; Python used in framework integrations.

**Source**: GitHub trending repos, June 2026.

## Chinese Community Perspective: The MCP Sentiment Arc

### May 2026: Turbulence (Signal: High)

- **"MCP陨落" (MCP's Fall)** — 1,499 likes on XHS. Signals disillusionment
  with MCP's maturity and scope.
- **UTCP proposed as replacement** — 248 likes across posts. Did not gain
  lasting traction.
- **MCP/A2A/ACP protocol comparison** posts emerging.
- Community consensus: MCP is important but "not yet mature."

**Source**: XHS Chinese AI community, May 2026.

### June 2026: Cooling (Signal: Medium)

- MCP陨落 discourse not retracted but generating no new engagement.
- UTCP replacement proposals also lost steam.
- Community attention shifted from "which protocol?" to "does protocol choice
  matter if skills are the unit?"
- **Emerging pragmatic position**: MCP is fine for tool discovery; don't build
  deep abstractions on it.

**Source**: XHS Chinese AI community, June 2026.

### Design Implication

Keep protocol layers thin and swappable. The community has tacitly adopted
this position. Don't over-invest in MCP-specific abstractions.

## Research Findings

### HyperTool: Code-Block Optimization for MCP (arXiv, June 2026)

Step-wise atomic tool calls create an "execution-granularity mismatch" —
deterministic sub-workflows consume context. HyperTool lets the agent emit a
single code block that calls multiple tools and manipulates returns locally.
On MCP-Universe benchmark: accuracy jumps from 15.69% → 35.29% (Qwen3-32B).

**Implication**: Bundling deterministic tool chains into single MCP calls
dramatically reduces context consumption. Applicable to any framework using
step-wise tool invocation.

### AgentBeats: Evaluation via Protocols (arXiv, June 2026)

"Agentified Agent Assessment" — judge agents evaluate subject agents through
A2A (task management) + MCP (tool access), needing one interface instead of
two. Five-month competition with 298 judge agents and 467 subject agents.

**Implication**: A2A + MCP convergence as the standard evaluation interface.
"Agents evaluating agents" through standardized protocols may become the
dominant evaluation paradigm. See also
[agent-evaluation.md](./agent-evaluation.md).

### Communication Graph Metadata Leakage (arXiv, June 2026)

A2A/MCP leave the communication graph in the clear. Because endpoints are
capability-labeled, passive metadata analysis can recover a task's class well
above chance. Candidate mitigations: SimpleX/SMP, Tor, mixnets.

**Implication**: Security-sensitive deployments need transport-layer privacy
on top of protocol-layer standardization.

---

*This note consolidates MCP/A2A/AG-UI references scattered across 6+ library
notes into a single canonical protocol reference. Source-dated provenance
lives in `inbox/` archive files.*
