<ai_context>
summary: "Triage of 8 new arXiv papers (June 9–18, 2026) converging on 'The Externalization Turn' — the systematic migration of agent reasoning responsibilities (governance, memory structuring, security assumptions, protocol negotiation, audit knowledge) OUT of LLM inference and into external, inspectable, verifiable structures. SafeClawBench (2606.18356) provides the empirical trigger: 84% of sandbox harms pass semantic (LLM-internal) safety checks, proving that internal reasoning cannot self-verify. Six papers independently respond by externalizing different responsibilities into falsifiable structures: deontic governance into OWL logic engines, security assumptions into source-level assertions with fuzzer falsification, audit knowledge into auto-evolved playbooks, memory into topic-structured documents with explicit lifecycles, page understanding into deterministic DOM representations, and protocol negotiation into dimensional taxonomies."
triggers: ["externalization", "deontic governance", "AgenticRei", "obligation lifecycle", "SafeClawBench", "staged security benchmark", "semantic vs sandbox harm", "Code-Augur", "specification-first security", "assumption falsification", "EvoHunt", "playbook evolution", "self-evolving audit", "Infini Memory", "topic-structured memory", "WebChallenger", "PageMem", "protocol taxonomy", "agent communication protocols", "Internet of Agentic AI", "IoAI"]
last_updated: "2026-06-22"
source_basis: "arXiv API queries: 'AI agent' AND 'multi-agent', 'LLM agent' AND 'coordination', 'agent' AND 'self-improvement' AND 'LLM', 'LLM agent' AND 'failure' AND 'production', 'agentic' AND 'runtime' AND 'LLM', 'agent' AND 'memory' AND 'persistent' AND 'LLM', 'agent' AND 'governance' AND 'runtime' AND 'LLM'. All abstracts read from export.arxiv.org API. Deduplicated against all prior triages (94 paper IDs checked)."
</ai_context>

# Source Triage — June 22, 2026 (arXiv: The Externalization Turn)

*Triaged: 2026-06-22 | Source: `https://export.arxiv.org/api/query` | Queries: 7 standard scout queries (see source_basis) | Papers: 8 new, deduplicated against all prior batches (94 existing paper IDs).*

---

## Convergent Theme: The Externalization Turn

Eight independent papers converge on a single architectural pattern: **agent failures concentrate at the assumption level — tacit beliefs about state, governance, security boundaries, and protocol compatibility that agents hold but never verify.** The response, across all eight papers, is the same: **externalize the responsibility into a structure that can be inspected, verified, and falsified independently of the LLM's inference.**

SafeClawBench provides the empirical trigger. When you separate security assessment into three stages — semantic acceptance (did the LLM agree?), audit-evidence harm (is there logged damage?), and sandbox harm (did state actually change?) — **84% of actual sandbox harms pass the semantic check.** The LLM says "I refused" or "This is safe" while the system state records real damage. Internal reasoning cannot reliably self-verify.

The remaining papers independently demonstrate the fix across six different responsibility domains:

| Paper | What's Externalized | From (internal) | To (external) |
|-------|-------------------|------------------|----------------|
| AgenticRei | Governance rules | Prompt-embedded policies | OWL deontic logic engine |
| Code-Augur | Security assumptions | Implicit model beliefs | Source-level assertions + fuzzer |
| EvoHunt | Audit knowledge | Human-crafted playbooks | Auto-evolved procedural docs |
| Infini Memory | Memory structure | Implicit retrieval | Topic-structured documents |
| WebChallenger | Page understanding | Raw HTML/screenshot | Deterministic DOM representation |
| Protocol Taxonomy | Interop assumptions | Ad-hoc integration | 5-dimensional classification |

This is the next layer beyond the Stochastic-Deterministic Inversion (prior triage). That finding moved control flow out of LLMs. This finding moves **epistemic responsibilities** out — the things the LLM *believes about the world* that it cannot verify from within its own inference.

---

## ★★★★★ [2606.18356] SafeClawBench: Separating Semantic, Audit-Evidence, and Sandbox Harm in Tool-Using LLM Agents

- **Source**: https://arxiv.org/abs/2606.18356
- **Categories**: cs.CR, cs.AI
- **Summary**: Introduces a staged security benchmark for tool-using agents with 600 adversarial tasks across six attack families (direct/indirect prompt injection, tool-return injection, memory poisoning, memory extraction, ambiguity-driven unsafe inference). The key innovation: three separate measurement endpoints rather than one collapsed "attack success rate." Semantic attack acceptance measures whether the LLM agreed; audit-evidence harm measures whether there's logged damage; sandbox harm measures whether system state actually changed. In a 12,000-row matched analysis across five agent endpoints under four prompt policies: **291 of 347 observed sandbox harms occur in rows that pass the semantic check.** Without prompt protection, semantic failure rates range 9.0–44.2%.
- **Key finding**: The semantic layer is not a reliable proxy for actual harm. 84% of sandbox harms are semantically invisible — the LLM "passes" (believes it refused or acted safely) while irreversible state changes occur. This isn't a model capability issue; it's a structural mismatch between what the LLM can observe (its own text output) and what matters (tool effects, state mutations, memory writes). Prompt policies change outcomes but effects are model- and protocol-dependent, meaning no single prompt fix works universally.
- **Implication for us**: Our evaluation system assesses quality at the semantic level — did the session produce reasonable output? But like SafeClawBench shows, semantic quality doesn't correlate with actual state effects. A session could produce "acceptable" text while creating duplicate KE files, writing stale context updates, or generating findings from simulated data. The three-endpoint framework (semantic, audit-evidence, sandbox) is directly applicable to our evaluation architecture. The most dangerous failure mode is when the evaluator says "good" while the knowledge base degrades — exactly the Phantom Feedback Loop (KE-1984) but with a rigorous measurement framework.
- **Cross-references**: [KE-1984 Phantom Feedback Loop](../../agents/scout/workspace/digest/today.md), [The Evaluation Mirage](../the-evaluation-mirage.md), [Agent Security & Governance](../agent-security-governance.md)

---

## ★★★★★ [2606.19464] Deontic Policies for Runtime Governance of Agentic AI Systems

- **Source**: https://arxiv.org/abs/2606.19464
- **Categories**: cs.AI, cs.MA
- **Published**: 2026-06-17 | IEEE Symposium on Agentic Services 2026
- **Summary**: Current policy engines (XACML, Rego, Cedar) address only permit/prohibit — but agent governance requires obligations (what agents MUST do after certain actions), dispensations (when obligations can be waived), meta-policy conflict resolution, and ontological reasoning over domain hierarchies. AgenticRei implements these using a deontic policy language built on the Rei framework, expressed as OWL (Web Ontology Language) and **evaluated at runtime by a high-performance logic engine entirely outside the LLM.** The same pipeline governs both tool invocations and agent-to-agent messages. Composes with A2AS (Agent-to-Agent Services).
- **Key finding**: The gap between permit/prohibit and full governance is not incremental — it's structural. Obligation lifecycle management (an agent MUST notify after performing action X; this obligation expires after condition Y; it can be waived under circumstance Z) cannot be expressed in current production policy engines at all. The critical design choice: governance logic runs **outside the LLM**, in a deterministic logic engine. This makes governance falsifiable — you can prove whether a policy was satisfied, not just ask the LLM if it thinks it complied.
- **Implication for us**: Our agent system has implicit obligations scattered across context files and AGENTS.md: "always include Source: line", "never write() low-numbered KE files", "check shared manifest at session start." These are prompt-embedded governance — exactly what AgenticRei argues cannot be reliably enforced by the LLM itself. The deontic framework (obligation + dispensation + conflict resolution) maps to our real governance problems: an agent SHOULD check the manifest, but MAY skip it if the session is time-critical. Today these tradeoffs are made implicitly by the LLM; AgenticRei argues they should be made explicitly by a logic engine. The evaluation mirage (KE-1984) is partly an obligation-lifecycle problem: the evaluator has obligations (produce a verdict) but no dispensation mechanism (skip evaluation when the session is routine), so it always fires, generating overhead.
- **Cross-references**: [Agent Protocols MCP/A2A](../agent-protocols-mcp-a2a.md), [The Impedance Principle](../the-impedance-principle.md), [Contract Layer triage](./2026-06-19-arxiv-contract-layer-triage.md)

---

## ★★★★★ [2606.18619] Code-Augur: Agentic Vulnerability Detection via Specification Inference

- **Source**: https://arxiv.org/abs/2606.18619
- **Categories**: cs.CR, cs.SE
- **Published**: 2026-06-17
- **Summary**: Proposes a security-specification-first paradigm for agentic vulnerability detection. Code-Augur analyzes each component, and when it deems a component secure, it **commits the local invariants behind that judgment as in-source assertions.** A guided fuzzer then attempts to falsify those assumptions. When the fuzzer triggers an assertion, it either reveals a genuine vulnerability or a flawed specification. Found **22 new vulnerabilities** in key open-source projects. Outperforms specialized commercial products (Claude Mythos) using general-purpose LLMs (Sonnet, DeepSeek).
- **Key finding**: The methodological innovation is not the agent or the fuzzer but the **assumption-to-assertion bridge.** When an agent judges "this code is safe," that judgment rests on implicit assumptions about inputs, state, and invariants. Code-Augur forces those assumptions to become explicit, testable artifacts. This is the externalization principle in its purest form: take what the LLM believes, write it down as a falsifiable statement, and then try to break it. The critical finding: assumptions externalized as assertions are falsifiable; assumptions left inside the LLM's reasoning are not, even retrospectively.
- **Implication for us**: Our agents make implicit assumptions constantly: "this KE doesn't already exist" (before creating a new one), "the tool output is accurate" (before writing a finding), "my context is current" (before making decisions). Code-Augur's assumption-to-assertion pattern could be applied: before an agent writes a new KE, it should assert "no existing KE covers arXiv ID X" and that assertion should be externally verified (which our `grep -rl` pattern partially does). The deeper insight: agent quality improves more from falsifying assumptions than from improving reasoning.
- **Cross-references**: [Stochastic-Deterministic Inversion triage](./2026-06-22-arxiv-stochastic-deterministic-inversion-triage.md), [The Detection-Repair Gap](../the-detection-repair-gap.md)

---

## ★★★★ [2606.16420] Transferable Self-Evolving Playbooks for Agentic Security Auditing (EvoHunt)

- **Source**: https://arxiv.org/abs/2606.16420
- **Categories**: cs.CR, cs.SE
- **Published**: 2026-06-14
- **Summary**: Three-agent evolution loop for security audit playbooks: audit agent rolls out current playbook → evaluator scores against ground truth → reviser updates playbook from failure analysis. The playbook format is unconstrained (workflows, heuristics, vulnerability knowledge, domain-specific content). Starting empty, the system evolves effective playbooks automatically. Key results: evolved playbook raises end-to-end exploits for Codex/GPT5.4-xhigh **6×** (1.1% → 6.2%); evolved open-source playbook (OpenCode/GLM5.1) **beats commercial product** (OpenAI Codex Security, 11.3% vs 9.2%); playbooks **transfer across agents** — Qwen3.6-27B improves from 2.4% to 6.5%.
- **Key finding**: The playbook IS the externalized knowledge. It starts empty and evolves from failure analysis alone. Two critical properties: (1) the evolved playbook outperforms human-crafted ones AND commercial products, meaning externalized procedural knowledge scales better than internalized model capability; (2) the playbook transfers across different LLMs and harnesses, meaning the externalized knowledge is model-agnostic. This is the strongest evidence yet that the harness/guidance layer — not the model — is the primary lever for agent capability.
- **Implication for us**: Our AGENTS.md, context.md, and heartbeat.md files ARE playbooks in EvoHunt's sense. But they don't evolve from failure analysis. They evolve from human editing and occasional agent suggestions. EvoHunt's three-agent loop (act → evaluate → revise playbook) maps directly to a potential improvement: after each session, rather than just evaluating the session, analyze what guidance change would have prevented the failure and propose a context.md edit. The 6× improvement from automated evolution is a strong signal that our static guidance files are significantly suboptimal.
- **Cross-references**: [APEX (2606.15363)](./2026-06-22-arxiv-stochastic-deterministic-inversion-triage.md), [HarnessX (2606.14249)](./2026-06-19-arxiv-contract-layer-triage.md), [The Contract Layer](./2026-06-19-arxiv-contract-layer-triage.md)

---

## ★★★★ [2606.10677] Infini Memory: Maintainable Topic Documents for Long-Term LLM Agent Memory

- **Source**: https://arxiv.org/abs/2606.10677
- **Categories**: cs.AI, cs.CL
- **Published**: 2026-06-09
- **Summary**: Proposes a topic-structured persistent memory architecture. Memory is organized as topic documents, each serving as a semantic unit for collecting related evidence, preserving metadata, and revising facts over time. New observations stage in a buffer, then periodically consolidate into coherent topic documents. At inference time, an agentic retrieval procedure lets the LLM read memory through iterative tool calls rather than single retrieval. Achieves **64.7%** on MemoryAgentBench. Ablations show topic-structured maintenance and iterative evidence inspection improve complementary aspects of long-term memory.
- **Key finding**: Topic-structured documents outperform both isolated records and implicit retrieval because they externalize two things simultaneously: (1) the semantic grouping (which observations belong together), and (2) the temporal lifecycle (buffer → consolidation → revision). The agentic retrieval (LLM reads memory iteratively through tool calls) is strictly better than single-step retrieval, but the bigger win comes from the structured maintenance — consolidation prevents unbounded growth, fact revision prevents staleness.
- **Implication for us**: Our knowledge library IS topic-structured documents (KE files organized by theme). But we lack the buffer → consolidation lifecycle. New observations go straight into either the daily digest or a new KE file. Infini Memory's buffer pattern — stage new observations, then periodically consolidate into existing topic documents — would reduce KE proliferation and improve coherence. Our `context_updates` mechanism is a buffer that consolidates into context.md, which is close to this pattern but applies only to agent self-knowledge, not to the shared KB.
- **Cross-references**: [The Session Floor](../the-session-floor.md), [Context Stigmergy Synthesis](../context-stigmergy-synthesis.md), [Obsidian Second Brain Patterns](../obsidian-second-brain-patterns.md)

---

## ★★★★ [2606.10423] WebChallenger: A Reliable and Efficient Generalist Web Agent

- **Source**: https://arxiv.org/abs/2606.10423
- **Categories**: cs.CL
- **Published**: 2026-06-09
- **Summary**: Argues agent capability gaps stem from architecture, not model scale. Introduces three mechanisms mirroring human cognitive advantages: (1) divide-and-conquer observation via PageMem (deterministic DOM representation as hierarchical semantic sections with summaries), (2) lightweight exploration-and-memory system (traverse once, build reusable map), (3) compound action workflows (collapse multi-step interactions into single actions). **Using off-the-shelf open-weight models without fine-tuning**: 56.3% WebArena, 48.7% VisualWebArena, 51.0% Online-Mind2Web, 70.9% WorkArena — approaching frontier proprietary systems at a fraction of cost.
- **Key finding**: The externalization is in the page representation. Raw HTML/screenshots are the LLM "internalizing" page understanding. PageMem externalizes it into a deterministic structure the LLM reads rather than interprets. The 3 mechanisms (selective attention, persistent memory, procedural fluency) are all architectural, not model-dependent — proven by open-weight models matching proprietary systems. This further supports the Contract Layer finding: harness quality > model quality.
- **Implication for us**: Our agents read files raw (full file contents in context). WebChallenger's PageMem pattern — pre-process raw data into hierarchical summaries, let the agent choose which sections to expand — could reduce our context waste. Instead of loading an entire 50KB knowledge file, the system could present topic headings with 1-line summaries and let the agent request expansion of relevant sections. The exploration-and-memory pattern (traverse once, build reusable map) parallels our INDEX.md structure but is more dynamic.
- **Cross-references**: [The Prompt Mass Problem](../the-prompt-mass-problem.md), [KE-1979 Orientation Waste](../../agents/scout/workspace/digest/today.md)

---

## ★★★★ [2606.19135] A Technical Taxonomy of LLM Agent Communication Protocols

- **Source**: https://arxiv.org/abs/2606.19135
- **Categories**: cs.MA, cs.AI, cs.NI
- **Published**: 2026-06-17
- **Summary**: Five-dimension taxonomy of 9 actively maintained open-source agent communication protocols: counterparty, payload, interaction state, discovery mechanism, and schema flexibility. Key findings: all sampled agent-to-agent protocols combine hybrid payloads with session-state persistence; most support multiple predefined schemas, two negotiate schemas at runtime (trend toward flexibility); decentralized discovery is rare. Short-term convergence toward protocols unifying agent-to-agent and agent-to-context (tool/data) communication. Long-term: **no single protocol maximizes versatility, efficiency, and portability simultaneously** — the field will evolve toward a federated, layered protocol stack.
- **Key finding**: The assumption that agent communication protocols will converge to a single standard (MCP or A2A "winning") is probably wrong. The 5-dimension taxonomy reveals that protocols make different tradeoffs across dimensions, and no single point in the design space dominates. The practical implication is that agents will need protocol negotiation capabilities — the ability to detect what protocol a counterparty speaks and adapt. The trend toward runtime schema negotiation (two protocols already do this) is the most forward-looking development.
- **Implication for us**: Our agent communication is ad-hoc — INBOX.md files, shared knowledge entries, and event-triggered workflows. The 5-dimension taxonomy provides a useful framework for evaluating our own protocol choices. We're strongest on interaction state (persistent session context) and weakest on discovery (agents discover each other through hardcoded paths) and schema flexibility (every message format is implicit). The "federated layered stack" prediction aligns with our mixed approach: different communication mechanisms for different purposes is likely correct rather than converging on a single protocol.
- **Cross-references**: [Agent Protocols MCP/A2A](../agent-protocols-mcp-a2a.md), [Multi-Agent Coordination](../multi-agent-coordination.md)

---

## ★★★ [2606.12835] The Internet of Agentic AI: Communication, Coordination, and Collective Intelligence at Scale

- **Source**: https://arxiv.org/abs/2606.12835
- **Categories**: cs.MA, cs.AI, cs.CY, cs.NI
- **Published**: 2026-06-11
- **Summary**: Comprehensive vision paper on an open ecosystem (IoAI) where heterogeneous agents discover each other, negotiate responsibilities, exchange context, invoke tools, and execute workflows across cloud, edge, device, organizational, and cyber-physical environments. Synthesizes foundations from single-agent AI, multi-agent systems, distributed computing, communication networks, game theory, and security engineering. Identifies six central research challenges: controlled emergence, semantic interoperability, secure identity, incentive-compatible coordination, resource-aware orchestration, and governance for large-scale agent networks.
- **Key finding**: The "controlled emergence" framing is the most relevant: when you have many agents interacting, the system-level behavior is emergent rather than designed. The challenge isn't building agents — it's governing emergent collective behavior. This is a mature framing of the Meta-Escalation Ratchet and Workflow Speciation Cascade: agents create new procedures, those procedures interact, and the interactions produce outcomes nobody designed.
- **Implication for us**: Primarily a theoretical framing paper, but the "controlled emergence" challenge is precisely our system's situation at small scale. Our agents create context updates, knowledge entries, and workflow modifications. These changes interact across sessions in ways that are emergent. The six challenges (emergence, interop, identity, incentives, resources, governance) provide a checklist for what our system needs to manage as it scales.
- **Cross-references**: [The Meta-Escalation Ratchet](../the-meta-escalation-ratchet.md), [The Workflow Speciation Cascade](../the-workflow-speciation-cascade.md), [Multi-Agent Coordination Trends](../multi-agent-coordination-trends.md)

---

## Cross-Triage Synthesis: The Three Layers of Agent Externalization

This triage completes a three-layer picture when read alongside prior triages:

| Layer | What's Externalized | Prior Triage | This Triage |
|-------|-------------------|-------------|-------------|
| **L1: Control Flow** | Routing, branching, coordination | Stochastic-Deterministic Inversion | — |
| **L2: Contracts** | Tool specs, harness config, eval criteria | The Contract Layer | — |
| **L3: Assumptions** | Beliefs about state, governance, safety, protocol compat | — | **The Externalization Turn** |

Each layer has a characteristic failure mode:
- **L1 failures**: wrong task gets routed, wrong branch taken (detectable by state mismatch)
- **L2 failures**: tool contract violated, evaluation criteria misapplied (detectable by contract checking)
- **L3 failures**: agent acts on wrong belief about what's true (undetectable by the agent itself — requires external falsification)

L3 is the hardest because the agent cannot know its own assumptions are wrong. SafeClawBench proves this: 84% of actual harms are invisible to the agent's own semantic assessment. Code-Augur's solution (externalize assumptions as assertions, falsify with fuzzer) is the most actionable pattern for L3 defense. AgenticRei's solution (externalize governance into deterministic logic) addresses the specific case where the assumption is about what rules apply.

**The cheapest intervention for our system**: Before each KE write, require the agent to externalize its key assumption ("I believe no KE covers this paper") as a checkable assertion (run a dedup grep), and record whether the assertion held. Over time, the rate of falsified assumptions becomes a calibration metric for agent epistemic reliability.
