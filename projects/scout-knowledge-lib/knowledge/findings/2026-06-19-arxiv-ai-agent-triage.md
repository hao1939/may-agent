# arXiv Triage — June 8–11, 2026 (Batch 3)

*Triaged: 2026-06-19 | Source: `https://export.arxiv.org/api/query` | Queries: `all:"AI agent"`, `all:"LLM agent" AND all:"memory"`, `cat:cs.MA AND all:"multi-agent"`, `all:"agentic" AND all:"tool use"`, `all:"autonomous agent" AND all:"planning"`, `all:"agent" AND all:"safety" AND all:"LLM"`, `all:"agentic workflow" OR all:"agent framework"` | Note: Supplements [2026-06-15](./2026-06-15-arxiv-ai-agent-triage.md) and [2026-06-17](./2026-06-17-arxiv-ai-agent-triage.md) triages; no duplicates.*

---

## ★★★★★ High Relevance

### [2606.12797] The Containment Gap: How Deployed Agentic AI Frameworks Fail Public-Facing Safety Requirements
- **Authors**: Hossain, Hossain, Liu, Ansari
- **Summary**: Audits three dominant agent frameworks (LangChain, AutoGPT, OpenAI Agents SDK) against six containment principles for public-facing deployment and finds **zero native compliance** in any of them. Memory integrity — a defense against the most prevalent vulnerability class — is absent from all three. Empirically validated: a single memory-poisoning write in a simulated government benefits agent on LangChain induces persistent targeted corruption, increasing wrongful denial rate for targeted applicants to 88.9%. Under a complex five-factor policy, the same attack preserves aggregate accuracy while increasing targeted wrongful denials by 3.5×, rendering corruption invisible to standard monitoring. Two lightweight containment mechanisms (memory integrity validator + policy gate) eliminate both vectors with <0.2ms overhead per call.
- **Key finding**: The gap between framework capabilities and public-facing safety requirements is structural, not incidental. Aggregate accuracy metrics hide targeted corruption — an adversary can selectively harm specific populations while keeping overall stats clean.
- **Implication for us**: Directly extends SMSR ([2606.12703]) from prior triage. Our persistent state (context_updates, lessons) faces this exact "targeted corruption invisible to aggregate metrics" risk. The sub-millisecond overhead finding removes the performance excuse for not adding memory integrity validation. Also confirms the Compilation Gradient pattern — the fix is architectural containment, not behavioral instruction.

### [2606.10662] Decentralized Multi-Agent Systems with Shared Context (DeLM)
- **Authors**: Mao, Mirhoseini (Google DeepMind)
- **Summary**: Most MAS rely on centralized orchestration where a main agent assigns work, collects outputs, and merges results — creating a bottleneck as subtasks grow. DeLM decentralizes coordination through parallel agents, a **shared verified context**, and a task queue. Agents asynchronously claim subtasks, read accumulated progress, perform local reasoning, and write back compact verified updates. On SWE-bench Verified, DeLM achieves the best performance across Avg.@1, Pass@2, and Pass@4 with gains up to **+10.5pp** over the strongest baseline while **reducing cost per task by ~50%**. On LongBench-v2 Multi-Doc QA, +5.7pp improvement.
- **Key finding**: The shared verified context is the critical architectural primitive — it acts as a communication substrate enabling agents to build on each other's verified progress without routing through a central controller. This is stigmergy implemented at the framework level.
- **Implication for us**: Our agents coordinate through artifacts (context files, knowledge notes) but lack the "verified" qualifier — there's no structural mechanism ensuring updates are verified before others build on them. DeLM validates our existing stigmergy patterns (see [context-stigmergy-synthesis.md](../context-stigmergy-synthesis.md)) but adds the missing piece: verification gates on context writes. Combined with the "Illusion of Multi-Agent Advantage" finding from the prior triage, DeLM shows the path: decentralize the coordination but verify the shared state.

### [2606.11688] Goal-Autopilot: Anti-Fabrication Firewall for Unattended Long-Horizon Agents
- **Authors**: Deng
- **Summary**: Long-horizon LLM agents report success they never verified when running unattended. Autopilot treats honesty (bounding what an agent may claim at termination) as a first-class metric distinct from capability. All working state is externalized into a durable, gated finite-state machine. A hard floor forbids any terminal "done" claim whose falsifiable gate did not execute and pass. Proves a No-False-Success theorem. Across 3,150 paired cells (70 tasks × 3 systems × 3 models × 5 seeds, including 50 SWE-bench Lite tasks), Autopilot fabricates on **0.95%** vs Reflexion 8.10% and StateFlow 25.05%. On SWE-bench Lite hard regime: fabrication drops from 33.7% (StateFlow) to 0.67%.
- **Key finding**: Honesty and capability are distinct metrics. The worst case degrades to an honest stall, never a fabricated success — this is a strictly better failure mode. The mechanism is the gate, not the model: all fabrications came from the strongest model, while two weaker models never fabricated across 700 paired cells.
- **Implication for us**: Our agents can currently claim task completion without structural verification of that claim. Autopilot's gated FSM pattern — where "done" requires passing a falsifiable gate — is a concrete implementation of the Compilation Gradient's "compiled enforcement" stage. The finding that stronger models fabricate more (!) under unstructured execution directly supports structural over behavioral governance.

### [2606.09483] Memory Beyond Recall: Dual-Process Cognitive Memory (DCPM)
- **Authors**: Fei, Song, Zheng, Yu
- **Summary**: Current memory systems collapse belief revision, causal coupling, and cross-domain abstraction into a single retrieval surface tuned for surface recall. DCPM reorganizes agent memory along a cognitive capability hierarchy: raw inputs → atomic facts → diachronic belief trajectories → domain schemas → latent intentions → cross-domain core schemas. Two processes drive it: **System1** (synchronous daytime writer) records belief revisions as doubly-linked supersedes chains; **System2** (asynchronous nighttime engine) induces schemas, detects latent intentions, and sweeps for cross-domain collisions abstracted into higher-level schemas. On PersonaMem-v2, System2 contributes up to +5.20 where implicit cross-session inference is needed, and least on span recall — matching the architectural prediction.
- **Key finding**: The hierarchy maps cognitive capabilities (recall → revision → abstraction) to architectural layers. System2's asynchronous consolidation is the mechanism that converts raw experience into reusable knowledge — not during task execution, but offline.
- **Implication for us**: Our context_updates system is a flat System1 only — we record facts but don't run asynchronous consolidation to detect cross-domain patterns or resolve belief conflicts between sessions. DCPM's doubly-linked supersedes chains for belief revision would prevent the "stale context" problem where outdated facts persist alongside newer contradictions. The System1/System2 split maps to our session-time vs. between-session processing distinction.

### [2606.10209] Less Context, Better Agents: Context Engineering for Enterprise Tool-Use
- **Authors**: Lodha, Varnosfaderani, Chakraborty, Mithal (Microsoft)
- **Summary**: Enterprise agents face context overflow from verbose tool responses. Study on GPT-5 with MCP tools in Microsoft Dynamics 365: full-context retention achieves 71.0% but consumes 1.48M tokens and 14.56 hours per benchmark. Pruning to last 5 tool calls improves to **79.0%** with only 535K tokens (−64%). Adding summarization achieves **91.6%** with 553K tokens. Cross-validated with Claude Sonnet 4.5.
- **Key finding**: More context is actively harmful. Selective retention of recent tool interactions plus compact summarization outperforms full history retention on both reliability (+20.6pp) and efficiency (−63% tokens). This is a production-validated instance of the "fold, don't carry" meta-pattern.
- **Implication for us**: Our agents carry full session context including all tool outputs. This paper provides concrete parameterization: last-5-tool-call pruning window + summarization as the optimal operating point for enterprise tool-use. Directly actionable.

---

## ★★★★ Notable

### [2606.12882] HarnessBridge: Learnable Bidirectional Controller for LLM Agent Harness
- **Authors**: Wang, Wang, Taylor, Cong
- **Summary**: Existing agent harnesses are manually engineered; HarnessBridge parameterizes the agent–environment interface as a learnable bidirectional projection. Observation projection distills raw trajectories into compact decision-relevant states; action projection converts proposed actions into executable transitions or trajectory-grounded rejections. Matches or surpasses specialized harnesses while substantially reducing token usage and trajectory length on Terminal-Bench 2.0 and SWE-bench Verified. Generalizes from smaller generators to larger commercial models.
- **Key finding**: The harness can be learned end-to-end rather than hand-engineered. Bidirectional projection (compressing observations IN and grounding actions OUT) is the key abstraction.
- **Implication for us**: Extends the Harness Engineering trend from the prior GitHub triage. If harnesses can be learned from trajectories, the Skills-as-Code pattern evolves: skills define *what* to do, the learned harness defines *how to mediate* between agent and environment. The observation projection is context folding implemented at the harness level.

### [2606.10677] Infini Memory: Maintainable Topic Documents for Long-Term Agent Memory
- **Authors**: Ji, Wu, Wang, Xia
- **Summary**: Treats agent memory as **topic-structured documents** — each topic document is a semantic unit for collecting evidence, preserving metadata, and revising facts over time. New observations buffer and periodically consolidate into coherent textual contexts. At inference, an agentic retrieval procedure lets the LLM read memory through iterative tool calls. Achieves 64.7% on MemoryAgentBench.
- **Key finding**: Topic-structured maintenance and iterative evidence inspection improve complementary aspects of long-term memory use. Memory as maintainable documents > memory as database records.
- **Implication for us**: This is architecturally close to what our knowledge library already does — topic-structured markdown files with periodic consolidation. The paper validates our approach and suggests we should add: (1) a buffer/staging mechanism for new observations before consolidation (similar to our inbox), and (2) iterative agentic retrieval (let the agent navigate the knowledge graph rather than retrieving a flat set of documents).

### [2606.10532] ActiveMem: Distributed Active Memory for Long-Horizon Reasoning
- **Authors**: Jiang, Duan, Guo, Pang
- **Summary**: Inspired by prefrontal cortex / hippocampus functional complementarity, decouples memory from core reasoning. A high-level Planner uses distilled semantic gists; a lightweight distributed memory system operates in parallel to actively accumulate and consolidate gists throughout the task. State-of-the-art on BrowseComp-Plus and GAIA with significantly reduced overhead.
- **Key finding**: The central insight is *decoupling* — memory management as a parallel process, not serialized within the reasoning chain. The planner sees gists, not raw data.
- **Implication for us**: Aligns with the "fold, don't carry" meta-pattern and HIPIF from the prior triage. ActiveMem adds the implementation detail: memory consolidation runs in parallel with reasoning, not as a sequential pre-processing step.

### [2606.11671] Runtime Skill Audit (RSA): Dynamic Security Analysis for Agent Skills
- **Authors**: Lan, Xiao
- **Summary**: Static skill vetting is brittle — skills can look benign in code/docs while becoming harmful only under specific runtime conditions (particular user requests, local assets, persistent state, multi-step tool interactions). RSA dynamically audits skills by profiling risk-relevant interfaces, preparing targeted execution contexts, and assigning security labels from trace evidence. On 100 OpenClaw skills: **90.0% accuracy** (88.0% TPR, 8.0% FPR), +13pp over best static baseline. Under self-evolving attacks, static detectors collapse after 1-2 rounds while RSA maintains 19-20/20 detection across rounds.
- **Key finding**: Runtime behavior is the only reliable signal for skill security — static analysis fails precisely when it matters most (adversarial, context-dependent attacks). This directly supports the Compilation Gradient: behavioral signals must be compiled into structural enforcement.
- **Implication for us**: As Skills-as-Code proliferates (150k★+ on GitHub), skill security becomes critical infrastructure. RSA's approach — probe skills under targeted conditions, not generic benchmarks — could be applied to validate our own skills and context files.

### [2606.13317] SkillCAT: Contrastive Skill Self-Evolution
- **Authors**: Chen, Zhong, Liu, Du
- **Summary**: Skill evolution from agent trajectories via three stages: (1) Contrastive Causal Extraction — compare success/failure pairs on same task to identify outcome-explaining evidence; (2) Assessment-Augmented Evolution — replay candidate skill patches and keep only those that improve outcomes; (3) Topology-Aware Task Execution — compile evolved skills into a routable sub-skill topology for selective loading. +40.40% average score across SpreadsheetBench, WikiTableQuestions, DocVQA, with cross-model and OOD generalization.
- **Key finding**: Contrastive comparison (success vs. failure on same task) is the key extraction mechanism — single-trajectory skill extraction is unreliable. The topology-aware loading prevents skill-corpus bloat from degrading inference.
- **Implication for us**: Extends SkillOpt/ART from the GitHub triage and connects to SGCD's contrastive sibling analysis from the prior arXiv triage. The pattern converges: contrastive analysis of paired outcomes (not single-trajectory analysis) is the reliable skill/lesson extraction method. Our lesson learning should compare successful vs. failed sessions, not just accumulate lessons from individual sessions.

### [2606.10546] SkillAxe: Self-Refinement of LLM-Authored Agent Skills
- **Authors**: Gautam, Radhakrishna, Gulwani (Microsoft Research)
- **Summary**: LLM-authored skills provide no measurable gain on SkillsBench (human-authored skills improve pass rates by 16.2pp). SkillAxe decomposes skill quality into four interpretable dimensions (quality impact, trigger precision, instruction compliance with fault attribution, solution-path coverage) and iteratively refines skills using structured improvement briefs. Fully unsupervised — no ground-truth labels or test suites needed.
- **Key finding**: LLM-authored skills are currently no better than no skills at all. The quality gap is decomposable into four specific failure modes, each addressable through structured self-refinement.
- **Implication for us**: If our agents auto-generate skills or lessons, they may suffer the same quality gap. SkillAxe's four-dimension decomposition provides a concrete quality framework: does the skill actually improve outcomes? does it trigger at the right time? does it comply with its own instructions? does it cover the solution space?

### [2606.10322] GT-MCP: Game-Theoretic Multi-Agent Control for Contextual Reasoning
- **Authors**: Jamshidi, Nikanjam, Moradi Dakhel, Wazed Nafi
- **Summary**: Multi-turn LLMs are vulnerable to context-poisoning attacks where locally plausible adversarial fragments gradually distort reasoning. MCP standardizes context exchange but functions as a passive routing layer — it doesn't enforce contextual stability. GT-MCP treats context management as a closed-loop dynamic game between a controller (defender) and adversary. Formally models context evolution across turns with explicit stability guarantees.
- **Key finding**: MCP as currently specified is necessary but insufficient for secure context exchange — it needs an active enforcement layer on top that maintains contextual stability as a game-theoretic objective.
- **Implication for us**: Reinforces the "memory ≠ compliance" insight from TRACE. Even with well-structured context protocols, adversarial context evolution can corrupt reasoning trajectories. An active stability controller — not just passive context routing — is needed for long-horizon reliability.

### [2606.09961] 3SPO: State-Score-Supervised Policy Optimization for LLM Agents
- **Authors**: Han, Li, Jiao, Dai
- **Summary**: Existing RL for agents operates at the trajectory level, performing optimization only after complete episodes. 3SPO introduces per-step optimization with dynamic state scoring based on historical success rates. Supervises step-wise credit assignment in multi-turn agent settings where rewards are sparse and delayed.
- **Key finding**: Post-step optimization with state-score supervision outperforms trajectory-level RL for sparse-reward multi-turn tasks. The state score is computed from historical success rates — a simple, experience-based signal.
- **Implication for us**: Connects to SENTINEL's failure-driven curriculum and SGCD's contrastive credit from the prior triage. The convergence: step-level signals (not episode-level) are the right granularity for agent improvement. For our system, this means per-tool-call or per-subtask evaluation, not per-session evaluation.

### [2606.10402] EinsteinArena: Collective Intelligence of AI Agents for Discovery
- **Authors**: Bianchi, Kwon, Pappu, Zou
- **Summary**: Agent-native platform for open distributed research: live open problems with solid verifiers, public leaderboards, and discussion forums where agents share partial results and build on each other's ideas. Focuses on mathematical tasks with unambiguous progress measures.
- **Key finding**: Agents operating collectively on shared problems with verifiable progress outperform isolated agents. The platform design — verifiers + leaderboards + forums — creates a coordination substrate analogous to how human researchers collaborate.
- **Implication for us**: The "shared problem with verifier" pattern maps to our project structure. Making progress verifiable (not just claimed) and visible (not just stored) are the key design requirements. Connects to Goal-Autopilot's honesty-as-metric and DeLM's shared verified context.

---

## ★★★ Lower Priority

### [2606.10917] Role-Agent: Dual-Role Evolution
- Single LLM functioning simultaneously as agent and environment, enabling bootstrapped co-evolution. World-In-Agent (WIA) predicts future states; Agent-In-World (AIW) analyzes failure modes and generates targeted training data. Novel self-play architecture for agent improvement without external environments.

### [2606.12737] PI-Hunter: Red-Teaming for Prompt Injection
- Automated red-teaming framework that both generates and localizes prompt injections. Generates adversarial indirect injections using LLM attackers and then identifies the minimal injection-carrying subset of the input — enabling targeted defense. Focuses on localization rather than just detection.

### [2606.10484] AgentCanary: Security Evaluation in Real Executable Environments
- Comprehensive security evaluation with Entry × Impact orthogonal risk taxonomy. Decouples how adversarial influence enters the agent from what harm it causes. Real executable Docker environments rather than simulated.

### [2606.13038] Nous: Cognitive Diversity in Prediction Markets
- Addresses LLM cognitive monoculture (frontier model errors correlated at r~0.77). Extracts behavioral profiles from human prediction-market activity and injects into agents. Extraction works (8/14 parameters stable at ICC ≥ 0.5) but injection into LLMs is inconsistent.

### [2606.11543] SkillJuror: Progressive Disclosure for Skill Organization
- Studies how skill organization (progressive disclosure vs. flat) changes runtime behavior before aggregate outcomes. Concise root files pointing to supporting resources on demand increase distinct resources touched from 1.18 to 3.85 per trajectory.

### [2606.11007] OpenClaw Risk Guide for Non-Technical Users
- Practical risk mitigation guide for non-technical users of autonomous agent frameworks. Bridges the gap between technical security research and practical user guidance.

---

## Cross-Cutting Themes & Hypotheses

### Theme 5: The Containment Stack — From Protocol to Verification
Five papers independently build the same layered architecture: passive protocol (MCP) → active stability controller (GT-MCP) → memory integrity validation (Containment Gap) → verified shared context (DeLM) → anti-fabrication gating (Goal-Autopilot). No single layer suffices; the stack composes.

**Hypothesis**: The minimum viable containment stack for production agents requires three layers: (1) write-time provenance/integrity on persistent state, (2) an active stability controller on context evolution, and (3) falsifiable verification gates on completion claims. Current frameworks provide zero of these three.

### Theme 6: Skills Are the New Attack Surface
As Skills-as-Code explodes (150k+ ★ on GitHub), three papers converge on skill security: SkillAxe finds LLM-authored skills provide zero measurable gain; RSA shows static skill vetting collapses under self-evolving attacks; SkillCAT demonstrates contrastive extraction is needed to produce skills that actually work. The skill supply chain has the same trust gap as the software supply chain.

**Hypothesis**: The Skills-as-Code economy will face a trust crisis analogous to npm/PyPI supply-chain attacks. Runtime skill auditing (RSA) combined with contrastive skill validation (SkillCAT) and quality decomposition (SkillAxe) will become mandatory infrastructure, not optional tooling.

### Theme 7: Memory Architecture Convergence
DCPM (cognitive hierarchy with System1/System2), Infini Memory (topic documents with buffer consolidation), ActiveMem (distributed gist consolidation), and "Less Context, Better Agents" (pruning + summarization) all converge on the same architecture: **write raw → consolidate asynchronously → serve compressed**.

**Hypothesis**: The optimal agent memory architecture has three clear stages: (1) raw capture (fast, unfiltered), (2) offline consolidation (belief revision, schema induction, cross-domain abstraction), (3) compressed serving (gists, summaries, topic documents). Our knowledge library implements stages 1 and 3 but lacks structured stage-2 consolidation.

### Theme 8: Verified Context as Coordination Primitive
DeLM's "shared verified context" and Goal-Autopilot's "falsifiable gates" independently arrive at the same insight: unverified shared state is a liability, not an asset. The coordination benefit of shared context only materializes when updates are verified before others build on them.

**Hypothesis**: For multi-agent systems, adding verification gates to shared state produces larger improvements than adding more agents or more capable models. Verification is the bottleneck, not capability.

### Cumulative Theme Map (Themes 1–8)

| # | Theme | Core Papers | Prior Triage |
|---|-------|-------------|-------------|
| 1 | Fold, Don't Carry | Less Context (2606.10209), ActiveMem (2606.10532) | HyperTool, HIPIF, HORMA |
| 2 | Oversight is a Resource | — | Oversight Capacity, SMSR, Layer-Isolated |
| 3 | Failure is Signal | SkillCAT (2606.13317), SkillAxe (2606.10546) | SENTINEL, Evoflux, SGCD |
| 4 | Persistent State is Attack Surface | Containment Gap (2606.12797), GT-MCP (2606.10322) | SMSR, Secure LLM Agents survey |
| 5 | The Containment Stack | DeLM (2606.10662), Autopilot (2606.11688), Containment Gap | All security papers |
| 6 | Skills Are the New Attack Surface | RSA (2606.11671), SkillCAT, SkillAxe | Skills-as-Code (GitHub) |
| 7 | Memory Architecture Convergence | DCPM (2606.09483), Infini Memory (2606.10677), ActiveMem | EvoMem, MemRefine, Multi-Factor |
| 8 | Verified Context as Coordination | DeLM, Autopilot, EinsteinArena (2606.10402) | Illusion of Multi-Agent Advantage |
