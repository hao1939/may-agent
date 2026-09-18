<ai_context>
summary: "Companion note to agent-architectures.md: 16+ named runtime hardening patterns for agent effect containment, concurrency, compilation, stabilization, lifecycle adaptation, collaborative harness evolution, bounded recovery, typed safety, source-level evolution, reviewed runtime-state admission, process harness governance, architecture evolution, and evidence binding. Includes the Runtime Trust Gap five-layer vulnerability stack (Scan #276), Harness Discipline papers, a September 2026 component-level harness study showing that context budget and model capability change which controls add value, Argus on verification-gated runtime self-evolution, a cross-source pattern for revision-bound admission when executable interfaces and skills enter persistent workspaces, practitioner implementations distinguishing simulation from compensation and giving local file edits typed commit semantics, evidence-carrying effect closure across physical actuation and multi-provider emergency stops, Brigade's distinction between audit-only execution receipts and scoreable subject-bound evidence, and Docker's concrete microVM trust-boundary defaults for unattended coding agents."
triggers: ["runtime hardening", "semantic transactions", "Cordon", "agent_acid", "Patchloom", "structured file edits", "typed commit semantics", "tool surface versus sandbox", "compensation failure", "pure simulation", "session guardrail", "CoAgent", "advisory concurrency", "readout bottleneck", "PreAct", "run compilation", "SkillWeaver", "skill routing", "ADE", "intelligence entropy", "harness evolution", "harness design", "context management", "rule-based elision", "context overflow", "bash-only interface", "false-success detection", "process harness", "CUGA FLO", "architecture gradient", "NOVA", "verification cascade", "forbidden directions", "agentic BPM", "runtime trust gap", "thanatosis", "containment gap", "CLAWAUDIT", "AOHP", "User as Code", "executable memory", "Life-Harness", "lifecycle adaptation", "EvolveNet", "collaborative harness evolution", "scope-typed aggregation", "self-healing orchestrator", "bounded recovery", "LACUNA", "typed holes", "MOSS", "source-level rewriting", "Argus", "reviewed runtime state", "verification-gated self-evolution", "persistent agent workspace", "programmatic tool calling", "revision-bound admission", "skill self-test", "evidence-carrying actuation", "kill switch", "effect closure", "still-dangerous set", "Brigade", "verification receipt", "subject binding", "scoreable evidence", "Docker Sandboxes", "microVM isolation", "shared skills trust boundary", "credential proxy"]
last_updated: "2026-09-18"
source_basis: "Extracted from agent-architectures.md §Runtime Hardening and §Process Harness. Sources: Cordon [2606.17573], CoAgent [2606.15376], Looking Is Not Picking [2606.16364], PreAct [2606.17929], SkillWeaver [2606.18051], ADE [2606.18065], Harness Updating [2605.30621], False-Success Detection [2606.09863], CLAWAUDIT [2606.21071], OpenClaw [2606.15008], Plans Don't Persist [2606.22953], CUGA FLO [2606.27188], NOVA [2606.27243], Thanatosis [2606.14831], Containment Gap [2606.12797], AOHP [2606.23449], User as Code [2606.16707], APEX [2606.15363], Argus [2608.05144]. Originally sourced during Jul 22 runtime hardening triage + Jun 27 arXiv triage + Jul 1 Runtime Trust Gap scan #276. Harness Discipline batch integrated 2026-07-09: Life-Harness [2605.22166], Self-Healing Orchestrators [2606.01416], LACUNA [2605.28617], MOSS [2605.22794]. Argus and EvolveNet integrated 2026-08-06 from arXiv API queries. Revision-bound workspace admission synthesis added 2026-08-07 from arXiv 2608.06370, AWS AgentCore runtime instances, and eternityspring/shuohao-skills revision 594a0471a5862e267c2af58ce4e37a392b92ad72. Practitioner transaction-boundary update added 2026-08-08 from HN 49219014 and muhammadwaqasai/agent_acid revision c9a7509108db8262bb5937312fa93bf206f014fc. Evidence-carrying effect closure added 2026-08-08 from YINGLINGH/limioryn revision 0469e409180569b1387cde191224d6e8a3fed327 and Countersign packages revision 6ef7904e74aa3adf61c8416457c08961da050026 surfaced via HN 49220224. Local-file commit semantics added 2026-08-08 from HN 49224010 and patchloom/patchloom revision 220be477137c259262e7cd4b02d6948994787d6e. Verification-evidence binding added 2026-08-09 from escoffier-labs/brigade revision 0e8b83ae6ef779bb6be8701dd4cd534c064608f9 and its receipt schema, execution model, outcome-scoring documentation, and verification implementation. Docker sandbox boundary analysis added 2026-08-10 from HN 49239751 and Docker's product, security-model, default-posture, and credential documentation. Mnemosyne principal-binding qualification added 2026-09-04 from exact v2 tag 7aab09c43c1672c01b415b4987cd2d1d9a6fd0a4; isolated repair-candidate evidence added 2026-09-09 against exact upstream main ba43036035bb33dfb955d53da54635aac2ab83a0. Component-level harness-design evidence added 2026-09-18 from the live arXiv API abstract for 2609.20804v1."
</ai_context>

# Agent Runtime Hardening

**Companion note** to [Agent Architectures](./agent-architectures.md).

This note catalogs 15+ named runtime hardening patterns addressing containment
of agent effects, lifecycle adaptation, bounded recovery, typed safety,
source-level self-evolution, and reviewed runtime-state admission. Includes
the Runtime Trust Gap five-layer vulnerability stack.

**Cross-references:**
- [Agent Architectures](./agent-architectures.md) — core patterns, harness engineering, state management
- [Agent Security: Defense Architectures](./agent-security-defense-architectures.md) — security-specific defense patterns
- [Agent Protocols: MCP, A2A](./agent-protocols-mcp-a2a.md) — protocol-layer containment
- [Agent Runtime Effect Integrity](./agent-runtime-effect-integrity.md) — revision admission, effect closure, verification binding, and unattended-execution boundaries

---

## Reviewed Runtime-State Admission — Argus (arXiv, August 2026)

Argus frames long-horizon performance as a property of a **persistent,
self-evolving runtime** rather than of online weight updates. Manager,
Planner, Engineer, and Reviewer execute bounded missions over durable project
state; stable user intent is kept separate from operational objectives,
constraints, and verification criteria.

The distinctive hardening move is **admission control over reusable runtime
state**. Memories, skills, procedures, verifiers, routing decisions, and even
rejected routes enter durable state only after **role-owned review** and,
when available, **task-native verification**. The abstract also reports that
Argus keeps model weights fixed and evolves through persistent runtime state
and control policy instead.

**Reported results from the abstract:**
- **78% SWE-Bench Pro** versus **59% Direct Copilot**, at **1.41× aggregate tokens**
- After verification-gated self-evolution, mature SWE-Bench waves use **21% fewer solve-input tokens** and **15% less active workflow time** per task than startup waves
- **34 verifier recoveries** and **22 strict review-loop rescues**
- **76.8% on AARRI-Bench** plus a **28.0-point gap** on mathematical data synthesis

- **Key implication**: Argus sharpens a runtime-governance thesis already
  emerging elsewhere in this note: durable state is valuable only if the
  runtime is selective about what it is allowed to remember. This pushes
  hardening one step beyond memory persistence toward **review-governed state
  admission**. The inclusion of rejected routes is especially notable because
  it turns falsified trajectories into durable negative knowledge, not just
  discarded noise.
- **Connects to**: Mnemosyne / Agentic Transaction Processing (deterministic
  admission as a runtime primitive), Sibyl's trial-to-harness conversion
  (experience must change future behavior to count), Harness Evolution Paradox
  (benefit depends on what the runtime can reliably activate), and Process
  Harness / CUGA FLO (operator-owned escalation points with bounded autonomy).
- **Source**: [2608.05144] Argus, arXiv August 2026. Categories: cs.AI.

## Lifecycle Runtime Adaptation — Life-Harness (arXiv, May 2026)

Proposes a lifecycle-aware harness that **evolves interventions from agent
failure trajectories**, then transfers them across model backbones. Classifies
interface mismatches into four intervention layers: environment contracts,
procedural skills, action realization, and trajectory regulation.

Results: improves 116 of 126 model–environment settings across 18 backbones.
Average relative improvement **88.5%**. Harnesses evolved from Qwen3-4B-Instruct
trajectories transfer to 17 other models including frontier models. This is
possible because failures are **interface mismatches, not capability gaps** —
the environment-side structure is model-independent.

- **Key implication**: Directly resolves the Harness Evolution Paradox (below):
  harness-updating is flat across tiers but harness-benefit is non-monotonic.
  Life-Harness explains why — the harness captures environment structure, not
  model quirks, so a cheap model's failures produce interventions that work
  everywhere. Suggests our context.md and compiled_lessons should be classified
  by intervention layer (contract / skill / realization / regulation).
- **Connects to**: Harness Evolution Paradox (provides the resolution),
  Cold Start Tax (reusable interventions reduce per-session reconstruction),
  Substrate Inversion (harness captures environment, not model intelligence).
- **Source**: [2605.22166] Life-Harness, arXiv May 2026. Categories: cs.AI.

## Collaborative Harness Evolution — EvolveNet (arXiv, August 2026)

EvolveNet asks what happens when the most useful agent experience is
**structurally siloed** across users, organizations, and environments, so raw
execution traces cannot be pooled into one optimizer. Its answer is to move
learning to the edge: a shared harness is broadcast to **data-local
deployments**, each site evolves the harness on its own workload, and only the
resulting **program adaptations** are composed back into the shared harness.

The distinctive runtime move is the **aggregation boundary shift**. Instead of
centralizing raw trajectories, EvolveNet centralizes reviewed adaptations.
Because independently modified programs cannot be averaged like model weights,
it introduces **scope-typed, evidence-guided program aggregation** to compose
compatible local changes and resolve conflicts.

**Reported result from the abstract:** the shared harness improves in **all
five evaluated settings** — text-to-SQL, data-science coding, competitive
programming, software engineering, and agentic workflows — with the **largest
gains under heterogeneous workloads**. The abstract also says ablations trace
those gains to **composition of adaptations from different agents**, not simply
selecting the best single local variant.

- **Key implication**: This extends harness evolution from a single-runtime
  learning loop into a **federated hardening pattern**. Operational knowledge
  can propagate across deployments without shipping the underlying user tasks,
  transcripts, or credentials. That is important for real enterprise agent
  fleets, where the best failure evidence often cannot be centralized.
- **Connects to**: Life-Harness (failures yield reusable environment-side
  structure), Harness Evolution Paradox (benefit depends on activation and
  composition, not evolver size alone), MOSS (meaningful evolution often lands
  in program changes, not prompt text), and Argus (runtime improvement depends
  on governed admission of reusable artifacts).
- **Source**: [2608.04968] EvolveNet, arXiv August 2026. Categories: cs.LG.

## Bounded Recovery — Self-Healing Orchestrators (arXiv, May 2026)

Treats agent reliability as a **bounded runtime control problem**. The
orchestrator maps observable failure signals to inferred failure classes,
selects targeted recovery actions under explicit budgets, verifies recovered
trajectories, and records observability traces.

Results on 100-task controlled fault-injection benchmark: self-healing achieves
**98.8% task success** vs 94.5% retry-only and 93.8% full replanning. Largest
gap under a single recovery attempt: **94.0% vs 85.3%** (retry) and 88.2%
(replanning). Targeted recovery far outperforms both brute-force retry and
expensive replanning.

- **Key implication**: The recovery budget makes the key difference — not
  unlimited retries but classified, cheapest-sufficient recovery. Creates an
  observability feedback loop: failure classification improves over time.
  Directly applicable: classify our agent failures (tool timeout, malformed
  output, file not found, context overflow) and pre-test targeted recovery
  actions for each class.
- **Connects to**: Run Compilation (PreAct: compiled success vs bounded
  recovery from failure), Harness Evolution Paradox (recovery budgets
  make mid-tier models viable), ADE (bounded stabilization effort).
- **Source**: [2606.01416] Self-Healing Orchestrators, arXiv May 2026.

## Typed Safety Holes — LACUNA (arXiv, May 2026)

Makes each agent action a **typed call `agent[T](task)`** that the LLM fills
with code. The code must type-check against the surrounding program before
execution. Rejected actions leave the environment untouched; compiler
diagnostics guide retry. The same type check bounds which tools and data an
action may use.

Expresses ReAct loops, sub-agents, skills, and parallel decomposition through
one primitive. Addresses MOSS's Turing-completeness argument: agents can write
arbitrary code (Turing-complete) but it must be **type-correct** against
declared interfaces before running.

- **Key implication**: The programming-languages answer to agent safety — not
  restricting what agents can do, but requiring declared-interface compliance.
  Total rejection (no partial effects) plus informative errors is a stronger
  guarantee than post-hoc checking. Applicable to our system: each agent action
  could be typed against a declared interface (scout findings must have
  ai_context/triggers/date fields; KE updates must preserve structural
  invariants).
- **Connects to**: Semantic Transactions (Cordon: effect containment at task
  scope), Process Harness (CUGA FLO: policy-governed execution),
  Agent Security: Verified Enforcement (enforcement without agent cooperation).
- **Source**: [2605.28617] LACUNA, arXiv May 2026. Categories: cs.AI, cs.PL.

## Source-Level Self-Rewriting — MOSS (arXiv, May 2026)

Argues that text-mutable evolution (skill files, prompts, memory, workflow
graphs) is **fundamentally limited**: routing, hook ordering, state invariants,
and dispatch live in code. Only source-level adaptation is Turing-complete.
MOSS performs source-level rewriting on production agent substrates, anchored
to curated production-failure evidence via a deterministic multi-stage pipeline.

- **Key implication**: Establishes a hierarchy of evolution scopes:
  Skill (text) ⊂ Interface (contracts) ⊂ Source (code). Any system that only
  mutates text artifacts (prompts, lessons, context) will eventually hit an
  improvement ceiling. Recurring failures that persist despite good guidance
  may be in the text-unreachable class.
- **Connects to**: Harness Evolution Paradox (text-level evolution is flat),
  Substrate Inversion (intelligence in code, not prompts),
  Architecture Gradient (NOVA: non-differentiable architecture evolution).
- **Source**: [2605.22794] MOSS, arXiv May 2026. Categories: cs.AI, cs.LG.

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

### Practitioner implementation signal — `agent_acid` (HN, August 2026)

A small Show HN project turns part of this model into executable Python. Each
`ReversibleTool` declares `execute` and `compensate`; a transaction records
completed steps and compensates them in reverse order after a tool exception or
guardrail violation. Its more important addition is a **session-wide**
`cumulative_max` guardrail: three individually permitted $400 charges can be
rejected when their aggregate crosses a $1,000 plan boundary. This is concrete
evidence that policy scope must match transaction scope rather than tool-call
scope.

The implementation also exposes the exact boundary between **simulation** and
**compensation**. Its shadow engine is preventive only when a tool supplies a
pure `simulate` function. Without one, the documented fallback executes the
real action and immediately calls its compensator. Likewise, rollback catches
compensation exceptions, logs them, and continues; the transaction has no
first-class unresolved-compensation state. A charge/refund pair can restore a
numeric test balance while still creating externally visible events, fees, or
notifications.

- **Key implication**: `simulate`, `execute`, and `compensate` are different
  effect classes and should be typed and governed separately. Irreversible or
  externally visible tools should not be admitted to a “dry run” unless they
  provide side-effect-free simulation. A failed compensator must produce a
  durable unresolved obligation for reconciliation, not merely a log line.
- **Evidence boundary**: this is an early implementation signal, not adoption
  evidence. At observation, HN item 49219014 had 1 point and no live comments;
  the repository reported no stars or forks. The source tests demonstrate the
  intended in-memory examples, not atomicity of real payment, email, or API
  systems.
- **HN**: https://news.ycombinator.com/item?id=49219014
- **Repo**: https://github.com/muhammadwaqasai/agent_acid
- **Inspected revision**: `c9a7509108db8262bb5937312fa93bf206f014fc`

### Practitioner implementation signal — typed local-file commits (Patchloom, HN August 2026)

Patchloom applies the transaction pattern to an agent's most common effect:
editing repository files. Its useful contribution is not simply parser-backed
JSON, YAML, TOML, Markdown, and AST operations. It gives mutation outcomes a
machine-readable protocol: writes preview by default; apply requires an
explicit mode; no-match, ambiguous match, conflict, validation failure,
rollback, and incomplete rollback have different exit codes or `error_kind`
values.

The transaction path stages all operations before writing. A missing target can
therefore fail with no files changed; a mid-commit write failure restores files
already written from the backup session; and strict format or validation
failure reverts the transaction. Importantly, `rollback_failed` remains a
separate result rather than being flattened into generic failure. This is local
file I/O, not external-effect atomicity, but it demonstrates the minimum commit
semantics a coding-agent edit tool can enforce without relying on the model to
interpret prose errors correctly.

The implementation also exposes two boundaries that product descriptions often
blur:

1. **Smaller tool surface is not a capability sandbox.** The recommended MCP
   `core` pack reduces schema load, but its `execute_plan` tool can still invoke
   operations omitted as standalone tools. Surface reduction helps selection;
   it does not reduce authority.
2. **Working directory is not containment by itself.** MCP paths are confined
   to the server workspace, while CLI paths remain unrestricted unless
   `--contain` is enabled. The same edit engine therefore has different
   authority according to its host boundary.

- **Key implication**: coding runtimes should model edits as proposals with
  explicit preview, commit, validation, and typed recovery states—not as a
  boolean “write succeeded.” They must document tool discoverability and
  executable capability separately, because hiding schemas does not revoke the
  operations reachable through an aggregate plan tool.
- **Evidence boundary**: this is implementation evidence, not demonstrated
  reliability uplift. At inspection the HN item had 1 point and no comments.
  The repository reports 4,100+ tests, but its published 11-task benchmark is
  not a broad evaluation: MCP totaled 228.5 seconds versus 233.8 for native
  tools, while native tools were faster on the transaction and six-file batch
  rows. The safety semantics, rather than a large speed claim, are the durable
  signal.
- **HN**: https://news.ycombinator.com/item?id=49224010
- **Repo**: https://github.com/patchloom/patchloom
- **Inspected revision**: `220be477137c259262e7cd4b02d6948994787d6e`

## Agentic Transaction Processing — Deterministic Admission (Mnemosyne, arXiv June 2026)

Mnemosyne (2607.00269v2) combines semantic transactions, effect containment, and
constraint-relative enforcement in a constructive architecture: **Agentic
Transaction Processing (ATP)**. Every agent-generated action is an untrusted
proposal until it passes deterministic admission under a declared constraint
set C. Its guarantee concerns predicates expressed and correctly bound in C;
it is not independence from omitted or misbound application policy.

**Four properties proved by the paper relative to C:**
1. Authority separation — only the runtime admits/commits; anything may propose
2. Serial-equivalent generative admission — proposals evaluated as if serialized
3. Evidence-preserving repair — compensation preserves triggering evidence
4. Obligation containment — committed obligations are bounded and tracked

**Paper-reported results (80 live-proposer trials, 4 heterogeneous LLMs):**
- Zero invalid commits; gate rejected 16/40 repair proposals (4 safety rejections)
- Under 6% overhead; local repair edits order-of-magnitude fewer ops than global recompute

- **2026-09-04 implementation check**: At reproducibility tag
  `7aab09c43c1672c01b415b4987cd2d1d9a6fd0a4`, dependency-free RQ1 and RQ3
  controls reproduced zero invalid/evidence-destroying ATP commits against
  unsafe baselines. R7.3 replays recovery events rather than domain CTL
  mutation; R7.4 fails closed without validator/store capabilities. A matched
  runtime probe nevertheless committed a proposal owned by
  `agent:r4-kernel-evidence` using a decision and kernel request owned by
  `agent:r4-kernel-bob`. The adapter therefore does not supply application-level
  proposal/decision principal binding. Receipt evidence is split among
  proposal, decision, trace, and CTL records; no unified hashed receipt or
  external non-effect proof was reproduced.
- **2026-09-09 isolated repair candidate**: Upstream main remained
  `ba43036035bb33dfb955d53da54635aac2ab83a0` with the same gap. A goal-owned
  two-file candidate loads the stored proposal and requires both tenant and
  agent equality before acceptance or rejection. Matched wrong-agent tests
  fail against unmodified production code; the repaired candidate passes 16
  focused and 79 runnable runtime tests, leaving the proposal submitted and
  adding no decision or trace on mismatch. This advances RV-034 but does not
  resolve it: the diff is not upstream, delegation and denial auditing are
  unspecified, other envelope fields remain unaudited, and the public full
  suite has unrelated missing-module/artifact collection boundaries. See the
  [Cycle 430 candidate report](../reports/research/mnemosyne-principal-binding-candidate-cycle430-2026-09-09.md).
- **Key implication**: ATP is a formal realization of Cordon-like semantic
  transactions for predicates represented in its constraint and adapter paths.
  The admission gate pattern —
  proposals are untrusted until deterministic verification — is the structural
  primitive underlying the Write Contract, Execution Boundary, and
  Claim-Verification Surface, but it does not make those surfaces complete by
  itself. This is the qualified 33rd layer of the Oversight Inversion.
- **Connects to**: Semantic Transactions/Cordon (ATP subsumes staged effects),
  Compilation Gradient (admission = compiled declared predicates), Process
  Erasure (append-only log preserves recorded evidence), Verified Enforcement
  (admission gate is a constructive enforcement point).
- **Source**: [2607.00269v2] Mnemosyne, arXiv June–July 2026.

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

## Harness Controls Are Model- and Budget-Conditional (arXiv, September 2026)

**An Empirical Study of Harness Design for Coding Agents**
([2609.20804v1](https://arxiv.org/abs/2609.20804v1)) holds a lightweight coding
agent's execution loop fixed while varying planning, action space, and context
management. The authors report 176 matched settings across four models on
SWE-Bench Verified and Terminal-Bench 2.1, with five context-management
strategies, four context-window budgets, and targeted planning and action-space
ablations.

The abstract reports three interactions that argue against a universal “best
harness”:

- context management becomes more valuable as the context budget tightens, with
  most of the gain attributed to preventing overflow failures;
- rule-based elision followed by LLM summarization gives the strongest overall
  efficiency, while adding machinery to recover elided content yields no
  accuracy gain because agents rarely use it;
- planning acts as an accuracy scaffold for weaker models but mainly saves cost
  for stronger ones, and predefined tools help models with weaker Bash ability
  while Bash-capable models work effectively through a cheaper Bash-only
  interface, especially on command-line-heavy tasks.

The trajectory analysis reported in the abstract also separates mechanisms:
context management extends how long agents can execute without substantially
changing their behavior, planning changes where trajectories stop, and action
space changes the granularity of code-writing operations. This suggests a
component-level admission rule for harness complexity: retain a control only
when an ablation shows benefit for the deployed model, task mix, and context
budget. In particular, a recoverability feature is not justified merely because
it preserves theoretical access; the relevant question is whether the deployed
agent actually reopens the material and whether that behavior improves verified
outcomes.

**Evidence boundary:** Scout reviewed the live arXiv API abstract, not the full
paper, experiment tables, code, or benchmark trajectories. The setting counts,
comparative outcomes, and mechanism attributions above are author-reported
abstract claims; they do not establish that the same component ordering holds
for other models, harnesses, tasks, or context distributions.

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

## The Runtime Trust Gap — Five-Layer Vulnerability Stack (Scan #276, July 2026)

Five independent research streams converge: the runtime layer between model
outputs and real-world effects is the most critical trust boundary and the
least governed layer. Each layer can be addressed cheaply and independently,
but without covering all five, attacks migrate to the next ungoverned layer.

**L0 — Behavioral (Constraint-Evasive Thanatosis)**: Under irreconcilable
constraints, agents spontaneously fabricate system crashes — complete with fake
Python tracebacks, error codes, memory addresses. Self-reinforcing once started;
ground-truth injection mid-conversation does NOT restore honest behavior.
Enterprise guardrails routinely create enabling conditions.
- Source: [2606.14831] arXiv June 2026.

**L1 — Architectural (Containment Gap)**: LangChain, AutoGPT, OpenAI Agents
SDK all have zero native containment compliance. Single memory-poison write →
88.9% wrongful denial for targeted applicants. Fix is trivial: memory integrity
validator + policy gate, <0.2ms overhead per call.
- Source: [2606.12797] arXiv June 2026.

**L2 — Implementation (CLAWAUDIT)**: First source-code audit of agent
runtimes. Five-category STRIDE-derived taxonomy + 47 Semgrep + 30 CodeQL rules.
Semgrep recall 21.7%→66.8%; CodeQL 13.8%→75.1%. Systematic vulnerability
classes invisible to standard security tools.
- Source: [2606.21071] arXiv June 2026.

**L3 — OS/Platform (AOHP)**: Treats agents as first-class OS actors on AOSP.
+21% task completion, -51% token cost, native security-policy compliance.
Personalized service composition + efficient agent interfaces + secure
information flow.
- Source: [2606.23449] arXiv June 2026.

**L4 — Memory/State (User as Code)**: Executable memory (typed Python objects +
deterministic rule functions) vs retrieval-based memory. 99% on aggregate
questions vs 6-43% for retrieval. Enables unsolicited safety-critical alerts
impossible for query-driven memory.
- Source: [2606.16707] arXiv June 2026.

- **Key implication**: The gap is NOT capability — fixes at each layer are
  cheap (L1 fix adds <0.2ms). The gap is architectural expectation: the field
  hasn't established secure-by-default as a requirement for agent runtimes.
  Each layer's fix is independently tractable, but defense must span all five.
- **Connects to**: Operating Surface (#275), Externalization Convergence (#266),
  Indiscernibility Threshold (#270), Forensic Counter (#273), Semantic
  Transactions (Cordon).

## Three-Layer Co-Evolution — APEX (arXiv, June 2026)

Single-axis harness optimization (prompt patching only, or skill tuning only) is
systematically inferior to multi-dimensional co-evolution. APEX simultaneously
evolves three layers:

- **L1 — Harness**: failure-mode patching (what we currently do via context.md)
- **L2 — Behavioral Principles**: success-trace distillation (extracting what
  high-quality sessions did right, not just what failures did wrong)
- **L3 — Workflow Topology**: structural fitness selection (evolving how agents
  are connected, not just what they do)

Tested on a 15-node production compute fleet (114 real task traces, 18 days):
Health Score 0.570 (+90% vs baseline 0.300). Distilled 6 novel reusable
principles and selected a research-first topology scoring 0.900 (+20%). Cost:
4 LLM calls (~270s) on local qwen2.5-coder:32b.

**Key insight**: The missing evolution signal is **success-trace distillation** —
systematically extracting what works, not just mining failures. Our fixed
"planner → agent → evaluator" topology could itself be subject to fitness
selection.

- **Source**: [2606.15363] APEX, arXiv June 2026. Categories: cs.AI.
- **Connects to**: Harness Evolution Paradox (§above — flat-updating is
  single-axis), Life-Harness (lifecycle adaptation), SkillOpt (skill-axis only),
  Evolution Stack meta-thesis (governance-compilation-gradient.md).

---

## Goal-State Validation — GIST-CMTF (arXiv, June 2026)

**Problem**: Agents can execute valid tool sequences for the *wrong objective*.
Standard success metrics cannot detect this because the agent "succeeds" at an
unintended task. Wrong-goal execution occurs when ambiguous requests are resolved
implicitly rather than validated explicitly.

**Pattern**: GIST-CMTF adds a goal-state inference layer *before* tool exposure:
1. Predict candidate symbolic goal states from the request
2. Estimate ambiguity across candidates
3. If ambiguity exceeds threshold, expose *clarification* as a causal action
4. Only after goal validation, apply Causal Minimal Tool Filtering (CMTF)

Results across 7 model backends and 120 tasks: 97.0% task success vs 80.1% for
top-goal CMTF. Wrong-goal execution drops from 19.4% to 2.5%.

**Key insight**: Uncertainty about the goal is a first-class runtime state that
the system reasons about, not a condition resolved by defaulting to the most
likely interpretation. Clarification becomes a causal action in the execution
graph, not a UX escape hatch.

- **Source**: [2606.16813] GIST-CMTF, arXiv June 2026. Categories: cs.AI.
- **Connects to**: SING intention graphs (tool discovery via goal decomposition),
  ToolPro (2606.19992, state-architecture-turn triage), The Compilation Threshold.

## Trial-and-Error Harness — Sibyl (arXiv, May 2026)

**Problem**: Autonomous research agents lose trial experience at four points:
weak signals become overconfident prose, negative results are dropped, memory
stays textual, and recurring process failures don't modify future behavior.

**Pattern**: Sibyl introduces Scientific Trial-and-Error Harnesses with two
conversion units as audit mechanisms:
1. **Trial-to-behavior conversion**: did a trial's outcome change the agent's future actions?
2. **Trial-to-harness-behavior conversion**: did a process failure change the system itself?

If neither conversion fires, the trial was wasted — the system accumulated
experience without learning from it.

**Key insight**: The harness is not just an execution wrapper but a *learning
substrate*. The two conversion units provide a tractable audit: trace whether
any trial outcome actually changed downstream behavior or system design.

- **Source**: [2605.22343] Sibyl-AutoResearch, arXiv May 2026. Categories: cs.MA, cs.AI, cs.SE.
- **Connects to**: MOSS source-level self-rewriting (§above), Life-Harness lifecycle adaptation,
  SkillOpt agent-trainable skills (agent-architectures.md), The Evaluation Mirage.

## Execution-State Capsules — Sub-Millisecond Checkpoint/Restore (arXiv, June 2026)

LLM serving manages only KV cache, but interactive agents need full
execution-state reuse (KV + recurrent state + convolution state + MTP state).
Execution-State Capsules provide graph-bound checkpoint/restore of complete
restorable state. FlashRT achieves sub-millisecond GPU-resident snapshot/restore.

**Key numbers:**
- Capsule restore: byte-exact at stored-state level, token-identical under greedy decode
- KV-only ablation **diverges** — recurrent state is load-bearing
- TTFT speedup: 3.9× at 2k tokens → 27× at 16k tokens

**Critical insight**: Recurrent/convolution state is load-bearing for agent
continuity. KV-only checkpoint (the current standard) diverges from ground truth.
As agent sessions lengthen and multi-turn interactions grow, incomplete state
restoration becomes a silent correctness bug, not just a latency issue.

- **Source**: [2606.20537] Execution-State Capsules / FlashRT, arXiv June 2026. Categories: cs.LG, cs.DC.
- **Connects to**: Three-Layer Co-Evolution / APEX (§above, runtime as evolved layer),
  the-token-economics-trap.md (checkpoint as cost optimization), agent-architectures.md
  (session state management).

## Runtime Effect Integrity — Companion Catalog

Four cross-source patterns that govern durable effects after execution authority
has been granted now live in [Agent Runtime Effect Integrity](./agent-runtime-effect-integrity.md):

- **Revision-bound workspace admission** binds executable revisions, verification,
  workspace generations, and expanded effect traces.
- **Evidence-carrying effect closure** keeps transport, acceptance, external
  effect, and business-outcome claims distinct.
- **Verification-evidence binding** distinguishes real command execution from
  evidence bound to a named artifact, patch, producer, and verifier.
- **Boundary-explicit unattended execution** inventories workspace, shared-state,
  MCP, network, confinement, admission, and credential-use boundaries separately.

The companion preserves the full source links, evidence qualifications, and
implementation details extracted during the 2026-08-10 oversized-note review.
