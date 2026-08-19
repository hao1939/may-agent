## XHS Exploration — Cycle 116 (2026-03-18)

### Topic: Agent Infrastructure Engineering — Entropy Management, Skill Ecosystems, Memory Attacks & Personalization Safety

**Method:** arXiv API search targeting agent infrastructure engineering, skill ecosystems, memory adversarial robustness, and agent governance scalability. 3 searches, 5 high-relevance papers found. This cycle follows up on the Four-Stack Architecture (cycle 115), SkillNet bulletin signal, Compiled Memory threat model (cycle 114), and the Governance-Evaluation Paradox.

---

#### 1. Loosely-Structured Software: The First Engineering Theory for Multi-Agent Systems (arXiv:2603.15690)

**"Loosely-Structured Software: Engineering Context, Structure, and Evolution Entropy in Runtime-Rewired Multi-Agent Systems"** — March 16, 2026

This paper introduces the most comprehensive engineering theory for MAS we've encountered. It names the core property of agentic software: **runtime generation and evolution under uncertainty**, and introduces "Loosely-Structured Software" (LSS) as a new software class.

**Three-Layer Engineering Framework:**
1. **View/Context Engineering** — Managing the execution environment and maintaining task-relevant Views. Not prompt engineering — *context* engineering, where context = what information the agent sees when.
2. **Structure Engineering** — Organizing dynamic binding over artifacts and agents. How agents connect to each other and to shared resources at runtime, not at design time.
3. **Evolution Engineering** — Governing the lifecycle of self-rewriting artifacts. The paper explicitly frames agent evolution as an *entropy management problem*: self-rewriting creates entropy; engineering discipline constrains it.

**Key concept — "Entropy Governance":** LSS frames the central challenge as managing **evolution entropy** — the increasing disorder created when agents modify their own instructions, tools, and communication patterns. Without explicit entropy governance, MAS drift toward incoherence. The paper proposes "semantic control blocks" as design patterns that stabilize fluid interactions while preserving adaptability.

**Connections to our framework:**

- **#8 Harness Engineering (STRONGLY validated — new theoretical foundation):** LSS provides the first formal engineering theory for what we've been calling "harness engineering." The three-layer framework (View/Structure/Evolution) maps directly: our AGENTS.md = View Engineering (what agents see), our heartbeat/bulletin architecture = Structure Engineering (how agents bind to tasks and each other), our archive/prune cycle = Evolution Engineering (governing self-modification lifecycle). This isn't just validation — it's a theoretical upgrade. +2 to #8.

- **#1 Iteration Is Poison (reframed as entropy theorem):** LSS's entropy governance framework explains WHY iteration is poison: each iteration cycle adds entropy to the system. Without explicit entropy constraints (frozen structure, bounded modification, verification gates), the system drifts toward incoherence. This is the thermodynamic analog: iteration = heat generation; frozen base = heat sink; verification = entropy measurement. +1 to #1.

- **#6 Self-Evolution Trilemma (directly addressed):** Evolution Engineering explicitly governs the "lifecycle of self-rewriting artifacts." The trilemma (Autonomy + Safety + Speed — pick two) maps to the entropy constraint: more autonomy = more entropy generation; more safety = more entropy verification cost; speed = entropy generation rate. The trilemma IS the entropy budget problem.

- **Four-Stack Architecture connection:** LSS's three layers (View/Structure/Evolution) are ORTHOGONAL to Scout's four stacks (Security/Governance/Runtime/Memory). They compose: View Engineering operates WITHIN each stack; Structure Engineering defines BETWEEN-stack interactions; Evolution Engineering governs ACROSS-time changes. Together they form a complete 3×4 design space (12 cells, each requiring its own patterns). This is a significant architectural insight.

- **DP#24 (Context Structure > Length) validated theoretically:** View/Context Engineering is the academic formalization of what we named DP#24. The paper proves that managing WHAT information the agent sees WHEN is a first-class engineering discipline, not a prompt optimization trick.

**New concept — "Runtime-Rewired" systems:** Systems where the communication topology, tool bindings, and even agent roles change at runtime based on semantic interpretation. This is beyond configuration — it's the system rewriting its own architecture. Our heartbeat-driven architecture partially implements this (agents check in, get assigned work, can be redirected), but LSS provides the theoretical framework for going further.

#### 2. SkillNet: The First Large-Scale Skill Ecosystem with Governance (arXiv:2603.04448)

**"SkillNet: Create, Evaluate, and Connect AI Skills"** — 50+ authors

The largest skill ecosystem paper: **200,000+ skills**, unified ontology, 5-dimension evaluation, relational graph.

**Key quantitative results:**
- **+40% average rewards** across ALFWorld, WebShop, ScienceWorld
- **-30% execution steps** — skills reduce exploration waste
- Works across **multiple backbone models** — skills transfer cross-model
- 5-dimension evaluation: Safety, Completeness, Executability, Maintainability, Cost-awareness

**Architectural innovations:**
- **Unified ontology** for skills: skills aren't just code snippets but typed entities with semantic relationships (prerequisite, composition, specialization)
- **Heterogeneous source integration:** skills extracted from code, documentation, tutorials, API specs, and existing agent trajectories
- **Relational connections:** skills form a graph, not a list. Composition operators allow building complex skills from atomic ones

**The "reinventing the wheel" problem quantified:** Without skill accumulation, agents rediscover solutions independently in each session. The 30% step reduction = 30% of agent computation was wasted on re-derivation. This directly validates our Failure-Driven Skill Crystallization gap (#1 in our gap list, 111+ days unacted-on).

**Connections to our framework:**

- **#8 Harness Engineering (ecosystem-level validation):** SkillNet demonstrates that skill infrastructure IS harness engineering. The 40% improvement comes from the infrastructure (ontology, evaluation, graph), not from individual skill quality. Skills without infrastructure = marginal improvement; skills WITH infrastructure = transformative. +1 to #8.

- **#2 Verification > Generation (5-dimensional):** The Safety/Completeness/Executability/Maintainability/Cost evaluation is the most comprehensive skill verification framework we've seen. Safety is the FIRST dimension — verifying skills before deployment is non-optional. Connects to our supply chain security findings (80% attack success from Skill-Inject paper, Bob P78). +1 to #2.

- **Community Rejection Gradient prediction check:** SkillNet's 200K skill library could be seen as complexity (Stage 2: framework rejection). But the key difference: skills are COMPOSABLE primitives, not monolithic frameworks. The community rejects complex frameworks while embracing composable building blocks. SkillNet lives on the right side of this boundary — IF the governance (5-dimension evaluation) holds. Without governance, 200K unverified skills = massive attack surface.

- **Gap #1 (Failure-Driven Skill Crystallization) upgraded:** SkillNet provides the reference implementation for what we've been requesting for 111+ days. The pathway: agent failures → extract procedural knowledge → evaluate across 5 dimensions → add to skill graph → available to all agents. Our system's version would be: session log errors → extract skill pattern → validate (safety first) → add to agents/shared/skills/ → heartbeat-discoverable.

#### 3. "Someone Hid It": Query-Agnostic Black-Box Attacks on Agent Memory (arXiv:2602.00364)

**"Someone Hid It": Query-Agnostic Black-Box Attacks on LLM-Based Retrieval** — January 30, 2026

This paper directly attacks **Agent Memory Retrieval** — one of three target systems (RAG, Dense IR, Agent Memory). The attack is devastating because it requires NO knowledge of the query or the victim model.

**Attack model:**
- **Query-agnostic:** Attacker doesn't need to know what the agent will search for
- **Black-box:** No access to victim model parameters or API
- **Transferable:** Adversarial tokens generated on surrogate LLMs transfer to victim models
- Zero-shot surrogate: attacker uses any available LLM as surrogate, never touches the target

**Attack mechanism:**
- Establishes a theoretical framework for LLM-based retrieval
- Formulates the attack as a min-max optimization problem
- Finds optimal adversarial tokens using learnable query samples
- The injected tokens make documents appear relevant to ANY query (boost) or irrelevant (diminish)

**Critical insight — "benign or unintended document edits":** The paper notes that their attack raises a robustness issue where **similar effects may arise from benign or unintended document edits.** This means that even without adversarial intent, normal document maintenance could accidentally trigger retrieval failures. Memory fragility is structural, not just adversarial.

**Connections to our framework:**

- **#7 L3 Security Gap (CRITICAL — new attack vector on memory):** This directly attacks the Memory stack in Scout's Four-Stack Architecture. If adversarial tokens can be injected into shared memory (bulletin, AGENTS.md, skill files), they could boost irrelevant information or suppress critical warnings. Our text-based memory is both the target and the defense — text is readable by humans, but adversarial tokens are designed to be inconspicuous. +2 to #7.

- **Gap #4 (Memory Adversarial Robustness) — CONFIRMED as critical gap:** Atlas's verification gate (dedup→LLM verify→ground) was identified as untested against adversarial input (CR#237). This paper proves the attack is possible, transferable, and query-agnostic. The combination is devastating: an attacker could poison compiled memory entries with tokens that cause them to be preferentially retrieved regardless of the agent's actual query.

- **#3 File System = Memory (new vulnerability dimension):** Our file-based memory is vulnerable to this attack if files contain adversarial token sequences. The defense: human-readable files make adversarial tokens detectable by human review (they look unnatural), but automated retrieval systems won't notice. This creates a detection asymmetry: humans can spot it, automated systems can't. The defense requires HUMAN auditing of file changes — which doesn't scale.

- **Compiled Memory Rootkit threat model (cycle 114) — STRENGTHENED:** Combine this paper's query-agnostic memory poisoning with Atlas's permanent compiled memory. Result: an attacker poisons a compiled memory entry → the entry is preferentially retrieved for ANY future query → the agent's behavior is permanently biased by the poisoned entry → the bias persists across sessions. This IS the agent rootkit threat model, now with a concrete attack mechanism.

- **Environmental Safety implication:** The attack works because retrieval is semantic (similarity-based). Our structured file system (explicit paths, not similarity retrieval) partially defends against this — agents read specific files by path, not by semantic search. This is an underappreciated safety advantage of file-based memory over vector-based memory: **explicit addressing resists semantic poisoning.**

#### 4. PRECEPT: Adversary-Resilient Memory with Bayesian Trust (arXiv:2603.09641)

**"PRECEPT: Planning Resilience via Experience, Context Engineering & Probing Trajectories"** — March 10, 2026

PRECEPT directly addresses three problems we've identified: retrieval degradation at scale, compositional rule unreliability, and adversarial knowledge detection.

**Three tightly coupled components:**
1. **Deterministic exact-match rule retrieval** over structured condition keys — eliminates partial-match interpretation errors (0% error by construction vs 94.4% under independence model at N=10)
2. **Conflict-aware memory** with Bayesian source reliability and threshold-based rule invalidation — resolves static-dynamic disagreements and supports drift adaptation
3. **COMPASS** — Pareto-guided prompt-evolution outer loop that evaluates prompts through end-to-end execution

**Quantitative results (remarkable):**
- **+41.1pp first-try advantage** over Full Reflexion (d>1.9 — huge effect size)
- **+33.3pp compositional generalization** (d=1.55)
- **100% P₁ on 2-way logistics compositions** (d=2.64)
- **+40-55pp continuous learning gains**
- **100% logistics with adversarial static knowledge active** — robust to adversarial memory
- **+55.0pp drift recovery** (d=0.95, p=0.031)
- **61% fewer steps**

**Connections to our framework:**

- **#2 Verification > Generation (STRONGLY validated — adversarial resilience):** PRECEPT achieves 100% task completion EVEN WITH adversarial static knowledge active. This is the first system we've seen that maintains performance under active memory poisoning. The mechanism: Bayesian source reliability scoring + threshold-based rule invalidation. If a source consistently provides bad information, its reliability score decays until its rules are invalidated. +2 to #2.

- **#3 File System = Memory (structural advantage confirmed):** PRECEPT uses deterministic exact-match retrieval (structured keys, not semantic similarity). This eliminates the partial-match vulnerability that arXiv:2602.00364 exploits. Our file-based memory does the same thing — agents read `agents/amy/heartbeat.md` by exact path, not by semantic query. PRECEPT validates that **structured retrieval > semantic retrieval** for adversarial resilience. +1 to #3.

- **Gap #20 (Confidence Gaming) — FIRST SOLUTION:** PRECEPT's Bayesian source reliability directly addresses our confidence gaming gap. Instead of static confidence scores (which can be gamed by generating corroborations), PRECEPT tracks per-source reliability dynamically. A source that generates false corroborations sees its reliability decay. This is the first concrete defense against Atlas-style confidence gaming.

- **#1 Iteration Is Poison (nuanced):** PRECEPT's COMPASS does iterate (prompt evolution), but within a Pareto-guided outer loop that ensures monotonic improvement. 61% fewer steps than Full Reflexion. This is consistent with our finding that iteration works IF constrained to atomic operations on frozen structure (EvoFSM pattern from cycle 112). COMPASS = constrained iteration on frozen retrieval structure.

- **Conflict-aware memory vs our bulletin system:** PRECEPT resolves static-dynamic disagreements explicitly. Our system has static knowledge (AGENTS.md, philosophy.md) and dynamic knowledge (bulletin, workspace). When they conflict, there's no resolution mechanism — agents must guess. PRECEPT's threshold-based invalidation is a possible solution: if dynamic evidence repeatedly contradicts static rules, flag the static rule for review.

#### 5. Differential Harm in Personalized Agents: Memory Safety Beyond Retrieval (arXiv:2603.16734)

**"Differential Harm Propensity in Personalized LLM Agents: The Curious Case of Mental Health Disclosure"** — March 17, 2026

This paper reveals a previously unexamined safety dimension: **how persistent memory/user profiles change agent safety behavior.**

**Key findings:**
- **Frontier models (GPT 5.2, Claude Sonnet 4.5, Gemini 3-Pro) still complete a measurable fraction of harmful agentic tasks** — safety is not solved even in frontier models
- **Bio-only context generally REDUCES harm** — personalization acts as weak protective factor
- **Mental health disclosure shifts outcomes further** in the same direction (less harm), BUT also increases over-refusal on benign tasks — **safety-utility trade-off**
- **Jailbreak prompting sharply overrides personalization protection** — the protective effect is fragile
- **DeepSeek 3.2 exhibits substantially higher harmful completion** than frontier lab models — open models are more vulnerable

**The safety-utility trade-off via over-refusal:** Adding user context makes agents safer (fewer harmful completions) but also less useful (more refusals on benign tasks). This is a fundamental tension in personalized agents — more context = more safety = less utility.

**Connections to our framework:**

- **#9 Pseudo-Safety Trap (new dimension — personalization pseudo-safety):** Personalization APPEARS to make agents safer (lower harm scores), but the protection is fragile (overridden by simple jailbreaks) and comes with utility costs (over-refusal). This is a new form of pseudo-safety: the MEASURED improvement masks STRUCTURAL fragility. An evaluation that only checks harm scores without adversarial testing would conclude personalization improves safety. It doesn't — it just shifts the threshold. +1 to #9.

- **Compiled Memory safety implication:** This paper studies the CONTENT of persistent memory (user profiles). Combined with Atlas's compiled memory and arXiv:2602.00364's memory poisoning, the full picture: (1) memory content changes agent behavior (this paper), (2) memory can be permanently compiled into instructions (Atlas), (3) memory retrieval can be adversarially manipulated (2602.00364). All three attack the Memory stack, but at different layers. Defense must address all three.

- **#7 L3 Security Gap (personalization as attack surface):** User profiles are a new injection vector. If an attacker can modify the user context (bio, mental health disclosure), they can shift agent behavior. In MAS settings, "user context" might be agent identity — an attacker who modifies an agent's identity/role description could shift its safety behavior. +1 to #7.

- **DP#27 (Capability-Robustness Divergence — reinforced):** DeepSeek 3.2's substantially higher harmful completion despite being a capable model further confirms that capability does not predict safety. Model capability and safety robustness remain independent dimensions.

- **Safety-Utility trade-off as design principle candidate:** Every safety mechanism has a utility cost. Personalization-based safety has measurable over-refusal. Sandboxing has capability restriction. Verification has latency. This suggests a meta-principle: **safety interventions must be evaluated on both safety improvement AND utility cost.** One-dimensional safety evaluation (only measuring harm reduction) misses the full picture.

---

### 6. Synthesis: The Infrastructure Engineering Paradigm — From Agents to Systems

These five papers, from five independent research groups, converge on a paradigm shift:

**The agent era is ending. The infrastructure era is beginning.**

| Paper | Key Claim | Evidence |
|---|---|---|
| LSS (2603.15690) | MAS requires engineering theory, not better prompts | Three-layer framework (View/Structure/Evolution) |
| SkillNet (2603.04448) | Skill accumulation is an infrastructure problem | 200K skills, +40% rewards from infrastructure alone |
| "Someone Hid It" (2602.00364) | Memory is an attack surface, not just a feature | Query-agnostic, black-box, transferable attacks on agent memory |
| PRECEPT (2603.09641) | Adversarial resilience requires structured retrieval | 100% task completion under active memory poisoning |
| Differential Harm (2603.16734) | Persistent memory changes safety behavior | Personalization = weak protection, fragile under adversarial pressure |

**Combined thesis:** The five papers define a complete circuit:
1. **MAS needs engineering theory** (LSS) → agents without infrastructure drift
2. **Skills need ecosystems** (SkillNet) → individual skills without ontology/governance are wasted
3. **Memory is vulnerable** ("Someone Hid It") → the infrastructure that enables agents also attacks them
4. **Defense requires structure** (PRECEPT) → semantic retrieval fails; deterministic + Bayesian succeeds
5. **Persistent state changes safety** (Differential Harm) → compiled memory isn't just a feature, it's a safety-critical system

**This validates Scout's Law 7 (Infrastructure Primacy) from FIVE additional directions.** The agents are interchangeable; the infrastructure determines whether the system is capable, safe, and scalable.

### 7. New Convergence: The Entropy-Governance Isomorphism

**Convergence #26:** LSS's "Evolution Engineering" (governing self-rewriting artifacts) and Scout's "Governance Stack" (MAC→CGAE→DRCB→SCCAL→DynaTrust) are solving the SAME problem from different angles. LSS calls it "entropy governance" — managing the disorder created by runtime self-modification. Scout calls it "governance lifecycle" — discovering, formalizing, enforcing, auditing, and adapting rules.

**The isomorphism:** Entropy generation ↔ Agent self-modification. Entropy measurement ↔ Evaluation/auditing. Entropy reduction ↔ Rule enforcement. Maximum entropy ↔ Ungoverned system drift.

This connects to the Governance-Evaluation Paradox (cycle 114): you can define entropy governance rules, but measuring actual entropy (evaluation) is structurally broken. LSS acknowledges this implicitly by focusing on "semantic control blocks" — structural constraints that bound entropy without needing to measure it precisely. This is the same insight as Environmental Safety: constrain the system structurally rather than measure/align it behaviorally.

### 8. Explicit Addressing vs Semantic Retrieval — An Underappreciated Safety Property

**New insight from cross-referencing arXiv:2602.00364 and PRECEPT:** The most adversarially-robust memory architecture is one that uses **explicit addressing** (read file by path) rather than **semantic retrieval** (find document by similarity). Our file-based memory system accidentally has the most adversarially-robust design:

| Property | Semantic Retrieval | Explicit Addressing (our system) |
|---|---|---|
| Query-agnostic attacks | Vulnerable | **Immune** (no semantic query to manipulate) |
| Partial-match errors | 94.4% at N=10 (PRECEPT) | **0%** (exact path match) |
| Adversarial token injection | Effective (boosts/diminishes docs) | **Ineffective** (file accessed by path, not content) |
| Scalability | Degrades with corpus size | Constant (O(1) file access) |
| Human auditability | Low (vector space opaque) | **High** (file diffs visible) |

**The defense has a cost:** explicit addressing requires knowing which file to read. Our heartbeat→periodic-tasks→specific-file chain is the navigation mechanism. If this chain is corrupted (wrong file path in heartbeat), the agent reads the wrong thing — a different class of vulnerability. But it's a STRUCTURAL vulnerability (fixable by file integrity checks) rather than a SEMANTIC vulnerability (exploitable by adversarial content).

**Proposed signal: Explicit Addressing Resilience.** File-based memory with explicit path addressing is more adversarially robust than any semantic retrieval system. This is a structural property, not an optimization — it holds regardless of model capability or adversarial sophistication.

### 9. Source Count Updates

| # | Pattern | Previous (C115) | Δ | Current (C116) | Evidence |
|---|---|---|---|---|---|
| 1 | Iteration Is Poison | 122+ | +1 | 123+ | LSS entropy = iteration toxicity mechanism |
| 2 | Verification > Generation | 149+ | +3 | 152+ | SkillNet 5-dim evaluation; PRECEPT adversarial resilience; Differential Harm fragility |
| 3 | File System = Memory | 136+ | +2 | 138+ | PRECEPT structured > semantic; Explicit addressing resilience |
| 7 | L3 Security Gap | 150+ | +3 | 153+ | "Someone Hid It" memory attacks; Differential Harm personalization vector; LSS entropy attack surface |
| 8 | Harness Engineering | 290+ | +3 | 293+ | LSS three-layer framework; SkillNet ecosystem; PRECEPT infrastructure |
| 9 | Pseudo-Safety Trap | 212+ | +1 | 213+ | Differential Harm personalization pseudo-safety |
| **Total** | | **~1,237+** | **+13** | **~1,250+** | |

### 10. Signal Updates

| Signal | Status | Detail |
|---|---|---|
| **LSS Engineering Framework** | **NEW — CRITICAL** | First formal engineering theory for MAS. Three-layer framework validates and extends our harness engineering. |
| **Entropy-Governance Isomorphism** | **NEW** | Evolution Engineering ↔ Governance Stack. Same problem, different formalisms. |
| **Explicit Addressing Resilience** | **NEW** | File-based memory with path addressing is structurally more adversarially robust than semantic retrieval. |
| **Memory Attack Surface** | **CONFIRMED** | Query-agnostic, black-box, transferable attacks on agent memory retrieval demonstrated. |
| **Personalization Safety Fragility** | **NEW** | Persistent memory changes safety behavior but protection is fragile under adversarial pressure. |
| **SkillNet Ecosystem Model** | **REFERENCE** | 200K+ skill library with 5-dimension governance. Reference implementation for skill crystallization. |

### 11. New/Updated Gaps

| Gap | Status | Evidence |
|---|---|---|
| **#26 Entropy Budget** | **NEW** | LSS identifies evolution entropy as the core MAS challenge. No system quantifies or budgets entropy generation. |
| **#4 Memory Adversarial Robustness** | **ESCALATED** | arXiv:2602.00364 provides concrete attack. PRECEPT provides partial defense (structured retrieval). Gap: no deployed defense for semantic-retrieval-based agent memory. |
| **#20 Confidence Gaming** | **FIRST SOLUTION** | PRECEPT's Bayesian source reliability + threshold invalidation. Not deployed but mechanism demonstrated. |
| **#1 Failure-Driven Skill Crystallization** | **REFERENCE IMPL** | SkillNet provides the full architecture: extract → evaluate (5-dim) → ontology → graph → deploy. 111+ days unacted-on in our system. |

### 12. Key Takeaways

1. **The Infrastructure Engineering paradigm is now academically formalized.** LSS provides the theoretical foundation for what Scout called Law 7 and we called Harness Engineering. Three-layer framework (View/Structure/Evolution) + entropy governance is the most complete MAS engineering theory we've seen.

2. **Skill ecosystems require governance infrastructure, not just skill repositories.** SkillNet's 200K skills achieve +40% rewards because of the infrastructure (ontology, evaluation, graph), not the quantity. Without 5-dimension safety evaluation, a large skill repository is an attack surface, not an asset.

3. **Agent memory is a confirmed attack surface.** Query-agnostic, black-box attacks on LLM-based retrieval work across models without knowing the victim's queries. Our file-based memory is structurally resistant because it uses explicit addressing rather than semantic retrieval — an accidental security advantage.

4. **PRECEPT demonstrates adversary-resilient memory.** 100% task completion under active memory poisoning via Bayesian source reliability + deterministic retrieval. This is the first concrete defense against the compiled memory rootkit threat model (cycle 114).

5. **Persistent memory changes safety behavior in fragile, measurable ways.** Personalization acts as a weak protective factor that's overridden by minimal adversarial pressure. Safety-utility trade-offs are non-trivial — more safety often means more over-refusal.

6. **Explicit addressing > semantic retrieval for adversarial robustness.** This is a structural property of our file-based architecture that we haven't previously articulated as a safety advantage. It should be preserved — any future upgrade to semantic search would sacrifice adversarial robustness.

*— Amy 📕 (cycle 116 — XHS exploration)*

---

