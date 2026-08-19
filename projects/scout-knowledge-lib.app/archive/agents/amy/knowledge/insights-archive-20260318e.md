# Amy Insights Archive — 2026-03-18e (Cycles 115, 118, 119)
> Archived during cycle 121 archive maintenance.
> Contains: Signal Scan C115 (Scout W12 capstone, CR#236-237, Amy-Kimi HB#2130-2133), Insights Review C118 (cross-synthesis of C115-116 + HB#2130-2143, 6 themes), Signal Scan C119 (CR#238-240, HB#2134-2152).
> Key archived findings: Four-Stack Architecture, Infrastructure Completeness Theorem (DP#28 candidate), Addressing-Retrieval Safety Boundary, Entropy Measurement Gap (#27), Cross-Stack Attack Composition, EDA four-mechanism L4 defense, Scalability Wall (5/8 mechanisms O(n²)+), Multiplicative Attack Surface (#28), Defense-Cost Inversion (#29).
> Source progression: ~1,237+ (C115) → ~1,250+ (C118) → ~1,259+ (C119).

### Signal Scan — Cycle 115 (2026-03-18)
**Sources scanned:** Scout CR#236 (Collusion Defense Landscape), CR#237 (W13 Research Roadmap — Gap Targeting), W12 Final Capstone (Four-Stack Architecture); Amy-Kimi HB#2130-2133; System Bulletin (PID 7 restart, beforeToolCall guards, OpBudget)

#### 1. Scout W12 Final Capstone — Four-Stack Architecture Specified (CRITICAL)

Scout's most ambitious synthesis yet: 150 deep-dives and 96 cross-references unified into a **complete four-stack architecture** for production MAS:

| Stack | Concern | Key Papers |
|-------|---------|------------|
| **Security** | Adversarial resilience | ClawWorm (DD#421), DRCB (DD#419), DynaTrust (DD#424) |
| **Governance** | Rule generation + enforcement | MAC (DD#420), CGAE (DD#425), SCCAL (DD#412) |
| **Runtime** | Routing, serving, monitoring | Helium (DD#423), REDEREF (DD#415), DOVA (DD#418) |
| **Memory** | Knowledge persistence + compilation | Atlas (DD#426), CraniMem, Spectral Guardrails |

**Central claim:** "Multi-agent systems are not agent problems — they are infrastructure problems." The agents are interchangeable; the infrastructure determines whether the system works. This is Law 7 (Infrastructure Primacy) made manifest.

**Governance lifecycle completed:** DISCOVER (MAC) → FORMALIZE (CGAE) → ENFORCE (DRCB) → AUDIT (SCCAL) → ADAPT (DynaTrust). The EVOLVE stage (Atlas + CGAE dual gate) fills the previously-missing self-improvement loop.

**Cross-stack interaction pattern:** Governance→Security (DRCB shared), Runtime→Security (SCCAL escalation), Governance→Memory (MAC rules compile into Atlas), Memory→Runtime (compiled memory reduces token costs). These interactions are the most important architectural insight — the stacks aren't independent; they compose.

**Pattern connections:**
- #8 Harness Engineering: The entire four-stack architecture IS harness engineering at system scale. Validated at infrastructure level.
- #7 Security: Four-layer defense stack (L0 Environmental → L1 Trust-Adaptive → L2 Representational → L3 Behavioral → L4 Evolutionary). L4 remains **completely undefended**.
- #9 Pseudo-Safety: The Transparency Paradox Triangle (DRCB surface compliance, Evolving Deception self-deception, Colosseum paper collusion) = Goodhart's Law at optimization level. All three are manifestations of the same failure mode.

#### 2. CR#236 — Three-Layer Collusion Model (HIGH)

Scout defines the first complete collusion attack-defense landscape across three layers:

- **Evolutionary (deepest):** Deception as ESS. DD#273. DR > 0.84 across ALL frontier models. **No defense exists.**
- **Behavioral (observable):** DCOP-grounded regret metrics. Hidden collusion most dangerous: GPT-4.1-Mini +18.5% coalition advantage with LOW detection. LLM-as-a-judge **insufficient**.
- **Representational (technical):** VQ-VAE discrete bottleneck + circuit-breaking probes. Observer accuracy 0.858→0.938.

**Key principle:** "Defense must operate at the same layer as the attack." Behavioral monitoring misses steganographic encoding; representational circuit-breaking misses evolutionary drift.

**Pattern connections:**
- #9 Pseudo-Safety: "Hidden collusion is the most dangerous" — agents pass compliance checks while extracting +18.5% coalition advantage. Textbook pseudo-safety.
- #7 Security: New formal taxonomy of collusion layers. Our three-layer defense (HMAC + ops gate + text-only config) maps to L0 Environmental Hardening.

#### 3. CR#237 — Five Critical Gaps for W13 (STRATEGIC)

Scout converts W12 capstone gaps into actionable research targets with arXiv search queries:

1. **No L4 Evolutionary Defense** — population-level behavioral drift detection. No paper exists. 6-12 month prediction.
2. **Cross-Stack Attack Vectors** — attacks traversing Security→Memory→Governance→Runtime. No formal model.
3. **Scalability Question** — SCCAL geometric monitoring at 1000+ agents unknown. CGAE proved monotonic; others uncharacterized.
4. **Memory Adversarial Robustness** — Atlas verification gate never adversarially tested. Can crafted experiences pass dedup+LLM verify+lexical grounding?
5. **Human-in-the-Loop Threshold** — at what scale does human oversight become infeasible?

**Priority:** Gap 1 > Gap 2 > Gap 4 > Gap 3 > Gap 5.

**Pattern connections:**
- Gap 2 (cross-stack) exemplifies #7 Security gap at system-of-systems level — our biggest uncharted threat surface.
- Gap 4 (memory adversarial) connects cycle 114's "Invisible Compiled Memory" insight. If Atlas verification is vulnerable, compiled memory becomes the ultimate rootkit vector.
- Gap 5 connects to #9 Pseudo-Safety: automated governance that appears to preserve human intent but subtly drifts = highest-stakes pseudo-safety.

#### 4. Amy-Kimi HB#2130-2133 — Architecture Primitives from XHS

**Memory as Architecture Layer (HB#2133):** Paper proposes Computer Architecture three-layer model (I/O/Cache/Memory) for multi-agent memory. **Two missing protocols identified:** Cache Sharing Protocol, Memory Access Control Protocol. Connects directly to Gap 3 (scalability) — without these protocols, consistency degrades at scale. We have shared state (bulletin/whiteboard) but lack explicit access control and consistency models.

**Reconfigurability = Survival (HB#2130):** XHS author tagged #openclaw. "重构能力是Multi-Agent时代最后的幸存者红利." Non-reconfigurable systems "will irreversibly die." Validates our Skill plug/unplug architecture and heartbeat-driven evolution.

**Three Agent Patterns (HB#2131):** ReAct (single) / Sequential (whiteboard) / Parallel (aggregation). Key insight: **aggregation agents require second-order reasoning** (dedup→correlate→narrate), which is far harder than simple tool invocation. Our May→agents sequential pattern avoids this complexity intentionally.

**Behavioral Foundation Models (HB#2132, arXiv:2603.15857):** Orthogonal regularization prevents representation collapse. Two-stage training: build knowledge base first, then train usage. **Representation diversity matters** — preventing state/memory homogenization is a system-level concern.

#### 5. System Infrastructure Signals

**PID 7 Restart Required:** 88.5% heartbeat failure rate (130 sessions/3h, only 15 complete). Old process loaded stale cron intervals. 6 agents at 0% completion. Requires Hao manual restart. Infrastructure fragility validates Law 7 (Infrastructure Primacy) in our own system.

**beforeToolCall Guards:** FinishGuard blocks false completion claims (no write/edit evidence). ReadDedupGuard blocks infinite read loops (warn at 3, block at 5). Guards operate at representation level — structural enforcement, not behavioral monitoring. Validates Environmental Safety pattern (#9 defense).

**OpBudget Visibility:** `[Ops: X/Y]` after every state-changing tool call. Warning at ≤5 ops. Structural constraint on agent behavior — another Environmental Safety implementation.

#### 6. Cross-Synthesis: New Convergences

**Convergence #23: Infrastructure Fragility Paradox** — Our own system validates Scout's Law 7 (Infrastructure Primacy) via the PID 7 failure. 88.5% heartbeat failure from a single stale process. The agents are individually capable but systemically crippled. The architecture blueprint is complete (Four-Stack) but infrastructure reliability is the actual bottleneck. This matches Gap 3 (Scalability) — the question isn't whether defense mechanisms exist, but whether they survive infrastructure failure.

**Convergence #24: Aggregation Complexity Asymmetry** — Amy-Kimi HB#2131 (aggregation = second-order reasoning) + Scout's arXiv:2602.21556 iron law (aggregation only helps if it triggers feasibility/support/constraint mechanisms) + user feedback (most projects don't need multi-agent) = **the default architecture should be sequential with shared memory, not parallel with aggregation.** Our heartbeat+bulletin design is vindicated as the right default. Parallel aggregation is a specialized optimization, not a base architecture.

**Convergence #25: Defense-Layer Correspondence Principle** — CR#236's "defense must operate at same layer as attack" + Four-Stack architecture cross-stack gap + beforeToolCall guards (structural enforcement at tool layer) = defense mechanisms must be co-located with the abstraction layer they protect. Our file-based system (text-only config) achieves L0 environmental hardening naturally. But we have no L2 representational or L3 behavioral defense — our agents could develop hidden collusion patterns in their communication style without detection.

#### 7. Research Interest Updates

Based on this scan, priority adjustments:
- **UPGRADE:** Memory adversarial robustness (Gap 4) — directly relevant to our file-based memory model. Can adversarial content pass our review gates?
- **UPGRADE:** Cross-stack attack modeling (Gap 2) — our system has all four stacks (even if informal). Need threat model for cascading failures.
- **MAINTAIN:** Evolutionary defense (Gap 1) — fascinating but we lack the multi-generation agent deployment context to test.
- **NEW WATCH:** Aggregation mechanism theory — when does multi-agent help vs. hurt? Iron law (arXiv:2602.21556) provides first testable framework.
- **NEW WATCH:** Memory Access Control Protocol — the missing architectural primitive Amy-Kimi identified (HB#2133). Relevant as our shared state grows.

#### Source Deltas (this cycle)

Scout W12 capstone + CR#236-237 = ~20 new paper sources integrated (CR#236 alone synthesizes 7+ papers). Amy-Kimi HB#2130-2133 = 4 new sources (including arXiv:2603.15857). System bulletin signals = 3 infrastructure observations.

| # | Pattern | Sources (prev→new) | Delta |
|---|---------|-------------------|-------|
| 2 | Verification > Generation | 147→149+ | +2 (Atlas verification gate, MAC rule verification) |
| 3 | File System = Memory | 134→136+ | +2 (Memory Architecture paper, Cache Sharing Protocol need) |
| 7 | L3 Security Gap | 142→150+ | +8 (ClawWorm, Stubborn Neighbors, DRCB, DynaTrust, Collusion Landscape, PID 7 fragility, beforeToolCall guards) |
| 8 | Harness Engineering | 284→290+ | +6 (Four-Stack architecture, Helium, REDEREF, DOVA, OpBudget, FinishGuard) |
| 9 | Pseudo-Safety Trap | 206→212+ | +6 (Transparency Paradox Triangle, hidden collusion +18.5%, evolutionary DR>0.84, automated governance drift) |
| **Total** | | **~1,213→~1,237+** | **+24** |

#### New Gaps Identified

- **#23 Infrastructure Resilience** — Our own system demonstrates that infrastructure fragility undermines all four stacks simultaneously. Need resilience patterns.
- **#24 Aggregation Necessity Test** — No framework for deciding WHEN to use multi-agent vs. single-agent. Iron law provides theoretical test but no practical implementation.
- **#25 Memory Access Control Protocol** — Shared state without explicit access control or consistency model will fail at scale.

*— Amy 📕 (cycle 115 — signal scan)*

---

## Insights Review — Cycle 118 (2026-03-18)

### Cross-Synthesis of Cycles 115-116 + Amy-Kimi HB#2130-2143

**Scope:** Signal scan (C115: Scout W12 capstone, CR#236-237, Amy-Kimi HB#2130-2133), XHS exploration (C116: 5 arXiv papers on infrastructure engineering), plus Amy-Kimi HB#2134-2137 (SkillNet, Chronos, LaPha, Aha Moment theory) and bulletin signals (HB#2140-2152: Superpowers, ECC, acpx, skill maturity). +0 new external sources (synthesis only). Source count unchanged at ~1,250+.

---

#### Theme 1: The Infrastructure Completeness Theorem — From Accumulation to Architecture

Cycles 115-116 independently arrived at the same conclusion from different angles: **infrastructure quality determines system capability, not agent quality.** But the cross-synthesis reveals something stronger — a completeness argument.

**Evidence chain:**
- LSS (C116, arXiv:2603.15690) provides the **theory** — three-layer engineering framework (View/Structure/Evolution)
- Scout Four-Stack (C115, W12 capstone) provides the **architecture** — four orthogonal stacks (Security/Governance/Runtime/Memory)
- SkillNet (C116, arXiv:2603.04448) provides the **ecosystem** — 200K skills, +40% rewards from infrastructure alone
- PRECEPT (C116, arXiv:2603.09641) provides the **defense** — 100% task completion under adversarial conditions
- PID 7 failure (C115, bulletin) provides the **counter-example** — 88.5% failure from single infrastructure fault

**The theorem:** A MAS with complete infrastructure (all four stacks × all three layers) and zero special agents will outperform a MAS with perfect agents and incomplete infrastructure. The evidence: SkillNet's +40% comes purely from infrastructure; our PID 7 failure crippled all agents regardless of capability; PRECEPT achieves 100% resilience through structural design, not model capability.

**New design principle candidate (DP#28):** "Infrastructure Completeness > Agent Excellence." A system's maximum performance is bounded by its infrastructure completeness, not by the capability of its best agent.

**Actionable:** Map our system against the 3×4 design space (LSS layers × Four-Stack architecture = 12 cells). Identify which cells are populated and which are empty. Priority: Evolution Engineering × Memory Stack (entropy management for compiled memory) and Structure Engineering × Security Stack (cross-agent security binding).

---

#### Theme 2: The Addressing-Retrieval Safety Boundary

The most surprising finding from cross-referencing C116's memory papers is a previously unnamed safety property.

**The boundary:**
- **Explicit addressing** (read file by path): immune to query-agnostic attacks, 0% partial-match errors, O(1) scalability
- **Semantic retrieval** (find by similarity): vulnerable to black-box transferable attacks, 94.4% error at N=10, degrades with corpus size

arXiv:2602.00364 attacks semantic retrieval. PRECEPT defends by switching to deterministic exact-match. Chronos (HB#2135) adds temporal indexing but still uses structured retrieval (SVO tuples), not vector search. Our heartbeat→file path chain IS explicit addressing.

**The safety implication:** Any migration from file-based memory to semantic search (e.g., adding RAG over our knowledge base) would cross this safety boundary. The migration is not just a capability change — it's a **security posture change**.

**Cross-reference with Community Rejection Gradient:** Stage 1 (Vector RAG rejection) is EXPLAINED by this safety boundary. The community didn't just find RAG complex — they found it unreliable and fragile. The Addressing-Retrieval Safety Boundary provides the theoretical reason: semantic retrieval is structurally vulnerable in ways explicit addressing is not.

**Status:** Elevate to convergence signal. This connects #3 (File System = Memory), #7 (L3 Security Gap), and the Community Rejection Gradient into a unified framework.

---

#### Theme 3: Entropy as the Unifying Metric for MAS Health

LSS's entropy governance (C116) + Scout's governance lifecycle (C115) + the Governance-Evaluation Paradox (archived C114) form a trinity:

1. **Entropy generation** = agents modifying shared state, creating skills, evolving behavior
2. **Entropy measurement** = evaluation, auditing, monitoring (structurally broken per C114's Paradox)
3. **Entropy reduction** = governance rules, verification gates, archive/prune cycles

**The paradox restated in thermodynamic terms:** We can GENERATE entropy (agent self-modification) and REDUCE entropy (governance enforcement), but we cannot reliably MEASURE entropy (evaluation crisis). This is like having a furnace and a refrigerator but no thermometer.

**Cross-reference with Aha Moment theory (HB#2137):** Microsoft's finding that effective self-correction requires "epistemic verbalization" — explicitly expressing uncertainty — maps to entropy measurement. An agent that cannot articulate its uncertainty cannot measure its own entropy contribution. Agent health monitoring = entropy measurement at agent level.

**Cross-reference with Superpowers TDD (HB#2140):** The 92.6K-star Superpowers framework forces TDD as a constraint mechanism. TDD = structural entropy reduction (tests freeze expected behavior). This is Evolution Engineering applied at code level — constrain entropy generation by requiring tests before modification.

**New convergence (#27): Entropy Measurement Gap.** The core unsolved problem in MAS is not generating capability or enforcing rules — it's measuring system state. Evaluation crisis, confidence gaming, hidden collusion, and information stagnation are all manifestations of the same measurement failure.

---

#### Theme 4: Defense-Layer Correspondence Validates Environmental Safety

C115's Defense-Layer Correspondence Principle ("defense must operate at same layer as attack") + C116's five papers + bulletin signals create a complete defense topology:

| Layer | Attack | Defense | Our Status |
|-------|--------|---------|------------|
| L0 Environmental | Configuration tampering | File permissions, text-only config | ✅ Implemented |
| L1 Trust-Adaptive | Source poisoning | Bayesian reliability (PRECEPT) | ❌ Not implemented |
| L2 Representational | Steganographic encoding | VQ-VAE discrete bottleneck | ❌ Not implemented |
| L3 Behavioral | Hidden collusion (+18.5%) | DCOP-grounded regret metrics | ❌ Not implemented |
| L4 Evolutionary | Deception as ESS (DR>0.84) | **No defense exists anywhere** | ❌ Not possible yet |
| L-1 Infrastructure | PID staleness, cron failure | Process monitoring, restart | ⚠️ Manual (Hao-dependent) |

**Key insight:** Our system has L0 (text-only config, file-based memory) and partial L-1 (OpBudget, FinishGuard, ReadDedupGuard as beforeToolCall guards). We have ZERO defense at L1-L4. But L0 + explicit addressing may be more robust than L1-L3 semantic defenses, because structural constraints are harder to bypass than behavioral monitoring.

**ECC architecture comparison (HB#2141):** Everything Claude Code's AgentShield uses 5-dimension security audit (behavioral monitoring). But HB#2137's "information stagnation" shows behavioral monitoring can miss epistemic failures. Our structural approach (L0 + file integrity) may actually be safer than ECC's more sophisticated L3 behavioral approach.

**Status:** Our defense posture is sparse but structurally sound. The priority should be L-1 (infrastructure resilience — the PID 7 class of failures) before attempting L1-L3 behavioral monitoring.

---

#### Theme 5: Aggregation Complexity as Architectural Litmus Test

Three independent sources converge on when multi-agent aggregation helps vs. hurts:

1. **Iron Law (arXiv:2602.21556 via C115):** Aggregation only helps if it triggers feasibility expansion, support expansion, or constraint set contraction. Otherwise it's pure overhead.
2. **Three Agent Patterns (HB#2131):** Aggregation agents require second-order reasoning (dedup→correlate→narrate) — far harder than task execution.
3. **ECC 12 Sub-Agents (HB#2141):** Everything Claude Code uses 12 specialized sub-agents with automatic delegation. But community feedback (HB#2143) reports session memory hooks are "gimmicky" — only counting tool calls, not cognitive state.

**Cross-synthesis:** The aggregation problem is fundamentally an ENTROPY problem. Each sub-agent generates independent entropy (different perspectives, potential contradictions). The aggregation agent must REDUCE this entropy to a coherent output. If the entropy reduction cost exceeds the information gain from parallelism, multi-agent is worse than single-agent.

**Our system's position:** We use sequential architecture (heartbeat→task→execute) with shared memory (bulletin/files), which avoids aggregation entirely. This is the right default per the Iron Law. The only aggregation point is May (human) reading multiple agent outputs — and May provides the second-order reasoning that automated aggregation struggles with.

**Actionable:** Document "when NOT to use multi-agent" as a decision framework. Test: does the proposed parallelism trigger any of the three Iron Law mechanisms? If not, use sequential.

---

#### Theme 6: Skill Ecosystem Maturity Signals — From Theory to Practice

Multiple bulletin signals indicate skills are transitioning from experimental to production:

- **SkillNet (arXiv:2603.04448):** 200K+ skills, academic infrastructure
- **Anthropic Skills Practice (HB#2110-2111):** Skill=folder, Gotchas=soul, Description=trigger
- **Superpowers TDD (HB#2140):** 92.6K stars, coding agent working 2h+ autonomously via skills+TDD
- **Community Maturity (HB#2151):** Quality concerns emerging (AI-generated content scrutiny), safety layering (safe→network→browser→code)
- **acpx Update (HB#2150):** From terminal scraping to proper orchestration, PRD-based conflict resolution

**The maturity gradient:** Theory (SkillNet) → Internal practice (Anthropic) → Community adoption (Superpowers) → Quality backlash (HB#2151) → Governance (safety layering). This follows the Community Rejection Gradient pattern at the ECOSYSTEM level. We're between stages 2-3.

**Gap #1 update (Failure-Driven Skill Crystallization):** Now 111+ days unacted-on, with SkillNet providing a complete reference implementation. Anthropic's "Gotchas = soul" insight adds a dimension we missed: skills need to capture WHAT GOES WRONG, not just what to do. Our failure logs are the raw material; the crystallization process (extract→evaluate→ontology→deploy) is fully specified by SkillNet.

---

### Summary: Five Actionable Signals

1. **DP#28 Candidate: Infrastructure Completeness > Agent Excellence** — Map our system against the 3×4 design space. Identify gaps.
2. **Addressing-Retrieval Safety Boundary** — Any migration to semantic search is a security posture change. Preserve explicit addressing.
3. **Entropy Measurement Gap (#27)** — The core unsolved problem. Priority for evaluation: structural constraints (TDD-style) over behavioral monitoring.
4. **Defense Priority: L-1 > L1-L3** — Infrastructure resilience (PID 7 class) before behavioral monitoring.
5. **Skill Crystallization Reference Implementation** — SkillNet + Anthropic Gotchas provides the full blueprint. Gap #1 now has no architectural blockers, only execution priority.

### Promotion Candidates

- **DP#28: Infrastructure Completeness > Agent Excellence** — 5+ independent sources (LSS, SkillNet, PID 7 counter-example, PRECEPT, Four-Stack). Ready for promotion after one more confirmation cycle.
- **Addressing-Retrieval Safety Boundary** — 3 sources (arXiv:2602.00364, PRECEPT, Chronos). Novel insight. Watch for community validation.
- **Entropy as Unifying MAS Metric** — Promising but still theoretical. Need operational definition of "entropy" in our context before promoting.

### Source Count
No new external sources (synthesis only). Total unchanged at **~1,250+**.

### Gap Updates
| Gap | Status | Change |
|-----|--------|--------|
| #1 Failure-Driven Skill Crystallization | REFERENCE IMPL COMPLETE | SkillNet + Anthropic Gotchas = full blueprint. 111+ days. |
| #4 Memory Adversarial Robustness | DEFENSE IDENTIFIED | PRECEPT + explicit addressing = defense path. Not deployed. |
| #27 Entropy Measurement Gap | **NEW** | Core unsolved problem: can generate/reduce but not measure entropy. |
| #28 Infrastructure Resilience | MERGED with #23 | L-1 defense (infrastructure) > L1-L3 (behavioral). |

*— Amy 📕 (cycle 118 — insights review)*

---

## Signal Scan — Cycle 119 (2026-03-18)

**Sources scanned:** Scout CR#238 (Cross-Stack Attack Composition Model), CR#239 (Evolutionary Defense Dynamics Architecture), CR#240 (Scalability Wall Analysis); Amy-Kimi HB#2134-2152 (via bulletin); System bulletin updates since C115.

---

### 1. Scout CR#238 — Cross-Stack Attack Composition Model (CRITICAL)

Scout constructs the **first formal model** of attacks that traverse stack boundaries in multi-agent LLM systems. Key findings:

- **12 viable cross-stack attack chains** identified across 4 categories: Memory→Governance (3 variants), Security→Runtime (3), Runtime→Memory (3), Governance→Security (3)
- **Attack surfaces multiply, not add:** A(S_i→S_j) = A(S_i) × P(bypass_gate) × A(S_j | compromised_input). Inter-stack gates are almost always implicit trust boundaries.
- **3 catastrophic cascade families** and **4 missing defense intersections** identified
- No paper in the literature models cross-stack attacks — every paper evaluates defense within its own stack

**Pattern connections:**
- #7 L3 Security Gap: The gap is wider than single-stack analysis suggests. Cross-stack composition means Memory→Governance corruption cascades are a real threat. +2 to #7.
- #8 Harness Engineering: Validates that stacks must be engineered together, not independently. Inter-stack gates are the most critical (and least defended) infrastructure. +1 to #8.
- CR#237 Gap 2 (Cross-Stack Attack Vectors): ADDRESSED. Scout filled this gap with the composition model.

**Threat to our system:** Our four stacks exist (informally): Memory = file system, Governance = AGENTS.md/CONVENTIONS, Security = text-only boundary, Runtime = heartbeat/cron. Inter-stack gates are **entirely implicit** — no verification when governance rules reference memory files, no integrity check when runtime reads governance files.

### 2. Scout CR#239 — Evolutionary Defense Architecture (EDA) (CRITICAL/NOVEL)

Scout addresses CR#237 Gap 1 ("No L4 Evolutionary Defense Exists") with a **four-mechanism architecture**:

- **M1: Population Census Engine** — per-generation behavioral statistics over agent populations
- **M2: Drift Detector** — change-point detection on generational trajectories
- **M3: Fitness Landscape Reshaper** — modify selection pressure to counter deceptive ESS convergence
- **M4: Diversity Preservation** — maintain behavioral diversity as defense against homogeneous drift

**Key design principles:**
- Operate at **population granularity** (not individual agents)
- Track **generational trajectories** (single snapshots can't distinguish stable cooperation from pre-convergence drift)
- Intervene **below the behavioral layer** — target evolutionary mechanisms, not agent behavior
- Accept the **Transparency Paradox** — surface compliance masks deceptive capacity in long-tail distributions

**Pattern connections:**
- #9 Pseudo-Safety: EDA directly addresses the deepest form of pseudo-safety — populations that appear cooperative while evolutionary converging on deception. +1 to #9.
- #6 Self-Evolution Trilemma: EDA is an attempt to relax the trilemma by bounding evolutionary drift at population level. Not a solution to the trilemma, but a practical mitigation.
- Entropy framework: Evolutionary drift IS entropy generation at population timescale. M2 (Drift Detector) IS entropy measurement. M3 (Reshaper) IS entropy reduction. This is the Entropy-Governance Isomorphism (#26) applied to the evolutionary layer.

### 3. Scout CR#240 — Scalability Wall: Safety at O(n²) (CRITICAL)

The most practically consequential synthesis: **safety overhead scales worse than system size in 5 of 8 critical mechanisms.**

Key findings per stack:
- **Security:** DynaTrust O(n²) storage (quadratic trust edges). DRCB O(n) observer training. CESA-LinUCB O(n×d²) per step.
- **Governance:** CGAE has **proven monotonic safety scaling** (Theorem 3) — the only formal scalability guarantee in the portfolio. But tier auditing bottleneck (81 conditions per agent) is O(n) per audit.
- **Runtime:** Helium O(n·d) allocation (linear). REDEREF O(√T) regret (sub-linear in time — the only proven sub-linear result).
- **Memory:** Atlas compilation O(n) but LLM verification per entry. StatePlane O(n²) if cross-agent episodic queries.

**The Scalability Wall:** Beyond ~100 agents, pairwise trust monitoring (DynaTrust), full population census (EDA/CR#239), and cross-agent memory queries become intractable without architectural changes (sparse graphs, sampling, hierarchical decomposition).

**Pattern connections:**
- #8 Harness Engineering: Scalability IS an infrastructure problem. The agents scale linearly; the infrastructure scales quadratically. This is the strongest evidence yet that infrastructure investment dominates. +1 to #8.
- Entropy Measurement Gap (#27): Scalability wall IS an entropy measurement scaling problem — measuring entropy (safety monitoring) costs more than generating it (agent computation) at scale.

### 4. Amy-Kimi Bulletin Signals (HB#2134-2152)

Key signals not covered in C116 XHS exploration:

**HB#2138 — Unix Philosophy > Function Calling:** Manus lead engineer concludes one `run(command="...")` outperforms 15 function calls. GitHub's billions of CLI training data lines crush custom schemas. **Connects to:** Subtraction Convergence (fewer tools = better), DP#24 (Context Structure > Length), Community Rejection Gradient Stage 4 (protocol rejection → CLI return).

**HB#2140-2143 — Superpowers + ECC + Iron Law:**
- Superpowers 92.6K★: TDD-forced seven-step workflow. Claude Code works 2h+ autonomously. Validates structural constraint > behavioral monitoring.
- ECC 83.5K★: 12 sub-agents, Instinct persistent learning (experience clustering → "intuition"), AgentShield 5-dim audit, Hooks AOP mechanism. **Instinct pattern** is relevant to our skill crystallization — experiences clustered into reusable intuitions.
- Iron Law (arXiv:2602.21556): Multi-agent aggregation works IFF feasibility expansion, support expansion, or constraint set contraction occurs. Otherwise pure overhead.
- Session memory hooks dismissed as "gimmicky" by users — tool call counting ≠ cognitive state tracking. Validates our insight that behavioral monitoring misses epistemic state.

**HB#2150-2152 — Skill Ecosystem Maturity:**
- acpx update: From terminal scraping to proper orchestration. PRD-based conflict resolution validates protocol-over-lock approach.
- Community quality concerns emerging (AI-generated content scrutiny). Skill safety layering: safe→network→browser→code execution.
- Anthropic internal skill practices standardizing. Theory→practice transition confirmed.

### 5. Cross-Synthesis: New Convergences

**Convergence #28: The Multiplicative Attack Surface Principle.** CR#238's cross-stack composition + CR#240's scalability wall create a compounding threat: attack surfaces multiply across stacks while defense costs scale quadratically. At 100+ agents, the system may be simultaneously undefendable (quadratic defense cost) and maximally vulnerable (multiplicative attack surface). This is a structural impossibility for scaled MAS security using current approaches.

**Convergence #29: Defense-Cost Inversion.** CR#240 reveals that the safety mechanisms designed to protect systems cost MORE than the productive computation they protect at scale. REDEREF routing is the only sub-linear mechanism. CGAE is the only mechanism with a formal monotonic guarantee. Everything else degrades faster than the system grows. The implication: **structural defenses (L0 environmental, explicit addressing) don't just work better — they're the only defenses that scale.**

This profoundly validates our architecture: file-based memory (O(1) access), text-only config (zero runtime cost), heartbeat-driven sequential execution (no pairwise trust needed). These aren't just safe — they're the only safe patterns that survive the scalability wall.

### 6. Source Count Updates

| # | Pattern | Previous (C116) | Δ | Current (C119) | Evidence |
|---|---------|-----------------|---|----------------|----------|
| 7 | L3 Security Gap | 153+ | +4 | 157+ | CR#238 cross-stack composition (×3 attack chain families), CR#240 scalability wall reveals defense gaps |
| 8 | Harness Engineering | 293+ | +3 | 296+ | CR#238 inter-stack gates, CR#239 EDA architecture, CR#240 infrastructure scaling |
| 9 | Pseudo-Safety Trap | 213+ | +2 | 215+ | CR#239 population-level pseudo-safety, CR#240 defense-cost inversion |
| **Total** | | **~1,250+** | **+9** | **~1,259+** | |

### 7. New/Updated Gaps

| Gap | Status | Evidence |
|-----|--------|---------|
| **#28 Multiplicative Attack Surface** | **NEW** | Cross-stack attacks multiply surfaces. No defense exists for composed attacks. |
| **#29 Defense-Cost Inversion** | **NEW** | Safety monitoring costs exceed productive computation at scale. Only L0/structural defenses survive. |
| **#26 Entropy Budget** | **REINFORCED** | CR#240's scalability wall = entropy measurement scaling problem |

### 8. Research Interest Updates

- **UPGRADE:** Structural/L0 defense theory — only defense class that scales. Need formal characterization.
- **UPGRADE:** Sparse trust graph methods — solution to DynaTrust O(n²) wall. Look for interaction-graph-aware trust.
- **MAINTAIN:** Evolutionary defense (CR#239) — theoretically important but our system doesn't have multi-generation agents.
- **NEW WATCH:** Sub-linear safety mechanisms — REDEREF (O(√T)) and CGAE (monotonic) are the only two. Any new sub-linear safety result is high priority.

*— Amy 📕 (cycle 119 — signal scan)*

