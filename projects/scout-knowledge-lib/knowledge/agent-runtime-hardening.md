<ai_context>
summary: "Companion note to agent-architectures.md: 10 named runtime hardening patterns for agent effect containment, concurrency, compilation, stabilization, process harness governance, and architecture evolution. Extracted from the Runtime Hardening and Process Harness sections of the canonical architecture note."
triggers: ["runtime hardening", "semantic transactions", "Cordon", "CoAgent", "advisory concurrency", "readout bottleneck", "PreAct", "run compilation", "SkillWeaver", "skill routing", "ADE", "intelligence entropy", "harness evolution", "false-success detection", "process harness", "CUGA FLO", "architecture gradient", "NOVA", "verification cascade", "forbidden directions", "agentic BPM"]
last_updated: "2026-10-31"
source_basis: "Extracted from agent-architectures.md §Runtime Hardening (2026-10-15) and §Process Harness (2026-10-31). Sources: Cordon [2606.17573], CoAgent [2606.15376], Looking Is Not Picking [2606.16364], PreAct [2606.17929], SkillWeaver [2606.18051], ADE [2606.18065], Harness Updating [2605.30621], False-Success Detection [2606.09863], CLAWAUDIT [2606.21071], OpenClaw [2606.15008], Plans Don't Persist [2606.22953], CUGA FLO [2606.27188], NOVA [2606.27243]. Originally sourced during Jul 22 runtime hardening triage + Jun 27 arXiv triage."
</ai_context>

# Agent Runtime Hardening

**Companion note** to [Agent Architectures](./agent-architectures.md).

This note catalogs 8 named runtime hardening patterns addressing containment
of agent effects before they escape to the world. Ten converging papers define
layers R0–R9 of the runtime hardening stack.

**Cross-references:**
- [Agent Architectures](./agent-architectures.md) — core patterns, harness engineering, state management
- [Agent Security: Defense Architectures](./agent-security-defense-architectures.md) — security-specific defense patterns
- [Agent Protocols: MCP, A2A](./agent-protocols-mcp-a2a.md) — protocol-layer containment

---

## Semantic Transactions — Effect Containment (Cordon, arXiv June 2026)

Agent runtimes expose tools as isolated RPCs with no task-scoped execution
boundary. Cordon introduces **semantic transactions**: task-level boundaries
binding tool intents, result lineage, reversible local state, staged external
effects, delegated authority, and audit metadata. Shadow state + effect outbox
pattern prevents irreversible mutations from escaping before commit.

- **Key implication**: This is the Compilation Gradient implemented at the
  runtime layer. Staged effects prevent Ghost Metabolism (sessions acting on
  retracted state). The "semantic transaction" vocabulary is the formal name
  for what's needed: not just state isolation but *effect containment* — a
  strictly stronger property.
- **Connects to**: Ghost Metabolism (staged effects prevent ghost mutations),
  Compilation Gradient (transactions = compiled governance at runtime),
  Cold Start Tax (recovery metadata enables warm restart),
  Verified Concurrency Anomalies (sits at a new "L-1" layer: effect staging
  before state commitment).
- **Source**: [2606.17573] Cordon, arXiv June 2026. Categories: cs.OS, cs.CR.

## Advisory Concurrency — LLM-as-Conflict-Judge (CoAgent, arXiv June 2026)

Classical concurrency control (locks, OCC) fits agent systems poorly:
transactions span minutes of inference, read sets are opaque, writes take
immediate effect. CoAgent exploits a new capability: **the LLM itself judges
whether a conflicting write invalidates its plan and repairs locally**, making
control advisory rather than blocking.

**MTPO Protocol (Monotonic Trajectory Pre-Order):**
- Fix serialization order at launch
- Serve each read an order-filtered value
- Speculative writes in place
- One-way notification for re-judgment and patching
- Saga-style inverse tools for undo/reorder

Results: 5% of serial correctness at 1.4× speedup (vs. 2PL/OCC losing all
gains). ToolSmith grows 25-tool library from bash target. Task pass: 45→63/71.

- **Key implication**: First paper to exploit LLM reasoning as a *concurrency
  primitive*. The "advisory" model (runtime informs, agent repairs) is a new
  interaction pattern. Our parallel sessions working on the same codebase
  could adopt this for structural conflict resolution.
- **Connects to**: Verified Concurrency Anomalies (detection ↔ CoAgent =
  resolution), Ghost Metabolism (advisory control prevents stale action),
  Harness Engineering (ToolSmith as self-growing harness),
  Session Floor (MTPO eliminates abort-retry cost).
- **Source**: [2606.15376] CoAgent, arXiv June 2026. Categories: cs.DC, cs.AI.
  Submitted to ATC 2026.

## Tool-Selection Readout Bottleneck (Looking Is Not Picking, arXiv June 2026)

LLM agents mis-call tools NOT because they fail to attend to the correct tool.
The model attends most to the correct tool **80% of the time** (vs. 21%
chance). The failure is at **decision readout**, not the harness. This directly
refutes the "crowded-harness / lost-in-the-middle" explanation.

Three-way evidence:
- Prompt repairs (reordering/duplicating) recover ≤23% of failures
- Readout-side interventions recover 59–91%
- Two different interventions recover the same failures (Jaccard 0.865)

Training-free selector: +11.9pp on BFCL, +14.9 on Seal-Tools.

- **Key implication**: Harness curation is less important than readout quality.
  The intuitive "reduce the harness" response recovers at most 23% of failures.
  The real fix is readout-side: better decoding, attention-informed selection,
  or separate tool-choice heads. Challenges minimal-harness design principle.
- **Connects to**: Prompt Mass Problem (harness size ≠ selection failure),
  Verification Inversion (verify at readout, not input structure),
  Harness Engineering (curation less important than decoding).
- **Source**: [2606.16364] arXiv June 2026. Categories: cs.AI, cs.CR, cs.SE.

## Run Compilation — PreAct (arXiv, June 2026)

Computer-using agents solve every task from scratch. PreAct **compiles
successful runs into small state-machine programs** (states = screen checks,
transitions = actions), then replays directly without LLM calls — **8.5–13×
faster**. Mismatch → graceful fallback to full agent reasoning.

Store-time validation: re-run from clean state + independent evaluator confirms
success before storing. Programs that replay to last step but leave task undone
are rejected. What didn't matter: prompt wording, runtime guardrails, retriever.

- **Key implication**: The Compilation Gradient thesis applied to execution.
  Successful runs are literally compiled from probabilistic LLM execution into
  deterministic state machines. Store-time validation = verification at compile
  time. Directly addresses Cold Start Tax: compiled programs have zero cold-start
  cost on replay.
- **Connects to**: Compilation Gradient (probabilistic → deterministic),
  Cold Start Tax (zero-cost replay), Session Floor (compiled programs eliminate
  floor), Insight Governance (store-time validation = curation loop).
- **Source**: [2606.17929] PreAct, arXiv June 2026. Categories: cs.AI.

## Compositional Skill Routing — SkillWeaver (arXiv, June 2026)

Real tasks require *composing* multiple skills. The Compositional Skill Routing
problem: decompose query into atomic sub-tasks, retrieve skill per sub-task,
compose executable plan. **Task decomposition quality is the primary bottleneck**
(34.2% category recall at step level).

SkillWeaver uses Iterative Skill-Aware Decomposition (SAD): retrieval-augmented
feedback loop. Results: 34.2% → 67.7% (+32.7%). Context reduction >99%.
Transfer: +35.6% even on unseen categories. CompSkillBench: 300 queries over
2,209 real MCP server skills, 24 categories.

- **Key implication**: Most failed runs aren't failing at *which tool to use*
  but at *how to decompose the problem*. SkillWeaver provides the formal
  mechanism for what task-tree systems do informally. The >99% context reduction
  from routing (vs loading all tools) connects to Prompt Mass Problem.
- **Connects to**: Prompt Mass Problem (skill routing = context reduction),
  Transduction Chain (decomposition format determines routing success),
  Agent Protocols: MCP (2,209 real MCP skills = ecosystem maturity).
- **Source**: [2606.18051] SkillWeaver, arXiv June 2026. Categories: cs.CL.

## Intelligence Entropy Stabilization — ADE Framework (arXiv, June 2026)

Extends the Intelligence Entropy principle ([2606.08162]) with engineering
framework. Lyapunov analysis yields stabilization condition: **λ > α/Cm**
(active stabilization effort must exceed entropy production rate divided by
model capability). ADE (Agent Delivery Engineering): four-layer architecture,
23 components, Five-Layer Disorder Taxonomy.

Production results (33.6 days monitoring, 100K-scale):
- Channel fracture: 69–98% → **near 0%**
- System death probability: below **0.02%**

- **Key implication**: First formal thermodynamic stabilization framework for
  agent systems. The condition λ > α/Cm quantifies why accumulated state
  degrades performance. Systems without stabilization exceeding entropy
  production will degrade exponentially regardless of component quality.
- **Connects to**: Abstention Decay (entropy growth = loss of selective
  action), Ghost Metabolism (disorder in retracted sessions), Cold Start Tax
  (S₀ at session start; higher = harder stabilization).
- **Source**: [2606.18065] ADE, arXiv June 2026. Categories: cs.MA.
  Origin: Shanghai Qijing Digital Technology.

## Harness Evolution Paradox — Flat-Updating / Non-Monotonic Benefit (arXiv, May 2026)

Decomposes agent self-evolution into two orthogonal capabilities:
- **Harness-updating**: producing useful persistent harness updates from traces.
  **FLAT across model tiers** — even Qwen3.5-9B produces updates comparable to
  Claude Opus 4.6.
- **Harness-benefit**: actually improving from updated harnesses.
  **NON-MONOTONIC** — weak models benefit little, mid-tier benefit most, strong
  models benefit less than mid-tier.

Weak-tier failure modes: (1) fail to activate relevant harness artifacts;
(2) activate but fail to follow faithfully.

- **Key implication**: The investment should go into the task-solving agent's
  instruction-following and harness-activation capabilities, not the evolver's
  strength. Guidance files help most for "average" sessions and least for the
  hardest problems. Structured, machine-parseable guidance with explicit
  activation triggers outperforms prose advice.
- **Connects to**: Cold Start Tax (guidance helps less when it's needed most),
  Compilation Gradient (compiled guidance > interpreted guidance), EvoHunt
  (playbook evolution works regardless of evolver strength), Criterion-Completion
  Gap (per-criterion ≠ end-to-end).
- **Source**: [2605.30621] Harness Updating Is Not Harness Benefit, arXiv May 2026.

## False-Success Detection — Lightweight vs LLM Judges (arXiv, June 2026)

**45–48% of agent failures are self-reported successes** where the agent
confidently claims completion while environment state shows otherwise. LLM
judges across 5 models × 5 prompt strategies × full task specs: **max AUROC
0.65** (near random). Judges rely on surface completion proxies (confident
closing language, action-sequence volume).

Lightweight TF-IDF detectors: **AUROC 0.83–0.95**, recovering 4–8× more
false successes at the same flag rate with **3,300× lower latency**.

- **Key implication**: LLM-as-judge for success verification is structurally
  inadequate. The fix is domain-calibrated lightweight detectors as triage
  signals: verify deliverable existence, file-change consistency, required-field
  presence BEFORE expensive LLM evaluation. This extends SafeClawBench's
  "semantic check ≠ actual harm" to the success direction.
- **Connects to**: Evaluation Mirage (judge-based evaluation misses half the
  problems), SafeClawBench (semantic layer unreliable), Silent Failures
  (fail-plausible as failure mode), Externalization Turn (externalize verification).
- **Source**: [2606.09863] From Confident Closing to Silent Failure, arXiv June 2026.

## The Implementation Blind Spot — Source-Level Audit (CLAWAUDIT + OpenClaw, Jun 2026)

Standard security tooling misses **78–86%** of agent-specific vulnerabilities
because the patterns are structurally different from web/API applications. The
first source-code audit of agent runtimes (CLAWAUDIT, 446 advisories benchmark)
shows that agent-specific static analysis raises held-out recall from 13.8–21.7%
(standard tools) to **66.8–75.1%** with agent-adapted rules.

Complementary finding: multi-agent output aggregation creates **super-linear**
attack surface expansion. Single-agent compromise probability 0.24 rises to
0.86 with 7 agents (2606.15008). Privilege drift 0.03→0.21 with positive
escalation curvature — the system becomes MORE vulnerable as attacker
capability increases. The weakest agent determines system-wide exposure.

- **Key implication**: The implementation layer (prompt builder, parser, tool
  dispatcher, memory writer, permission gate) performs the actual mediation
  between model output and world effect but has never had its own security
  taxonomy until CLAWAUDIT. Combined with Plans Don't Persist (2606.22953)
  showing context management code makes alignment-critical decisions (plan
  eviction = plan loss), the runtime layer is simultaneously the most critical
  and least governed surface.
- **Connects to**: Escapability Hierarchy (enforcement works only when substrate
  is inaccessible), Composition Tax (output aggregation makes costs super-linear),
  Governance Artifact Gap (configs pass through implementation unvalidated).
- **Sources**: [2606.21071] CLAWAUDIT, [2606.15008] OpenClaw Attack Surface,
  [2606.22953] Plans Don't Persist. See findings/2026-06-28-arxiv-scan-203.md.

## Process Harness — Deterministic Engine + Policy-Governed Agents (CUGA FLO, arXiv June 2026)

A **process harness** places a policy-governed agentic layer around a
deterministic workflow engine. The engine retains structural authority; agents
reason only at designated control points. Three policy-governed agent types:
- **TaskAgent** — knowledge-intensive task execution within defined boundaries
- **DecisionAgent** — per-case gateway routing at process decision points
- **FlowAgent** — runtime flow adaptation via hook mechanism within policy bounds

Each agent reasons within an explicit policy drawn from the process FRAME (the
aggregate policy set governing all LLM calls). Reconciles imperative
requirements (deterministic compliance) with normative requirements
(policy-framed autonomy).

- **Key implication**: First formal realization of Substrate Inversion for
  business process management. The pattern is directly applicable to our
  orchestrator: deterministic control flow with agent reasoning at designated
  decision points, bounded by explicit policy.
- **Source**: [2606.27188] arXiv June 2026.

## Architecture Gradient — Non-Differentiable Architecture Evolution (NOVA, arXiv June 2026)

An SGD-inspired, non-differentiable update signal for agent architecture
evolution. Aggregates prior modifications, verification diagnostics, metric
feedback, and trajectory memory to guide next modifications. Four-level
verification cascade blocks invalid candidates early. **Forbidden directions**
mechanism explicitly records what NOT to try.

Deployed in industrial advertising: 13x reduction in human-attended time for
literature-to-production cycles. 54.5% effective pass rate on L2 ScaleUp tasks.

- **Key implication**: The architecture gradient concept — giving agents a
  sense of direction via synthesized verification feedback — addresses the
  metacognitive ceiling (#183) structurally. Negative knowledge (forbidden
  directions) prevents costly re-exploration of failed approaches.
- **Source**: [2606.27243] arXiv June 2026.
