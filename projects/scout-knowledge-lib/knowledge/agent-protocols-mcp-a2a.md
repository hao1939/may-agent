<ai_context>
summary: "Canonical overview of the agent protocol landscape: MCP (agent→tool), A2A (agent→agent), AG-UI (agent→frontend). Covers what each standardizes, the SDK/ecosystem state, competing protocols, Chinese community sentiment, and research findings."
triggers: ["MCP", "Model Context Protocol", "A2A", "AG-UI", "AHP", "Agent Host Protocol", "agent protocol", "agent-to-agent protocol", "tool connectivity protocol", "MCP陨落", "ID-JAG", "Zero-Touch OAuth", "protocol fatigue", "protocol absorption", "EMA enterprise managed auth", "auth isolation", "MCP moat", "agent-behind-MCP", "Cloudflare temporary accounts", "agent-native infrastructure", "accommodation wave", "auth.md", "ephemeral deploy"]
last_updated: "2026-07-02"
source_basis: "GitHub trending repos June 2026, XHS Chinese AI community May-June 2026, arXiv briefings June 2026, HN explorations June 2026 (incl. scan #33), arXiv 2606.30317 (MCP Architecture Patterns), scan #262. See ai_context sources section below."
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

- **Source**: [HN Scan #53](./findings/2026-08-29-hn-scan-53.md), Jun 2026.

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

- **Source**: [HN Scan #33](./findings/2026-06-20-hn-scan-33.md), Jun 2026; [HN Scan #157](./findings/2026-09-28-hn-scan-157.md), Sep 2026. HN item 48582679.

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

- **Source**: [HN Scan #54](./findings/2026-08-30-hn-scan-54.md), Jun 2026.

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

- **Source**: [HN Scan #56](./findings/2026-09-01-hn-scan-56.md), Sep 2026.

### Protocol Taxonomy Research — Federated Stack Thesis (arXiv, Sept 2026)

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

- **Source**: [arXiv 2606.19135](https://arxiv.org/abs/2606.19135), Sept 2026.

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

- **Source**: [arXiv 2606.25876](https://arxiv.org/abs/2606.25876), [findings/2026-10-02-hn-scan-161.md](./findings/2026-10-02-hn-scan-161.md)

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

### Microsoft AHP — Fourth Protocol Layer (Scan #204)

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

**Prediction**: AHP remains VS Code-internal. The pattern repeats — vendors
ship their own protocol layer, the ecosystem consolidates on MCP, vendor
layers become internal implementation details.

- **Source**: [GitHub](https://github.com/microsoft/agent-host-protocol), HN item 48582679 (roblourens comment).

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

## MCP Protocol-Level Privacy Risks (Scan #259, Nov 2026)

**MCPPrivacyDetector** (2606.21338): First large-scale protocol-aware static analysis of MCP servers. 10,655 servers audited.

**Key findings**:
- **>10% of MCP servers leak credentials** via protocol-structural pathways
- Leakage is **protocol-induced**: credentials (Bearer tokens, API keys, plaintext auth) cross the local/LLM boundary by being returned, logged, or raised inside `@mcp.tool` handlers — with NO explicit outbound request in source code
- Conventional exfiltration scanners structurally cannot detect this class of leakage
- **Technical approach**: Unified cross-language program representation + context-aware semantic filtering + taint analysis for protocol-specific implicit sinks

**Structural meaning for MCP absorption**: MCP's very success at absorbing all other protocols makes this finding more severe. If MCP is the ONE protocol, then MCP's leakage surface IS the entire agent security surface. The absorption that simplifies integration cost also concentrates credential exposure risk.

- **Connection**: Extends ToxicSkills (scan #166, 36% critical ClawHub issues), Implementation Blind Spot (scan #203), ShareLock threshold poisoning (scan #170)
- **Source**: https://arxiv.org/abs/2606.21338

## MCP Architecture Patterns & Tool-Count Ceiling (Scan #262, Nov 2026)

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

*This note consolidates MCP/A2A/AG-UI references scattered across 6+ library
notes into a single canonical protocol reference. Source-dated provenance
lives in `inbox/` archive files.*
