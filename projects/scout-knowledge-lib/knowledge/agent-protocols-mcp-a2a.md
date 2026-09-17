<ai_context>
summary: "Canonical overview of the agent protocol landscape: MCP (agent→tool), A2A (agent→agent), AG-UI (agent→frontend), AHP (host→multi-client session state), and practical ACP implementation evidence. Covers what each standardizes, the SDK/ecosystem state, competing protocols, Chinese community sentiment, research findings, and how protocol roadmaps and implementations are splitting transport/tool shells from identity, discovery, and runtime control layers. A pinned Ripwire implementation adds a concrete progressive-discovery rule: omit capabilities that provably cannot succeed in the bound workspace, disclose the omission, and retain execution-time refusal rather than confusing catalog visibility with authority."
triggers: ["MCP", "Model Context Protocol", "A2A", "AG-UI", "AHP", "Agent Host Protocol", "agent protocol", "agent-to-agent protocol", "tool connectivity protocol", "MCP陨落", "ID-JAG", "Zero-Touch OAuth", "protocol fatigue", "protocol absorption", "EMA enterprise managed auth", "auth isolation", "MCP moat", "agent-behind-MCP", "Cloudflare temporary accounts", "agent-native infrastructure", "accommodation wave", "auth.md", "ephemeral deploy", "stateless MCP", "requestState", "mcp-use v2", "ACP backend rail", "entwurf", "garden id", "progressive discovery", "capability-conditioned discovery", "Ripwire", "workload identity federation", "DPoP", "MCP roadmap"]
last_updated: "2026-09-11"
source_basis: "GitHub trending repos June 2026, XHS Chinese AI community May-June 2026, arXiv briefings June 2026, HN explorations June-Aug 2026 (incl. scan #33 and HN items 49131438, 49198472, 49399591, and 49453910), arXiv 2606.30317 (MCP Architecture Patterns), scan #262, Simon Willison's stateless MCP write-up (2026-07-31), Manufact's mcp-use v2 stateless-MCP rebuild write-up (2026-07-29), the current GitHub repo junghan0611/entwurf checked 2026-08-06 for ACP/backend-rail implementation evidence, the official MCP roadmap published 2026-08-22, VS Code's first-party Agent Host launch post (2026-08-26), and redhat-et/ripwire inspected at commit 5c4235b9befd4cd5b6f9f3a489940d7b79f86520 for capability-conditioned MCP catalog evidence (2026-09-11). See source declarations below."
</ai_context>

# Agent Protocols: MCP, A2A, and the Emerging Stack

Canonical reference for agent communication and tool-access protocols tracked
by Scout. This note exists because MCP is referenced in 6+ library notes but
was never described as a protocol.

See also: [agent-architectures.md](./agent-architectures.md) for architecture
patterns, [multi-agent-coordination.md](./multi-agent-coordination.md) for
coordination topology.

## Quick Map

- [Protocol Taxonomy](#protocol-taxonomy)
- [MCP Ecosystem (June 2026)](#mcp-ecosystem-june-2026)
- [Chinese Community Perspective: The MCP Sentiment Arc](#chinese-community-perspective-the-mcp-sentiment-arc)
- [Research Findings](#research-findings)
- [MCP Protocol-Level Privacy Risks (Scan #259)](#mcp-protocol-level-privacy-risks-scan-259-jul-2026)
- [MCP Architecture Patterns & Tool-Count Ceiling (Scan #262)](#mcp-architecture-patterns--tool-count-ceiling-scan-262-jul-2026)
- [Governance Expressivity Gap — The Missing Layer (Scan #291)](#governance-expressivity-gap--the-missing-layer-scan-291-jul-2026)
- [MCP 2026-07-28 Spec Release: Transport Goes Stateless](#8-mcp-2026-07-28-spec-release-transport-goes-stateless)
- [HN Implementation Follow-Through: Stateless MCP Pushes State Up the Stack](#8a1-hn-implementation-follow-through-2026-08-06-stateless-mcp-pushes-state-up-the-stack)
- [GitHub Implementation Follow-Through: ACP Becomes a Backend Shell While Runtime Identity Lives Elsewhere](#8a2-github-implementation-follow-through-2026-08-06-acp-becomes-a-backend-shell-while-runtime-identity-lives-elsewhere)
- [MCP Roadmap: Progressive Discovery Becomes an Authorization Boundary](#8a3-hn-roadmap-signal-2026-08-22-progressive-discovery-becomes-an-authorization-boundary)
- [Ripwire: Capability-Conditioned Discovery Must Disclose Its Proof Boundary](#8a4-github-implementation-signal-2026-09-11-capability-conditioned-discovery-must-disclose-its-proof-boundary)
- [MCP Protocol Debt — Quantitative Evidence](#8b-mcp-protocol-debt--quantitative-evidence-2026-07-12)

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
- **Community governance (formal proof)**: Governance Gaps (arXiv 2606.31498,
  Jun 2026) provides a systematic 6-dimension gap analysis (membership,
  deliberation, voting, dissent preservation, human escalation, audit/replay)
  across MCP, A2A, ACP, ANP, and ERC-8004. Voting and dissent preservation are
  *universally absent*. Deliberation is absent or partial. Conclusion: "agent
  community governance constitutes a missing architectural layer above current
  interoperability standards, not a missing feature within them." Distinguishes
  extensible gaps (addressable via protocol extension) from structural gaps
  (requiring new architectural layer). See findings/2026-07-01-arxiv-scan-302.md.
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

### MCP Server Taint-Style Vulnerabilities — SPELLSMITH (arXiv, July 2026)

First systematic analysis of MCP server vulnerabilities. Key findings:
taint-style vulnerabilities constitute a substantial fraction of MCP server
security issues, require significant code modifications to remediate, and
face slow community response times.

SPELLSMITH proposes a novel text-based mitigation: analyze high-risk
capabilities exposed by an MCP server, combine with tool descriptions and
parameter semantics to identify potential taint-style risks, then embed
behavioral guidance in the protocol's Description property. A self-reflection
module iteratively evaluates and refines outputs. This operates at the
*protocol level* — modifying tool descriptions rather than patching server
code — providing a unified mitigation strategy that generalizes across
multiple vulnerability types.

- **Key implication**: The MCP threat model extends beyond *malicious* servers
  (prior focus) to *vulnerable* legitimate servers with exploitable flaws.
  The Description-based mitigation represents a new defense layer operating
  at the protocol level, orthogonal to code-level fixes.
- **Connects to**: Communication Graph Metadata Leakage (another attack
  surface), MCP Auth (defense layer), Diagnostic Deficit (#476, server
  observability gaps).
- **Source**: [2607.07461] SPELLSMITH, arXiv July 2026. Categories: cs.CR, cs.SE.

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

**Update (Scan #53, 2026-08-29)**: Resurfaces at 274pts/102c with new
discourse. Anthropic engineer **dend** does AMA confirming expansion to more
identity providers. Key new signal: **sean_lynch** reframes MCP's value as
"isolating the auth flow outside of the agent's context window" — security
boundary separation, not tool discovery. **programmancer** provides reality
check: implementing with Microsoft Entra ID is "genuinely painful," indicating
spec maturity ≠ implementation ease. Protocol fatigue minority grows (**brap**:
"I thought we're over this collective delusion called MCP").

- **Source**: [HN Scan #53](./findings/2026-06-20-hn-scan-53.md), Jun 2026.

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

### A2A Adoption Reality Check (HN, June–September 2026)

"Ask HN: Is anyone using the A2A protocol?" (96pts, 45c) revealed thin but
growing enterprise adoption. A2A SDK has **10.9M downloads** vs MCP's **257M**
(4.2% ratio, reported by A2A package maintainer).

Community positions cluster around skepticism:
- "No distinction between Agent A → Agent B and Agent A → future Agent A.
  Agents have no inherent sense of identity." (simonreiff)
- "Nothing stops me from having a full agent behind my MCP server." (holografix)
- "Just build an API, give the other agent the spec in markdown." (asdev)

**Enterprise confirmation (Scan #157, Sep 28):** Three new practitioner reports:
- lazharichir: "I am using A2A at work. It's a bit like the 'microservices
  architecture' for agents. Allows teams to develop agents independently."
- reactordev: "My agent speaks A2A with itself and others. Built in layers
  like an organization."
- techwizrd: "I'm using it at work as well. It's quite challenging to manage."
- baroiall: "Enterprises are [using it], it's the future for them."

The skeptic critique also sharpened:
- nyellin: "Designed on paper by someone with no understanding of prompt caching
  and no consideration of latency or token costs."
- bckr: "We set up AgentCards + SSE streaming — then realized we didn't need an
  agent on the other side. So, no."
- calny: npm creator Laurie Voss presented on agent interaction protocols and
  was "skeptical whether they (including A2A) added much value."

**Pattern confirmed**: A2A follows the microservices adoption curve exactly:
enterprise-in (organizational boundaries justify overhead), startup-out
(overhead exceeds value at small scale). The "just use an API/MCP server"
position wins for simple cases. A2A's value emerges only when lifecycle
management across organizational trust boundaries is needed.

- **Source**: [HN Scan #33](./findings/2026-06-20-hn-scan-33.md), Jun 2026; [HN Scan #157](./findings/2026-06-25-hn-scan-157.md), Jun 2026. HN item 48582679.

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

### ATProto Identity Portability as Agent Protocol Analog (HN, June 2026)

Dan Abramov's "There are no instances in ATProto" (471pts, 245c) triggered
community discourse on identity-portable vs instance-bound protocol design.
ATProto separates identity (DID) from hosting (PDS) from execution (AppView)
— each is independently swappable.

**Agent-relevant parallels:**
- PDS (Personal Data Server) = Agent State Store — memory is portable between hosts
- AppView = Capability Executor — separated from identity/data ownership
- Relay = Message Bus — distribution infrastructure independent of both

**Connection to MCP Auth**: sean_lynch's scan #53 insight ("auth isolation
outside the context window is MCP's real moat") and ATProto's identity-data
separation both solve the same structural problem: decoupling identity/auth
from the compute that processes the data.

**Community critique** (timbray): ATProto's portability is aspirational while
existentially dependent on Bluesky PBC funding. RobotToaster: "In practice,
there's only one PLC directory." jrm4 counter-argues that persistent portable
identity is *worse* for privacy than instance-bound identity.

**Implication for agent architecture**: The "portable agent identity" pattern
(agent DID separate from hosting platform) is structurally sound but faces
the same bootstrapping problem as ATProto — someone must run the directory.
For multi-agent systems, this means a DID-like layer is necessary for
cross-platform agent coordination, but practical deployment will likely
centralize around 1-2 directories initially.

- **Source**: [HN Scan #54](./findings/2026-06-20-hn-scan-54.md), Jun 2026.

### Agent-Native Infrastructure Accommodation (HN/Cloudflare, June 2026)

**The Accommodation Wave** — infrastructure providers are inverting traditional
auth/signup flows to serve agents as first-class consumers.

**Cloudflare Temporary Accounts** (blog.cloudflare.com/temporary-accounts/,
2026-06-19): First major cloud platform to formally eliminate auth walls for
agent consumers.

Mechanism:
1. Agent runs `wrangler deploy` → hits auth wall
2. Wrangler detects non-browser context, tells agent about `--temporary` flag
3. Agent re-runs with `--temporary` → ephemeral account provisioned automatically
4. Deployment lives 60 minutes; human can claim ownership or it auto-expires
5. Agent can iterate (deploy, curl, redeploy) unlimited times within window

**Three design principles:**
- **Detection-Not-Declaration**: System observes agent context without requiring
  self-identification. Works for unknown agents.
- **Ephemeral-by-Default, Persistent-by-Claim**: Resources start temporary,
  become permanent through explicit human action. Inverts "create account → use"
  to "use → optionally take ownership."
- **Tight Iterate Loops**: 60-minute window enables agent trial-and-error without
  human intervention between iterations.

**Related initiatives:**
- **Stripe partnership** — agents provision subscriptions/payments on behalf of users
- **auth.md** (WorkOS + Cloudflare) — protocol letting agents provision accounts
  via well-known OAuth standards without browser flows
- **Flue framework** (Cloudflare, Jun 17) — third-party agent frameworks targeting
  Agents SDK as deployment runtime

**Connection to protocol stack**: Cloudflare's accommodation + MCP Zero-Touch
OAuth + ATProto identity portability form a convergent infrastructure layer
where identity, deployment, and resource management are all designed for
non-human consumers. The Accommodation Wave complements The Substrate Inversion:
once the architecture (not the model) is the locus of capability, infrastructure
must accommodate the *architecture* (agents) as the primary consumer.

- **Source**: [HN Scan #56](./findings/2026-06-20-hn-scan-56.md), Jun 2026.

### Protocol Taxonomy Research — Federated Stack Thesis (arXiv, Jun 2026)

arXiv 2606.19135 provides the first systematic taxonomy of LLM agent
communication protocols, classifying nine actively maintained protocols across
five dimensions: counterparty, payload, interaction state, discovery mechanism,
and schema flexibility.

**Key findings:**
- All sampled agent-to-agent protocols combine hybrid payloads with session-state
  persistence — this is converging as the baseline.
- Most protocols support multiple predefined schemas; two negotiate schemas at
  runtime, indicating a trend toward schema flexibility.
- **Decentralized discovery remains rare** — validating the practical centralization
  critique from ATProto discourse (scan #54).
- Short-term convergence pressure toward protocols unifying agent-to-agent and
  agent-to-context (tool+data) communication.
- Long-term: **"No single protocol is likely to maximize versatility, efficiency,
  and portability simultaneously."** The field will evolve toward a federated,
  layered protocol stack.

**Implication**: Confirms protocol fatigue is structural, not just community
sentiment. Validates the thin-protocol design principle. Connects to The
Decoupling Cascade (knowledge/the-decoupling-cascade.md) — protocol
decomposition is one of six simultaneous decoupling axes in agent architecture.

- **Source**: [arXiv 2606.19135](https://arxiv.org/abs/2606.19135), Jun 2026.

### Web4 Agent Economy — Payment Layer Empirics (arXiv, Jun 2026)

arXiv 2606.25876 provides the first large-scale empirical study of the Web4
autonomous agent economy — agents as independent economic actors with crypto
wallets, on-chain trading, and API payments.

**Key findings:**
- Analyzed: 99,448 multi-chain identity registrations, 317M+ transaction logs,
  341 MCP project source code, 349 GitHub issues
- Agents process **millions of daily transactions** — machine-to-machine economy
  already exists at scale
- Three-protocol infrastructure triangle: MCP (agent→tool), x402 (agent→agent
  payments), EIP-8004 (verifiable identity)
- **Payment interoperability is the most persistent unresolved bottleneck**
- Identity/authorization and cross-environment operation are critical gaps
- Community responses visible but unevenly distributed across repositories

**Implication**: Extends the ERC-8004 empirical study (2606.26028, scan #156)
with production-scale data. The 73-90% Sybil reviewer problem is even more
concerning at millions of daily transactions. x402 fills the payment gap that
MCP/A2A/AG-UI taxonomy leaves open — the protocol stack needs a fourth layer
for economic exchange. This is the "missing payment primitive" that Stripe
partnership and Cloudflare OAuth were approaching from the enterprise side.

- **Source**: [arXiv 2606.25876](https://arxiv.org/abs/2606.25876), [HN Scan #161](./findings/2026-06-25-hn-scan-161.md)

### Governance Structures for Agent Protocols — Empirical Comparison (arXiv, Jun 2026)

arXiv 2606.26203 introduces the first LLM-powered comparative pipeline for
analyzing governance discourse across agent protocol standards, comparing
ERC-8004 (permissionless, on-chain DAO) with Google A2A (corporate-led).

**Key findings** (4,323 governance participation records analyzed):
- **Comparable participation inequality** — neither regime is "more democratic"
  at the contributor level; similar power concentration in both
- **Comparable community fragmentation** — similar clique structures emerge
  regardless of governance form
- **Denser discourse alignment in permissionless setting** — open governance
  fosters greater *thematic convergence* despite decentralized participation
- Institutional design influences **substantive focus** (what topics dominate)
  more than participation patterns (who contributes)

**Implication for MCP/A2A debate**: Community skepticism toward A2A (scan #166)
may partly reflect corporate governance focusing on different priorities than
practitioners need. The "thematic convergence" advantage of open governance
suggests community-governed standards converge on practitioner-relevant topics
faster. However, the participation inequality finding means no governance form
solves the "who decides" problem — structural power concentration persists
regardless.

**Implication for protocol design**: Protocol governance *form* (corporate vs
permissionless) is a substantive choice about what gets prioritized, not a
participation-equity choice. Both concentrate power similarly; the question is
whether that power focuses on enterprise needs (A2A) or practitioner needs
(open/MCP ecosystem). The "federated, layered protocol stack" prediction above
may naturally result from different governance structures focusing different
protocol layers on different audiences.

- **Source**: [arXiv 2606.26203](https://arxiv.org/abs/2606.26203), [findings/2026-06-26-hn-scan-179.md](./findings/2026-06-26-hn-scan-179.md)

### MCP in Physical-World Safety-Critical Domains (Scan #183)

**Source**: [arXiv 2606.27231](https://arxiv.org/abs/2606.27231)

First documented MCP deployment controlling physical hardware (trapped-ion
quantum physics experiments). Agent writes native ARTIQ control code and
interacts with hardware through MCP tool calls. Key architectural innovations:

- **Per-operation cryptographic authorization**: No tool call reaches hardware
  without a token bound to its exact contents
- **Simulation-first gate**: Agent code runs in isolated dax.sim before
  touching real equipment
- **Dual authorization modes**: Automatic (simulation-verified) or manual
  (human operator) depending on action sensitivity
- **Interface portability**: Same MCP interface confirmed on two independent
  ion-trap platforms (Ca⁺/CaOH⁺ and Yb⁺)

This extends MCP from software/API tooling into physical-world control,
validating the protocol's generality. The authorization-token mechanism
demonstrates MCP can enforce safety constraints that matter (hardware damage)
beyond data/access control. Represents the convergence of MCP with the
Institutional Attestation pattern (#176): "govern actions, not agents."

### Agent-Native Infrastructure Identity (Scan #197)

**Source**: [Cloudflare blog](https://blog.cloudflare.com/temporary-accounts/), HN 48608394 (249pts)

Cloudflare launches **temporary accounts for AI agents** — first major
infrastructure provider creating agent-native identity primitives at scale.
Agents can programmatically provision Workers, D1, R2, Durable Objects
without permanent human identity.

Key architectural properties:
- **Ephemeral by default**: accounts are disposable, reducing blast radius
- **Rate-limited provisioning**: prevents abuse of agent-driven infra creation
- **No human identity requirement**: agents operate as first-class actors
- **Full platform access**: not a sandboxed subset but real CF infrastructure

**Structural significance**: While ERC-8004 (§above) proposes decentralized
identity and MCP provides tool-level interop, Cloudflare solves the pragmatic
deployment identity problem. This confirms the infrastructure layer is
legitimating agents independently of model-layer political gatekeeping.

Community tension: "Let's give bots their own accounts so they can scrape
harder — also Cloudflare: endless Turnstile loops for humans." The
legitimation creates a paradox where the same company that gates human access
explicitly enables agent access.

### MCP Domain Expansion: 3D World Generation and Game Engines (Scan #201)

**Source**: https://github.com/per-simmons/unreal-agent-harness (131★, Jun 2026)

AI agents building procedurally generated cities in Unreal Engine 5.8,
controlled entirely through MCP. Uses City Sample base + PCG (Procedural
Content Generation). Extends the physical-domain trajectory from scan #183
(trapped-ion quantum) into creative/spatial domains.

MCP domain coverage now spans:
- **Software tools**: File systems, APIs, databases (original scope)
- **Physical experiments**: Trapped-ion quantum hardware (#183)
- **3D world generation**: Game engines, procedural content (#201)
- **Financial operations**: DeFi markets via theeleven (517★, #201)
- **Browser automation**: patchright-browser, peerd (earlier scans)
- **Desktop context**: continuum (21★, full desktop as MCP)

Each new domain that adopts MCP raises switching costs and creates de facto
standardization. The protocol is hardening through proliferation, not
specification committees.

### Microsoft AHP — Fourth Protocol Layer (Scan #204; Launch Follow-Through 2026-08-26)

**Source**: https://github.com/microsoft/agent-host-protocol (65★, Jun 2026)

Microsoft's VS Code team announced **AHP (Agent Host Protocol)** — a
"synchronized, multi-client state protocol for AI agent sessions." Immutable
state, pure reducers, write-ahead reconciliation. SDKs in Swift, Rust,
Kotlin, TypeScript, Go.

AHP occupies a previously unnamed protocol position:
- **L0 MCP**: Agent → Tool
- **L1 A2A**: Agent → Agent
- **L2 AG-UI**: Agent → Frontend
- **L3 AHP**: Host → Client (session state synchronization)

roblourens (VS Code team) announced AHP in the A2A thread, implicitly
positioning it as what VS Code needs instead of A2A.

**Launch follow-through:** An HN submission on August 26 surfaced VS Code's
first-party launch report. It falsifies this note's earlier prediction that AHP
would remain an internal implementation detail: VS Code now ships the Agent
Host in Stable and Insiders, documents `code agent host` as a standalone
server, and publishes client libraries in five languages.

The more useful signal is the protocol boundary, not merely persistence. A
dedicated host owns authoritative, harness-neutral state while Copilot and
Claude retain their own SDKs, loops, tools, permissions, subagents, commands,
and hooks behind adapters. Sessions, chats, terminals, and changesets are
URI-addressable channels. A subscriber receives a current snapshot followed by
ordered actions; reconnecting clients replay missed actions, and shared reducers
let an editor, agent-management window, and browser converge without
understanding the harness backend. A client can observe, act, approve, cancel,
or contribute tools to the same live session.

**Architectural implication:** session portability needs an authority plane,
not transcript copying. The host must own sequence, replay, capability
negotiation, and a generic state model; otherwise each surface becomes a
competing session authority. AHP also preserves an important distinction from
AG-UI: it coordinates multiple independent clients around one long-running
session rather than only streaming one agent's events to one frontend.

**Limits hidden by the word “persistent”:** closing a folder does not end a
local turn, but VS Code must remain running because it manages the local host;
a remotely deployed standalone host has a different lifetime. Client-contributed
tools also mean state continuity does not guarantee capability continuity when
a contributing client disconnects. Finally, the launch post is first-party
architecture evidence, not an interoperability, reliability, or security
benchmark, and the specification remains under active development.

- **Source**: [GitHub](https://github.com/microsoft/agent-host-protocol), HN item 48582679 (roblourens comment).
- **HN follow-through**: https://news.ycombinator.com/item?id=49453910
- **First-party launch report**: https://code.visualstudio.com/blogs/2026/08/26/agent-host-architecture

### The Absorption Principle (Scan #204, Jun 2026)

**Key finding**: Protocols succeed by absorption, not cooperation in a layered
stack.

MCP is not winning because it's the best tool-access protocol. It's winning
because practitioners discovered they can hide entire agents behind MCP
servers, making A2A unnecessary for most cases. Evidence:

1. **A2A practitioners retreated to MCP**: bckr ("didn't need an agent on the
   other side"), thallavajhula ("moved from MCP to A2A to Agent↔MCP back
   again"), time0ut ("stayed with agent-behind-MCP style patterns").
2. **MCP absorbed memory**: Statey, BetterDB, agent-memory-engine all expose
   memory through MCP tools, not a separate memory protocol.
3. **MCP absorbed evaluation**: Topos exposes code quality metrics through MCP.
4. **MCP absorbed security**: Diplomat-agent, CapFrame — security tooling
   assumes MCP is THE interface.

**Why absorption works**: Integration cost scales super-linearly with protocol
count (Composition Tax, scan #184). Each new protocol requires new auth, new
context, new caching, new debugging. Practitioners minimize total cost by
stretching one protocol beyond its design scope.

**Absorption boundary** — what MCP structurally cannot absorb:
- Real-time state synchronization (AHP's niche)
- Payment settlement (x402's niche)
- Identity portability (DID/ATProto's niche)

These three edges predict where new, durable protocol layers may emerge — but
only when use cases are popular enough to justify integration cost.

- **Source**: [HN Scan #204](./findings/2026-06-28-hn-scan-204.md), Jun 2026. HN items: 48582679, 48691461, 48687650, 48672444, 48678841.

## MCP Protocol-Level Privacy Risks (Scan #259, Jul 2026)

**MCPPrivacyDetector** (2606.21338): First large-scale protocol-aware static analysis of MCP servers. 10,655 servers audited.

**Key findings**:
- **>10% of MCP servers leak credentials** via protocol-structural pathways
- Leakage is **protocol-induced**: credentials (Bearer tokens, API keys, plaintext auth) cross the local/LLM boundary by being returned, logged, or raised inside `@mcp.tool` handlers — with NO explicit outbound request in source code
- Conventional exfiltration scanners structurally cannot detect this class of leakage
- **Technical approach**: Unified cross-language program representation + context-aware semantic filtering + taint analysis for protocol-specific implicit sinks

**Structural meaning for MCP absorption**: MCP's very success at absorbing all other protocols makes this finding more severe. If MCP is the ONE protocol, then MCP's leakage surface IS the entire agent security surface. The absorption that simplifies integration cost also concentrates credential exposure risk.

- **Connection**: Extends ToxicSkills (scan #166, 36% critical ClawHub issues), Implementation Blind Spot (scan #203), ShareLock threshold poisoning (scan #170)
- **Source**: https://arxiv.org/abs/2606.21338

## MCP Architecture Patterns & Tool-Count Ceiling (Scan #262, Jul 2026)

**MCP Server Architecture Patterns for LLM-Integrated Applications** (2606.30317): First industry experience paper cataloguing recurring MCP server architectural patterns from 15 independently developed servers (5 production ANSYR voice AI platform + 10 public MCP registry).

**Five canonical patterns** (described in Gamma et al. form):
1. **Resource Gateway** — Pure data exposure to LLMs
2. **Tool Orchestrator** — Multi-step tool coordination
3. **Stateful Session Server** — Cross-request state persistence
4. **Proxy Aggregator** — Fan-out to multiple backends
5. **Domain-Specific Adapter** — Domain translation layer

Also documents **four anti-patterns** and cross-cutting concerns (authentication, versioning, observability).

**Critical quantitative finding — tool-count ceiling**:
- Tool-selection accuracy drops below 90% at **10–15 tools** for Claude Haiku 4.5
- Tool-selection accuracy drops below 90% at **20–30 tools** for Claude Sonnet 4
- Inter-rater reliability: Cohen's κ = 0.76 (good, not excellent); three pattern-boundary ambiguities identified

**Structural implication**: The MCP ecosystem is in accumulation mode (hundreds of servers) but the model's tool governance capacity has a hard ceiling. No matter how many MCP servers exist, a model can only reliably select from 10–30 tools in any given context. This forces architectural governance decisions: partitioning, pre-selection, hierarchical routing. The tool-count ceiling is the Governance Gap (#262) applied to tool ecosystems.

- **Connection**: Extends privacy risks (#259) and auth maturation findings; complements Always-On Agents survey (2606.30306) on state governance deficit
- **Authority Manufacture connection (#280)**: Protocol patterns create false composability confidence — naming a pattern suggests unlimited applicability, but the tool-count cliff means confidence exceeds actual capacity at production scale. This is the Authority Manufacture Problem applied to infrastructure: protocol maturity ≠ compositional reliability.
- **Source**: https://arxiv.org/abs/2606.30317

## Governance Expressivity Gap — The Missing Layer (Scan #291, Jul 2026)

arXiv 2606.31498 performs the first systematic gap analysis of all 5 major
agent interoperability protocols (MCP, A2A, ACP, ANP, ERC-8004) against a
6-dimension governance requirements taxonomy derived from organizational
theory and enterprise governance standards:

| Dimension | MCP | A2A | ACP | ANP | ERC-8004 |
|-----------|-----|-----|-----|-----|----------|
| Membership | Partial | Partial | Partial | Partial | Supported |
| Deliberation | Absent | Absent | Partial | Absent | Absent |
| Voting | **Absent** | **Absent** | **Absent** | **Absent** | **Absent** |
| Dissent preservation | **Absent** | **Absent** | **Absent** | **Absent** | **Absent** |
| Human escalation | Partial | Partial | Partial | Absent | Absent |
| Audit/replay | Partial | Partial | Partial | Absent | Partial |

**Key findings**:
- Voting and dissent preservation are **universally absent** across all five
  protocols — no protocol can express disagreement or collective decision
- Deliberation is absent or at most partial — no protocol supports structured
  discussion before action
- The paper distinguishes **extensible gaps** (addressable via protocol
  extension mechanisms) from **structural gaps** (requiring a new
  architectural layer)
- Collective decision-making is a **structural gap** — it cannot be added to
  task-oriented coordination protocols; it requires a new layer above them

**Conclusion**: "Agent community governance constitutes a missing
architectural layer above current interoperability standards, not a missing
feature within them."

**Connection to prior findings**:
- Confirms Protocol Gaps (§1 of this note) were understated — the gap is not
  "missing features" but "missing layer"
- Extends Governance Structures comparison (2606.26203) — that paper showed
  governance *forms* differ in focus; this paper shows ALL forms lack
  expressivity for collective decisions regardless of form
- Validates Specification Turn (#267) and Enforcement Crystallization (#278)
  — specification and enforcement operate within protocols that can't express
  what needs specifying/enforcing at the community level

**Source**: https://arxiv.org/abs/2606.31498, scan #291

---

## §8. MCP 2026-07-28 Spec Release: Transport Goes Stateless

**Finding**: The MCP 2026-07-28 specification officially moves the transport
layer to stateless HTTP, deprecating persistent SSE connections. Tool calls
are now explicitly request/response (no session affinity required), enabling
serverless deployment of MCP servers. Lead maintainer confirms this unblocks
"remote MCP servers into serverless hosts."

**Community reaction** (HN, 17pts, 6 comments):
- "Tool calls are stateless anyway — when an LLM asks get_my_todos then
  add_todo it's just text going back into the context window."
- Concern from users relying on SSE for multi-day workflow monitoring —
  replacement mechanism unclear.
- Questions about whether HTTP method/name headers are still needed vs plain
  URL-based routing.

**Architectural significance**: This validates the "MCP is a function-call
envelope, not a session protocol" interpretation. Stateless transport:
1. Eliminates connection management overhead for cloud-hosted tools
2. Aligns with HTTP semantics (caching, load-balancing, CDN-friendliness)
3. Breaks assumptions for long-running subscriptions (notifications, progress)

**Connection**: Explains the extreme non-compliance found in §8b below —
servers built for stateful SSE need architectural rework, not just a version
bump.

**Source**: https://blog.modelcontextprotocol.io/posts/2026-07-28/
HN: https://news.ycombinator.com/item?id=49088058

### §8a. HN Follow-Through (2026-08-05): Stateless MCP Narrows the Debate to Ops + Context

**Finding**: Two weeks after the 2026-07-28 spec release, the live HN front-page
reaction to Simon Willison's "Stateless MCP has recaptured my interest"
(https://simonwillison.net/2026/Jul/31/stateless-mcp/, HN 49131438) shows a
pragmatic shift: stateless MCP is no longer being defended as a novel protocol
primitive, but as a **governable HTTP tool surface** that can use normal web
infrastructure while remaining safer than giving agents raw shell+`curl`.

**Primary source details**:
- Simon's before/after example shows the transport collapsing from
  initialize+session-ID flow to a single `POST /mcp` request for `tools/call`.
- He explicitly argues this is "a better fit for building scalable web
  applications" because servers no longer need to track session IDs or route a
  session back to the same machine.
- He also reverses his earlier skepticism: arbitrary shell/network access is
  "fraught with risk," while MCP tools are easier to audit and control.

**HN practitioner reaction** (front page, 112pts / 16 comments when checked):
- Multiple commenters treat the change as operational normalization, not
  conceptual novelty: "just another REST API endpoint," now compatible with
  load balancers, API gateways, and progressive rollouts.
- Implementers report the simplification is real: one commenter said a
  scratch-built Python MCP server had previously failed to work reliably across
  clients and welcomed the reduced complexity.
- The remaining objections have moved up-stack: context bloat, poor
  composability versus shell pipelines, and whether generic constrained HTTP
  tools could capture most MCP value.

**Architectural significance**: This materially updates the July "MCP is a
deadend / CLI is the future" discourse. Stateless transport does not beat CLI
on flexibility; instead it makes MCP viable precisely by conceding the lower
layer. The protocol's differentiators narrow to:
1. **Auth/governance boundary** — constrained tool surface instead of arbitrary
   network execution
2. **Operational fit** — standard web infra, serverless deployment, no session
   affinity
3. **Inspectable capability contracts** — typed tools remain easier to audit
   than shell transcripts

**Implication for agent builders**: The next competitive battleground is no
longer transport semantics. It is whether MCP deployments can solve **context
selection and response-shaping** well enough to avoid the bloat/composability
criticisms that HN now treats as the main remaining weakness.

**Source**: https://simonwillison.net/2026/Jul/31/stateless-mcp/
HN: https://news.ycombinator.com/item?id=49131438

### §8a.1. HN Implementation Follow-Through (2026-08-06): Stateless MCP Pushes State Up the Stack

A smaller Show HN around **mcp-use v2** is still a useful protocol signal
because it shows how downstream tooling is adapting now that the 2026-07-28 MCP
revision removed protocol-level sessions.

The linked post says the new spec:
- removes both the `initialize` handshake and the `Mcp-Session-Id` session,
- reframes application state as explicit contract data rather than hidden
  transport state,
- and adds related production-facing surface such as a formal extensions model,
  Tasks, cache hints, trace context, stronger OAuth requirements, and a
  deprecation policy.

The most useful implementation evidence is that the team says they **did not
patch the old framework**; they **rebuilt mcp-use v2 around a stateless request
path** for modern HTTP runtimes. Their concrete examples move state and control
into the application layer:
- multi-step flows now return `input_required` plus opaque `requestState`,
- the React `McpClientProvider` owns persistence, reconnects, OAuth state,
  proxy fallback, notifications, and elicitation queues,
- and the server layer adds direct v2 elicitation support plus
  **verified/tamper-protected request state**.

The post also reports non-trivial packaging/runtime changes versus v1:
- **10,982** median ops/s vs **8,615**,
- **68.1 ms** median cold launch vs **151.6 ms**,
- **74.4 MiB** clean install vs **404.6 MiB**.

That matters because it sharpens the architectural reading of stateless MCP.
The simplification is not just "MCP becomes more REST-like." It is that MCP
frameworks are being forced to make **state, auth, and recovery explicit
app-layer responsibilities** instead of relying on transport-era session magic.
In practice, the protocol is getting thinner while the surrounding client/runtime
layer gets more opinionated about signed state handles, OAuth, and request
replay.

This is a useful complement to §8a above: Simon Willison's HN thread showed
that practitioners increasingly value stateless MCP for standard web ops;
mcp-use v2 shows the follow-through cost and opportunity for framework authors.
Stateless MCP does not remove state management — it **relocates it**.

**Source**: https://manufact.com/blog/mcp-use-v2
HN: https://news.ycombinator.com/item?id=49198472

### §8a.2. GitHub Implementation Follow-Through (2026-08-06): ACP Becomes a Backend Shell While Runtime Identity Lives Elsewhere

**Finding**: The current GitHub repo **junghan0611/entwurf** is useful protocol evidence because it treats ACP as a **backend-shell adapter layer**, not as the whole agent runtime. Its docs explicitly assign ACP the backend process lifecycle, session isolation overlays, model enforcement, prompt/event mapping, and turn evidence — while explicitly keeping citizen registration, socket registry, peer protocol, memory DB, planner/orchestrator, and auth outside the ACP plugin boundary.

**Primary source details**:
- `AGENTS.md` says the ACP plugin owns backend lifecycle, isolated overlay, tool narrowing, ACP dialect handling, and turn evidence, but **"does not own"** citizen registration, socket registry, peer protocol, memory DB, planner/orchestrator, or auth.
- The same file defines **one record axis** above transport: pi sessions, Claude Code mailbox sessions, and Antigravity native-push sessions all become addressable only after they have a record-backed **garden id**. A one-turn provider call without `--entwurf-control` is a real model turn but is **not addressable**.
- `docs/acp-backend-rail.md` makes the layering explicit: the host pi session owns the record-backed citizen identity, while backend adapters only supply spawn/init/model/carrier/overlay/MCP projection behavior. It also documents backend asymmetry: Claude accepts wire `mcpServers`, but Cortex ignores that field so the adapter writes a private `cortex/mcp.json` instead.
- `docs/external-mcp-host.md` shows the control implication: an external MCP host can read `entwurf_peers` and `entwurf_inbox_read`, but `entwurf_v2` sends are **refused by default** unless the caller has authoritative sender identity or explicitly opts into an anonymous non-replyable hatch. Delivery authority is therefore not granted by protocol connectivity alone.
- `VERIFY.md` adds an important operational nuance: release acceptance checks continuity, socket liveness, replyability, and backend-specific carrier behavior separately. In other words, the implementation does not treat "ACP session exists" as sufficient proof that addressability, identity, or delivery guarantees are correct.

**Architectural significance**: This sharpens the protocol split Scout has been tracking. In practice, ACP is being used as a **thin shell for talking to backend agent runtimes**, while the harder production properties — addressability, identity continuity, replyability, mailbox/native-push routing, and delivery authority — are being implemented in adjacent runtime layers.

That matters because it updates the usual "protocol wars" framing. The live design question is no longer just which protocol wins. It is **which layers stay protocol-thin and which layers must become explicit runtime control planes**.

**Implications for agent builders**:
1. **Backend interoperability does not equal runtime identity.** A common ACP turn loop can normalize Claude/Cortex access without normalizing who is allowed to send, reply, resume, or claim a durable session identity.
2. **Addressability is becoming a separate contract.** `entwurf` makes session addressability depend on a record-backed garden id, not on the existence of an ACP session or an MCP connection.
3. **Protocol-level capability still needs runtime-side authority checks.** The repo's default refusal for unauthenticated external sends is concrete evidence that "tool reachable" is weaker than "delivery authorized."
4. **The governance-gap thesis shows up in implementation form.** Earlier papers argued that current protocols lack higher-order governance expressivity. This repo shows the practical consequence: production builders are externalizing identity, routing authority, and delivery policy into a layer above the protocol.

**Connection**: Complements §8a and §8a.1. Stateless MCP moved hidden server state up into the application/runtime layer; `entwurf` shows ACP doing something similar on the agent-shell side. Both trends point toward thinner protocols and thicker runtime control layers.

**Source**: https://github.com/junghan0611/entwurf
Supporting docs: https://raw.githubusercontent.com/junghan0611/entwurf/main/AGENTS.md, https://raw.githubusercontent.com/junghan0611/entwurf/main/VERIFY.md, https://raw.githubusercontent.com/junghan0611/entwurf/main/docs/acp-backend-rail.md, https://raw.githubusercontent.com/junghan0611/entwurf/main/docs/external-mcp-host.md

### §8a.3. HN Roadmap Signal (2026-08-22): Progressive Discovery Becomes an Authorization Boundary

The official MCP roadmap puts three previously separate scaling problems on the
same protocol agenda:

1. **Long-running work exceeds request/response.** The maintainers plan to
   mature Tasks, subscriptions/listen, progress notifications, and
   server-initiated events so work can be observed and steered without polling.
2. **Large tool catalogs exceed model attention.** The roadmap says mounting a
   server with 100 tools charges the model for the whole surface before a user
   asks anything and worsens tool selection. Its proposed direction is
   progressive discovery: expose a small entry point, then reveal more of the
   catalog as the conversation narrows.
3. **Unattended agents exceed browser-centric authorization.** The identity
   track covers DPoP, Workload Identity Federation, ID-JAG, and token exchange
   for cloud agents acting for absent users or delegating narrower authority to
   sub-agents.

The non-obvious design consequence is that **progressive discovery cannot be
only a context-compression feature**. Once callers have workload identity and
delegated scopes, the catalog revealed at each step should be filtered by what
that identity may actually invoke. Otherwise a router may save tokens while
still advertising forbidden capabilities, leaking schema metadata, and inviting
plans that fail only at execution time. Discovery therefore becomes part of the
authorization boundary: authenticate first, attenuate the discoverable surface,
then disclose and execute.

The HN discussion sharpened this coupling. One practitioner described Workload
Identity Federation as preserving the compliance answer to “who” without
blocking an unattended loop on interactive OAuth; another explicitly asked for
service-independent limits for specialized sub-agents. A separate thread noted
that practitioners already lazy-load MCP tools or front them with “code mode,”
which shows progressive discovery is catching up with deployed routing patterns,
not inventing them.

This is a **roadmap signal, not a shipped-spec claim**. The practical near-term
architecture is to keep the search→route→call layer independently enforceable,
bind its results to caller identity and delegation, and retain execution-time
authorization as the final check. [Warden's five-tool meta-router](./findings/2026-08-01-github-warden-mcp-meta-router.md)
demonstrates the catalog-compression shape; the roadmap adds the missing
requirement that the revealed catalog must be authority-aware.

**Source**: https://blog.modelcontextprotocol.io/posts/mcp-roadmap/
HN: https://news.ycombinator.com/item?id=49399591

### §8a.4. GitHub Implementation Signal (2026-09-11): Capability-Conditioned Discovery Must Disclose Its Proof Boundary

A current GitHub repository turns one part of that roadmap direction into a
narrow, inspectable implementation. At pinned revision
[`5c4235b9`](https://github.com/redhat-et/ripwire/commit/5c4235b9befd4cd5b6f9f3a489940d7b79f86520),
`redhat-et/ripwire` exposes a deterministic code map through both a CLI and an
MCP server. The important signal is not the repository's advertised retrieval
ratios, which are author-run and were not reproduced in this observation. It is
how the MCP catalog changes when the server can prove facts about its bound
workspace.

For a listener pinned to a non-Git directory, the implementation omits three
Git-only tools—`owners`, `whereis`, and `stray_content`—from `tools/list`,
reducing that catalog from 31 to 28 entries. Its regression gate checks more
than the count: it verifies the exact retained set, requires initialization
instructions to name the omitted tools and explain the Git limitation, keeps
four tools that can still answer without Git, and proves that an omitted tool
called explicitly still reaches its normal Git-specific refusal rather than
becoming an unknown route. The same non-Git directory served through the
unbound stdio mode retains all 31 tools because a later request may name a
different repository. Omission is therefore conditioned on what the server can
prove impossible for that transport and scope, not on a broad guess about what
the caller will need.

This adds a useful rule to progressive discovery: **catalog reduction needs a
proof boundary and a disclosure receipt**. A server may omit a capability when
its binding makes success impossible, but it should not infer impossibility
from an unbound or caller-selectable context. The response should also say what
was hidden and why, so fewer schema tokens do not masquerade as the server's
full capability surface. Finally, keeping invocation-time refusal distinct from
catalog visibility preserves the layered contract: discovery guides planning;
execution still enforces current preconditions.

Ripwire also makes the context-cost tradeoff explicit by recommending its CLI
as the cheaper interface when an agent can already run shell commands, because
MCP verb schemas otherwise occupy every session's context. That is a design
position rather than independent evidence that CLI always wins. Still, paired
with the capability-conditioned catalog, it suggests three separate controls
for large tool systems:

1. choose the cheapest already-authorized transport for the task;
2. advertise only capabilities that can succeed within the proven binding; and
3. enforce preconditions and authority again when a capability is invoked.

**Evidence boundary:** This inspection confirms repository code, tests, and
published benchmark machinery at one commit; it does not establish the claimed
retrieval accuracy, token savings, performance, or behavior of a built binary.
The repository tree was complete in the GitHub response (`truncated: false`),
and the discovery Search API returned `incomplete_results: false`.

**Sources:** [repository](https://github.com/redhat-et/ripwire),
[pinned MCP implementation](https://github.com/redhat-et/ripwire/blob/5c4235b9befd4cd5b6f9f3a489940d7b79f86520/src/mcp.h),
[pinned catalog-pruning regression gate](https://github.com/redhat-et/ripwire/blob/5c4235b9befd4cd5b6f9f3a489940d7b79f86520/test/mcptoolprunecheck.sh),
[pinned map-before-read guidance](https://github.com/redhat-et/ripwire/blob/5c4235b9befd4cd5b6f9f3a489940d7b79f86520/skills/ripwire-orient/map-before-you-read.md), and
[pinned warm-session benchmark harness](https://github.com/redhat-et/ripwire/blob/5c4235b9befd4cd5b6f9f3a489940d7b79f86520/bench/mcp_session_timing.py).

---

## §8b. MCP Protocol Debt — Quantitative Evidence (2026-07-12)

**Finding**: Tool `mcp-spec-check` scanned 4,356 reachable MCP servers and
found only 1 compliant with the upcoming 2026-07-28 spec revision (0.023%
compliance). HN reaction: "Usually a product not working with 99.995% of the
ecosystem is a no-go."

**Implication**: MCP spec velocity exceeds ecosystem adoption velocity by
orders of magnitude. This is classic **protocol debt** — rapid spec evolution
creating fragmentation across deployed implementations. Agent systems
depending on MCP should:
1. Pin to specific spec versions as first-class dependencies
2. Budget for migration costs at each spec revision
3. Treat MCP compliance as a runtime property to test, not assume

**Connection**: Validates MCP Governance Illusion (scan #279), Specification
Turn (#267), Enforcement Crystallization (#278). The governance tooling
(spec-check, Kastra) is emerging *reactively* — after fragmentation, not
before it.

**Source**: https://github.com/Roee-Tsur/mcp-spec-check, HN scan #282

---

*This note consolidates MCP/A2A/AG-UI references scattered across 6+ library
notes into a single canonical protocol reference. Source-dated provenance
lives in `inbox/` archive files.*
