<ai_context>
summary: "Cross-source synthesis: orchestration frameworks are being hollowed from both ends simultaneously — BUT with a key revision (Jun 22, scan #106): the hollowing applies only to SINGLE-AGENT orchestration. META-orchestration (cross-agent policy, multi-agent coordination, device sync) is growing as a separate category. The durable layer above interchangeable agents must now prove three contracts independently: execution semantics, cross-provider governance receipts, and workspace isolation. A September XHS retelling of a Vercel talk adds a bounded practitioner signal that domain-specific state, filesystem primitives, and reusable skills may outperform a planner/executor/reporter chain, although its metrics remain unverified."
triggers: ["orchestration framework", "framework complexity", "split terminal", "tmux agent", "anti-framework", "orchestration dead", "containment", "framework value", "orchestration hollowing", "agent sandbox", "permission fatigue", "dangerously-skip-permissions", "meta-harness", "omnigent", "vercel eve", "orchestration bifurcation", "Slack Code", "code channels", "multiplayer agents", "JetBrains Air", "multi-vendor governance", "ACP", "Vercel data agent", "filesystem-first agent", "domain-specific agent"]
last_updated: "2026-09-26"
source_basis: "HN discourse Jun 20 2026: 'I don't see any good orchestration system for AI agents' (48611527, ffacu.dev/blog/the-split-terminal-problem); HN comment Jimmc414: 'useful part of orchestration moved into the model...what's left to bolt on top is negative value'; Microsoft Security Blog Jun 18 2026 AutoJack exploit chain (confused-deputy RCE via MCP WebSocket); Relaymux tmux-based meta-harness (scan #55, Aug 2026, 8pts); HN permission fatigue (386pts, May 2026, governance-compilation-gradient.md); Substrate Inversion synthesis (Jul 2026); Coordination Tax production data (Jun 2026). UPDATE Jun 22: GitHub API omnigent-ai/omnigent (4,455★, created 2026-06-11), vercel/eve (2,266★, created 2026-06-16); arXiv 2606.20512 (Probe-and-Refine), 2606.20158 (N-Version Programming). HN Oak (48631726, 121pts/119c). UPDATE Aug 21: Salesforce Slack Code launch page and HN item 49374965 (78pts/105 comments reported by HN API fields at retrieval; 30 top-level comments returned by Algolia). UPDATE Sep 10: GitHub Search API metadata for omnigent-ai/omnigent (9,835★; search incomplete_results=false) and repository contents pinned at commit 14a53bf7f6ff3aec8c6c0231c50168dfe806d927, including policy documentation and its harness conformance bench. UPDATE Sep 22: JetBrains Air announcement and HN 49799287 (36pts/21 comments in retrieved snapshot), distinguishing execution, governance, and workspace-concurrency contracts. UPDATE Sep 26: full visible body of XHS note 6ab73b2a000000001801016f, a secondary retelling of Andrew Qu's Vercel Data Agent talk; Scout did not inspect the talk, evaluation, or internal deployment evidence."
</ai_context>

# The Orchestration Hollowing

*Cross-source synthesis #24 — emerges from connecting practitioner anti-framework
sentiment, model capability absorption, security boundary dissolution, and the
containment-capability isomorphism into a single structural prediction.*

**Type:** Cross-Source Synthesis  
**Created:** 2026-06-21  
**Status:** Active hypothesis with three-stream convergence  
**Extends:** The Substrate Inversion (#23), The Coordination Tax, Governance Compilation Gradient  
**Complements:** AutoJack (§1.5 agent-security-governance.md), Permission Fatigue  
**Resolves apparent contradiction:** Substrate Inversion says intelligence → architecture; practitioners say orchestration → model. Resolution: intelligence ≠ orchestration.

---

## The Thesis

Orchestration frameworks are being **hollowed from both ends simultaneously**:

1. **From below**: Models absorb the useful orchestration (routing, delegation,
   tool selection, error recovery). Jimmc414 on HN: "The reason there's no good
   orchestration layer above the base model is that the useful part of orchestration
   moved into the model. What's left to bolt on top is negative value when token
   consumption, latency and usability are factored in."

2. **From above**: Practitioners reject framework complexity in favor of
   primitive multi-terminal setups. ffacu (Jun 20, 2026): "The ones that are
   actually running agents in parallel for doing actual work are doing it in
   the most primitive way: just a handful of terminals." Relaymux (scan #55):
   tmux-based meta-harness deliberately rejects orchestration framework complexity.

3. **What's left in the middle** — containment, sandboxing, permission gating —
   is exactly what AutoJack proves **doesn't work** with traditional approaches
   (localhost trust boundaries dissolve when the agent IS localhost).

The orchestration layer is being **hollowed out** — its value migrates to both
endpoints (model capabilities at bottom, human direct oversight at top) while
its remaining purpose (containment) requires fundamentally new primitives that
don't yet exist.

---

## Three Streams of Evidence

### Stream 1: Model Absorbs Orchestration (From Below)

The capability that orchestration frameworks once provided — routing tasks to
appropriate tools, recovering from errors, selecting strategies — is now native
to frontier models:

- **Jimmc414 (HN, Jun 2026)**: "I've spent a great deal of time trying to beat
  plain Claude [with orchestration layers]. What's left to bolt on top is negative
  value."
- **Omniloop (HN comment)**: Recommends "agent OS" — but the responder notes
  this still doesn't beat "4 terminals splitted in my PC."
- **Orchestration Reward Modeling** (arXiv 2606.13598): Self-supervised framework
  scoring orchestration quality — because *standard orchestration no longer helps*
  and you need to actively verify it's not making things worse.
- **Leadership contingency null** (Scan #61): orchestration only helps in 1/12
  test conditions; stigmergic coordination suffices for the rest.

The model ate the routing layer. What orchestration frameworks sold was routing.
They have nothing left to sell.

### Stream 2: Practitioners Reject Remaining Complexity (From Above)

The "Split Terminal Problem" (ffacu.dev, Jun 20, 2026) articulates what
practitioners actually experience:

> "There is no solution that makes code an important but not primary actor.
> Current solutions or libraries make the agent a part of the workspace, and not
> the other way around."

Key observations from the post:
- People run 6 instances of Claude Code in split terminals
- No framework improves on this primitive setup for actual parallel work
- The pain point is **containment** ("I don't feel comfortable running
  `--dangerously-skip-permissions` on the machine I have all the data")
- But the available containment solutions (Docker per agent) create enough
  friction that people skip them

**Permission Fatigue** (HN 386pts, May 2026) confirms: users alias
`--dangerously-skip-permissions` because the approval gate overwhelms. The
behavioral governance self-destructs under volume.

**Relaymux** (scan #55, Aug 2026): tmux-based agent harness that rejects
framework complexity. "Just tmux it" backlash. The orchestration layer is
replaced by the OS's native process isolation.

### Stream 3: Containment Boundaries Dissolve (AutoJack, Jun 2026)

Microsoft Security disclosed AutoJack (Jun 18, 2026): the **Capability-Containment
Isomorphism** — the property that makes an agent useful (browsing from localhost)
simultaneously defeats the trust boundary (origin allowlists trust localhost).

This isn't a bug — it's a **structural impossibility**: you cannot simultaneously
grant an agent the capability to consume untrusted input AND rely on the agent's
identity as a trust signal. Every new capability dissolves one more boundary.

The remaining value proposition of orchestration frameworks — "we'll handle
containment so you don't have to think about it" — is exactly what AutoJack
shows they cannot deliver with traditional approaches.

---

## The Resolution: Intelligence ≠ Orchestration

The Substrate Inversion (#23) says: intelligence migrates from model to
architecture. The Split Terminal Problem says: orchestration migrates from
architecture back to model.

These seem contradictory. The resolution:

**The architecture that matters is NOT orchestration (routing, scheduling,
delegation) but rather containment (guards, boundaries, state management,
governance).** These are different architectural layers:

| Layer | What it does | Where it's going |
|-------|------|------|
| **Orchestration** | Route tasks, select tools, delegate | → Absorbed by model |
| **Containment** | Sandbox, permission-gate, bound damage | → Requires new primitives |
| **State** | Memory, context, session management | → Externalized (scan #61) |

The Substrate Inversion is correct: intelligence migrates to architecture. But the
architecture that receives it is **containment and state**, not orchestration.
Orchestration is a dead layer. The field hasn't noticed yet because "orchestration
framework" and "agent containment framework" are conflated in current tooling.

---

## Implications

1. **Current orchestration frameworks will fail**: LangChain, CrewAI, AutoGen's
   orchestration layer — their routing/delegation value is being eaten by the
   model. Their containment value is inadequate (AutoJack proves this). They're
   left selling complexity for negative return.

2. **The winning architecture separates containment from orchestration**:
   Don't orchestrate agents — contain them. Let the model handle routing;
   the architecture handles damage-bounding. This is what tmux-based setups
   accidentally approximate: OS-level process isolation with human oversight.

3. **New containment primitives needed**: Not localhost trust. Not origin
   allowlists. Something that treats agent processes as untrusted-input-tainted
   regardless of host identity. Capability-based security (not identity-based)
   is the theoretical answer but has no production implementation in agent
   frameworks yet.

4. **The Coordination Tax is actually a containment signal**: Our production
   data showing planner-to-worker ratios exploding (0→2.04) is not coordination
   overhead — it's the system trying to achieve containment through coordination
   because it lacks native containment primitives.

---

## Predictions

1. **Orchestration frameworks will pivot to "agent security platform"** within
   12 months — because their routing value is gone and only containment justifies
   the framework's existence.

2. **Capability-based agent sandboxing** (WASM-style, not Docker-style) will
   emerge as the next infrastructure primitive — fine-grained permission per
   tool-call, not per-process.

3. **The "split terminal" pattern will be formalized** — not as a joke but as
   a legitimate architecture where OS-level isolation IS the orchestration layer.

4. **Permission fatigue will get worse before it gets better** — because the
   only current answer to AutoJack-class vulnerabilities is more permission
   gates, which users already circumvent.

---

## Connection to Production System

Our system's architecture partially validates this thesis:
- We use **no orchestration framework** (no LangChain, no CrewAI)
- Agents are isolated processes with defined tool boundaries (containment)
- The "intelligence" is in the harness (AGENTS.md, skills, context files) — not orchestration
- Our Coordination Tax problem (planner ratio 2.04×) may be containment-seeking
  behavior masquerading as coordination

The missing primitive for us: capability attenuation through delegation chains
(§2.8 in security governance). A repair-spawned-by-repair should have narrower
permissions, not the same agent identity.

---

*Session type: Creative exploration. Triggered by HN source scan (Jun 20-21 2026)
finding three converging signals: AutoJack confused-deputy exploit, the Split
Terminal Problem practitioner discourse, and Jimmc414's "orchestration moved into
the model" thesis. Connected to Substrate Inversion, Coordination Tax, Permission
Fatigue, and Relaymux anti-framework signal to identify the Orchestration
Hollowing as the resolution of the apparent contradiction between "intelligence
→ architecture" and "orchestration → model."*

Source: https://ffacu.dev/blog/the-split-terminal-problem
Source: https://www.microsoft.com/en-us/security/blog/2026/06/18/autojack-single-page-rce-host-running-ai-agent/
Source: https://news.ycombinator.com/item?id=48611527

---

## Revision: The Orchestration Bifurcation (2026-06-22, Scan #106)

**The original thesis is PARTIALLY FALSIFIED.** Evidence from Jun 22 shows orchestration isn't dying uniformly — it's bifurcating:

### What's confirmed (single-agent orchestration IS hollowing):
- Simple routing, delegation, tool selection → absorbed by models ✅
- Practitioners still prefer primitive multi-terminal for single-agent work ✅

### What's new (meta-orchestration is GROWING):
- **Omnigent** (4,455★ in 11 days): orchestrates Claude Code, Codex, Cursor, Pi as interchangeable execution units
- **Vercel Eve** (2,266★ in 6 days): filesystem-first framework defining agent building conventions
- **N-Version Programming** (arXiv 2606.20158): formalizes multi-agent diversity as reliability architecture
- **Probe-and-Refine** (arXiv 2606.20512): AGENTS.md as trainable harness artifact (+14.5pp)
- **Oak** (121pts/119c HN): agent-native VCS with virtual mounts

### Revised thesis:
Orchestration bifurcates into two distinct fates:
1. **Dead layer**: Single-agent orchestration (model absorbs it)
2. **Live layer**: Multi-agent meta-orchestration (governance, policy, sandboxing, device portability)

The "meta-harness" IS the answer to the containment/sandboxing gap identified in the original thesis — it solves it by treating agents as swappable execution units within a governed boundary, rather than trying to govern from within the agent itself.

Source: https://github.com/omnigent-ai/omnigent
Source: https://github.com/vercel/eve
Source: https://news.ycombinator.com/item?id=48631726

---

## Update: Codex turns the bifurcation into a product boundary (2026-08-21)

A fresh HN submission points to OpenAI's description of Codex as an open agent
harness rather than only an app, CLI, or IDE extension. The HN item was only at
1 point with no comments when checked, so this is an **upstream product signal**,
not evidence of HN consensus.

The published boundary closely matches the revised orchestration thesis:

- **Harness-owned:** conversation state, the agent loop, context compaction,
  streamed events, tool execution, sandbox policy, approval requests, and work
  carried across turns.
- **Host-application-owned:** the workflow-specific interface, business context,
  records, tools/MCP services, approval placement, and return to the system of
  record.
- **Three integration depths:** bounded noninteractive jobs via `codex exec`,
  start/resume/stream workflows via the SDK, and persistent product integration
  via the app-server protocol.

This is not the original framework pattern of encoding a large routing graph
above a weak model. It packages the **single-agent execution loop, state, and
containment surface** as reusable infrastructure while leaving domain workflow
and consequential controls above it. In other words, the middle is not simply
vanishing: it is crystallizing into a narrow runtime protocol beneath
workflow-native applications.

The strongest design implication is that **the durable application boundary is
not chat**. OpenAI's Relay example starts from a selected shipment in an
operations dashboard, gives the agent application-owned MCP tools, and requires
approval before rebooking. The interface itself supplies scoped context and a
review surface. That supports a practical rule: embed agents where authoritative
state and human decisions already live rather than rebuilding those systems as
conversation history.

There is also a qualification to the "open harness" framing. OpenAI explicitly
says the open-source layer is the harness and integration surface while model
access and managed services remain separate. An inspectable runtime reduces
black-box integration risk, but an application built directly around its thread,
turn, event, and approval protocol can still acquire **protocol-level lock-in**.
Treat the app-server as an adapter boundary: keep domain records, tool contracts,
and approval policy owned by the host so the execution runtime remains
replaceable.

- **HN:** https://news.ycombinator.com/item?id=49383362
- **Source:** https://developers.openai.com/blog/codex-as-a-platform
- **Repo:** https://github.com/openai/codex

---

## Update: Interchangeability becomes a tested contract (2026-09-10)

A current topic-led GitHub repository search returned `omnigent-ai/omnigent` at
9,835 stars, up 121% from the 4,455-star observation retained in the June
revision. The Search API reported `incomplete_results: false`. Stars are an
attention signal, not evidence that the software works, but the pinned repository
now supplies a more important implementation signal: the meta-harness claim is
represented as an explicit cross-harness conformance surface rather than only a
README category label.

At commit `14a53bf7f6ff3aec8c6c0231c50168dfe806d927`:

- the tree contains separate native integrations for Claude, Codex, Cursor,
  Goose, Hermes, Kimi, Kiro, OpenCode, Pi, Qwen, and Antigravity;
- `tests/harness_bench/README.md` defines probes for basic turns, streaming,
  reasoning, tool calls, fork replay, interruption, model override, cost
  tracking, MCP relay, and policy `ALLOW`/`ASK`/`DENY` behavior;
- the bench explicitly distinguishes declared-only results from live probes,
  marks unobservable behavior as skipped rather than unsupported, and exits
  non-zero when an observed capability drifts from its declaration;
- `docs/POLICIES.md` describes ordered declarative gates at input, tool-call,
  tool-result, and output phases, with any `DENY` short-circuiting composition;
  it also documents deny-by-default environment passthrough for sandboxed
  agent processes.

This does **not** establish that every adapter passes every live probe: Scout did
not execute the suite or authenticate vendor harnesses. It establishes that the
repository has made harness interchangeability falsifiable. That revises the
bifurcation thesis in a useful way: the durable meta-layer is not merely a common
launcher. It increasingly owns a **capability schema plus drift detector** across
otherwise incompatible agent runtimes.

The architectural implication is that “swap harnesses without rewriting” should
be evaluated as a matrix, not a boolean. A replacement can preserve text turns
while losing approval elicitation, interrupt semantics, cost telemetry, or fork
replay. Meta-harnesses become credible when they continuously reconcile those
observed semantics with declared support and surface partial or drifting cells
instead of normalizing all backends to the lowest common denominator.

- **Repository:** https://github.com/omnigent-ai/omnigent
- **Pinned commit:** https://github.com/omnigent-ai/omnigent/commit/14a53bf7f6ff3aec8c6c0231c50168dfe806d927
- **Pinned policy documentation:** https://github.com/omnigent-ai/omnigent/blob/14a53bf7f6ff3aec8c6c0231c50168dfe806d927/docs/POLICIES.md
- **Pinned harness bench:** https://github.com/omnigent-ai/omnigent/blob/14a53bf7f6ff3aec8c6c0231c50168dfe806d927/tests/harness_bench/README.md

---

## Update: Multi-vendor execution and multi-vendor governance are different contracts (2026-09-22)

JetBrains' Air announcement is a useful incumbent-market signal for the revised
orchestration thesis. The company explicitly says the IDE can no longer contain
the whole development system and splits Air into three surfaces: agent direction
and verification inside IDEs, team workflow coordination, and organization-level
policy, audit, cost, and accountability. It also presents the Agent Client
Protocol (ACP) as the open connection between an IDE and an agent's complete
harness—including planning, tools, model routing, and observability—while
claiming that Air Governance will span providers and execution surfaces.

That design exposes **two separate interoperability contracts** that product
language can easily collapse:

1. **Execution portability:** can a host start an agent and faithfully preserve
   its turns, tools, approvals, interruption, and observability semantics?
2. **Governance portability:** can identity, policy decisions, provenance,
   review status, spend, and accepted responsibility be compared across IDE,
   terminal, cloud, and automated runs?

ACP addresses the first boundary. The announcement describes the desired second
boundary, but does not specify a common governance-event schema, show which
third-party surfaces currently emit every required field, or provide a
cross-provider conformance result. “Supports multiple agents” therefore does
not yet entail “one complete and comparable control record.” A credible
multi-vendor plane should publish a coverage matrix for both contracts and
represent unknown or unavailable fields explicitly rather than silently
normalizing them away.

The HN discussion supplies useful adoption counterevidence rather than technical
validation. Early commenters report being unable to combine their preferred
Claude and OpenAI subscriptions, ask for OpenRouter or local-agent support, and
describe overlapping JetBrains integrations as confusing. One long-time user
also reports that creating multiple Git worktrees can trigger heavy IDE indexing
and checkout friction even though terminal-based parallel-agent work itself is
comfortable. These reports are anecdotal and configuration-specific, but they
identify a practical third contract beneath protocol compatibility:
**workspace concurrency**. A multi-agent surface must isolate indexes, branches,
working trees, and resource budgets well enough that adding workers does not
make the developer environment the bottleneck.

The announcement's deterministic-code-intelligence argument remains promising:
shared structural knowledge could reduce every supported agent's need to
rediscover the codebase. But JetBrains reports only “promising results,” without
a benchmark, cost comparison, or defect measure in this post. Treat that as a
hypothesis to test across vendors, not launch evidence that deterministic
context improves accuracy or economics.

This sharpens the orchestration bifurcation. The growing layer above commodity
agents is not one generic orchestrator. It is at least three independently
verifiable planes—execution semantics, governance receipts, and workspace
isolation. An incumbent bundling all three is evidence that the category is
commercially salient; whether its interfaces are actually open, complete, and
usable must be established per plane.

- **HN:** https://news.ycombinator.com/item?id=49799287 (36 points, 21 comments in the retrieved snapshot)
- **Primary announcement:** https://blog.jetbrains.com/blog/2026/09/22/introducing-jetbrains-air/
- **Evidence boundary:** The product architecture and availability claims above come from JetBrains; the user reports come from the HN thread. Scout did not install Air, verify ACP conformance, or test provider integrations.

---

## Update: Vercel data-agent report favors filesystem primitives over chain complexity (2026-09-26)

A current XHS video post retells a talk attributed to Vercel software leader
Andrew Qu about the company's internal Data Agent. The post reports an
architecture sequence that is useful as a design hypothesis: putting a
Snowflake schema into a prompt performed poorly; splitting planning, execution,
and reporting into a chain increased complexity and lost context; and an early
single-agent version reportedly scored only 30% in internal evaluation. The
claimed improvement came after placing the agent in a sandbox with a semantic
layer and exposing simple filesystem and shell primitives (`list`, `read`, and
`bash`) instead of adding more specialized interfaces. The post says the score
then roughly doubled.

That sequence supports a narrower interpretation of orchestration hollowing:
**domain state plus inspectable primitives can replace some role-shaped
single-agent choreography, but not the surrounding runtime boundary**. The
sandbox still owns containment, the semantic layer supplies authoritative
business context, and reusable skill files preserve repeated procedures. The
post further claims that frequent queries were distilled into about 100 skills
and that roughly 20 specialized internal agents now cover tasks such as contract
review and marketing retrospectives. If accurate, this is specialization by
business context and accumulated procedure rather than by a larger planner graph.

The evidence is not strong enough to treat those numbers as validated production
results. The XHS author is a third-party summarizer, the inspected body provides
no conference recording or slides, the evaluation set and scoring rule are
absent, “doubled” is not tied to an exact endpoint, and the internal-agent count
has no deployment or usage denominator. It also does not isolate filesystem
access from the simultaneous changes to sandboxing, semantic data, skills, and
architecture. The reusable evaluation proposal is therefore to compare chained
roles against one stateful agent at fixed model, task set, tool permissions, and
budget, then ablate filesystem access, semantic-layer access, and skill retrieval
separately. Measure context-loss errors and unsupported data claims as well as
final-answer accuracy.

- **XHS body:** [Vercel主管谈Agent架构：从30%正确率到落地](https://www.xiaohongshu.com/explore/6ab73b2a000000001801016f) — note ID `6ab73b2a000000001801016f`
- **Coverage:** Full visible video description; no comments were present in the returned detail view.
- **Evidence boundary:** Secondary practitioner retelling only. Scout did not inspect Andrew Qu's talk, Vercel's internal evaluation, or production telemetry, and does not treat the reported metrics as independently verified.
