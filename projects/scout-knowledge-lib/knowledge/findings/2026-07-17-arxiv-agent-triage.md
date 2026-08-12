<ai_context>
summary: "Triage of 10 arXiv papers (July 9–15, 2026). Four convergent themes: adaptive agent memory (learned memory management, experience graphs, prospective memory benchmarks, KV-cache region awareness), self-improving evaluation loops (co-evolving metrics and skills, critic experience banks), isolation-first safety (distributed backdoors in MAS, safety routing beyond binary, isolation as first-class principle), and inference-efficient planning (graph-augmented tree search eliminating LLM calls)."
triggers: ["arXiv triage", "agent memory", "adaptive memory", "prospective memory", "experience graph", "self-improving evaluation", "co-evolving metrics", "critic confidence", "distributed backdoors", "isolation safety", "agent planning", "tree search", "KV cache"]
last_updated: "2026-07-17"
source_basis: "arXiv API queries: all:'LLM agent' AND all:'planning', all:'LLM agent' AND all:'memory', all:'agent' AND all:'safety' AND all:'LLM' (July 9-15, 2026 papers, deduplicated against prior triages)"
</ai_context>

# arXiv Triage — July 9–15, 2026

*Triaged: 2026-07-17 | Source: `https://export.arxiv.org/api/query` | Queries: `all:"LLM agent" AND all:"planning"`, `all:"LLM agent" AND all:"memory"`, `all:"agent" AND all:"safety" AND all:"LLM"` | Note: Supplements [2026-06-16](./2026-06-16-arxiv-ai-agent-triage.md) and all prior triages; no duplicates.*

---

## ★★★★★ High Relevance

### [2607.13591] Memory as a Controlled Process: Learned Adaptive Memory Management for LLM Agents
- **Source**: https://arxiv.org/abs/2607.13591
- **Published**: 2026-07-15
- **Summary**: Argues that fixed memory heuristics (graph-structured, reflective stores, nearest-neighbor retrieval) are the core bottleneck for agentic learning. Proposes *learned* memory management where retrieval/storage strategies adapt based on task phase and goal type — early tasks benefit from minimal retrieval (sparse memory), recurring goals benefit from plan reuse rather than generic lookup.
- **Key finding**: Memory behavior is **fundamentally context-dependent**. Static memory access patterns are always suboptimal because the optimal strategy changes with task phase, memory density, and goal recurrence.
- **Implication for us**: Directly challenges our current context-file approach where memory access is uniform (load all relevant context). Suggests that memory retrieval should be *phase-aware*: early in a session load less, later load more targeted content. Connects to The Prompt-Mass Problem — adaptive memory management is one solution to unbounded context growth.

### [2607.12406] Isolation as a First-Class Principle for LLM-Agent System Safety
- **Source**: https://arxiv.org/abs/2607.12406
- **Published**: 2026-07-14
- **Summary**: Survey treating **isolation** as the unifying structural principle explaining why prompt injection, tool misuse, and memory poisoning share the same root cause and propagation pattern. Argues safety isn't just input-output alignment but system behavior and real-world execution outcomes.
- **Key finding**: Failures like prompt injection, tool misuse, and memory poisoning share a **structural cause**: insufficient isolation between trust domains. When you understand the agent as a system (not a model), isolation boundaries become the primary safety mechanism.
- **Implication for us**: Validates the architectural intuition behind separating agent workspaces, using guards between layers, and treating tool access as a capability that must be explicitly granted. The "isolation as first-class principle" framing unifies several of our safety patterns (file-scoped writes, approval gates, workspace separation) under one coherent theory. Extends the Guardrail DoS finding from June — guards themselves need isolation from the payloads they inspect.

### [2607.11751] When Local Monitors Miss Compositional Harm: Distributed Backdoors in Multi-Agent Systems
- **Source**: https://arxiv.org/abs/2607.11751
- **Published**: 2026-07-13
- **Summary**: Demonstrates that per-step/per-agent monitoring has a **fundamental hole**: a distributed backdoor splits harmful payloads across agents so every local check passes while the assembled result is the attack. The key insight is "local benignness" — no fragment carries the harm individually.
- **Key finding**: The attack class is **compositional harm**: harm that emerges only from assembly, invisible to any local monitor. This is not a monitoring failure — it's a fundamental limitation of local safety checks.
- **Implication for us**: Critical for multi-agent architectures. Our per-agent guards check individual actions but don't reason about cross-agent assembly. A malicious or corrupted context file passed between agents could carry benign fragments that compose into something harmful. This suggests we need *assembly-point monitoring* — checking the composed output at integration boundaries, not just individual steps. Extends the "seams between components" insight from the June fail-plausible paper.

### [2607.12790] Who Grades the Grader? Co-Evolving Evaluation Metrics and Skills
- **Source**: https://arxiv.org/abs/2607.12790
- **Published**: 2026-07-14
- **Summary**: Self-evolving agent systems assume reliable evaluation metrics already exist. This paper makes metrics themselves *evolvable*: a metric loop searches compositions of small "drawback detectors" under an evolutionary lifecycle, trained against a 10-item anchored reference set, yielding transparent and inspectable metrics.
- **Key finding**: The evaluation metric is not fixed infrastructure — it's a **co-evolving artifact** that must improve alongside the skills it evaluates. Static metrics degrade as agent capabilities change.
- **Implication for us**: Directly extends The Evaluation Mirage. Our evaluators produce scores but the scoring criteria are fixed. As agents improve, the metrics need to evolve with them. The "anchored reference set" (10 items) approach is practical — a small curated set of known-good/known-bad examples grounds metric evolution without requiring large labeled datasets. Connects to the lesson system: as lessons accumulate, what counts as "good" agent behavior changes.

---

## ★★★★ Notable

### [2607.13884] Experience Memory Graph: One-Shot Error Correction for Agents
- **Source**: https://arxiv.org/abs/2607.13884
- **Published**: 2026-07-15
- **Summary**: Proposes graph-structured experience memory enabling one-shot error correction — after seeing a failure once, the agent can correct similar errors immediately without iterative trial-and-error. Addresses brittleness of prompt-based reflection and heavy API costs of retry loops.
- **Key finding**: Error correction can be **structural** (graph-based pattern matching) rather than reflective (LLM re-prompting). One exposure to a failure pattern is sufficient if encoded properly.
- **Implication for us**: Our lesson system is conceptually similar but unstructured. A graph linking error patterns → corrections → contexts would make lessons more actionable. The "one-shot" property is attractive — currently our lessons require multiple exposures before they reliably influence behavior.

### [2607.12397] Critic Experience Bank: Step-Level Confidence Estimation for LLM Agents
- **Source**: https://arxiv.org/abs/2607.12397
- **Published**: 2026-07-14
- **Summary**: Step-level confidence estimation: calibrated probability that each proposed action is productive, available *before* execution. Confidence depends on execution consequences, not just prompt-response scoring.
- **Key finding**: Agent confidence must account for **downstream execution consequences**, not just surface plausibility. A step can look correct but lead to irreversible state corruption.
- **Implication for us**: Relevant to our guard system — guards currently check action validity but don't estimate confidence about downstream consequences. A pre-execution confidence score could gate expensive or irreversible operations more effectively than binary allow/deny.

### [2607.13594] SAFETY SENTRY: Context-Aware Human Intervention via EXECUTE-ASK-REFUSE Routing
- **Source**: https://arxiv.org/abs/2607.13594
- **Published**: 2026-07-15
- **Summary**: Moves beyond binary safe/unsafe to a three-way routing: EXECUTE (safe, proceed autonomously), ASK (uncertain, request human input), REFUSE (clearly harmful). Operates at instance granularity rather than action categories, reducing alert fatigue.
- **Key finding**: Binary guard decisions erode user trust from both sides — too many false alarms train users to ignore alerts (the "wave-through" problem), while missed harms destroy confidence. The **ASK** category is the key innovation: admitting uncertainty and escalating.
- **Implication for us**: Our approval gate is binary (approve/deny). Adding an ASK category — where the system flags uncertainty and provides context for human decision — would reduce both false-positive friction and false-negative risk. The instance-level (not category-level) granularity is also important: "file write" shouldn't always require approval, but "file write to production config" should.

### [2607.12385] PM-Bench: Evaluating Prospective Memory in LLM Agents
- **Source**: https://arxiv.org/abs/2607.12385
- **Published**: 2026-07-14
- **Summary**: Benchmark for prospective memory — the ability to remember to do something at a future trigger point while engaged in other activities. Simulates a 7-day week where agents must maintain ongoing activity while monitoring for deferred intention triggers.
- **Key finding**: Prospective memory (remembering future intentions) is distinct from retrospective memory (recalling past facts) and is poorly served by current agent memory architectures.
- **Implication for us**: Our task/request tracking system is a form of prospective memory. The benchmark's framing clarifies why simple context injection doesn't solve deferred tasks — the agent needs to *monitor* for trigger conditions, not just store the intention.

---

## ★★★ Tracking

### [2607.10582] MemDecay: Region-Aware KV Cache Eviction for Efficient LLM Agent Inference
- **Source**: https://arxiv.org/abs/2607.10582
- **Published**: 2026-07-12
- **Summary**: Training-free KV-cache eviction that assigns region-specific priorities and decay rates based on semantic structure (system instructions, plans, user turns, tool outputs). Exploits structure already available to the agent orchestrator.
- **Implication**: Infrastructure-level optimization. If our inference provider uses this, context window pressure reduces without architectural changes. The "region-aware" framing aligns with our structured context approach (system prompt, context files, conversation history have different retention needs).

### [2607.08894] GATS: Graph-Augmented Tree Search with Layered World Models
- **Source**: https://arxiv.org/abs/2607.08894
- **Published**: 2026-07-09
- **Summary**: Eliminates LLM calls during planning inference via a three-layer world model: exact symbolic matching, statistics-learned transitions, and LLM-generated predictions as fallback. UCB1-based tree search.
- **Implication**: Demonstrates that planning doesn't require LLM at every step — symbolic/statistical layers handle most cases. Relevant if we ever build explicit planning into agent workflows rather than relying on single-shot LLM planning.

---

## Cross-Cutting Themes

### 1. Memory Is Becoming a First-Class Research Problem
Four papers address agent memory from different angles: adaptive management (2607.13591), error-correction graphs (2607.13884), prospective memory benchmarks (2607.12385), and efficient caching (2607.10582). The field is moving from "agents have memory" to "how memory works is the core differentiator."

### 2. Evaluation Must Co-Evolve With Capabilities
Both 2607.12790 (co-evolving metrics) and 2607.12397 (critic experience bank) address the same meta-problem: static evaluation degrades as systems improve. This validates our Evaluation Mirage diagnosis and suggests the fix isn't better metrics but *evolving* metrics.

### 3. Isolation and Composition Create a Safety Dilemma
The isolation survey (2607.12406), distributed backdoors paper (2607.11751), and safety routing (2607.13594) together paint a picture: isolation prevents harm propagation but agents *must* compose to be useful. The resolution is assembly-point monitoring and graduated trust (EXECUTE/ASK/REFUSE).

### 4. Reducing LLM Dependency at Runtime
GATS (2607.08894) and MemDecay (2607.10582) both reduce LLM dependency — GATS eliminates LLM calls for planning when symbolic/statistical layers suffice, MemDecay reduces memory pressure. The trend: LLM as fallback, not primary mechanism.
