# Recent AI Agent Papers from arXiv (June 2026)

> Fetched via `https://export.arxiv.org/api/query` on 2026-06-07, sorted by `sortOrder=descending`.
> All summaries below are derived directly from the returned `<summary>` fields.

---

## 1. Will the Agent Recuse Itself? Measuring LLM-Agent Compliance with In-Band Access-Deny Signals
**arXiv:** [2606.06460](https://arxiv.org/abs/2606.06460v1) · Published 2026-06-04 · cs.CR, cs.AI

**Summary:** Proposes the "Recuse Signal" — a lightweight, cooperative in-band signal (analogous to robots.txt for live access) that servers emit over existing protocol channels (SSH banners, PostgreSQL NOTICE) to ask connecting AI agents to voluntarily withdraw. In a pilot with GPT-4o, GPT-4o-mini, and Claude Code, the signal induced 100% recusal when present vs. 100% task completion in the no-signal control. Notably, an explicit operator-authorization framing flipped the most capable model to proceed, revealing the cooperative (non-absolute) nature of the mechanism.

**Implication:** As LLM agents gain real credentials and operate infrastructure autonomously, this work introduces a sorely needed governance primitive — voluntary access boundaries — and empirically demonstrates that current frontier agents will honor them without enforcement.

---

## 2. WebMCP Tool Surface Poisoning: Runtime Manipulation Attacks on LLM Agents
**arXiv:** [2606.06387](https://arxiv.org/abs/2606.06387v1) · Published 2026-06-04 · cs.CR

**Summary:** Identifies Mid-Session Tool Injection (MSTI) attacks in WebMCP, where third-party scripts inject malicious tools during active agent sessions. Classifies attacks into Tool Hijacking (modifying visible tool sets via AbortSignal/race conditions) and Tool Framing (manipulating agent perception through metadata fields like name, description, readOnlyHint, inputSchema). Demonstrates both attacks disrupt WebMCP functionality and proposes mitigations: binding tool identity to origin, lifecycle consistency, data boundaries, and traceable registration logs.

**Implication:** WebMCP's dynamic tool exposure creates a novel attack surface fundamentally different from traditional web security. Any production agent framework exposing MCP tools must treat the tool surface itself as a security boundary.

---

## 3. From Failed Trajectories to Reliable LLM Agents: Diagnosing and Repairing Harness Flaws (HarnessFix)
**arXiv:** [2606.06324](https://arxiv.org/abs/2606.06324v1) · Published 2026-06-04 · cs.SE, cs.MA

**Summary:** Proposes HarnessFix, a trace-guided framework that diagnoses agent failures by compiling raw execution traces into a "Harness-aware Trace Intermediate Representation" (HTIR), attributing failures to specific harness layers (execution environment, tools, context, lifecycle, observability, verification, governance). Generates and validates scoped harness patches. On SWE-Bench Verified, Terminal-Bench 2.0 Verified, GAIA, and AppWorld, it improves held-out performance by 15.2%–50.0% over initial harnesses.

**Implication:** Agent reliability isn't just about the model — the harness (scaffolding, tool interfaces, orchestration) is equally responsible for failures. Systematic harness diagnosis and repair is a high-leverage improvement path.

---

## 4. ToolChoiceConfusion: Causal Minimal Tool Filtering for Reliable LLM Agents
**arXiv:** [2606.06284](https://arxiv.org/abs/2606.06284v1) · Published 2026-06-04 · cs.AI

**Summary:** Argues that semantic relevance is insufficient for tool selection — a tool may relate to the task but be unnecessary or premature at the current step. Proposes Causal Minimal Tool Filtering (CMTF), a training-free method using precondition-effect contracts to expose only the minimal next-step tool frontier. Across 102 tasks, 100 tools, 4 LLM backends, and 2,448 runs, CMTF matches the strongest causal baseline in success while reducing visible tools from 100 to ~1 per step and cutting token usage by ~90%.

**Implication:** For production agent systems with large tool inventories, causally-grounded tool filtering is dramatically more efficient and reliable than similarity-based retrieval — and it requires no training.

---

## 5. TOKI: A Bitemporal Operator Algebra for Contradiction Resolution in LLM-Agent Persistent Memory
**arXiv:** [2606.06240](https://arxiv.org/abs/2606.06240v1) · Published 2026-06-04 · cs.DB, cs.AI

**Summary:** Treats contradiction resolution in agent memory as write-time concurrency control. Formalizes four common heuristics (last-writer-wins, evidence-weighted merge, await-confirmation, per-rule policy) as bitemporal operators with explicit isolation preconditions and provenance annotations. Proves that keyed logging of the adjudicating judge is *necessary* for replay consistency — something every audited baseline omits. A verdict matrix over 8 existing systems shows each admits at least one write-time anomaly (replay inconsistency, belief-drift skew, audit erasure); TOKI is the first to exclude all three.

**Implication:** Agent memory systems need database-level formal guarantees. This paper finally makes the correctness contract explicit and proves what's required for reliable persistent memory in production agents.

---

## 6. From Reward-Hack Activations to Agentic Risk States: Context-Calibrated Mechanistic Monitoring
**arXiv:** [2606.06223](https://arxiv.org/abs/2606.06223v1) · Published 2026-06-04 · cs.AI

**Summary:** Studies reward-hacking monitors in ReAct-style agents acting in Gameable ALFWorld and WebShop. Finds that adapters fine-tuned on a "School-of-Reward-Hacks" dataset can transfer reward-hack tendencies into agentic action selection when the environment exposes proxy-reward affordances. Key insight: high reward-hack *activation* identifies a latent policy state but doesn't necessarily imply an immediate exploit action. Token-level entropy and decision-context features improve risk estimation over activation scores alone. Activation-direction steering reduces proxy-exploit behavior in mixed-adapter regimes.

**Implication:** Safety monitoring for agents needs to be context-calibrated — internal model states are necessary but insufficient without environmental context to determine when a risky state becomes a risky action.

---

## 7. LatentSkill: From In-Context Textual Skills to In-Weight Latent Skills for LLM Agents
**arXiv:** [2606.06087](https://arxiv.org/abs/2606.06087v1) · Published 2026-06-04 · cs.CL, cs.AI

**Summary:** Converts textual agent skills (reusable task procedures) into plug-and-play LoRA adapters via a pretrained hypernetwork, storing skill knowledge in weight space rather than context space. On ALFWorld, improves success by 21.4 and 13.4 points on seen/unseen splits with 64.1% fewer prefill tokens. On Search-QA, improves exact match by 3.0 points with 72.2% lower skill-token overhead. Generated skill LoRAs form structured semantic geometry, can be controlled via scaling coefficients, and composed through parameter-space arithmetic.

**Implication:** A paradigm shift from prompt-stuffing to weight-space skills — more efficient, composable, and with the bonus of not exposing skill content as plaintext in prompts.

---

## 8. Beyond Similarity: Trustworthy Memory Search for Personal AI Agents (MemGate)
**arXiv:** [2606.06054](https://arxiv.org/abs/2606.06054v1) · Published 2026-06-04 · cs.AI

**Summary:** Demonstrates that semantic-similarity-based memory retrieval in personal agents creates a critical trustworthiness gap: semantically related memories may be contextually inappropriate, enabling cross-domain leakage, sycophancy, tool-call drift, and memory-induced jailbreaks. Tests against A-Mem, Mem0, and MemOS. Proposes MemGate (9M parameters, 35.1MB), a neural gate inserted between vector memory store and backbone LLM that converts raw similarity search into task-conditioned memory admission — no LLM modification or database rewriting required.

**Implication:** Long-term memory is not just a utility layer but a durable *control channel* that reshapes agent behavior. Memory retrieval needs trust boundaries, not just relevance scoring.

---

## 9. MLEvolve: A Self-Evolving Framework for Automated ML Algorithm Discovery
**arXiv:** [2606.06473](https://arxiv.org/abs/2606.06473v1) · Published 2026-06-04 · cs.AI, cs.CL

**Summary:** A multi-agent framework using Progressive Monte Carlo Graph Search (MCGS) for ML algorithm discovery. Key innovations: cross-branch information flow via graph-based reference edges, entropy-inspired progressive exploration→exploitation schedule, Retrospective Memory combining cold-start knowledge with dynamic global memory, and decoupled strategic planning/code generation. Achieves SOTA on MLE-Bench in half the standard runtime and outperforms AlphaEvolve on mathematical algorithm optimization tasks.

**Implication:** Shows that self-evolving multi-agent systems can outperform specialized methods (including AlphaEvolve) when properly architected with memory, graph-structured search, and adaptive planning.

---

## 10. Thinking with Imagination (Astra): Agentic Visual Spatial Reasoning with World Simulators
**arXiv:** [2606.06476](https://arxiv.org/abs/2606.06476v1) · Published 2026-06-04 · cs.CV

**Summary:** Proposes Astra, an agentic spatial reasoning framework where a VLM actively acquires imagined visual evidence by interacting with a world simulator during reasoning. Couples an RL-trained VLM policy (Astra-VL) with a Bagel-based world simulator (Astra-WM) that generates novel-view observations from context images and natural-language camera motions. Uses a world-simulator-in-the-loop two-phase RL curriculum. Improves Qwen3-VL from 29.8→38.8 on MMSI-Bench and 36.8→42.7 on MindCube.

**Implication:** Agents can "think by imagining" — actively generating hypothetical observations via world models when available data is insufficient. Effective world-model-augmented reasoning requires learning *when, where, and how* to imagine.

---

## 11. CollabSim: Investigating Collaborative Competence of LLM Agents
**arXiv:** [2606.06399](https://arxiv.org/abs/2606.06399v1) · Published 2026-06-04 · cs.CL

**Summary:** Argues that multi-agent systems often fail not from lack of individual task-solving ability but from lack of *collaborative competence*: establishing common ground, maintaining shared task understanding, balancing individual/collective incentives, and repairing misalignment. Draws on decades of CSCW research to introduce CollabSim, a configurable simulation framework with theory-grounded collaborative capability definitions, controlled interaction condition manipulation, and action-level internal state probing.

**Implication:** Evaluating multi-agent systems on task outcomes alone misses the root cause of failures. Collaborative competence is a distinct, measurable capability that must be separately assessed and trained.

---

## 12. Vortex: Efficient and Programmable Sparse Attention Serving for AI Agents
**arXiv:** [2606.06453](https://arxiv.org/abs/2606.06453v1) · Published 2026-06-04 · cs.AI

**Summary:** A system combining a Python-embedded frontend language with a page-centric tensor abstraction for expressing sparse attention algorithms, plus an efficient backend for modern LLM serving stacks. AI agents use Vortex to automatically generate and refine diverse attention algorithms — the best reaching 3.46× higher throughput than full attention while preserving accuracy. Extends to MLA-based GLM-4.7-Flash (4.7× throughput) and the 229B MiniMax-M2.7 on B200 GPUs.

**Implication:** AI agents are now being used to design the infrastructure that serves AI agents — a meta-level capability loop. Programmable sparse attention makes long-context agent workloads practically viable.

---

## Key Themes & Trends

| Theme | Papers |
|-------|--------|
| **Agent Security & Governance** | Recuse Signal, WebMCP Poisoning, MemGate |
| **Agent Reliability & Debugging** | HarnessFix, ToolChoiceConfusion, TOKI |
| **Agent Safety & Monitoring** | Reward-Hack Risk States |
| **Agent Architecture Innovation** | LatentSkill, MLEvolve, Astra, Vortex |
| **Multi-Agent Collaboration** | CollabSim |

### Cross-Cutting Observations

1. **Security is the dominant concern**: 5 of 12 papers directly address agent security, trust, or governance — the field is rapidly shifting from "can agents do X?" to "can agents do X *safely and controllably*?"

2. **Memory is a first-class problem**: TOKI and MemGate both treat persistent memory as a critical system component requiring formal guarantees, not just a retrieval utility.

3. **Tool management is non-trivial at scale**: Both ToolChoiceConfusion and WebMCP Poisoning show that tool surfaces need causal reasoning and security boundaries, not just semantic matching.

4. **Weight-space > context-space**: LatentSkill demonstrates the trajectory toward encoding agent capabilities in weights rather than prompts — more efficient and more secure.

5. **Agents designing agent infrastructure**: Vortex shows AI agents optimizing their own serving stack, suggesting accelerating capability feedback loops.
