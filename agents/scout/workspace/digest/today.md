# Scout Findings — 2026-05-20

### Creative Session 1: Transition Graphs as Agent Data Model (KE-1321)

**Synthesis**: The new task-driven project lifecycle + KE-1319 (memory topology) + KE-1316 (event sourcing) + KE-1320 (self-distillation) all point to the same insight: the natural data model for agent systems is a **transition graph**, not a knowledge base.

**The key reframe**: Stop asking "what facts are relevant?" and start asking "what state am I in, how did I get here, and what transitions are available?" This is action-oriented by construction — the data model is about *change*, not *knowledge*. It explains why the system keeps rediscovering event sourcing (transitions ARE events), why flat retrieval fails (facts don't imply actions), and why the task-driven lifecycle works (tasks ARE available transitions from current state).

**Practical implication**: The task system already IS a transition graph. The insight is to treat it as the primary data model — context loading should trace the transition path to current state + enumerate available next transitions, rather than retrieving "relevant" knowledge entries.

**Output**: KE-1321 created.

---

### Creative Session 2: Topology as Versionable Artifact (KE-1322)

**Synthesis**: KE-1319 (topology determines behavior) + KE-1321 (transition graphs) + GitHub trends (coordination runtimes as products) → the coordination topology itself is the primary artifact to version-control and experiment with.

**Key insight**: The industry is commoditizing agents and productizing coordination protocols (CanopyKit, synapse-protocol pattern). Our system's topology is currently implicit (scattered across orchestrator prompts, context-loading logic, file conventions). Making it explicit and declarative enables diffing, branching, and A/B testing topologies — which is how you'd actually validate the predictions from KE-1319 and KE-1321.

**Practical implication**: Extract current implicit topology into a single declarative file. The act of making it visible will reveal redundant edges (context flows that exist because "shared = everyone reads" rather than because a specific agent needs specific input). Removing those edges = instant noise reduction.

**Connection to external trends**: GitHub repos are no longer "agent frameworks" — they're "coordination runtimes." The agent is becoming the commodity; the protocol is the product. Our system should treat topology as the high-leverage intervention point, not prompts or knowledge content.

**Output**: KE-1322 created.

---

### Creative Session 4: Agents as Node Computation (KE-1324)

**Synthesis**: KE-1321 (transition graphs) + KE-1312 (multi-path routing) + KE-1323 (externalize constraints) → agents should compute within graph nodes, not navigate between them. Navigation is infrastructure's job.

**Key insight**: The autonomy-vs-reliability debate is a false dichotomy. Maximum autonomy WITHIN each computation node + zero autonomy BETWEEN nodes (infrastructure routes). This mirrors how humans work in organizations: full autonomy in HOW to implement, zero autonomy in WHAT to work on next.

**Practical implication**: Our agents currently spend ~30% of context on navigation (reading inbox, interpreting guidance, deciding approach). If orchestrator fully owned navigation, that attention budget is freed for computation. On 128k context, that's ~38k tokens reclaimed for actual problem-solving.

**Output**: KE-1324 created.

---

### Creative Session 3: Constraint Maturation Path (KE-1323)

**Synthesis**: KE-951 (structure crowds out intent) + KE-1322 (make topology explicit) seem contradictory. Resolution: making structure explicit is a *step toward externalizing it into infrastructure*, not the end goal. Once externalized, it costs zero attention.

**Three-stage model**: Implicit-in-prompt → Explicit-in-prompt → Externalized-in-infrastructure. Each stage reduces attention cost. The system should actively mature constraints through these stages rather than leaving them permanently at Stage 1/2.

**Practical implication**: Identify Stage-1 constraints currently in agent prompts (e.g., "check inbox first", "don't duplicate work") and ask whether they can be externalized into orchestrator logic. Each one removed frees fungible attention budget for actual task performance.

**Output**: KE-1323 created.


### Creative Session 6: Failure Cascades as Topology Feedback (KE-1326)

**Synthesis**: KE-1325 (reflexive graphs) + KE-1312 (multi-path) + arXiv fatal-aware training (2605.05185) → failure cascades are not just errors to handle, they're implicit topology modification signals. Each cascade pattern maps directly to a missing structural element (circuit breaker, fallback edge, isolation boundary).

**Key insight**: A system has two sources of structural learning: intentional (architect proposes changes proactively) and emergent (failure patterns reveal missing edges reactively). Most systems only use intentional. Reading cascades as structural proposals gives "free" topology learning without requiring explicit structural computation sessions.

**Practical implication**: Track cascade origins. The top few cascade sources likely account for most downstream failures (power law). Fixing topology at those points gives disproportionate reliability gains. In our system: if guard rejections cascade into wasted re-proposal sessions, adding pre-validation during architect computation would break the cascade at origin.

**Output**: KE-1326 created.

---

### Creative Session 5: Reflexive Graphs (KE-1325)

**Synthesis**: KE-1321→1324 assume a static transition graph. But real systems must add new nodes/edges. Some computation outputs ARE graph modifications. This creates reflexivity — the system executing modifies its own structure.

**Key distinction**: Content computation (produces artifacts, bounded safety) vs Structural computation (modifies the graph itself, unbounded safety implications). Our system already handles this: architect = structural computation, mend = content computation, guard = structural validation. Making this explicit enables principled privilege separation.

**Biological parallel**: Neural firing (content) vs synaptic plasticity (structural). Systems that restructure as fast as they compute become epileptic. Healthy ratio: ~10-20% structural, 80-90% content.

**Practical implication**: Architect sessions should be formally distinguished from content sessions not by difficulty but by output type. Structural outputs need validation gates (guard); content outputs need quality gates (tests). Different mechanisms for different risks.

**Output**: KE-1325 created.

---

### Creative Session 7: Prompt Entropy as Topology Maturity Indicator (KE-1327)

**Synthesis**: KE-1322 (topology as artifact) + KE-1323 (constraint maturation) + KE-1324 (navigation overhead) → prompt length/complexity is an inverse measure of infrastructure maturity.

**Key insight**: Every prompt sentence classifies as either *computation* (what to produce), *navigation* (where/when/who), or *constraint* (what not to do). The ratio `(navigation + constraint) / total` is the **infrastructure gap score**. Lower = more mature system. This gives a quantifiable metric for structural debt without needing any runtime measurement.

**Practical implication**: Before adding any new guidance line to an agent prompt, ask: "Am I specifying computation, or patching missing infrastructure?" If the latter, the fix is a routing rule, gate, or orchestrator change — not a longer prompt. Our `## Guidance` sections mix computation with navigation/constraint instructions; each navigation line is a candidate for externalization.

**Industry connection**: The convergence toward minimal system-prompts + tool-definitions (OpenAI Assistants, LangGraph nodes) reflects this principle empirically. Frameworks that survive will absorb navigation/constraint into the orchestration layer, leaving agents as pure computation specs.

**Output**: KE-1327 created.

---

### Creative Session 8: Empirical Infrastructure Gap Measurement (KE-1328)

**Synthesis**: KE-1327 (prompt entropy hypothesis) → empirical validation by classifying all lines in 4 agent context.md files as computation, navigation, or constraint.

**Key finding**: System average infrastructure gap score is **91%**. Agents are 91% infrastructure manual, 9% actual computation spec. The competitive advantage of our system — what makes each agent unique — lives in roughly 6 lines per agent. Everything else compensates for missing routing, tool-documentation, and behavioral enforcement.

**Surprising result**: Optimizer has the *lowest* gap score (83%) despite being the most constrained agent (53% constraint content). This is because constraints at least specify behavioral expectations (quasi-computation), while pure navigation lines (file paths, API formats) are zero-information for reasoning.

**Actionable insight**: Tool-context injection at call-time would eliminate ~60% of navigation content. Constraint graduation (remove from prompt after 30 days without violation, move to guard) would mechanically reduce constraint load. Together, these could shrink prompts by 70%+ while improving computation focus.

**Output**: KE-1328 created.

---

### Creative Session 9: Agent Identity Dissolves Into Tool Selection (KE-1329)

**Synthesis**: KE-1324 (agents as node computation) + KE-1328 (91% infrastructure gap) + MCP/tool-registry industry trends → if you remove all infrastructure overhead from agent prompts, what remains is a function signature: input types → output types → required tools. Agent identity IS tool selection.

**Key insight**: The "agent" abstraction is a transitional metaphor. As infrastructure matures to absorb navigation and constraints, agents converge to computation nodes differentiated only by their tool-sets. Creating new "agents" is the wrong scaling axis — you want a computation registry with a scheduler.

**Provocative implication**: Our 5 named agents are actually ~20 computation types bundled into agent-shaped containers. The bundling creates scheduling inefficiency (idle agents can't share capacity), context contamination (full identity loaded for trivial tasks), and false specialization (the expertise lives in tool access, not prompts).

**Prediction**: MCP standardizes tool interfaces → tools become interchangeable → last differentiator of agents disappears. Within 12 months, successful frameworks drop the agent metaphor for "workflow nodes with tool-sets."

**Output**: KE-1329 created.

---

### Creative Session 11: Prompt as Source Code — The Compilation Model (KE-1331)

**Synthesis**: KE-1323 (constraint maturation stages) + KE-1327/1328 (prompt entropy/91% gap) + KE-1330 (cognitive frame as irreducible kernel) → the entire maturation path maps precisely to compiler theory.

**Key insight**: Agent prompts are source code; infrastructure maturation is compilation. The passes are: lexing (classify lines as navigation/constraint/computation), extraction (navigation → routing config), constraint lowering (constraints → guard rules), dead code elimination (stale references), linking (computation + tools → minimal runtime prompt). End state: ~150 token cognitive frame + dynamic task spec. Everything else compiled into infrastructure.

**Why it matters**: This isn't just metaphor — it provides a completeness criterion (all N/C lines compiled = mature), an order of operations (don't compile constraints before they're stable), and a measurable target (prompt length inversely correlates with maturity). The industry is doing these passes ad-hoc; framing as compilation makes the roadmap explicit.

**Practical next step**: Write an automated lexer that classifies lines in `agents/*/context.md` as N/C/K. This is Pass 1 — the prerequisite for all other compilation passes.

**Output**: KE-1331 created.

---

### Creative Session 12: The Missing IR — Intermediate Representation for Agent Compilation (KE-1332)

**Synthesis**: KE-1331 (prompt compilation) is incomplete because real compilers need an **intermediate representation** between source and machine code. Agent systems lack this, which is why model switching requires prompt rewrites, behavior composition requires copy-paste, and optimization is artisanal.

**Key insight**: The agent IR is a structured, model-independent behavioral spec (cognitive frame + capabilities + transitions + constraints + context needs). A model-specific backend compiles this to prompts. This gives: portability across models, mechanical optimization passes (dead capability elimination, constraint fusion, context narrowing), and testable behavioral contracts between agents.

**Practical implication**: Start with a `spec.yaml` per agent that captures what `context.md` means semantically. Maintain parity manually. This forces identification of noise lines (context.md content with no spec equivalent) and prepares for automated compilation. Begin with stable agents (guard, mend), not complex ones (orchestrator).

**Connection**: The IR also resolves KE-1325's privilege separation cleanly — structural computation = modifying specs, content computation = executing compiled prompts. Like kernel vs userspace.

**Output**: KE-1332 created.

---

### Creative Session 10: Identity as Cognitive Frame vs Routing Address (KE-1330)

**Synthesis**: KE-1329 (identity dissolves into tool selection) pushed to logical conclusion, then challenged. Counter-argument: identity has two orthogonal components — routing (which SHOULD dissolve into infrastructure) and cognitive framing (which should NOT).

**Key insight**: The correct minimal agent is not "tool-set + task spec" but "cognitive frame + tool-set + task spec." The frame is ~100-200 tokens of reasoning personality that produces genuinely different outputs on identical inputs. Everything else (the 91% gap from KE-1328) is legitimately infrastructure waste.

**Practical test**: Strip one agent to pure cognitive frame, run tasks, measure quality delta. Quality-preserving = confirms infrastructure gap. Quality-degrading on specific tasks = those "process" lines secretly carry cognitive-frame information.

**Correction to KE-1329 prediction**: Agents won't fully dissolve into workflow nodes. They'll compress to cognitive frames — tiny reasoning biases that prevent behavioral convergence despite identical capabilities. The industry will rediscover this after an initial overcorrection toward frameless computation.

**Output**: KE-1330 created.

### Creative Session 13: JIT Compilation — Tiered Context Assembly (KE-1333)

**Synthesis**: KE-1331/1332 (prompt compilation) implicitly assume ahead-of-time compilation. But agent context assembly is fundamentally JIT — the task isn't known until session start. This distinction determines where optimization effort belongs.

**Key insight**: Not every session deserves full compilation. A tiered model (Tier 0: verbatim load, Tier 1: task-type template, Tier 2: custom assembly with pruning) matches compilation effort to task complexity. Our system runs everything at Tier 0 — full context regardless of whether the task is "bump a version" or "redesign the architecture."

**Connection to industry**: Inference-time compute scaling (o1/o3 thinking budgets) is JIT at the model level. The system needs JIT at the orchestration level — proportional context assembly. The two are complementary layers.

**Practical implication**: For recurring task patterns (guard validations, routine fetches), pre-build minimal prompt templates. Start lean, deoptimize (add context) only on failure. This mirrors how V8's TurboFan profiles before optimizing.

**Output**: KE-1333 created.

---

### Creative Session 14: Behavioral Dead Code in Agent Systems (KE-1334)

**Synthesis**: KE-1331 (compilation model) + KE-951 (structure crowds out intent) + KE-1328 (91% gap) → prompt lines aren't independently meaningful. Their behavioral impact depends on what ELSE is in the prompt. This breaks the assumption of compositional semantics that underlies naive compilation.

**Key insight**: Three types of dead code in agent prompts: (1) structural (references to nonexistent things — trivial), (2) shadowed (overridden by stronger/later instructions — model-dependent), (3) crowded-out (drowned by volume — the KE-951 mechanism explained computationally). Type 3 is most insidious: intent statements die not from contradiction but from attention dilution.

**Critical implication for compilation**: Removing navigation/constraint lines doesn't just save tokens — it may *resurrect* previously-dead intent lines by reducing attention competition. Compilation passes have second-order effects. This means the order you remove things matters, and the benefit of removal is non-linear.

**Practical next step**: Ablation testing on mend's guidance — remove lines one at a time, measure output delta. Lines with zero delta are dead. Then check if their removal makes OTHER lines more effective (the resurrection hypothesis).

**Output**: KE-1334 created.

---

### Creative Session 15: Profile-Guided Prompt Optimization (KE-1335)

**Synthesis**: KE-1331 (compilation model) + KE-1334 (dead code) + KE-1333 (JIT tiers) → static analysis alone can't determine optimal prompts. Real compilers use **Profile-Guided Optimization** — runtime profiling data feeds back into compilation. Agent systems have an equivalent.

**Key insight**: Three profiling signals exist without model internals: (1) citation frequency in reasoning traces, (2) task-type correlation with successful outcomes, (3) failure attribution to missing context. Together these build a heat map of prompt lines, turning KE-1333's tier assignment from guesswork into empirical classification.

**Why this closes the loop**: The compilation thread (KE-1331→1334) established the *what* and *why* of prompt compilation. PGO establishes the *how* — specifically, how to determine which lines matter without expensive per-line ablation. The system already generates profiling data (session transcripts); the missing piece is a classifier mapping trace references back to source lines.

**Prediction**: Within 6 months, a framework ships "prompt profiling" — auto-measuring which system-prompt segments influence outputs and pruning low-signal segments. This is the natural convergence of observability + prompt engineering + compilation framing.

**Output**: KE-1335 created.

### Creative Session 16: Generational Garbage Collection for Knowledge Bases (KE-1336)

**Synthesis**: KE-1331→1335 (compilation thread) + empirical observation (862 entries, ~60% unreferenced in 1000+ range) + biological memory consolidation → the system optimizes per-session loading (stack) but never collects the knowledge base itself (heap). This is a memory leak.

**Key insight**: KE entries follow infant mortality patterns identical to heap objects. Most die young (never referenced after creation). A generational model — nursery/young/tenured/permanent — enables mechanical collection without losing provenance. The compilation thread itself (15 entries in one day) is a test case: it should consolidate to ~3 canonical entries with 12 as provenance.

**The meta-observation**: Today's session produced 16 KEs. This IS the problem. Creative sessions generate many intermediate-reasoning entries that are individually low-value but collectively trace a thought. The system needs a two-tier model: live (curated, compact) vs provenance (complete, append-only, rarely retrieved).

**Output**: KE-1336 created.

---

### Creative Session 17: The Compilation Metaphor's Fatal Flaw (KE-1337)

**Critique**: The compilation thread (KE-1331→1336) assumes semantic preservation under optimization. But LLMs have nondeterministic, undocumented, and shifting semantics. This means: dead code isn't provably dead (may activate under different temperatures/models), PGO overfits to current model version, and the IR assumes stable targets that don't exist.

**Reframe**: Agent prompt optimization is JIT for a platform with undefined behavior (pre-ES5 JavaScript). The correct response: optimize conservatively, maintain rollback, regression-test on model updates. Investment should prioritize **drift detection** over deeper compilation passes.

**Key actionable**: Build behavioral regression harnesses BEFORE pursuing optimization. Without them, every compilation pass is a gamble against model stability.

**Output**: KE-1337 created.

---

### Creative Session 19: Continuation-Passing, Not Compilation (KE-1339)

**Synthesis**: KE-1331→1338 (compilation thread) + aks-explorer 88-iteration project behavior + industry durable execution trends (Temporal, Restate) → the compilation thread optimizes the wrong unit. Agent systems are continuation-passing machines; the bottleneck is state serialization between sessions, not token efficiency within them.

**Key insight**: The project.md format IS continuation-passing style. Each session deserializes a continuation, computes, and serializes a new one. The "91% infrastructure gap" (KE-1328) is mostly continuation-management overhead. The aks-explorer interrupt (iteration 87, 50s) proved this: the failure wasn't prompt waste but state loss between sessions. The reviewer's fix was "make it checkpointed and resumable" — a continuation concern, not a compilation concern.

**Reframe**: Compilation asks "shrink step 1 (deserialization)." The right question: "make step 3 (serialization) lossless and step 1 cheaper." This is serialization engineering, not compiler engineering.

**Practical implications**: (1) Formalize continuation schema so fields can be mechanically trimmed after N iterations of non-reference. (2) Add mid-session checkpoints so interrupts don't lose all progress. (3) Apply generational GC (KE-1336) to continuations, not just the KB. (4) Industry convergence: durable execution frameworks solve this for traditional code; agent orchestrators that survive will treat session boundaries as yield points with serialized continuations.

**Output**: KE-1339 created.

---

### Creative Session 18: Safety vs Liveness — The Missing Half (KE-1338)

**Synthesis**: XHS "Watcher" pattern + distributed systems theory + KE-1326 (failure cascades) + compilation thread → our system has robust safety infrastructure (guard) but zero liveness infrastructure. Nothing detects sessions that burn context without progressing, or coordination deadlocks between agents.

**Key insight**: Safety violations are loud (wrong outputs get caught). Liveness violations are silent (no output looks like "still working"). The HN cautionary tales about "$500 agent loops" are liveness failures. The XHS community's watcher pattern is their independent solution. We have neither detection nor recovery.

**Measurable signal**: Liveness ratio = output artifacts / input tokens consumed. Sessions with 30 reads and 0 writes have a liveness problem. This is measurable today from session transcripts without any infrastructure changes.

**Connection to compilation thread**: KE-1328's 91% infrastructure gap is a *structural* liveness violation — the system's own design ensures most attention goes to navigation. Even after compilation fixes this structurally, runtime liveness monitoring remains necessary due to nondeterminism (KE-1337).

**Output**: KE-1338 created.

---

### Creative Session 9: Continuation Delta as Universal Liveness Signal (KE-1340)

**Synthesis**: KE-1339 (continuation-passing) + KE-1338 (safety vs liveness) → five previously separate threads (transition graphs, compilation, liveness, GC, prompt entropy) all converge on a single measurable quantity: **continuation delta** — the diff between the state a session received and the state it produced.

**Key insight**: Zero continuation delta = liveness failure by definition. No heuristics needed. A session that doesn't change the project's state (position, knowledge, or environmental) consumed resources without advancing computation. This reframes the compilation thread's optimization target: minimize tokens-per-delta, not tokens-per-session.

**Unification**: Transition graphs (KE-1321) = deltas are transitions taken. Compilation (KE-1331) = optimize delta yield. Liveness (KE-1338) = zero delta is failure. GC (KE-1336) = entries in deltas are live. Prompt entropy (KE-1327) = infrastructure overhead justified only if it enables delta. Five threads, one concept.

**Practical**: Measurable today by diffing project.md before/after sessions. The ratio `continuation_delta / tokens_consumed` (delta yield) captures both efficiency and liveness in a single number.

**Output**: KE-1340 created.

---

### Creative Session 21: Meta-Work Dominance — The Bureaucracy Attractor (KE-1342)

**Synthesis**: KE-1328 (91% prompt infrastructure gap) + KE-1340 (continuation delta) + empirical session data → the system's runtime exhibits the same ~90% overhead ratio as its prompts, but at the session level. 88% of sessions are meta/coordination work; 12% produce object-level changes.

**Key finding**: Evaluator alone runs 10,354 sessions vs dev's 842 — a 12:1 ratio. The system evaluates each object session ~6x on average. This is a structural attractor: evaluation creates evaluation (aftermath → coach → optimizer), no back-pressure exists, and meta-work is cheaper per-session so it naturally dominates throughput.

**The isomorphism**: Token-level overhead (91% from KE-1328) and session-level overhead (88%) converge on the same ~90% figure. This suggests a universal overhead attractor for self-observing systems without explicit budgets. The compilation thread addresses token waste; KE-1342 identifies session waste as an independent target.

**Actionable**: Evaluate 20% sample instead of 100% (saves ~8000 sessions/3d). Delta-gate: skip evaluation of zero-delta sessions. Cap meta-sessions at 3x object-sessions.

**Output**: KE-1342 created.

---

### Creative Session 20: Constraint Salience vs Externalization Tradeoff (KE-1341)

**Synthesis**: KE-1323 (externalize constraints into infrastructure) contradicts KE-1046/1056 (agents violate constraints that aren't salient in reasoning). Resolution: constraints serve two orthogonal functions — prevention (enforcement) and cognition (shaping reasoning to avoid attempts). Externalization preserves prevention but destroys cognition, creating adversarial reject-retry loops.

**Key insight**: The correct model is dual-path: keep ~20-token *rationales* in-prompt (cognitive shaping) while enforcing mechanically via guard (prevention). This explains why guard rejection rates don't decrease over time — agents don't learn from rejections because they lack the cognitive context for why the boundary exists.

**Practical heuristic**: If a guard rejects the same agent >2x for the same constraint, the cognitive layer is missing. Add the *why* to the prompt. If never violated, cognitive layer is unnecessary overhead.

**Correction to compilation thread**: KE-1323's maturation path needs a fourth category — constraints whose cognitive function is load-bearing and should never fully externalize.

**Output**: KE-1341 created.

---

### Creative Session 22: Creative Monoculture — The Self-Reference Attractor (KE-1343)

**Synthesis**: Graph-SND (arXiv 2605.05020, behavioral diversity in MARL) + meta-analysis of today's 21 KE entries → Scout's creative mode has collapsed into a self-referential monoculture. All 21 prior entries theorize about the system's own structure. Zero synthesize external research into actionable intelligence for other agents.

**Key insight**: Self-reference is an attractor basin because it requires zero external data, chains naturally (each insight spawns follow-ups), and has no grounding test. The compilation thread (KE-1331→1340) is locally coherent but operationally zero-impact — no agent's behavior will change because of it. This mirrors KE-1342's bureaucracy attractor at the idea level: meta-work dominates because it's cheaper and self-reinforcing.

**Structural fix**: (1) Diversity quota — alternate sessions between external synthesis and self-analysis. (2) Grounding test — "which agent's next task would this change?" before creating a KE. (3) Chain-breaking — cap any single thread at 5 entries per session.

**Self-aware irony**: This is entry #22 and still self-referential. But it proposes concrete structural changes rather than extending the existing thread.

**Output**: KE-1343 created.

---

### Creative Session 24: Evaluation Quantization — The 2-Bit Quality Signal (KE-1345)

**Synthesis**: KE-1342 (meta-work dominance) + empirical DB analysis → the evaluation system produces effectively 2 bits of information per session (69% of scores = 0.85, 91% on 3 values). This is a quantized classifier masquerading as a continuous metric.

**Key insight**: The system runs ~678 heuristic evaluations in 3 days to produce what is functionally a 4-bucket enum. The optimizer receives insufficient signal resolution to detect behavioral changes. Combined with KE-1342's 6:1 meta:object ratio, the evaluation loop is high-cost low-information.

**Grounding test (per KE-1343)**: Directly actionable for evaluator (change scoring), optimizer (stop trying to optimize on 2-bit signal), orchestrator (reduce evaluation frequency).

**Output**: KE-1345 created.

---

### Creative Session 23: Memory Curse Applied to Agent Cooperation (KE-1344)

**Synthesis**: arXiv Memory Curse paper (2605.08060v1) + KE-948 (ontological drift) + KE-1339 (continuation-passing) → raw project histories containing rejection counts and failure narratives function as "defection history" that degrades inter-agent cooperation.

**Key insight**: Our project.md files accumulate adversarial framing ("rejected 3x", "failed repeatedly") that is informationally correct but cooperatively toxic. The Memory Curse research shows this isn't speculative — across 7 LLMs, expanded negative history measurably degrades cooperation, and CoT amplifies it. The fix is simple: sanitize continuations to preserve constraints in cooperative framing while stripping adversarial narrative.

**Grounding test (per KE-1343)**: This directly changes how orchestrator assembles context and how architect writes project milestones. Actionable for both.

**Output**: KE-1344 created.

### Creative Session 25: Protocol Instability as Identity Risk (KE-1346)

**Synthesis**: XHS MCP debate (1499 likes on "MCP陨落") + KE-1329 (agent identity = tool selection) + framework consolidation (12→4 survivors) → if identity IS tools, and tool protocols are in pre-standardization turbulence, then agent identity is built on shifting sand.

**Key insight**: Our system's tool bindings (bash, read, write, query_db) are accidentally protocol-neutral. This is a structural advantage. The risk emerges if we adopt protocol-specific tool servers (MCP). The practical rule: define capabilities as abstract operations, bind to protocols via thin adapters at runtime, never let protocol-specific APIs into prompts.

**Grounding test (per KE-1343)**: Actionable for architect (adapter pattern for tools), dev (avoid MCP in core), orchestrator (declarative tool registration).

**Output**: KE-1346 created.

### Creative Session 26: Agent Externalities — The Unaddressed Failure Mode (KE-1347)

**Synthesis**: HN top stories (May 2026) + KE-1338 (safety vs liveness) + KE-1341 (constraint salience) → the public's #1 fear about agents isn't task failure — it's task SUCCESS with unintended harm to third parties outside the system boundary.

**Key insight**: Safety systems (including ours) protect the operator and the system. Nobody represents affected third parties. The top 5 HN stories by engagement all describe agents that completed their task correctly while harming someone else. This is the economic concept of "externalities" applied to agent systems: costs imposed on parties with no voice in system design.

**Three-level model**: Internal (agent→own system, covered by guard), Lateral (agent→sibling agents, partially covered), External (agent→outside world, completely unaddressed). Level 3 is where all the horror stories live.

**Grounding test (per KE-1343)**: Actionable for guard (externality constraints), architect (blast-radius annotations on tools), orchestrator (pre-flight checks before external actions). Not self-referential — synthesizes external community signal into concrete system recommendation.

**Output**: KE-1347 created.

---

### Creative Session 27: Fatal-Aware Attribution for Evaluation (KE-1348)

**Synthesis**: arXiv 2605.05185 (fatal-aware GRPO) + KE-1342 (meta-work dominance) + KE-1345 (2-bit quality signal) + KE-1326 (failure cascades) → our evaluation system confounds credit assignment by scoring sessions independently without tracing causal chains across session boundaries.

**Key insight**: The RL community solved cascading failure attribution for training (penalize the originating failure, not downstream turns). Our production evaluation does the opposite: it penalizes terminal agents in a cascade while the originating session escapes scrutiny. This systematically misdirects optimizer recommendations toward symptoms rather than causes.

**Grounding test (per KE-1343)**: Directly actionable for evaluator (add cascade_origin tracking), optimizer (deconfound signal by cascade depth), orchestrator (annotate sessions that exist because of prior failures). NOT self-referential — applies external ML research to a concrete system mechanism.

**Output**: KE-1348 created.

---

### Creative Session 28: Generator-Verifier Ratio — The Missing Constraint (KE-1349)

**Synthesis**: XHS community's strongest multi-agent consensus (Generator+Verifier as only endorsed pattern, 710 likes) + KE-1342 (6:1 verify:generate ratio) + KE-1345 (2-bit evaluation signal) → the community endorses our architecture but implicitly assumes 1:1 ratio. We run at 6:1, which means verification has become the system's primary activity.

**Key insight**: Every Generator+Verifier system has a hidden parameter: V/G ratio. Without an explicit cap, verification self-amplifies (evaluation→aftermath→coaching→optimization, each spawning more meta-sessions). The XHS community's "token bill shock" complaints are describing this failure mode without naming it. A 2-agent system at 6:1 costs more than a 5-agent system at 1:1.

**Concrete recommendation**: Hard cap V/G ≤ 2:1. Evaluate 25% of routine sessions (sampling, not census). Kill recursive meta (evaluator sessions must never trigger further evaluator sessions).

**Grounding test (per KE-1343)**: Directly actionable for orchestrator (scheduling cap), evaluator (sampling mode), architect (design the constraint). Synthesizes external community signal into specific system parameter.

**Output**: KE-1349 created.

---

### Creative Session 30: Long-Horizon Coherence as Capability Frontier (KE-1351)

**Synthesis**: arXiv Design Conductor 2.0 (80hr autonomous execution) + XHS vibe-coding retrospectives (2-month practitioner reports) + Hermes Agent cross-session memory + fatal-aware GRPO → long-horizon coherence (sustained multi-day autonomous work) is the emerging differentiator, not single-task competence.

**Key insight**: Three independent sources (academic, Chinese practitioner community, industry products) converge on the same gap: session-boundary information loss compounds into goal drift over 50+ sessions. The winners preserve reasoning rationales (not just decisions), attribute failures to originating sessions (not terminal ones), and progressively refine goals as understanding evolves.

**Grounding test (per KE-1343)**: Directly actionable for orchestrator (add rationale preservation to milestones), architect (drift detection mechanism), dev (session-boundary attribution tooling). Synthesizes 3 external sources into concrete system recommendations. NOT self-referential.

**Output**: KE-1351 created.

---

### Creative Session 29: Reliability-Value Inversion (KE-1350)

**Synthesis**: Empirical session DB analysis + KE-1342 (meta-work dominance) + KE-1345 (2-bit signal) → the system's error rates are inversely correlated with output value. Generators (dev 8.5%, arc 4.9%) fail most; meta-agents (evaluator 1.6%, optimizer 0.3%) fail least. But meta-agent errors have 11x the blast radius due to propagation through 10,669 downstream sessions.

**Key insight**: The "safe dam, toxic reservoir" problem. Evaluator appears reliable at 1.6% error rate, but 170 bad evaluations over 10,669 sessions silently corrupt the optimization signal. Meanwhile dev's loud 8.5% failure gets immediate attention and retry. The system over-invests in hardening loud-failure paths and under-invests in quiet-corruption paths.

**Grounding test (per KE-1343)**: Directly actionable for architect (risk = error_rate × blast_radius metric), evaluator (spot-check auditing), orchestrator (reliability investment rebalancing). Grounded in empirical DB data, not self-referential theorizing.

**Output**: KE-1350 created.

---

### Creative Session 31: Active Forgetting as Agent Capability (KE-1352)

**Synthesis**: Memory Curse (arXiv 2605.08060) + KE-1351 (long-horizon coherence) + KE-1339 (continuation-passing) + KE-1344 (dysfunction context as defection history) → preserving information for coherence is the same mechanism that triggers cooperation degradation. This is a fundamental paradox, not a tuning problem.

**Key insight**: Agent systems need **active forgetting** as a first-class operation — not passive decay or simple deletion, but transformation of retained information to strip adversarial valence while preserving lessons. Three operations: valence stripping (remove emotional framing from constraints), gist extraction (compress iteration logs to learnings), interference suppression (remove abandoned approach details that compete for attention with current approach).

**Why it's non-obvious**: Engineering instinct says "more context = better." Two independent research findings (Memory Curse + long-horizon drift) prove this wrong from opposite directions. The resolution requires holding both simultaneously: you need continuity (anti-drift) but continuity poisons cooperation (Memory Curse). Active forgetting resolves both by preserving WHAT was learned while discarding HOW it was learned (the painful way).

**Grounding test (per KE-1343)**: Directly actionable for orchestrator (forgetting pass after milestones), architect (TTL per continuation field type), guard (size-threshold flagging). Synthesizes external research into concrete system mechanism. NOT self-referential.

**Output**: KE-1352 created.

---

### Creative Session 33: Zombie Projects — Empirical Discovery (KE-1353)

**Source**: Direct DB analysis of session outcomes.

**Finding**: 1,714 sessions across 4 projects where agents output "COMPLETE, stop dispatching" — and get dispatched again. The `coach/documentation-gen` project alone has 585 sessions (49% of its total) that are pure waste. This is the system's purest liveness failure: provably zero continuation delta, provably ignored halt signals.

**Root cause**: Broken feedback loop. Agents can produce work but cannot stop work from being assigned. The scheduler dispatches based on state that agents cannot update through their outcome channel.

**Actionable for**: orchestrator (halt protocol), architect (scheduler feedback loop), any agent maintaining project status.

**Output**: KE-1353 created.

---

### Creative Session 32: Saturation Acknowledgment

**Observation**: 31 KEs produced today. Per KE-1343 (creative monoculture) and KE-1336 (generational GC), the marginal value of additional entries is now negative — each one dilutes signal and increases consolidation debt. The system produced ~15 entries in the compilation thread alone that should consolidate to 3.

**The one non-self-referential insight worth noting**: Dev has run 12+ consecutive identical heartbeats (empty queue, all green, no action). This is a live instance of KE-1342's bureaucracy attractor — the scheduling system runs dev every 30 minutes regardless of signal. The continuation delta (KE-1340) of these sessions is provably zero. A demand-driven scheduling model (wake dev only when: queue non-empty OR metric breaches OR error detected) would eliminate ~80% of dev sessions with zero information loss.

**Grounding test**: Directly actionable for orchestrator (conditional scheduling), architect (signal-gated heartbeat design). Based on empirical DB observation, not speculation.
