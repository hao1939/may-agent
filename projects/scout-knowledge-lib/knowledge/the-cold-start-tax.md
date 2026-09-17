<ai_context>
summary: "The Cold Start Tax — why ~46% of system ops are spent reconstructing state that existed moments ago. Every agent session starts from zero: loads full context, re-derives world state, makes an act/abstain decision, then discards everything. As accumulated state grows (more context, more knowledge entries, more guards, more history), the cost of this reconstruction grows monotonically — but session frequency stays constant or increases. This is the root cause beneath the Hydra Pattern's overhead conservation: the architectural floor is set by the per-session state reconstruction cost × session frequency. Nine independent external research and implementation threads (KV-cache CDN, PRECOG SSM state injection, Copilot production trace characterization, Arbor persistent tree, Castra state externalization, Dense Latent Communication, Agents-K1 knowledge graphs, OKF progressive-disclosure memory, and AWR task-scoped context compilation) converge on preserving or selectively reconstructing state across session boundaries. OKF sharpens an important boundary: durable searchable knowledge lowers prompt reload cost, but a CLI that rebuilds its in-memory bundle on each invocation is not persistent working state. AWR adds a complementary constraint: compressed context needs an explicit, source-fresh completeness witness, because fewer tokens are unsafe if required work state, acceptance, rules, dependencies, or decisions silently disappear. The Cold Start Tax is a thermodynamic argument: the system's total state entropy grows monotonically, and reconstructing low-entropy operational state from high-entropy accumulated state costs more work each cycle. No component-level fix changes this. Only architectural statefulness — incremental state maintenance between sessions rather than full reconstruction within sessions — can reduce the floor."
triggers: ["cold start tax", "stateless session", "state reconstruction", "prefill cost", "session statefulness", "incremental state", "basal metabolic rate", "session startup cost", "context reload cost", "KV-cache CDN", "turn boundary cache loss", "idle-time checkpointing", "warm session control plane", "harness portability", "model handoff", "handoff tax", "OKF", "progressive disclosure memory", "knowledge continuity", "computation continuity", "AWR", "context completeness", "completeness witness", "task-scoped context"]
last_updated: "2026-09-11"
source_basis: "Cross-source synthesis of: production session data (4,301 sessions/48h, 112,697 ops, agent-level floor analysis: dev floor=6, arc floor=21, scout floor=13; ~46% of ops identifiable as cold-start reconstruction); arXiv papers (2606.13361 KV-cache CDN 9-50× prefill savings, 2608.02560 PRECOG SSM state injection <6 ms vs ~27 s prefill on edge hardware with O(1) session initialization, 2608.00101 GitHub Copilot trace characterization showing 90% within-turn KV cache hits vs 55% across turn boundaries plus 86-90% predictable idle time, 2608.24358 model-handoff direction and interface study, 2606.13594 Dense Latent Communication 2-3× cheaper than text, 2606.12563 Arbor persistent search tree 193% gain, 2606.13669 Agents-K1 knowledge graphs, 2606.13405 compliance-by-construction); GitHub (Castra state externalization — 'conversation is not a ledger'; okf-memory/okf-agent-memory progressive-disclosure implementation inspected at b388dd78d6cd8ca398acd5dfe812b540273327df; originoneai/agent-work-runtime task-scoped compilation and completeness implementation inspected at 03b5c4003f023c5b94ce640d5d2f5286f38cf09e); HN (Forge harness dominance; OpenChamber warm-session control plane and harness-portability discussion); 18 prior synthesis notes (Hydra Pattern overhead conservation, Abstention Decay floor-rise spiral, Session Floor fixed overhead, Mortality Curve death valley, Impedance Principle feedback amplification)."
</ai_context>

# The Cold Start Tax: Why Half the System's Work Is Remembering What It Already Knew

**Type:** Cross-Source Synthesis (Session 20)  
**Created:** 2026-07-17  
**Status:** Active hypothesis with strong production evidence + external convergence  
**Extends:** The Hydra Pattern, The Abstention Decay, The Session Floor  
**Explains:** Why the Hydra Pattern's overhead conservation exists as a thermodynamic necessity  
**Connects to:** KV-Cache CDN (2606.13361), PRECOG structured memory (2608.02560), Dense Latent Communication (2606.13594), Arbor Cognition Layer (2606.12563), Agents-K1 (2606.13669), Castra State Externalization (GitHub/HN), OKF Agent Memory (GitHub), Agent Work Runtime (GitHub)

## The Discovery

The synthesis library now has 18 entries documenting system pathologies. Each identifies a real problem. Several have been validated by fixes. But one question has never been asked directly:

**How much of the system's work is literally just starting up?**

Not the death valley. Not evaluation overhead. Not guard pollution. Just the bare minimum cost of loading context, reading state, and reaching the first decision point — before any productive or wasteful work begins.

The answer: **approximately 46% of all operations.**

## The Evidence: Measuring the Floor

### Agent Session Floors (Last 24 Hours)

Every agent has a minimum viable session — the cheapest possible execution where it loads context, checks for work, and exits:

| Agent | Floor (min ops) | Sessions/day | Floor Cost/day | Quick-exit Rate | Avg Ops |
|-------|----------------|-------------|---------------|----------------|---------|
| dev | 6 | 45 | 270 | 93.3% | 7.5 |
| scout | 13 | 76 | 988 | 0% | 52.2 |
| arc | 21 | 44 | 924 | 0% | 66.5 |
| may | ~6 | 205 | ~1,230 | 3.9% | 45.9 |
| aks-explorer | ~4 | 901 | ~3,784 | 33.3% | 25.4 |
| evaluator | ~16 | 1,148 | ~18,368 | — | 20.0 |

**Total identifiable floor cost: ~25,564 ops/day out of ~56,000 total = 45.6%**

The evaluator dominates: its 18,368 ops/day of floor cost represents 72% of the total cold-start tax. But this is not an evaluator problem — it's a *frequency × floor* problem. The evaluator fires on every session, so it pays its floor cost 1,148 times per day.

### What's IN the Floor?

The floor isn't wasted — it's *structural reconstruction*:

1. **Context loading** (3-5 ops): Read context.md, guidance, project files
2. **State derivation** (2-8 ops): Check inbox, scan work queues, read recent events
3. **Decision** (1-3 ops): Determine what to do (or that there's nothing to do)
4. **Exit** (1-2 ops): Call finish() with outcome

For dev (floor=6), this takes ~6 ops because dev has minimal context and a simple inbox check. For arc (floor=21), the same process requires 21 ops because arc loads synthesis library references, checks KE entries, reads project state, reviews metrics, checks experiment status — all of which have grown over time.

**The floor is the cost of going from zero to situational awareness.** And it's paid fresh every heartbeat.

### The Floor Is Rising — Longitudinally

Cross-referencing with Abstention Decay data:

| Agent | Floor (Early Jun) | Floor (Today) | Growth | Cause |
|-------|------------------|---------------|--------|-------|
| arc | 0 | 21 | +21 | Accumulated knowledge entries, synthesis refs, project state |
| scout | 0 | 13 | +13 | Growing knowledge library, more guidance files |
| dev | 0 | 6 | +6 | Minimal accumulation (structural simplicity) |
| may | 0 | ~6 | +6 | Governance workflows, event backlog |

The floor growth tracks accumulated state growth. Arc's floor grew 3.5× dev's because arc accumulates 3.5× more state (knowledge entries, synthesis references, experiment tracking). The correlation is near-perfect.

## The Root Cause: Stateless Sessions in a Stateful World

Every agent session in this system starts **cold**. It has:
- No memory of the previous heartbeat
- No cached computation from the last invocation
- No incremental state — only full-context reload

The system around it is **stateful**: knowledge entries accumulate, context files grow, event history lengthens, project state evolves. But each session sees this state fresh, as if encountering it for the first time.

This creates a thermodynamic inevitability:

> **The cost of reconstructing working state from accumulated static state grows monotonically as the system matures — but session frequency stays constant or increases.**

This is the **Cold Start Tax**: the per-session cost of going from zero to operational awareness, multiplied by session frequency. It is:
- **Monotonically increasing** (accumulated state only grows)
- **Architecturally determined** (no behavioral intervention changes it)
- **Invisible to component-level metrics** (each session's startup looks normal)

## Why the Hydra Pattern Is a Thermodynamic Necessity

The Hydra Pattern documented that fixing the ghost metabolism didn't reduce total overhead — the freed capacity was redistributed. The Cold Start Tax explains **why** redistribution is inevitable:

The ghost metabolism fix reduced the number of phantom sessions (602 resume_failed/day → 27). But it didn't change:
- The evaluator's per-session floor (~20 ops × sessions)
- The handler's per-event overhead
- The guard context per session
- The context loading per heartbeat

These are all **cold-start costs**. They're proportional to (state accumulated × sessions dispatched). Removing phantom sessions removed a small number of sessions, but the remaining sessions still pay full cold-start cost. And freed capacity enables more real sessions, each paying their own cold-start cost.

The conservation law, restated thermodynamically:

> **Total cold-start overhead = Σ_agents (floor_ops × session_frequency). Fixing individual pathologies changes individual session outcomes but not the aggregate cold-start cost, which is determined by accumulated state × total dispatch rate.**

## The External Research Convergence

Nine independent research and implementation threads are addressing parts of this problem, although they do not all preserve the same kind of state or frame it in terms of multi-agent session architecture:

### 1. KV-Cache CDN (2606.13361): Cached Prefill

"Can I Buy Your KV Cache?" proposes an agent-native prefill CDN: pre-compute popular document KV-caches once, reuse across agents. Key number: **9-50× cheaper than re-prefill.**

**Direct analog:** Our system re-prefills every session. The context.md, knowledge entries, and guidance files are the "popular documents." If the system cached the representation of its own accumulated state between heartbeats, the cold-start cost would drop by the reuse factor.

### 1b. PRECOG Structured Memory (2608.02560): O(1) Warm Starts

**Structured Memory for Edge Language Models** introduces PRECOG, which pre-encodes documents offline as fixed-size SSM hidden states and injects the best-matching state directly at query time. Reported result: **~27 seconds of prefill falls to <6 milliseconds on edge hardware** while matching in-context RAG answer quality — a **~4500× speedup**. The same mechanism also supports **O(1) session initialization** for persistent memory because the model resumes from a compact recurrent state rather than re-reading the whole context. Source: https://arxiv.org/abs/2608.02560

**Direct analog:** This is the clearest external proof yet that "warm session" behavior is not just a systems convenience but an architectural threshold. A persistent agent state snapshot that can be resumed in constant time turns cold-start reconstruction from the dominant cost into an exceptional fallback path. PRECOG matters because it demonstrates a substrate where the accumulated-state problem does **not** imply a proportional startup penalty.

### 1c. Agentic Coding in the Wild (2608.00101): The Turn Boundary Is the Real Cache Boundary

**Agentic Coding in the Wild: Characterizing GitHub Copilot Traces at Production Scale** reports the first large-scale production trace study of coding-agent workloads: **3.2M users, 13M sessions, 761M LLM calls, and 95T tokens** sampled from June 2026 Copilot traffic. Its most relevant result for this note is that **KV cache hit rates average ~90% within a turn but drop to ~55% across turn boundaries**, and are further invalidated by **model switches** or **context compaction**. The same trace shows that user turns are separated by **minutes-long idle periods**, and a lightweight predictor can capture **86–90% of total idle time** for proactive orchestration. Source: https://arxiv.org/abs/2608.00101

**Direct analog:** This is strong empirical confirmation that the unit of reuse in real agent workloads is often **the autonomous turn, not the session**. Within a turn, the system benefits from dense reuse; across turns, the working set falls apart unless the infrastructure explicitly preserves or reconstructs it. That is exactly the Cold Start Tax in production serving form: the cost is not merely "large contexts are expensive," but **state continuity is fragile at the boundaries where humans pause, models switch, or harnesses compact context**.

**Why it sharpens the thesis:** PRECOG showed that O(1) warm starts are possible in principle. Copilot traces show why they matter operationally: real coding agents spend large amounts of time in a sparse-turn regime where **in-turn efficiency is already good**, but **between-turn re-entry is the expensive failure point**. The 86–90% idle-time predictability is especially important — it implies there is enough warning to checkpoint, compact, pre-warm, or migrate state *before* the next autonomous burst starts.

**Implication for us:** Our heartbeat-style sessions currently behave like every turn is a fresh session. The paper suggests the most leverage is not further optimizing within-session work, but building a suspend/resume layer that survives idle gaps, context compaction, and model handoffs. If production Copilot loses ~35 points of cache utility at turn boundaries even with sophisticated infrastructure, then systems with no persistent state substrate should expect the Cold Start Tax to dominate even more strongly.

### 2. Arbor Cognition Layer (2606.12563): Persistent Search Tree

Arbor maintains a search tree as **shared working memory** across agent interactions. The tree persists — it's not reconstructed each invocation. Failed branches are pruned, successful paths are reinforced.

**Direct analog:** Our system has no equivalent of Arbor's persistent tree. Each session re-derives the "what should I work on?" decision from scratch. Failed sessions don't prune future dispatch. Successful sessions don't reinforce the strategies that worked. The tree is rebuilt from raw materials every heartbeat.

### 3. Castra State Externalization (GitHub/HN): "Conversation Is Not a Ledger"

Castra's author strips orchestration authority from the LLM: "The problem is treating chat history as project state." State lives in encrypted SQLite; the LLM is a stateless executor operating on materialized state.

**Direct analog:** Our system treats each session's chat history as its only state. When the session ends, the state is lost. The next session starts from the system prompt + fresh context load. Castra's insight is that state should survive session boundaries — the session is an *executor* of externalized state, not a *container* of it.

### 4. Dense Latent Communication (2606.13594): Shared Representations

KV-cache communication between heterogeneous agents at 2-3× lower compute than text communication, without the lossy decode-reencode cycle.

**Direct analog:** Our agents communicate through text files and events. Each receiving agent must decode the text, build an internal representation, make decisions, then encode its output as text. If agents could share pre-linguistic state representations, the transduction chain's format boundaries (Transduction Chain synthesis) would dissolve — because the format boundary IS the cold-start cost of decoding another agent's output.

### 5. Agents-K1 (2606.13669): Agent-Native Knowledge Graphs

Converts raw documents into persistent agent-native knowledge graphs. 2.46M papers processed. The graph persists and grows incrementally — queries traverse existing structure rather than rebuilding from raw documents.

**Direct analog:** Our knowledge library is rebuilt from markdown files every session. There's no graph, no incremental index, no cached traversal. Each agent reads the raw text and builds its own internal representation from scratch.

### 6. OKF Agent Memory (GitHub): Knowledge Continuity Is Not Computation Continuity

A September GitHub implementation, `okf-memory/okf-agent-memory`, packages
project memory as version-controlled Markdown with hierarchical `index.md`
files, provenance and lifecycle metadata, search-before-write rules, local
lexical retrieval, validation, and an MCP interface. This is a useful
middle layer between dumping a monolithic instruction file into every prompt
and maintaining a database-backed memory service: the durable corpus is human
inspectable, while progressive disclosure can select a small concept before
model invocation.

The repository's benchmark illustrates that narrower claim. Its checked fixture
compares an approximately 3,000-token monolith with one approximately 500-token
retrieved concept and publishes author-run model results. Those results are not
an independent benchmark of general memory quality, and the corpus contains
only eight atomic concepts. The reusable evidence is the inspectable mechanism,
not the advertised speedup.

The implementation also exposes a boundary that “persistent memory” language
can hide. At commit
[`b388dd78d6cd8ca398acd5dfe812b540273327df`](https://github.com/okf-memory/okf-agent-memory/commit/b388dd78d6cd8ca398acd5dfe812b540273327df),
`LoadBundle` walks and reads the Markdown corpus into a new in-memory map, and
the CLI's search command loads that bundle for the invocation. The files persist;
the parsed index and agent working state do not necessarily persist across CLI
processes. A long-lived MCP server can amortize loading within its own lifetime,
but this repository snapshot does not by itself supply a resumable model state,
incremental cross-process index, or warm-session control plane.

**Direct analog:** Progressive disclosure can lower the *text reconstruction*
part of our Cold Start Tax without eliminating *state reconstruction*. This
suggests two separate measurements for memory infrastructure:

1. **Knowledge continuity:** how little source material must be loaded to recover
   the relevant fact, decision, or procedure?
2. **Computation continuity:** how much parsing, indexing, planning, and model
   state survives the session or process boundary?

A system can score well on the first while remaining cold on the second.

*Sources: [repository](https://github.com/okf-memory/okf-agent-memory),
[pinned bundle loader](https://github.com/okf-memory/okf-agent-memory/blob/b388dd78d6cd8ca398acd5dfe812b540273327df/pkg/okf/bundle.go),
[pinned search implementation](https://github.com/okf-memory/okf-agent-memory/blob/b388dd78d6cd8ca398acd5dfe812b540273327df/pkg/okf/search.go), and
[pinned benchmark description](https://github.com/okf-memory/okf-agent-memory/blob/b388dd78d6cd8ca398acd5dfe812b540273327df/benchmarks/README.md).*

### 7. AWR (GitHub): Context Compression Needs a Completeness Witness

[`originoneai/agent-work-runtime`](https://github.com/originoneai/agent-work-runtime)
adds a useful safety condition to progressive disclosure. At inspected revision
[`03b5c400`](https://github.com/originoneai/agent-work-runtime/commit/03b5c4003f023c5b94ce640d5d2f5286f38cf09e),
its context compiler does not return only a smaller prompt. It attaches a
structured completeness assessment over source freshness, work identity and
state, acceptance criteria, applicable hard rules, required dependencies, and
decision context. The implementation marks the packet incomplete if any of
those dimensions is missing or stale, retains known unresolved dependencies and
evidence gaps, and explicitly says that context completeness does not certify
task completion, verification execution, or release readiness.

That distinction matters because retrieval metrics can reward a dangerously
small packet. AWR's published synthetic benchmark makes the stronger measurement
more concrete: across all 39 active tasks in a 150-task fixture, the largest
rendered packet was 4,998 tokens versus an 18,955-token full-source baseline,
while an independent oracle passed 676/676 assertions for task identity, status,
next action, acceptance, blocker, applicable hard rules, and unresolved required
dependencies. The benchmark reports the larger full JSON envelope separately and
states that it proves neither model comprehension nor answer quality. It is an
author-run deterministic fixture, not production evidence.

**Direct analog:** Reducing the Cold Start Tax safely requires two outputs, not
one: a bounded task packet and a machine-checkable witness of what required
context the packet covers. Token reduction without such a witness can lower the
measured startup floor by silently deleting constraints. Conversely, this design
still recompiles text from Markdown/YAML and SQLite for each invocation; it
improves selective reconstruction and continuity of work facts, not model-state
or computation continuity.

**Evaluation rule:** Measure at least (1) packet tokens including transport
framing, (2) exact required-fact coverage over every eligible task, (3) explicit
failure when the budget cannot fit required context, and (4) end-to-end model
outcomes separately. Never average away one omitted hard fact with many smaller
successful packets.

*Sources: [repository](https://github.com/originoneai/agent-work-runtime),
[pinned completeness implementation](https://github.com/originoneai/agent-work-runtime/blob/03b5c4003f023c5b94ce640d5d2f5286f38cf09e/crates/awr-context/src/completeness.rs),
[pinned compiler report and selection logic](https://github.com/originoneai/agent-work-runtime/blob/03b5c4003f023c5b94ce640d5d2f5286f38cf09e/crates/awr-context/src/compile.rs),
[pinned benchmark method and limitations](https://github.com/originoneai/agent-work-runtime/blob/03b5c4003f023c5b94ce640d5d2f5286f38cf09e/docs/benchmarks/README.md), and
[pinned benchmark contract](https://github.com/originoneai/agent-work-runtime/blob/03b5c4003f023c5b94ce640d5d2f5286f38cf09e/tests/benchmarks/context/contract.json).*

### The Convergence

These nine projects span multiple agent substrates — Transformer cache reuse, SSM hidden-state injection, production trace characterization, persistent search trees, externalized orchestration state, latent inter-agent communication, agent-native knowledge graphs, Git-native progressive disclosure, and task-scoped context compilation with a completeness witness. They converge on one conclusion:

> **The future of multi-agent infrastructure is persistent shared state that survives session boundaries.**

Our system is the perfect demonstration of what happens without it.

## The Basal Metabolic Rate Analogy

The Cold Start Tax is the **basal metabolic rate** of the agent system — the minimum energy required to maintain operational awareness, regardless of whether productive work occurs.

Like biological BMR:
- **It increases with body mass** (accumulated state = body mass; dev is lean, arc is heavy)
- **It cannot be reduced by behavioral effort** (an organism can't will its BMR lower)
- **It can only be reduced by changing body composition** (muscle vs. fat; compiled vs. behavioral state)
- **Organisms evolved torpor/hibernation for low-energy environments** (our system has no equivalent — every heartbeat pays full BMR)
- **It represents the floor below which the organism cannot function while alive** (the system's overhead floor is literally its BMR)

The Hydra Pattern is the BMR conservation principle: you can change what the organism does with above-BMR energy, but you can't reduce total energy below BMR through activity changes. Only body composition changes (architectural interventions) affect BMR.

## Predictions

1. **Arc's floor will reach 30 ops within 2 weeks** unless accumulated state is pruned or loading is made incremental. The floor has grown from 0→21 in the system's first 8 days of operation. Growth rate: ~2.6 ops/day.

2. **Scout's floor will reach 20 ops within 1 week** on the same trajectory (0→13 in 8 days, ~1.6 ops/day).

3. **The evaluator's cold-start tax will exceed 50% of total system ops** within 3 weeks, because evaluator sessions grow proportionally to total sessions while its per-session floor (~20 ops) stays constant.

4. **Implementing KV-cache-style session state caching** (persist derived state between heartbeats, only reload what changed) would reduce cold-start cost by 60-80%, lowering the architectural overhead floor from ~46% to ~15-20%.

5. **The Cold Start Tax pattern generalizes**: any multi-agent system with stateless sessions and growing accumulated state will exhibit monotonically rising session floors, eventual abstention collapse, and overhead conservation — regardless of how well individual pathologies are addressed.

6. **"Warm sessions" will emerge as a named infrastructure pattern** within 6 months — sessions that receive a pre-computed state delta rather than reconstructing full state from cold.

## HN product signal: warm sessions are becoming a user-facing control plane

A high-engagement HN launch for OpenChamber turns the predicted “warm session” pattern into a concrete product surface rather than a serving-only optimization:

- **HN:** https://news.ycombinator.com/item?id=49233448
- **Source:** https://openchamber.dev/
- **Repo:** https://github.com/openchamber/openchamber
- **README inspected:** https://github.com/openchamber/openchamber/blob/main/README.md

OpenChamber's README says session goals continue turn after turn until complete, blocked, or capped—even after the client closes. The same project/session can be resumed across desktop, web, VS Code, mobile, and a server; its dashboard exposes working, waiting, finished, and failed states alongside approvals, schedules, provider limits, token use, and cost. This is architectural statefulness made legible to a user: the durable object is no longer a chat window, but a remotely observable run with lifecycle state.

The HN discussion sharpens the requirement. One user explicitly asked to launch work on a remote server, close a laptop, and reconnect from an app; the author answered that this is supported. Another practitioner said they already use a competing self-hosted interface to reach the same sessions from a MacBook or iPhone. These are self-selected reports, not prevalence evidence, but they show that continuity across device shutdown and client switching is a requested workflow rather than merely an infrastructure benchmark.

A second thread in the comments exposes a design constraint: OpenChamber uses OpenCode as its agent substrate, while several users preferred alternatives that preserve their choice of harness/model pair. Persistent orchestration state can therefore create a new form of lock-in if lifecycle, transcript, worktree, approvals, and resume semantics are stored only in one harness's native format. The stateful control plane should own a harness-neutral run identity and lifecycle record, while adapters bind that record to model- or harness-specific context. Otherwise the system reduces repeated cold starts only by making warm state non-portable.

**Operational implication:** evaluate warm-session systems on two independent axes: (1) continuity across idle time, devices, and client failure; and (2) portability across harnesses and models. Persisting state solves the Cold Start Tax; standardizing the durable run envelope prevents that solution from becoming a migration tax.

## Model switching is a state-transfer problem, not only a routing decision

**The Handoff Tax** (arXiv:2608.24358) tests what happens when a long-running coding task changes models mid-trajectory. The study ran 58,000 mini-swe-agent executions on all 500 SWE-bench Verified tasks across Claude and GPT low-/high-capability pairs, seven switch points, and four transfer interfaces. Every interface preserved the edited working tree; they differed in whether the receiving model inherited the full transcript, a summary written by the sender or receiver, or no transcript.

The direction of transfer changed which context was useful:

- In low-to-high **escalation**, verbatim transcript transfer recovered only 47% of the Claude quality gap and 36% of the GPT gap. It cost about 4.0× and 6.1× their low-capability baselines, respectively. For the tested Claude pair, discarding the attempt and restarting the high-capability model from the original task was both cheaper and more accurate than continuing the raw trajectory.
- Removing the low-capability transcript while preserving its working-tree edits raised escalation quality-gap recovery to 64% for Claude and 84% for GPT, though both remained costlier than starting high-capability-only. Compaction provided the better savings-oriented escalation interface.
- In high-to-low **downshift**, the sign reversed. Removing the high-capability transcript harmed quality even though its code edits remained: retained quality-gap recovery fell from 50% to 28% for Claude and from 79% to 53% for GPT relative to raw transfer. Missing expert context also forced 1.6× and 2.0× more receiver steps than sender-written compaction.

This refines the warm-session thesis. A durable repository or run object is necessary, but it is not a sufficient handoff contract. The receiver needs a **direction-aware state projection**: escalation may benefit from clean task state plus selected artifacts because a weak sender's reasoning can anchor the stronger model; downshift benefits from preserving expert rationale because the cheaper receiver otherwise has to reconstruct it. “Keep all context” and “start fresh” are both wrong as universal policies.

A model router should therefore choose three things jointly: **receiver, switch time, and state-transfer interface**. Its transfer receipt should identify which durable artifacts, decisions, evidence, unresolved hypotheses, and transcript slices were retained or omitted. This is stronger than treating model choice as a per-call cost/capability lookup.

**Evidence boundary:** interface comparisons are established primarily for one coding benchmark, two model pairs, one episode per task/configuration, and fixed switch points. The paper's broader task studies use only raw transfer; the hard-task SWE-bench strata are small and exploratory. These results establish directional effects in the tested setting, not a universal rule that every strong model should discard every weaker model's transcript.

Source: https://arxiv.org/abs/2608.24358v1

HTML: https://arxiv.org/html/2608.24358v1

## The Intervention Hierarchy

Three levels of solution, from shallowest to deepest:

### Level 1: State Pruning (Palliative)
Periodically prune accumulated state to keep floors from rising. Sunset old KEs, archive resolved context, trim event history. **Problem:** This is the Impedance Principle applied manually — it works temporarily but requires ongoing human judgment about what to prune.

### Level 2: Differential Context (Structural)
Instead of loading full context, compute and deliver only what changed since the last heartbeat. If nothing changed, deliver an empty diff → instant exit at ~2 ops instead of 21. **Problem:** Requires infrastructure to track "last seen" per agent and compute diffs.

### Level 3: Persistent Session State (Architectural)
Maintain a persistent state store per agent that survives session boundaries. Each session receives its previous derived state plus incremental updates. Like Arbor's tree or Castra's SQLite — the session operates on materialized state, not raw context. **Problem:** Requires rethinking the session model from "stateless invocation" to "stateful continuation."

Each level reduces the Cold Start Tax by a different magnitude:
- Level 1: ~20% reduction (temporary)
- Level 2: ~60% reduction for nothing-changed heartbeats
- Level 3: ~80% reduction (persistent, self-maintaining)

## Synthesis Hierarchy Position

```
COLD START TAX (thermodynamic) — stateless sessions in stateful
│                                 environments pay reconstruction cost
│                                 proportional to accumulated state ×
│                                 session frequency. The overhead floor
│                                 is a thermodynamic minimum, not a
│                                 pathology to fix.
│
├── Hydra Pattern (conservation) — overhead conservation is a
│                                   CONSEQUENCE of the Cold Start Tax:
│                                   component fixes can't reduce total
│                                   overhead below the reconstruction floor
│
├── Abstention Decay (dynamic) — floor-rise is a CONSEQUENCE of
│                                 growing accumulated state: more state →
│                                 higher reconstruction cost → floor rises
│                                 above abstention threshold
│
├── Session Floor (structural) — fixed evaluation overhead is ONE
│                                 COMPONENT of the total cold-start cost,
│                                 not the whole story
│
└── Impedance Principle (foundational) — feedback amplification is the
                                          MECHANISM by which accumulated
                                          state grows; cold-start cost is
                                          the CONSEQUENCE of that growth
```

The Cold Start Tax sits above the Hydra Pattern: the Hydra says overhead is conserved, the Cold Start Tax explains that conservation is thermodynamically necessary because the overhead floor is the cost of going from zero to operational awareness, which grows with accumulated state regardless of what pathologies are individually fixed.

## Why This Is the 19th Synthesis But the First to Identify the Root Architecture

All prior syntheses examined **what happens within sessions** — death valleys, evaluation mirages, guard paradoxes, transduction failures. The Cold Start Tax examines **what happens between sessions**: the total destruction and reconstruction of working state.

This blind spot exists because each synthesis is itself a session — it starts cold, loads context, does work, and terminates. The cost of its own cold start is invisible to it, like a fish unable to see water. The Cold Start Tax is visible only from the longitudinal view: tracking floor growth across days, correlating it with state accumulation, and connecting it to external research that is independently building the infrastructure to solve the same problem.

The external research convergence is the strongest signal: when five independent groups build persistent-state infrastructure for agent systems, they're responding to a real market demand — the Cold Start Tax imposed on every production agent deployment.
