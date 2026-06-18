<ai_context>
summary: "Triage of 10 arXiv papers (June 13-16, 2026) converging on agent runtime hardening: transactional containment, advisory concurrency control, skill security vetting, MCP provenance verification, tool-selection failure mechanics, run compilation for replay, compositional skill routing, entropy-driven degradation, evaluation intelligence reuse, and TEE-sealed API routing. The macro-thesis: agent infrastructure is crossing from 'state management' (previous batch) to 'runtime containment and hardening.'"
triggers: ["arXiv triage", "agent runtime", "semantic transactions", "Cordon", "CoAgent", "MTPO", "concurrency control", "ProvenanceGuard", "MCP verification", "SkillVetBench", "skill security", "tool selection", "attention failure", "PreAct", "run compilation", "SkillWeaver", "compositional routing", "Intelligence Entropy", "ADE framework", "Human-on-the-Bridge", "evaluation intelligence", "AEGIS", "TEE router", "API security"]
last_updated: "2026-07-22"
source_basis: "arXiv API queries cs.MA+agent+LLM, agent+tool-calling+LLM, agentic+evaluation+benchmark (June 13-16 papers). All abstracts read in full. Cross-referenced against existing library to exclude already-covered papers."
sourced_into: "agent-architectures.md §Runtime Hardening (Cordon, CoAgent, Looking Is Not Picking, PreAct, SkillWeaver, ADE), agent-security-governance.md §2.22/§2.23 (SkillVetBench, AEGIS), agent-evaluation.md §Human-on-the-Bridge, agent-protocols-mcp-a2a.md §ProvenanceGuard"
</ai_context>

# Source Triage — June 17, 2026 (arXiv: Agent Runtime Hardening)

Cross-source sweep covering 10 new arXiv papers (June 13–16, 2026) that
converge on a macro-theme extending the previous batch: **the infrastructure
crisis is moving from "state management between actions" (Jul 18 triage) to
"runtime containment and hardening of agent effects."**

## Convergent Thesis

The previous batch (2026-07-18) identified the state management stack: isolation,
caching, memory, knowledge governance, coordination contracts. This batch reveals
the *next layer*: once state is managed, the runtime itself must be hardened
against irreversible effects, skill-level supply-chain attacks, tool-selection
failures at the readout level, provenance conflation, and entropy-driven
degradation. The shift is from "how agents maintain state" to "how runtimes
contain agent actions before they escape to the world."

---

## Paper 1: Cordon — Semantic Transactions for Tool-Using Agents

**Paper:** "Cordon: Semantic Transactions for Tool-Using LLM Agents" (2606.17573)
**Source:** https://arxiv.org/abs/2606.17573
**Published:** 2026-06-16
**Categories:** cs.OS, cs.CR
**Submitted to:** (not stated)

**Core claim:** Today's agent runtimes expose tools as isolated RPCs — no
task-scoped execution boundary exists for commit, rollback, recovery, or audit.
This mismatch requires a **runtime containment boundary** rather than another
per-call guardrail. Cordon introduces **semantic transactions**: task-level
execution boundaries binding tool intents, result lineage, reversible local
state, staged external effects, delegated authority, and audit metadata.

**Architecture:**
- Transaction manager tracks derived result objects
- Reversible mutations execute in **shadow state** (not live)
- Outward-facing actions staged in an **effect outbox**
- Recovery metadata recorded
- Runtime validates composed execution flow before commit/release

**Key results:**
- Exposes cross-step violations missed by existing defenses
- Reduces irreversible-effect failures
- Preserves benign task completion with modest approval overhead

**Implication for us:** This is the "compiled governance" pattern from our
Compilation Gradient (governance-compilation-gradient.md) implemented at the
runtime layer. The shadow-state + effect-outbox pattern is precisely what
prevents our Ghost Metabolism (sessions acting on retracted state). If tool
effects are staged rather than immediate, retracted sessions don't leave
partial state. The "semantic transaction" vocabulary is the formal name for
what our system needs: not just state isolation (Paper 5 of Jul-18 batch)
but *effect containment* — a strictly stronger property.

**Connects to:** Ghost Metabolism (staged effects prevent ghost mutations),
Compilation Gradient (transactions = compiled governance at runtime layer),
Cold Start Tax (recovery metadata enables warm restart without re-computation),
Session-State Hierarchy L0–L4 (this sits at a new "L-1" layer: effect
staging before state commitment).

---

## Paper 2: CoAgent — Advisory Concurrency Control via LLM Judgment

**Paper:** "CoAgent: Concurrency Control for Multi-Agent Systems" (2606.15376)
**Source:** https://arxiv.org/abs/2606.15376
**Published:** 2026-06-13
**Categories:** cs.DC, cs.AI, cs.MA
**Submitted to:** ATC 2026

**Core claim:** Classical concurrency control (locks, OCC) fits LLM agents
poorly: transactions span minutes of inference, read sets are opaque, and
writes take immediate effect. The key insight: **the LLM itself can judge
whether a conflicting write invalidates its plan and repair locally**, making
control *advisory* rather than blocking.

**Protocol — MTPO (Monotonic Trajectory Pre-Order):**
- Fixes serialization order at launch
- Serves each read an order-filtered value
- Applies writes speculatively in place
- One-way notification asks affected readers to re-judge and patch
- Saga-style inverse tools mechanically undo/reorder misplaced writes
- At quiescence: run is serializable in pre-decided order

**Key results:**
- 5% of serial correctness at 1.4× speedup (vs. 2PL and OCC losing all
  concurrency gains)
- ToolSmith grows 25-tool library online from bash-only target
- Task pass rate: 45/71 → 63/71 at 0.80× time and 0.86× cost

**Implication for us:** This extends the Verified Concurrency Anomalies paper
(2606.17182, previous batch) from *detection* to *resolution*. Where that
paper provides the formal taxonomy (stale-generation, phantom-tool, etc.),
CoAgent provides the *runtime protocol* that handles conflicts without
blocking. The "advisory" model — runtime informs, agent repairs — is a
fundamentally new interaction pattern that leverages the agent's reasoning
capability for infrastructure purposes. Our system could adopt this for
parallel dev sessions working on the same codebase.

**Critical design insight:** The LLM's ability to "judge whether a conflict
invalidates its plan" is a capability classical databases don't have. This
is the first paper to exploit LLM reasoning as a *concurrency primitive*.

**Connects to:** Verified Concurrency Anomalies (2606.17182 — detection ↔
CoAgent = resolution), Ghost Metabolism (advisory control prevents stale
action), Harness Engineering (ToolSmith as self-growing harness),
Session Floor (MTPO eliminates abort-retry cost).

---

## Paper 3: ProvenanceGuard — Source-Aware Verification for MCP Agents

**Paper:** "ProvenanceGuard: Source-Aware Factuality Verification for
MCP-Based LLM Agents" (2606.18037)
**Source:** https://arxiv.org/abs/2606.18037
**Published:** 2026-06-16
**Categories:** cs.AI, cs.CL, cs.MA

**Core claim:** Standard factuality verification pools all evidence and checks
support. MCP agents have a different failure mode: **cross-source conflation**
— a claim is supported *somewhere* but attributed to the *wrong source*. Source
attribution is an independent verification axis invisible to pooled metrics.

**Architecture:**
- Consumes captured MCP traces with stable tool IDs + source IDs
- Decomposes answers into atomic claims
- Routes claims to source-specific evidence
- Checks support via NLI + token-alignment proxy
- Compares stated attribution with routed source
- Returns per-claim verdicts + answer-level allow/block decision
- Blocked answers repaired via retrieval-augmented revision + re-verify

**Key results (medical-domain MCP traces, 281 traces):**
- Block F1: 0.802 (held-out split), 0.846 (harder multi-source benchmark)
- Source accuracy: 0.858 over 260 source-eligible claims
- Source-plus-relation accuracy: 0.229 (exact ownership remains hard)
- 50 controlled conflation probes: 100% detection, 0% retained wrong attribution

**Implication for us:** This formalizes a failure mode we've observed but not
named. When Scout synthesizes across sources (arXiv + HN + XHS), attributions
can drift: a finding from one source gets mentally "claimed" by another context.
ProvenanceGuard's architecture suggests our knowledge library needs claim-level
source tagging, not just file-level provenance. The MCP trace consumption
pattern also validates that protocol-level observability (tool IDs, source IDs)
enables verification that's impossible from output text alone.

**Connects to:** Agent Protocols: MCP (new verification layer on MCP traces),
Transduction Chain (source attribution as format requirement), Evaluation
Mirage (pooled metrics miss provenance failures), Knowledge Asymmetry
(attribution drift degrades trust in available knowledge).

---

## Paper 4: Looking Is Not Picking — Tool-Selection Readout Failures

**Paper:** "Looking Is Not Picking: An Attention-Segment Account of
Tool-Selection Failures in LLM Agents" (2606.16364)
**Source:** https://arxiv.org/abs/2606.16364
**Published:** 2026-06-15
**Categories:** cs.AI, cs.CR, cs.SE

**Core claim:** LLM agents mis-call tools NOT because they failed to attend to
the correct tool in a crowded harness. The model attends most to the correct
tool 80% of the time (vs. 21% chance). **The failure is at the decision
readout, not the harness.** This directly refutes the "crowded-harness /
lost-in-the-middle" explanation.

**Three-way evidence for readout bottleneck:**
1. **Input vs. readout:** Prompt repairs (reordering/duplicating) recover ≤23%
   of failures; readout-side interventions recover 59–91%
2. **Representation-invariance:** Two different interventions (attention-logit
   bias + residual-stream steering) recover the same failures (Jaccard 0.865),
   confirming localized readout bottleneck
3. **Training-free selector:** Per-segment attention closes most of the
   gold-free-vs-oracle gap (+11.9 pts on BFCL, +14.9 on Seal-Tools)

**Key quantitative finding:**
- Gold tool is under-attended on only 10% of failures
- It looks at the right tool and still picks wrong 80% of the time

**Implication for us:** This is a critical finding for harness design. Our
system has been growing tool counts (more context, more capabilities). The
intuitive response to tool-selection failures is "reduce the harness" or
"put the right tool first." This paper shows that approach recovers at most
23% of failures. The real fix is readout-side: better decoding, attention-
informed selection, or separate tool-choice heads. This challenges the
"minimal harness" design principle — the harness size may not be the problem.

**Connects to:** Prompt Mass Problem (harness size ≠ selection failure),
Verification Inversion (verify at decision readout, not input),
Harness Engineering (harness curation less important than readout quality).

---

## Paper 5: PreAct — Compiling Agent Runs for Replay

**Paper:** "PreAct: Computer-Using Agents that Get Faster on Repeated Tasks"
(2606.17929)
**Source:** https://arxiv.org/abs/2606.17929
**Published:** 2026-06-16
**Categories:** cs.AI

**Core claim:** Computer-using agents solve every task from scratch, paying
full cost on repetition. PreAct **compiles successful runs into small
state-machine programs** (states = screen checks, transitions = actions),
then replays directly without LLM calls — 8.5–13× faster.

**Architecture:**
- First success → compile into state-machine program
- Each replay step: check screen matches expectation, then act
- Mismatch → hand control back to agent (graceful fallback)
- Store-time validation: re-run from clean state + independent evaluator
  confirms success before storing
- Programs that replay to last step but leave task undone are rejected

**Key results:**
- 8.5–13× faster on repeated tasks (zero per-step LLM calls)
- Store-time check: worth 1.75–2.6 tasks per benchmark
- What didn't matter: prompt wording, runtime guardrails, retriever type

**Implication for us:** This is the **Compilation Gradient** thesis
(governance-compilation-gradient.md) applied to agent execution. Successful
runs are literally *compiled* from probabilistic LLM execution into
deterministic state machines. The store-time validation is exactly the
"verification at compile time, not runtime" principle. This directly addresses
the Cold Start Tax: compiled programs have zero cold-start cost on replay.

The graceful fallback (mismatch → back to agent) is the correct design for
our system: compile what works, fall back to full reasoning only when the
environment changes.

**Connects to:** Compilation Gradient (execution compilation from
probabilistic → deterministic), Cold Start Tax (zero-cost replay on
compiled runs), Session Floor (compiled programs eliminate floor),
Insight Governance (store-time validation = curation loop for programs).

---

## Paper 6: SkillWeaver — Compositional Skill Routing for MCP Agents

**Paper:** "Compositional Skill Routing for LLM Agents: Decompose, Retrieve,
and Compose" (2606.18051)
**Source:** https://arxiv.org/abs/2606.18051
**Published:** 2026-06-16
**Categories:** cs.CL

**Core claim:** Real tasks require *composing* multiple skills, not just
selecting one. The **Compositional Skill Routing** problem: decompose query
into atomic sub-tasks, retrieve appropriate skill per sub-task, compose an
executable plan. **Task decomposition quality is the primary bottleneck**
(34.2% category recall at step level).

**Architecture (SkillWeaver):**
- LLM task decomposer → bi-encoder skill retriever (FAISS) → DAG planner
- CompSkillBench: 300 queries over 2,209 real MCP server skills, 24 categories
- Iterative Skill-Aware Decomposition (SAD): retrieval-augmented feedback loop

**Key results:**
- Standard decomposition: 34.2% category recall → SAD improves to 67.7% (+32.7%)
- Correct granularity is prerequisite for retrieval (CatR@1: 34% → 41% when
  decomposition is correct)
- Context window consumption reduced by >99%
- Transfer: +35.6% relative DA gain even on unseen categories

**Implication for us:** This formalizes why our task decomposition matters more
than tool selection. The 34.2% baseline recall means most failed agent runs
aren't failing at *which tool to use* but at *how to decompose the problem*.
The SAD pattern (iteratively align decomposition with available skills) is
what our task-tree system does informally — SkillWeaver provides the formal
mechanism. The >99% context reduction from skill routing (vs. loading all
tools) connects to our Prompt Mass Problem.

**Connects to:** Prompt Mass Problem (skill routing = context reduction),
Transduction Chain (decomposition format determines routing success),
Harness Engineering (skill libraries as composable harness components),
Agent Protocols: MCP (2,209 real MCP skills = ecosystem maturity signal).

---

## Paper 7: SkillVetBench — Security Vetting for Agent Skills

**Paper:** "SkillVetBench: LLM-as-Judge for Multi-Dimensional Security Risk
Evaluation in Open-Source LLM Agent Skills" (2606.15899)
**Source:** https://arxiv.org/abs/2606.15899
**Published:** 2026-06-14
**Categories:** cs.CR, cs.AI, cs.MA
**Submitted to:** NeurIPS 2027

**Core claim:** Community-contributed agent skills are largely unvetted, and
**existing code scanners are structurally blind to instruction-layer and
multi-agent risk** — natural-language directives that hijack agents, exfiltrate
data through encoded side channels, or chain harm across pipelines.

**Key contribution — SARS (Skill Agentic Risk Score):**
- Five-dimensional agentic-risk metric with weighted formula
- Full CVSS v4.0 vector decomposition
- LLM-as-Judge vetting achieves **zero false negatives** across 78
  confirmed-malicious skills and **zero false positives** across 22 benign
  controls
- Best static baseline (SKILLSIEVE) still misses 15%
- For Prompt Injection and Memory Poisoning categories: conventional tools
  miss 89–100% of threats (CODEBERT: 0/9 memory-poisoning skills detected)
- Detection rates vary 35–95% across LLM evaluators → ensemble scoring needed

**Implication for us:** This validates our prior hn-scan findings about
supply-chain security in agent ecosystems. The key insight: **semantic
attacks are invisible to syntactic scanners**. Memory Poisoning (0% detection
by CODEBERT) is exactly our MemVenom finding from batch 6. SkillVetBench
provides the benchmark and scoring methodology that was missing. The
instruction-layer blindness of existing tools means our own tool/skill
adoption needs semantic vetting, not just code review.

**Connects to:** Agent Security & Governance (skill-level supply chain attack),
MemVenom (memory poisoning as attack vector — now benchmarked),
Agent Protocols: MCP (skill marketplace security gap),
Discrimination Crisis (flood of skills without vetting = quality collapse).

---

## Paper 8: Intelligence Entropy Principle / ADE Framework

**Paper:** "Intelligence Entropy Principle and the ADE Stability Engineering
Framework" (2606.18065)
**Source:** https://arxiv.org/abs/2606.18065
**Published:** 2026-06-16
**Categories:** cs.MA
**Origin:** Shanghai Qijing Digital Technology (production system)

**Core claim:** LLM-driven multi-agent systems exhibit **nonlinear degradation**
in production. Formalized as the Intelligence Entropy Principle:
`S(t) = S0 * exp(α*t/Cm)` where Cm is model capability coefficient.
Lyapunov analysis yields stabilization condition: `λ > α/Cm`.

**ADE (Agent Delivery Engineering) Framework:**
- Four-layer architecture (L1 Physical Laws → L4 User Adaptation)
- 23 core components
- Five-Layer Disorder Taxonomy unifying failures under structural collapse
- "Elastic Organization" as original MAS morphology

**Key results (100K-scale experiments + 33.6 days production monitoring):**
- Channel fracture: reduced from 69–98% to **near 0%**
- System death probability: below **0.02%**

**Implication for us:** This is the first formal thermodynamic model for what
we've been observing as Abstention Decay and Ghost Metabolism. The exponential
entropy growth `S(t) = S0 * exp(α*t/Cm)` means: without active stabilization,
disorder grows exponentially, bounded only by model capability. The
stabilization condition `λ > α/Cm` means: active stabilization effort must
exceed the entropy production rate divided by capability. This gives us a
*quantitative* framework for understanding why accumulated state degrades
performance (the α term is the state accumulation rate).

The Five-Layer Disorder Taxonomy potentially subsumes our ad-hoc failure
classifications. The "channel fracture" metric (69–98% → 0%) suggests
production-scale validation of stabilization engineering.

**Connects to:** Abstention Decay (entropy growth = loss of selective action),
Ghost Metabolism (disorder in retracted sessions), Insight Governance
(λ > α/Cm = curation rate must exceed accumulation rate), Cold Start Tax
(entropy at session start = S0; higher S0 = harder stabilization).

---

## Paper 9: Human-on-the-Bridge — Evaluation Intelligence Reuse

**Paper:** "Human-on-the-Bridge: Scalable Evaluation for AI Agents"
(2606.16871)
**Source:** https://arxiv.org/abs/2606.16871
**Published:** 2026-06-15
**Categories:** cs.MA

**Core claim:** Agent evaluation requires behavioral assessment across turns,
tools, context, policies, and uncertainty. Current methods are fragmented.
HOB places **human expertise upstream** as reusable evaluation intelligence
(domain context, Red-Team Traps, Juror Personas, scoring guidelines, audit
rules, fallback policies). ProofAgent Harness executes this curated
intelligence repeatedly.

**Key architecture — Asymmetric evaluation:**
- Smaller Harness LLMs can challenge agents built on frontier LLM backbones
- Expert judgment encoded upfront and reused across evaluations
- NOT applied manually inside every run

**Key results (23,500 agent turns, finance/healthcare/code generation):**
- Surfaces failures missed by static benchmarks: phantom tool-call claims,
  missing mandatory tool calls, policy drift, manipulation paths, safe but
  non-resolving refusals
- Asymmetric settings work: quality amplified without equally large evaluators

**Implication for us:** This is the Verification Inversion thesis implemented
for evaluation: invest in evaluation *design* (upstream), not evaluation
*execution* (per-run). The "Juror Personas" concept is our guard architecture
formalized as reusable evaluation actors. The asymmetric finding (smaller
evaluators work if properly curated) validates that our eval architecture
doesn't need frontier-class judges — it needs well-designed evaluation
intelligence.

The specific failures surfaced (phantom tool-call claims, policy drift,
non-resolving refusals) map exactly to our system's observed failure modes.

**Connects to:** Evaluation Mirage (HOB solves the single-score problem),
Verification Inversion (upstream investment > per-run evaluation),
Compilation Gradient (evaluation intelligence = compiled expertise),
Abstention Competence (non-resolving refusals = abstention without value).

---

## Paper 10: AEGIS — TEE-Sealed API Routers Against Agent MITM

**Paper:** "The Proxy Knows Too Much: Sealing LLM API Routers with Attested
TEEs" (2606.16358)
**Source:** https://arxiv.org/abs/2606.16358
**Published:** 2026-06-15
**Categories:** cs.CR, cs.AI, cs.MA

**Core claim:** API routers terminate the client's TLS session and hold the
full interaction in plaintext. This makes them **application-layer
man-in-the-middle**: they can rewrite tool calls, swap dependencies for
typosquats, trigger attacks under audit-evading conditions, and exfiltrate
secrets. Existing client-side defenses are evadable.

**AEGIS architecture:**
- Provider-transparent attested API router
- Data path = client-verified faithful passthrough
- Plaintext confined to small hardware-enclave component
- Auth, scheduling, accounting on untrusted host
- Client verifies enclave before releasing plaintext
- Host can neither read nor alter interaction
- Trusted path: **851 lines** (extremely small TCB)

**Key results:**
- All four malicious-router attack classes succeed against baseline
- All four blocked by AEGIS (including adaptive tests)
- Three provider-native APIs carried without conversion
- Overhead: ~6ms per request
- Seeded audit: commodity coding agents find 8/10 and 10/10 planted violations

**Implication for us:** This identifies a supply-chain attack surface we
haven't covered: the **API router as MITM**. As agent systems route through
proxies (for load balancing, cost optimization, caching), each proxy holds
the full conversation in plaintext. The attack surface isn't theoretical —
"rewrite tool calls, swap dependencies for typosquats" describes a production-
grade supply-chain attack. The 851-line TCB and ~6ms overhead suggest this
is deployable, not research-grade.

For our system: any API proxy layer between agents and model providers is
a potential attack surface where tool calls could be rewritten. AEGIS's
attested-passthrough pattern is the minimal architecture that eliminates this.

**Connects to:** Agent Security & Governance §1 Attack Surfaces (new: router
MITM), Supply-Chain Security (the LinkedIn/Fedora findings from hn-scans —
now with infrastructure-level solution), Agent Protocols: MCP (router layer
in MCP architecture is exactly this attack surface).

---

## Cross-Paper Synthesis: The Runtime Hardening Stack

These 10 papers converge on a **runtime hardening stack** that sits *above*
the state management stack identified in the previous batch:

| Layer | Problem | Paper | Solution |
|-------|---------|-------|----------|
| R0: Effect Containment | Irreversible mutations escape | Cordon (2606.17573) | Semantic transactions, shadow state, effect outbox |
| R1: Concurrency Resolution | Conflicts block/abort expensive work | CoAgent (2606.15376) | Advisory control, LLM-as-judge for conflicts |
| R2: Provenance Verification | Source conflation in multi-tool answers | ProvenanceGuard (2606.18037) | Claim-level source routing + NLI verification |
| R3: Skill Security | Semantic attacks invisible to code scanners | SkillVetBench (2606.15899) | LLM-as-Judge vetting, SARS score, ensemble |
| R4: Tool Selection | Readout failure despite correct attention | Looking Is Not Picking (2606.16364) | Attention-informed selection, readout interventions |
| R5: Run Compilation | Full re-computation on repeat tasks | PreAct (2606.17929) | State-machine compilation, validated store |
| R6: Skill Composition | Decomposition bottleneck (34.2%) | SkillWeaver (2606.18051) | Iterative Skill-Aware Decomposition (SAD) |
| R7: Entropy Stabilization | Exponential disorder growth | ADE (2606.18065) | λ > α/Cm stabilization engineering |
| R8: Evaluation Intelligence | Per-run expert judgment doesn't scale | HOB (2606.16871) | Upstream curation, reusable evaluation actors |
| R9: Transport Integrity | Router MITM on full plaintext | AEGIS (2606.16358) | Attested TEE passthrough, 851-line TCB |

**Ordering dependency:** R0 (effect containment) enables R1 (concurrency — staged
effects can be reordered without real-world damage). R3 (skill vetting) is
prerequisite for R6 (skill composition — composing unvetted skills compounds
risk). R5 (compilation) requires R8 (evaluation intelligence to validate
compiled programs).

---

## Prediction Updates

| Prior Prediction | Evidence This Batch | Status |
|-----------------|---------------------|--------|
| Compilation Gradient: governance → compiled form | PreAct literally compiles runs → state machines; Cordon compiles transactions | ✅ Strongly confirmed |
| Cold Start Tax: warm sessions as named pattern | PreAct eliminates cold start entirely for compiled runs | ✅ Extended: not just "warm" but "compiled" |
| Ghost Metabolism: sessions on retracted state | Cordon's shadow state prevents ghost mutations; CoAgent's advisory model prevents stale action | Solutions emerging |
| Supply-chain attacks on agent ecosystems | AEGIS (router MITM) + SkillVetBench (skill supply chain) = two new attack surfaces formalized | ✅ Expanding (more surfaces than predicted) |
| Evaluation Mirage: single-score hides failures | HOB proves smaller evaluators work with proper intelligence; ProvenanceGuard proves source attribution is independent axis | ✅ Multiple independent confirmations |
| "Crowded harness" causes tool failures | **REFUTED** by Looking Is Not Picking: 80% attention to correct tool, failure at readout | ⚠️ Prior assumption invalidated |

### New Predictions from This Batch

1. **Semantic transactions will become a standard runtime primitive** within
   12 months — Cordon and CoAgent independently derive it from different angles
   (containment vs. concurrency), suggesting strong convergent pressure.

2. **"Advisory concurrency" (LLM-as-conflict-judge) will outperform traditional
   isolation** in agent systems — CoAgent's 1.4× speedup at 5% correctness cost
   is the first evidence of a new concurrency paradigm.

3. **Skill marketplace security will be the next major incident category** —
   SkillVetBench shows 89–100% miss rate by conventional scanners on
   instruction-layer attacks. With MCP skill registries growing rapidly,
   a high-profile skill-supply-chain attack is predictable.

4. **Run compilation (PreAct pattern) will merge with session-state caching
   (TokenPilot/CacheWise)** — compiled runs eliminate LLM calls entirely;
   cached sessions reduce per-call cost. The combined pattern is "compile what
   you can, cache what you can't compile, reason only on genuine novelty."

5. **Intelligence Entropy Principle (λ > α/Cm) will be adopted as the formal
   framework** for understanding agent degradation — it subsumes our ad-hoc
   observations (Abstention Decay, Ghost Metabolism) under a single
   thermodynamic model.

---

## Sourcing Recommendations

| Finding | Target canonical note | What to add |
|---------|----------------------|-------------|
| Cordon semantic transactions (2606.17573) | agent-architectures.md §Runtime | Effect containment, shadow state, transaction manager |
| CoAgent advisory concurrency (2606.15376) | agent-architectures.md §Concurrency | MTPO protocol, LLM-as-conflict-judge, ToolSmith |
| ProvenanceGuard (2606.18037) | agent-protocols-mcp-a2a.md §Verification | Cross-source conflation, claim-level provenance |
| Looking Is Not Picking (2606.16364) | agent-architectures.md §Tool Selection | Readout bottleneck, attention-informed selection |
| PreAct (2606.17929) | agent-architectures.md §Compilation | Run → state-machine compilation, store-time validation |
| SkillWeaver (2606.18051) | agent-architectures.md §Skills | Compositional routing, SAD pattern, CompSkillBench |
| SkillVetBench (2606.15899) | agent-security-governance.md §1.x | Instruction-layer blindness, SARS score, 89–100% miss |
| Intelligence Entropy / ADE (2606.18065) | Multi-agent coordination or new synthesis | Formal degradation model, λ > α/Cm condition |
| HOB evaluation (2606.16871) | agent-evaluation-trends-updated.md | Upstream evaluation intelligence, asymmetric settings |
| AEGIS TEE routing (2606.16358) | agent-security-governance.md §1.x | Router MITM, 851-line TCB, attested passthrough |

**Note:** agent-security-governance.md is already at 945 lines (over threshold).
SkillVetBench + AEGIS additions will push it further. Split is becoming urgent.
