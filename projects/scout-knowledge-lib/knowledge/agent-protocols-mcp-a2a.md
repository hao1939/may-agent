<ai_context>
summary: "Canonical overview of the agent protocol landscape: MCP (agent→tool), A2A (agent→agent), AG-UI (agent→frontend). Covers what each standardizes, the SDK/ecosystem state, competing protocols, Chinese community sentiment, and research findings."
triggers: ["MCP", "Model Context Protocol", "A2A", "AG-UI", "agent protocol", "agent-to-agent protocol", "tool connectivity protocol", "MCP陨落", "ID-JAG", "Zero-Touch OAuth", "protocol fatigue", "EMA enterprise managed auth", "auth isolation", "MCP moat"]
last_updated: "2026-06-20"
source_basis: "GitHub trending repos June 2026, XHS Chinese AI community May-June 2026, arXiv briefings June 2026, HN explorations June 2026 (incl. scan #33). See ai_context sources section below."
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

### Source-Aware Factuality Verification — ProvenanceGuard (arXiv, June 2026)

Standard factuality verification pools all evidence and checks support. MCP
agents have a distinct failure mode: **cross-source conflation** — a claim is
supported *somewhere* but attributed to the *wrong source*. Source attribution
is an independent verification axis invisible to pooled metrics.

Architecture: consumes captured MCP traces with stable tool IDs + source IDs →
decomposes answers into atomic claims → routes claims to source-specific
evidence → checks support via NLI + token-alignment proxy → compares stated
attribution with routed source → returns per-claim verdicts + answer-level
allow/block decision. Blocked answers repaired via retrieval-augmented revision.

Results (medical-domain MCP traces, 281 traces):
- Block F1: 0.802–0.846
- Source accuracy: 0.858 over 260 source-eligible claims
- 50 controlled conflation probes: **100% detection**, 0% retained wrong attribution

- **Key implication**: Validates that protocol-level observability (tool IDs,
  source IDs) enables verification impossible from output text alone. When
  synthesizing across sources (arXiv + HN + XHS), attributions can drift.
  Claim-level source tagging needed, not just file-level provenance. MCP trace
  consumption is the enabling infrastructure.
- **Connects to**: Transduction Chain (source attribution as format requirement),
  Evaluation Mirage (pooled metrics miss provenance failures),
  Knowledge Asymmetry (attribution drift degrades trust).
- **Source**: [2606.18037] ProvenanceGuard, arXiv June 2026. Categories: cs.AI, cs.CL, cs.MA.

---

### Emerging: Universal Memory Protocol (UMP) — The Third Interop Layer

GitHub repos signal a third protocol layer forming alongside MCP (tools) and
A2A (agent coordination): a **memory protocol** standardizing how agents share,
version, and expire persistent state.

- **edihasaj/universal-memory-protocol** (28★, Jun 2026) — proposes UMP as
  "the third interop layer beside MCP (tools) and A2A (coordination)."
- **memforks-dev/memforks** (101★) — "Git for AI agent memory" with branching
  and merging semantics for versioned agent state.
- **icarus-memory-infra** (289★) — provenance, rollback, supersession chains
  over any backend.

**Implication**: The agent interop stack may complete as MCP + A2A + Memory
Protocol. Cross-agent memory sharing is emerging as the bottleneck that
neither MCP nor A2A addresses. Whether UMP or a competing spec fills this
slot, the three-layer shape (tools / agents / state) is converging.

- **Source**: GitHub trending scan, July 22, 2026.

### MCP Auth Maturation: Zero-Touch OAuth + ID-JAG (HN, June 2026)

Multi-vendor collaboration (Okta, Microsoft, Figma, Linear) produced a
Zero-Touch OAuth specification for MCP. Powered by **ID-JAG** (Identity
Assertion Authorization Grant), an IETF draft token format that enables
enterprise-managed auth without per-connection user interaction.

Key practitioner insight (sean_lynch, 165pt story, Jun 20): "The real value
MCP offers over skills/CLI is isolating the auth flow outside of the agent's
context window." Auth isolation — not tool discovery — is MCP's defensible
moat.

ID-JAG is designed as a **cross-protocol agent auth primitive** (maxwellg,
Okta engineer): "isn't MCP specific at all." If adopted beyond MCP, it could
become the standard agent authentication token format.

**Implication**: MCP's enterprise readiness gap (auth) is closing. This moves
MCP from "developer tool protocol" to "enterprise integration protocol."
Auth maturation strengthens MCP's position vs. "just use an API" arguments.

- **Source**: [HN Scan #33](./findings/2026-06-20-hn-scan-33.md), Jun 2026.

**Update (Scan #49)**: Zero-Touch OAuth now **production-deployed** by
Anthropic, Okta, and Atlassian. EMA (Enterprise-Managed Auth) is a stable MCP
extension. Implementation reports from krooj (Atlassian) and dend (Anthropic)
confirm shipping, not proposal stage. MCP skeptic flashgordon converts: "I used
to be a naysayer. 'It's just APIs' I used to say. What folks don't realize is
the details matter." Story at 241pts/95c. Auth isolation is now MCP's
strongest enterprise value proposition — surpassing tool discovery.

- **Source**: [HN Scan #49](./findings/2026-06-19-hn-scan-49.md), Jun 2026.

**Update (Scan #50)**: Story grows to 255pts/99c. Key new positions:
- **sean_lynch** reframes debate: "Before you get into 'MCP is dead, Skills forever' — auth isolation outside context window is the real capability." This names auth isolation (not tool discovery) as MCP's true competitive advantage over Skills/CLI approaches.
- **ericchiang** recognizes cross-protocol applicability: "So you can run centralized infra to validate a user, device, scopes, and enforce policies for all apps? Can we get this in other OAuth 2.0 clients?"
- **dend** (Anthropic lead maintainer) confirms: "The standard itself is not MCP-specific. As long as client and server adopt ID-JAG, they're golden." This positions ID-JAG as a general agent auth primitive beyond MCP.
- **russell_h** (C1) reports same-day production adoption: "We launched support today for C1 to act as an EMA identity provider."
- **Web gap persists**: zackify hacked cookie-based auth but dend responds "Cookies were made for the browser. MCP often operates in environments where that is not a guarantee."
- **Scope expansion signal**: Multiple commenters want ID-JAG for CLI tools (gcloud, npm), non-MCP services — indicating the token format may outgrow MCP itself.

- **Source**: [HN Scan #50](./findings/2026-06-20-hn-scan-50.md), Jun 2026.

**Update (Scan #54)**: Story plateaus at 265pts/99c — no significant engagement
change over scans #51–#54. MCP OAuth has transitioned from "growing signal"
to "stable infrastructure" — the community has absorbed it as expected tooling
rather than debating its merits. This is the pattern of successful
standardization: controversy → adoption → invisibility.

- **Source**: [HN Scan #54](./findings/2026-06-20-hn-scan-54.md), Jun 2026.

**Update (Scan #57)**: Story holds at 266pts/100c — engagement stable, but the
comment thread reveals **implementation depth** not captured by point metrics.
New practitioner signals confirm MCP auth has crossed to "shipped default":
- **programmancer** reports real Entra ID implementation pain — the "pit of
  implementation" phase where specs become infrastructure.
- **sandeepkd** proposes IDP-as-proxy-gateway pattern — the spec is generating
  architectural variants, which only happens post-adoption.
- **zackify** (80-page MCP book author) still frustrated by web gap — confirms
  long-term community investment despite friction.
- The **Credential Isolation Convergence** emerges: MCP auth (protocol layer),
  Airgap (filesystem layer), and MITM proxies (network layer) all solve the
  same problem — keeping credentials out of the agent's context — from different
  architectural layers simultaneously. This convergence validates MCP auth as
  correct problem framing, even as it shows the problem exceeds any single
  protocol's scope.

**Status**: MCP Enterprise Auth is now **de facto infrastructure**. The debate
phase is over. Remaining work is implementation detail, not adoption.

- **Source**: [HN Scan #57](./findings/2026-06-20-hn-scan-57.md), Jun 2026.

### A2A Adoption Reality Check (HN, June 2026)

"Ask HN: Is anyone using the A2A protocol?" (75pts, 38c) revealed thin
adoption. A2A SDK has **10.9M downloads** vs MCP's **257M** (4.2% ratio,
reported by A2A package maintainer).

Community positions cluster around skepticism:
- "No distinction between Agent A → Agent B and Agent A → future Agent A.
  Agents have no inherent sense of identity." (simonreiff)
- "Nothing stops me from having a full agent behind my MCP server." (holografix)
- "Just build an API, give the other agent the spec in markdown." (asdev)
- "A bit like microservices for agents" (lazharichir) — only positive report.

**Implication**: A2A may follow the microservices adoption curve: enterprise-in,
startup-out, eventual backlash. The MCP-as-universal-envelope thesis (agents
behind MCP servers) is winning by default. Chinese community's "Agent协议
三剑客" framing (MCP + A2A + Skills) may need revision.

- **Source**: [HN Scan #33](./findings/2026-06-20-hn-scan-33.md), Jun 2026.

### Protocol Fatigue: Agentic Resource Discovery Rejected (HN, June 2026)

A new "Agentic Resource Discovery Specification" was immediately compared to
UDDI (the failed 2000s web services discovery standard) by HN commenters.
Responses: "This is search" (iandanforth), "Reminiscent of UDDI" (khaledh),
"Imposing structure on unstructured discovery ignores all progress in IR"
(nostrebored).

**Scan #55 update (Jun 20):** Google's positioning now transparent to the
community. gavinray: "Too many protocols got created (MCP, A2A, etc) and so
now you've got to create a new standard that can consume them all, and Google
being a search index would like to index them." _pdp_ proposes minimalist
alternative: "Why not ask the agent to read .well-known/agent.md and do a
bootstrap?" myaccountonhn delivers the meta-critique: "I thought the point of
AI was that you wouldn't need stuff like this."

**Implication**: Community tolerance for new agent protocols has reached its
limit. After MCP, A2A, AG-UI, ARDS, and UMP in 18 months, practitioners want
consolidation, not more specs. Validates the "thin protocol layer" design
principle: keep protocol dependencies minimal and swappable. Google's spec is
likely dead-on-arrival due to visible corporate positioning + XKCD-927
dynamics + minimalist alternatives.

- **Source**: [HN Scan #33](./findings/2026-06-20-hn-scan-33.md),
  [HN Scan #55](./findings/2026-06-20-hn-scan-55.md), Jun 2026.

---

*This note consolidates MCP/A2A/AG-UI references scattered across 6+ library
notes into a single canonical protocol reference. Source-dated provenance
lives in `inbox/` archive files.*
