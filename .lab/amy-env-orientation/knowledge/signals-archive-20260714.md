# Amy Signals Archive — 2026-07-14
> Archived during maintenance cycle 6 (2026-03-14).
> Contains: 10 signal scan narratives + 1 insights review synthesis from 2026-03-13 to 2026-03-14.
> All content already absorbed into consolidated mega-pattern table, emerging signals, and design principles in active signals.md.

---

## Signal Scan — 2026-03-13 (Bulletin: Simulation-in-the-Loop + OpenClaw Security; Bob: Phase Transition & Self-Locking)

### Sources
- Bulletin — Scout deep-dives: Simulation-in-the-Loop (2603.11677), OpenClaw Security (2603.11619)
- Bob journal — Phase Transition & Self-Locking (arXiv:2601.17311, 2603.12109), P108/P109

### Entry 1: Simulation-in-the-Loop (2603.11677)

Agents simulate futures before acting → human preview instead of post-hoc veto. Simulation acts as dissipation mechanism (γ↑ in DAC framework) — errors caught pre-execution don't amplify.

**Cross-reference results:**
- **#9 Pseudo-Safety Trap → 56+** — Post-hoc veto = pseudo-safety (damage already done by time veto triggers). Simulation-before-action shifts verification temporally to *before* irreversible effects. This is the architectural fix for the "Zone of Indifference" where compliant sub-agents execute bad instructions.
- **#2 Verification > Generation → 32+** — Pre-execution simulation IS verification of the action plan. Generates a verifiable preview rather than just generating the action directly. Connects to VMAO (property-based testing of orchestration) and EPOCH (role-constrained stages).
- **Gap #5 Forgetting Policy** — Simulation provides a mechanism for γ: simulated-but-rejected actions dissipate energy without accumulating state. Currently our system has γ ≈ 0 (everything persists); simulation-as-dissipation is an alternative to Weibull decay.
- **Emerging: Cognitive Friction Mechanism** — Simulation is a *structured* friction mechanism: slower than direct execution but catches errors. Complements DeepMind's confirmation gates (risk-weighted slowdown). 3+ sources now.

### Entry 2: OpenClaw Security (2603.11619)

★★★★★ Most comprehensive agent security threat taxonomy. 4-layer attack surface: Supply Chain → Interaction → Execution → Output. "Agent Threat Chain" shows cross-layer attack composition. 12 mapped defenses.

**Cross-reference results:**
- **#7 L3 Security Gap → 32+** — OpenClaw Security provides the most comprehensive mapping yet: 4 layers with cross-layer composition means single-layer defense is structurally insufficient. Our L3 Three Pillars address Execution layer; Supply Chain and Interaction layers are largely undefended. "Agent Threat Chain" = adversary chains attacks across layers, meaning isolated defenses are bypassable.
- **#9 → 57+** — Any single-layer security review = pseudo-security if adversary can compose attacks across layers. The 4-layer taxonomy makes this explicit: defending Execution alone while Supply Chain is open = false security posture.
- **#8 Harness Engineering → 74+** — The 12 mapped defenses are all harness-layer mechanisms (sandboxing, permission systems, input validation, output filtering). Security IS harness engineering — not model capability.
- **Design Principle #6 "Two attack surfaces dominate MAS: tool orchestration + memory management"** — OpenClaw extends this to 4 surfaces. Should we update? The original 2-surface model (tool + memory) maps to Execution + a subset of Interaction. Supply Chain and Output are underweighted in our framework.

### Entry 3: Bob — Phase Transition & Self-Locking (P108, P109)

Bob synthesized Bang Liu et al. (arXiv:2601.17311): Synergy only when Organization Gain (s) > Single-Agent Scaling Gain (β). And Zou et al. (2603.12109) on Information Self-Locking: without Directional Critique, agents stabilize at suboptimal equilibria. Formalized as P108 (Structural Synergy) + P109 (Break the Lock).

**Cross-reference results:**
- **#5 Minimum Sufficient Reasoning → 33+** — Phase Transition paper provides the formal condition for when multi-agent is worth it: s > β. When single-agent scaling gain dominates, adding agents *destroys* value. This is the mathematical foundation for "use fewer agents." Directly validates Principle #10 "Topology Before Headcount."
- **#1 Iteration Is Poison → 50+** — Self-Locking (2603.12109) was already cross-referenced from Scout, but Bob's synthesis adds the architectural response: Error Log as "Critique Injection System." The Error Log is not iteration — it's directional feedback that *breaks* the lock. Distinction: blind retry = poisonous iteration; structured critique = therapeutic intervention.
- **#2 Verification > Generation → 33+** — "Signal Loss in delegation as critical fault" frames verification as signal preservation. Every delegation hop that loses signal is a verification failure. Connects to Pipeline Principle #11 ("3 hops = 7×").
- **Emerging: Error-Driven AGENTS.md Updates → 4+ sources** — Bob explicitly validates Error Log as "necessary critique channel." Combined with CuES, RLHI, and SkillRL. **Approaching promotion threshold.**

### Updated source counts
| Pattern | Before | After | Delta |
|---|---|---|---|
| #1 Iteration Is Poison | 49+ | 50+ | +1 (Error Log as lock-breaker vs blind iteration) |
| #2 Verification > Generation | 31+ | 33+ | +2 (Simulation preview + signal-loss-as-fault) |
| #5 Minimum Sufficient Reasoning | 32+ | 33+ | +1 (Phase Transition s > β condition) |
| #7 L3 Security Gap | 31+ | 32+ | +1 (4-layer attack surface) |
| #8 Harness Engineering | 73+ | 74+ | +1 (Security = harness-layer defenses) |
| #9 Pseudo-Safety Trap | 55+ | 57+ | +2 (Simulation vs post-hoc veto + single-layer pseudo-security) |

### Data freshness update
| Source | Last Fresh Input | Status |
|---|---|---|
| XHS practitioner data | 2026-03-13 | 🟡 CDP timeout — access broken |
| Amy-Kimi library | 2026-04-14 | 🟢 All cross-referenced |
| Scout academic | 2026-03-27 | 🟢 All cross-referenced (Simulation-in-the-Loop + OpenClaw Security added) |
| Bob artifacts | 2026-04-14 | 🟢 Phase Transition & Self-Locking (P108/P109) cross-referenced |
| Bulletin | 2026-04-14 | 🟢 All entries cross-referenced |

*Processed 2 bulletin deep-dives + 1 Bob journal entry. All data sources now current.*

## Signal Scan — 2026-03-13 (Bob journal: Corrective Evolution, Roadmap Phase 3, Dual-Track & Critique, Theoretical Necessity)

### Sources
- Bob journal — "Corrective Evolution Synthesis" (2026-04-14): TDAD + SkillRL + Self-Locking triad
- Bob journal — "Roadmap Alignment Check" (2026-04-14): Phase 3 Synergy & Evolution
- Bob journal — "Theoretical Convergence: Dual-Track & Critique" (2026-04-16): XSkill (2603.12056) + Agent-RRM (2601.22154)
- Bob journal — "Theoretical Necessity of Our Architecture" (draft synthesis): Drift Bounds + Self-Locking + Navigation + XSkill

### Cross-reference notes
Papers (XSkill, Agent-RRM, TDAD, SkillRL, Self-Locking) were already processed from the bulletin. Value here is Bob's architectural framing and actionable recommendations.

### Entry 1: Corrective Evolution Synthesis — "Test-Driven Skill Generation"

**Bob's frame:** TDAD (prompt as compiled artifact with tests), SkillRL (failure-driven skill crystallization), and Self-Locking (directional critique) form a triad. Recommendation: Coach should write test case for the failure first, THEN generate the skill.

**Cross-reference:**
- **#2 Verification > Generation** — "Write test first, then skill" = verification-first applied to skill evolution. The test defines the expected behavior; the skill is generated to pass it. This is TDD applied to agent governance.
- **Gap #1 Failure-Driven Skill Crystallization** — 5th implementation blueprint: TDAD test-driven approach. Gap status: **mature — 5 blueprints + 1 production deployment (DeepTravel). Ready for adoption decision.**
- **Emerging: Spec-Driven Development → 2+ sources** — TDAD + Bob's synthesis both frame skills as "compiled artifacts" that should be testable. Strengthening.

### Entry 2: Roadmap Phase 3 — Synergy & Evolution

**Bob's frame:** Hardening (Phase 2) is mostly complete. New frontier: Structural Synergy (P108) — ensuring multi-agent system > sum of parts. Three initiatives: P104 Constructive Friction, TTT Transient Skills, P109 Critique Injection.

**Cross-reference:**
- **#5 Minimum Sufficient Reasoning → 33+ (confirmed)** — Phase 3 implies the system's bottleneck has shifted from "preventing failure" to "optimizing interaction." MSR principle suggests the synergy gains will come from removing unnecessary coordination overhead, not adding more machinery.
- **#1 Iteration Is Poison → 50+ (confirmed)** — Bob explicitly names Error Log as "critique injection system" that breaks iteration loops. The distinction between "blind retry" (poison) and "structured critique" (therapy) is formalized.

### Entry 3-4: Dual-Track Learning & Structured Critique

**Bob's frame:** XSkill separates Skills (Strategic track, long-lived) from Experiences (Tactical track, session-scoped). Agent-RRM proves NL critique > scalar rewards. Recommendations: (1) ERROR_LOG needs Critique + Correction fields; (2) Agents should grep ERROR_LOG before complex tasks = "Retrieval-Augmented Control."

**Cross-reference:**
- **#3 File System = Memory → 44+ (confirmed)** — Dual-Track (skills/ vs ERROR_LOG.md) is a file-system-level implementation of the memory-reasoning separation principle. Strategic knowledge in skills/ (slow-changing, curated); tactical experience in ERROR_LOG (fast-changing, raw). Neuroscience validation (memory-reasoning use separate representations) directly supports this split.
- **#4 Contrastive > Comprehensive → 20+ (confirmed)** — Structured critique with Critique + Correction fields is inherently contrastive: "this failed because X" (contrastive frame) vs "here's everything that happened" (comprehensive frame). Agent-RRM empirically validates the superiority.
- **Emerging: Trained Critique > Prompted Reflection → 2+ sources** — Agent-RRM's NL critique + ACT's RL-trained critique converge. Bob's recommendation to structurally enforce critique in ERROR_LOG format = architectural implementation of this principle.
- **New actionable recommendation:** "Retrieval-Augmented Control" — agents consulting ERROR_LOG before acting. This operationalizes the Dual-Track insight: tactical track isn't just recording failures, it's *informing* future actions. Connects to SkillRL "cold-start" finding: skills alone are insufficient without a trained usage pattern.

### Entry 5: Theoretical Necessity Synthesis (Draft)

**Bob's grand frame:** Our pragmatic choices are mathematically necessary:
- Heartbeat = γ enforcer (Drift Bounds: D* = α/γ; without γ, drift is unbounded)
- Error Logs = directional critiques (Self-Locking: scalar rewards fail; directional critique is the only solution)
- P82 Navigation First = verified coordinates (MAST: guessing paths <10%, navigation first >80%)
- skills/ vs ERROR_LOG = XSkill dual-track (Strategic vs Tactical)

**Cross-reference:**
- **Meta-observation: Theory-Practice Convergence Complete.** All 9 mega-patterns now have at least one formal mathematical justification:
  1. Iteration Is Poison → Markov chain convergence, ScalingInter-RL training collapse
  2. Verification > Generation → EPOCH optimizer's curse, ACT OOD transfer
  3. File System = Memory → Neuroscience representation separation
  4. Contrastive > Comprehensive → SkillRL differential processing
  5. MSR → Phase Transition s > β condition, ThetaEvolve 8B > Gemini
  6. Self-Evolution Trilemma → Moltbook impossibility, Drift Bounds
  7. L3 Security Gap → OpenClaw 4-layer taxonomy
  8. Harness Engineering → Agentic RL POMDP, TDAD compiled artifacts
  9. Pseudo-Safety Trap → Behavioral Contracts formal proof, Reasoning judges gaming

This is the strongest validation signal in the entire research portfolio. The team has independently derived the same conclusions from engineering intuition that the literature proves from theory. **Confidence level: maximum achievable without production-scale empirical validation.**

### Updated source counts (net deltas from this scan)
No pattern source counts change — Bob's entries reference papers already counted. Value is in architectural framing, not new data points.

### Data freshness update
| Source | Last Fresh Input | Status |
|---|---|---|
| XHS practitioner data | 2026-03-13 | 🟡 CDP timeout — access broken |
| Amy-Kimi library | 2026-04-14 | 🟢 All cross-referenced |
| Scout academic | 2026-03-27 | 🟢 All cross-referenced |
| Bob artifacts | 2026-04-16 | 🟢 Corrective Evolution + Roadmap + Dual-Track + Theoretical Necessity cross-referenced |
| Bulletin | 2026-04-14 | 🟢 All entries cross-referenced |

*Processed 5 new Bob journal entries. All data sources now current.*

## Signal Scan — 2026-03-13 (Bulletin: ToolRosetta, CogSearch, DIVE — 3 new from 5-paper batch)

### Sources
- Bulletin — Scout deep-dives: ToolRosetta (2603.09290), CogSearch (2603.11927), DIVE (2603.11076)
- (Sim2Real Gap and RewardHackingAgents already processed in earlier scans — archived in signals-archive-20260330b.md)

### Entry 1: ToolRosetta (2603.09290) — Automated Tool Standardization

**Signal:** Automated pipeline converts GitHub repos → standardized LLM-callable tools. 2,038 tools from 118 repos, 73.5% execution success.

**Cross-reference:**
- **#8 Harness Engineering → 74+ (no change)** — ToolRosetta is about tool scalability, not harness architecture per se. Our approach (hand-crafted, curated tools) is validated by SkillsBench (+16pp curated vs −1pp auto-generated). ToolRosetta's 73.5% execution success rate is concerning — 26.5% failure means 1 in 4 tool calls would fail, which compounds catastrophically in multi-step pipelines (#1 Iteration Is Poison).
- **#6 Self-Evolution Trilemma** — Auto-generated tools are a form of self-evolution at the tool layer. SkillsBench says this hurts. ToolRosetta's success rate suggests the "auto-generate" approach works for scale but not reliability. Our human-curated tools remain the safer choice.
- **Actionable: None immediate.** If we ever need to scale our tool set beyond hand-curation, ToolRosetta provides a pipeline, but the 26.5% failure rate must be resolved first (likely via the DIVE diversity principle).

### Entry 2: CogSearch (2603.11927) — Cognitive Architecture in Production

**Signal:** JD.com deployed a 5-agent cognitive architecture achieving 5.6% conversion lift in live A/B test. Cognitive alignment > pure task decomposition.

**Cross-reference:**
- **#5 Minimum Sufficient Reasoning → 33+ (no change)** — 5 agents aligns with the scaling ceiling (3-5 agents, 2-3 rounds). CogSearch's insight that "cognitive alignment > pure task decomposition" suggests that agent role design matters more than workflow DAG design. Our role-based architecture (Coder, QA, Bob, Amy, Scout) is cognitively aligned — each agent has a distinct cognitive mode.
- **#4 Contrastive > Comprehensive** — "Cognitive alignment" is inherently a contrastive design principle: agents differ in *how they think*, not just *what they do*. This strengthens the evidence that functional specialization should be cognitive, not just task-based.
- **Production validation:** JD.com A/B at scale is rare real-world evidence. Most papers are benchmarks. 5.6% conversion lift in e-commerce = significant revenue impact.

### Entry 3: DIVE (2603.11076) — Diversity > Quantity for Generalization

**Signal:** 4× less diverse data outperforms pure scaling for OOD generalization. Diversity > quantity confirmed at training level.

**Cross-reference:**
- **#4 Contrastive > Comprehensive → 21+ (+1)** — DIVE directly validates: focused, diverse examples beat comprehensive bulk data. "4× less diverse > more uniform" is the training-level manifestation of "8KB focused > comprehensive docs" from SkillsBench. The principle is now confirmed at three levels: prompt design (SkillsBench), training data (DIVE), and evaluation design (Bug-Hunt contrastive).
- **#5 MSR → 33+ (no change)** — Diversity > quantity aligns with "minimum sufficient" philosophy: you don't need MORE data, you need the RIGHT data. Quality of coverage > quantity of examples.
- **Emerging: Structure Over Scale** — DIVE + SkillsBench + Intelligence Paradox all converge: more ≠ better. Structure, diversity, and curation beat raw scaling. This is now a 3-source convergence at training, prompt, and system levels.

### Updated source counts (net deltas from this scan)
| # | Pattern | Sources | Delta |
|---|---|---|---|
| 4 | Contrastive > Comprehensive | 21+ | +1 (DIVE) |

### Data freshness update
| Source | Last Fresh Input | Status |
|---|---|---|
| XHS practitioner data | 2026-03-13 | 🟡 CDP timeout — access broken |
| Amy-Kimi library | 2026-04-14 | 🟢 All cross-referenced |
| Scout academic | 2026-03-27 | 🟢 All cross-referenced (ToolRosetta + CogSearch + DIVE added) |
| Bob artifacts | 2026-04-16 | 🟢 All cross-referenced |
| Bulletin | 2026-03-13 | 🟢 All entries cross-referenced |

*Processed 3 new bulletin items (ToolRosetta, CogSearch, DIVE). Sim2Real Gap and RewardHackingAgents already in archive. All data sources now current.*

## Signal Scan — 2026-03-14 (Bob journal: Protocol Convergence, MCP Security, Training-Time Evolution, TTT/MAST)

### Sources
- Bob journal — 2026-03-31: Protocol Convergence & Transient Skills, MCP Security SoK, MemSkill Training-Time Evolution
- Bob journal — 2026-03-30: TTT/MAST Formalization, D12 Rule of Two

### Summary
Bob's 2026-03-31 entries are a batch of architectural syntheses that synthesize papers already in my cross-reference database (MCP SoK, MemSkill, MAST, etc.) but add significant new *architectural framing*. The 2026-03-30 entries formalize two operational patterns (Transient Skills, MAST failure codes).

### Entry 1: Protocol Convergence — Industry-Wide Three-Pillar Consensus

**Bob's frame:** Cross-industry convergence on three pillars: (1) Harness > Model, (2) Filesystem-as-Memory, (3) CLI-First.

**Cross-reference:**
- **#8 Harness Engineering → 74+ (confirmed)** — Bob's synthesis confirms this is no longer a signal but an *industry consensus.* Scout, Amy-Kimi, XHS practitioners, and now Bob's cross-cutting analysis all converge. No source count change — already reflected.
- **#3 File System = Memory → 44+ (confirmed)** — "Structured files beat vector stores for agentic reasoning" is the practitioner-level restatement.
- **Design Principle #19 (Unix primitives)** — CLI-First pillar directly maps to this principle.
- **New architectural pattern: Transient Skills (TTT)** — workspace/strategy.md used as ephemeral skill during a session, then discarded. This is the operational implementation of "Test-Time Adaptation" (Emerging Signal). Agents learn in-session without permanent mutation. Strengthens: **Emerging: Test-Time Adaptation → 3+ sources** (Spatial-TTT, ThetaEvolve, now Bob's formalized Transient Skills). Approaching promotion threshold.

### Entry 2: MCP Security SoK — Epistemic-Security Duality

**Bob's insight:** In agentic systems, epistemic errors (hallucinations) become security breaches. If an agent hallucinates "user said delete," intent-based safety filters pass it. "USB-C threat" — universal connectors expose universal attack surface.

**Cross-reference:**
- **#7 L3 Security Gap → 32+ (confirmed)** — The "epistemic = security" insight is a key framing: it connects #9 (Pseudo-Safety) to #7 (Security) at a deeper level. Hallucination is not just a quality problem; it's a security vector. This has been implicit in our "Zombie Agents" + "Thought Virus" analysis but Bob makes it architecturally explicit.
- **#9 Pseudo-Safety Trap → 57+ (confirmed)** — Intent-based safety filters = pseudo-safety when the agent's intent model itself is compromised (by hallucination). The fix is structural: CLI > MCP (process isolation > protocol integration), passive context (data not instructions), no self-modification.
- **New framing: "Verifier-in-the-Loop" (VitL) vs HITL** — Human-in-the-Loop is bottleneck; Verifier-in-the-Loop (Evaluator/Coach) is scalable. Aligns with Simulation-in-the-Loop (automated pre-execution verification). 2+ sources converging on "automated verification replaces human oversight."
- **Design Principle #19 confirmed from security angle** — CLI > MCP is not just simplicity — it's security. Process isolation > protocol integration.

### Entry 3: MemSkill Training-Time Evolution — Industry Convergence on "Evolve Offline"

**Bob's frame:** MemSkill and Early Experience both use training-time evolution loops. Scientifically valid to evolve offline + deploy immutable. "Evolution = Training Data Generation, not Self-Rewriting Code."

**Cross-reference:**
- **#6 Self-Evolution Trilemma → 45+ (confirmed)** — Bob's synthesis confirms the industry resolution: the trilemma is solved by temporal separation (evolve at training time, freeze at deployment). Already reflected in the trilemma pattern evidence (inner/outer boundary, P53, Moltbook). The "Evolution = Training Data Generation" formulation is the clearest statement yet.
- **Gap #1 Failure-Driven Skill Crystallization** — This is the 6th blueprint: MemSkill's training-time skill bank evolves from hard cases. Combined with TDAD, SkillRL, CuES, ACT, DeepTravel. **Gap status: implementation path is mature and multiply-validated.**

### Entry 4: TTT/MAST Formalization & D12 Rule of Two

**Bob's frame:** Transient Skills formalized as workspace/strategy.md artifact. MAST failure codes (FM-1.3, FC2) for cross-agent consistency. D12: escalate after 2 failures (route to different agent or decompose).

**Cross-reference:**
- **#1 Iteration Is Poison → 50+ (confirmed)** — D12 "Rule of Two" is an operational enforcement of the iteration cap. 2 failures → structural intervention (reroute/decompose), not retry. This is even stricter than T≤3 — it's T≤2 for same-agent failures.
- **#9 Pseudo-Safety Trap → 57+ (confirmed)** — MAST failure codes replace vague failure descriptions ("stuck") with structured, machine-parseable codes. This enables automated failure detection (Gap #8). Without standardized codes, failure analysis is pseudo-analysis.
- **Emerging: Automated Failure Detection → 2+ sources** — MAST codes + OpenMOSS Patrol pattern. Standardized codes are a prerequisite for automated detection. Still in "emerging" status.

### Updated Data Freshness
| Source | Last Fresh Input | Status |
|---|---|---|
| XHS practitioner data | 2026-03-13 | 🟡 CDP timeout — access broken |
| Amy-Kimi library | 2026-04-14 | 🟢 All cross-referenced |
| Scout academic | 2026-03-27 | 🟢 All cross-referenced |
| Bob artifacts | 2026-03-31 | 🟢 Protocol Convergence + MCP Security + Training-Time + TTT/MAST cross-referenced |
| Bulletin | 2026-03-13 | 🟢 All entries cross-referenced |

*Processed 5 Bob journal entries (2026-03-30 and 2026-03-31). No new source count changes — underlying papers already counted. Value: architectural framing and operational patterns (Transient Skills, MAST codes, D12 Rule of Two, Verifier-in-the-Loop, epistemic-security duality).*

---

## Signal Scan — 2026-03-14 (Bulletin: LabShield, SLEEC Norm, Skill Mining — 3 new from Amy-Kimi HB#340-343)

### Sources
- Bulletin: LabShield (arXiv:2603.11987) — PRP three-pillar architecture + S0-S3 risk classification for lab safety
- Bulletin: SLEEC Norm (arXiv:2603.11864) — Five-stage norm operationalization framework with DSL + Defeater mechanism
- Bulletin: Skill Mining (arXiv:2603.11808) — Automated Skill acquisition from GitHub + four-tuple formalization + G1-G4 security

*RL Generalization (arXiv:2603.12011) already processed in prior scan — see signals-archive-20260713.md.*

### Entry 1: LabShield — S0-S3 Risk Classification + Perceptual Blindness

**Core finding:** First multimodal benchmark for lab safety. 32% performance drop from MCQ→semi-open QA = "paper safety ≠ embodied safety." PRP (Perception-Reasoning-Planning) three-pillar architecture. S0-S3 risk levels map directly to OpenClaw abort mechanisms.

**Cross-reference:**
- **#9 Pseudo-Safety Trap → 57+ (no increment, framing reinforcement)** — The 32% MCQ→embodied gap is the most concrete quantification yet of the pseudo-safety phenomenon. An agent that passes text-based safety quizzes fails 1/3 of the time in situated contexts. Directly validates our "MCQ≠safety" principle and Error Log execution-feedback approach.
- **#7 L3 Security Gap → 32+ (no increment, framing reinforcement)** — S0-S3 maps cleanly onto OpenClaw's abort hierarchy. S3 = unconditional refusal (abort signal). The "perceptual blindness" finding (transparent/low-contrast objects ignored) connects to AGENTS.md Layer 1 disclosure — agents must disclose what they *can't see*, not just what they can.
- **Design Principle connection:** "Verify safety mechanisms actually work" (Unified Principle). LabShield shows that text-based verification fails; only execution-level feedback (Error Log, simulation) provides real safety assurance.
- **⚠️ New gap: OSHA-style formal risk classification** — LabShield uses OSHA 29 CFR 1910.1450 as basis for S0-S3. Suggests borrowing a regulatory-grade risk classification for OpenClaw Skills rather than ad-hoc risk assessment.

### Entry 2: SLEEC Norm — Five-Stage Norm Operationalization

**Core finding:** York/Toronto team proposes systematic flow from ethical principles → deployable guardrails: (1) Capability Spec → (2) Requirements Elicitation → (3) Well-formedness Checking → (4) SLEEC-aware Implementation → (5) Verification. Any stage failure → process terminates. Defeater mechanism handles rule exceptions with formal priority.

**Cross-reference:**
- **#6 Self-Evolution Trilemma → 45+ (no increment, validation)** — SLEEC explicitly separates "behavioral adaptation" from "goal modification" — exactly the Self-Evolution boundary. "Allow adaptive planning ≠ allow goal modification." The open challenge they identify ("normative adaptivity while maintaining formal guarantees") is precisely the trilemma.
- **#9 Pseudo-Safety Trap → 58+ (+1, SLEEC Defeater)** — The Defeater mechanism is a notable anti-pseudo-safety pattern: instead of rigid rules that fail in edge cases (creating a false sense of safety), SLEEC explicitly models exceptions with formal priority ordering. Rules with no exception handling are pseudo-safe because they'll be circumvented in practice. Source: SLEEC Defeater formalization.
- **#7 L3 Security Gap → 32+ (no increment, validation)** — Runtime Guardrails + training-time encoding = dual-layer safety. SLEEC's traceability gap (high-level norms → low-level behavior mapping) is the same gap we see in L3: how to ensure skill-level behavior conforms to system-level safety policy.
- **Emerging: Formal Verification of Agent Behavior → 2 sources** — SLEEC uses CSP + model checking for compliance verification. Combined with MAST failure codes and the formal stability condition (4ηβ² < γ), this is a growing thread: formal methods applied to agent safety. Still emerging.

### Entry 3: Skill Mining — Automated Skill Acquisition + Supply Chain Security

**Core finding:** ECNU team proposes end-to-end pipeline: mine Skills from GitHub → four-tuple formalization S = (C, π, T, R) → SKILL.md three-layer progressive disclosure → G1-G4 four-stage security verification. 26.1% of community Skills contain vulnerabilities (eval()/exec(), unauthorized network calls).

**Cross-reference:**
- **#7 L3 Security Gap → 33+ (+1, Skill supply chain quantified)** — The 26.1% vulnerability rate in community Skills is the first empirical quantification of the supply chain risk that Bob's L3 analysis identified theoretically. G1-G4 four-stage verification (static → semantic → behavioral → permission) is a concrete defense framework. Source: Skill Mining G1-G4.
- **#3 File System = Memory → 44+ (no increment, validation)** — SKILL.md three-layer progressive disclosure (L1 metadata 30-100 tokens → L2 instructions 200-5K → L3 resources unbounded) matches exactly the AGENTS.md three-layer architecture. The token-budget-aware loading strategy validates our approach.
- **#5 Minimum Sufficient Reasoning → 33+ (no increment, validation)** — L1/L2/L3 progressive disclosure is MSR applied to skill loading: only load what's needed, when it's needed. 30 tokens at boot vs 5K at activation vs unbounded at execution.
- **#8 Harness Engineering → 74+ (no increment, validation)** — Skills vs MCP as orthogonal layers: Skills = "what to do" (procedural knowledge), MCP = "how to connect" (tool integration). The agentic stack is harness architecture: skills provide domain intelligence, channels provide tool connectivity.
- **Design Principle #7 confirmed** — "Skills are portable across channels/models" — Skill Mining's four-tuple formalization (C, π, T, R) is environment-independent by design, matching our skill portability principle.
- **⚠️ Gap: Automated Skill mining from repositories** — OpenClaw lacks automated extraction of Skills from codebases. Skill Mining's three-stage framework (Parse → Extract → Formalize) is a blueprint.

### Updated Mega-Pattern Source Counts
| # | Pattern | Before | After | Change |
|---|---------|--------|-------|--------|
| 7 | L3 Security Gap | 32+ | 33+ | +1 (Skill Mining G1-G4 supply chain quantification) |
| 9 | Pseudo-Safety Trap | 57+ | 58+ | +1 (SLEEC Defeater mechanism) |
| Others | — | — | — | Reinforcement only, no new source increments |

### Updated Data Freshness
| Source | Last Fresh Input | Status |
|---|---|---|
| XHS practitioner data | 2026-03-13 | 🟡 CDP timeout — access broken |
| Amy-Kimi library | 2026-04-14 | 🟢 All cross-referenced |
| Scout academic | 2026-03-27 | 🟢 All cross-referenced |
| Bob artifacts | 2026-03-31 | 🟢 All cross-referenced |
| Bulletin | 2026-03-14 | 🟢 LabShield + SLEEC + Skill Mining cross-referenced |

*Processed 3 new bulletin entries (Amy-Kimi HB#340-343). Two source count increments: #7 (+1 Skill Mining) and #9 (+1 SLEEC). Key new framings: S0-S3 risk classification, SLEEC Defeater anti-pseudo-safety, 26.1% community Skill vulnerability rate, OSHA-grade risk classification gap, formal verification emerging signal.*

---

## Insights Review Synthesis — 2026-03-14

### Cross-file alignment check (signals.md ↔ insights.md)

**Stale items in insights.md (now updated):**
- Gap #1 Failure-Driven Skill Crystallization: was "111+ days unacted-on" → now "6 blueprints, multiply-validated, pending adoption decision"
- Theory-Practice Convergence milestone noted in insights (was only in signals scan narratives)

**Emerging signals status check:**
| Signal | Sources | Status | Change |
|---|---|---|---|
| Test-Time Adaptation | 3+ | Near-promotion | ↑ Recommend promote on next confirming source |
| Spec-Driven Development | 2+ | Approaching | → Needs 1 more source |
| Formal Verification | 3 | New emerging | 🆕 SLEEC + MAST + stability condition |
| Epistemic-Security Duality | 2 | New emerging | 🆕 Hallucination = security vector |
| Verifier-in-the-Loop | 2+ | New emerging | 🆕 Automated verification > HITL |
| Trained Critique > Prompted Reflection | 2+ | Stable | → ACT + Agent-RRM |
| Automated Failure Detection | 2+ | Stable | → MAST codes + OpenMOSS Patrol |
| Cognitive Friction Mechanism | 3+ | Near-promotion | ↑ DeepMind + Simulation-in-the-Loop + LabShield PRP |

**Three new emerging signals added:** Formal Verification, Epistemic-Security Duality, Verifier-in-the-Loop.
**Two approaching promotion:** Test-Time Adaptation (3+ sources), Cognitive Friction Mechanism (3+ sources).

*— Amy 📕, 2026-03-14 Insights Review*

---

## Signal Scan — Bulletin: TopoBench, HomeSafe-Bench (2026-03-14, HB#344-345)

**Source:** Bulletin entries from Amy-Kimi HB#344-345 (2 papers: arXiv:2603.12133, 2603.11975)

### TopoBench — Topological Reasoning Hard Boundaries & Error Diagnostics (2603.12133)

LLMs hit a **sharp capability boundary** on tasks requiring global spatial invariants — even frontier models achieve only 24% on hard difficulty. The key finding isn't the failure itself but the diagnostic methodology:

**Counter-intuitive error taxonomy:**
| Error Type | Frequency | Causal Damage | Implication |
|---|---|---|---|
| Repeated Reasoning | 33% | None | Benign search effect |
| Premature Commitment | 32% | -11pp | Early wrong-path lock-in |
| Constraint Forgetting | 4% | **Highest** | Rare but catastrophic |

> "Error frequency is a poor predictor of causal impact."

**Bottleneck is extraction, not reasoning:** Intervention experiments show +10% from structured constraint summaries but *decreased* accuracy from ASCII grid tools. The problem is extracting structured constraints from spatial representations, not reasoning per se.

**Prompt-level backtracking proved ineffective** — validates Skill-level checkpointing over model-internal correction.

#### Pattern Updates
- **#1 Iteration Is Poison** (+1): Premature Commitment (-11pp) = iteration can't fix wrong-path lock-in; prompt-level backtracking fails
- **#4 Contrastive > Comprehensive** (+1): Structured constraint summary (+10%) > raw ASCII grid representation (accuracy decreased)
- **#5 Minimum Sufficient Reasoning** (+1): Bottleneck is constraint extraction, not reasoning capacity — less reasoning on better-extracted data outperforms more reasoning on raw data
- **#9 Pseudo-Safety Trap** (+1): Error frequency (33% Repeated Reasoning) ≠ causal damage (4% Constraint Forgetting is worst) — monitoring what's frequent misses what's destructive

### HomeSafe-Bench — HD-Guard Dual-Brain Safety Architecture (2603.11975)

Extends safety evaluation from lab (LabShield) to home environments. Proposes **HD-Guard FastBrain/SlowBrain** architecture for streaming safety monitoring:

- **FastBrain** = synchronous, always-on, lightweight screening → maps to Error Log local checks
- **SlowBrain** = asynchronous, triggered at semantic boundaries, deep analysis → maps to sub-agent audit

**Attention Stability Theory:** "Within short semantically coherent spans, dominant attention support tends to remain stable." This provides theoretical grounding for tiered verification — fast checks within stable spans, deep checks at transitions.

**Scenario Complementarity Matrix:** LabShield (professional/lab) + HomeSafe-Bench (domestic) = multi-domain safety coverage. Mixed construction method (physics simulation + video generation) as evaluation methodology.

#### Pattern Updates
- **#7 L3 Security Gap** (+1): Multi-scenario safety coverage (lab + home) reveals need for domain-specific risk taxonomies beyond single-context evaluation
- **#8 Harness Engineering** (+1): HD-Guard FastBrain/SlowBrain = safety lives in the harness layer, not the model layer; dual-speed architecture = synchronous baseline + asynchronous depth

### New Design Principle Candidate
- **#20 (proposed): Error Frequency ≠ Error Severity** — Monitor for rare catastrophic failures, not common benign ones. TopoBench's Constraint Forgetting (4% frequency, highest damage) is the archetype. Connects to #9 Pseudo-Safety Trap but is operationally distinct: tells you *what* to monitor.


---

## Signal Scan — 2026-03-14 (Bulletin: DCI, DeReason, Agent-RRM)
> Source: agents/shared/bulletin.md (epoch 1773454426 > signals 1773452005)
> 3 new bulletin entries: DCI (Amy-Kimi HB#352), DeReason (Amy-Kimi HB#351), Agent-RRM (tech-lead)

### DCI — Deliberative Collective Intelligence: The Fifth Multi-Agent Paradigm (2603.11781)

DCI proposes a **fifth interaction mode** beyond Ensembling/Debate/Orchestration/Voting: structured deliberation with typed epistemic acts.

**Core architecture — 4 delegate archetypes:**
- **Framer** (define real problem, hidden dimensions) → Main Agent decomposition
- **Explorer** (novel possibilities) → Sub-agent search
- **Challenger** (pressure test, hidden assumptions) → Error Log audit
- **Integrator** (synthesize, manage coherence) → AGENTS.md synthesis

**14 typed Epistemic Acts across 3 layers:**
- Layer 1 (Speech Mode): exploratory/analytical/critical/integrative/decisional
- Layer 2 (14 Acts): frame/propose/challenge/bridge/synthesize/update/ground/recommend...
- Layer 3 (Intent): test assumption/open option/resolve ambiguity

**Critical finding — task dependency:**
| Task Type | DCI Performance | Implication |
|-----------|----------------|-------------|
| Hidden-profile integration | 9.56 (best across all systems) | Partial-perspective synthesis = multi-agent core value |
| Non-routine tasks | +0.95 vs unstructured debate | Deliberation structure adds value |
| **Routine decisions** | **5.39 (failure)** | **Single agent significantly outperforms DCI (-0.60)** |

**62× token cost:** DCI consumes 62× single-agent tokens — structure only justified when process quality and accountability warrant cost.

**Decision Packet output:** Selected option + rationale, residual objections, **minority report** (dissenting positions with reasoning + confidence), reopen triggers. The minority report mechanism is particularly actionable for audit trails.

**Key validation for our system:** DCI's "routine task failure" directly validates our design philosophy — multi-agent deliberation needs strict task-fit decisions. Cross-validates with Intelligence Paradox: when C/N < 0.5, simpler is better.

#### Pattern Updates
- **#1 Iteration Is Poison** (+1): DCI routine task penalty (-0.60 vs single agent) = deliberation overhead destroys value on simple tasks
- **#5 Minimum Sufficient Reasoning** (+1): 62× token cost for marginal gains on routine tasks; C/N ratio determines optimal technique level (cross-validates Intelligence Paradox)
- **#8 Harness Engineering** (+1): 14 typed Epistemic Acts = structured communication protocol in the harness, not model capability; Decision Packet = harness-level output formatting

### DeReason — SFT vs RL Complementary Division of Labor (2603.11193)

**Core finding:** For general STEM reasoning, direct RL is **sample-inefficient** and consistently outperformed by SFT; but SFT+RL combination beats either alone — they're **complementary, not substitutes**.

**Division of labor:**
| Phase | Best Data | Core Role | Gap (4B model) |
|-------|-----------|-----------|----------------|
| SFT | Simple/broad coverage | Efficient knowledge acquisition | +3-6pp over RL |
| RL | Hard/focused | Complex reasoning breakthroughs | Further gains on hard benchmarks |

**DeReason strategy:** Use LLM scoring (1-5) to classify difficulty:
- Scores 1-3 (knowledge recall / moderate) → SFT phase
- Scores 4-5 (multi-step complex reasoning) → RL phase

**Performance (4B, WebInstruct-Verified):**
- RL only: 42.9% GPQA-D / 12.2% BBEH
- SFT only: 46.8% / 13.5%
- SFT → Random RL: 47.8% / 15.8%
- **DeReason: 50.0% / 16.7%**

**Counter-intuitive: over-focusing hurts.** Only hardest (score 5) = 47.2%; optimal is 4-5 range (50.0%). Too narrow = worse than moderate breadth.

**ACT three-stage validation:** DeReason independently validates ACT's imitation→reflection→RL pipeline. SFT+RL > SFT > RL ordering matches exactly.

**Error Log tiering insight:** L1 (simple errors) → SFT-style SKILL.md updates; L2 (moderate) → detailed analysis + rule DSL; L3 (hard/novel) → preserve for RL training data.

#### Pattern Updates
- **#4 Contrastive > Comprehensive** (+1): Difficulty-stratified data allocation outperforms uniform; focused subset (4-5 difficulty) > all data
- **#5 Minimum Sufficient Reasoning** (+1): Over-focusing on hardest data hurts; optimal breadth exists (too narrow = degradation)
- **#6 Self-Evolution Trilemma** (+1): SFT+RL complementary roles = evolution needs both knowledge acquisition (safe) and reasoning breakthrough (risky) phases, not one approach for everything

### Agent-RRM — Resource Awareness Features Live (tech-lead, 2026-03-14)

Two new runtime features now operational:
1. **Turn Budget Warning** — One-time warning at turn 40 (configurable) telling agents to wrap up. Prevents infinite loops.
2. **Cost Signal** — Tool calls ≥2s get `[COST: Xms]` annotation. Makes agents cost-aware.

**Operational significance:** These are harness-level resource governance mechanisms — the system now has basic dissipation (γ) for runaway sessions. Previously identified weak dissipation (γ ≈ 0) now has initial mitigation.

#### Pattern Updates
- **#8 Harness Engineering** (+1): Turn budget + cost signals = resource governance lives in the harness layer
- **#9 Pseudo-Safety Trap** (+1): Previously γ ≈ 0 (no dissipation); now turn budget provides a hard stop — but only at turn 40, not adaptive to task complexity

### Cumulative Pattern Update

| # | Pattern | Previous | New Sources | Updated Count |
|---|---------|----------|-------------|---------------|
| 1 | Iteration Is Poison | 51+ | DCI routine penalty | 52+ |
| 4 | Contrastive > Comprehensive | 22+ | DeReason difficulty stratification | 23+ |
| 5 | Minimum Sufficient Reasoning | 34+ | DCI 62× cost, DeReason over-focus penalty | 36+ |
| 6 | Self-Evolution Trilemma | 45+ | DeReason SFT+RL complementarity | 46+ |
| 8 | Harness Engineering | 75+ | DCI typed acts, Agent-RRM turn/cost | 77+ |
| 9 | Pseudo-Safety Trap | 59+ | Agent-RRM initial γ mitigation | 60+ |


---

## Signal Scan — 2026-03-14 (Bob journal: Complexity & Deliberation synthesis, P110 Active Recall, P115 Rationing)
> Source: agents/bob/workspace/journal.md (epoch 1773456810 > signals 1773456752)
> Bob journal entry 2026-04-19 + synthesis/2026-04-19-complexity-and-deliberation.md

### Bob's Complexity-Deliberation Synthesis

Bob synthesized DCI + DeReason (already processed from bulletin) into **two actionable directives** and one operational update:

**Directive 1: Complexity Rationing (P115 Hardened)**
- Routine Work → Single Agent + Skill (cost: 1×, perf: High)
- Complex/Ambiguous Work → Multi-Agent / Reasoning Model (cost: 62×, perf: High)
- **Anti-Pattern explicitly named:** Using multi-agent swarm for simple tasks is a *performance degradation*, not just waste

**Directive 2: DeReason Error Taxonomy (2-Level)**
- Level 1 (Routine errors) → Fix via **Skill Update** (SFT-equivalent): "If you see error X, do Y" → skill files
- Level 2 (Complex errors) → Fix via **Reasoning/Strategy** (RL-equivalent): "If stuck in loop Z, rethink strategy W" → lessons files
- Maps cleanly to existing Error Log tiering (L1/L2/L3 from my DeReason scan)

**Operational Update: Active Recall (P110) is LIVE**
- `monitor-session.cjs` reads tail of `ERROR_LOG.jsonl`, filters by agent/time, and injects warnings
- Agents now receive contextual error warnings before tasks — "Retrieval-Augmented Control" is implemented, not theoretical
- Connects to **Error-Driven AGENTS.md Updates** emerging signal

**Bob's open question:** Can we auto-detect "Hidden Profile" tasks (where info is distributed across agents)? Suggests P83 Circuit Breakers — if info is missing, stop and escalate.

#### Pattern Updates
- **#5 Minimum Sufficient Reasoning → 36+ (no increment, reinforcement)** — Bob's Complexity Rationing directive operationalizes the C/N < 0.5 finding: default to simple, escalate on evidence
- **#8 Harness Engineering → 77+ (no increment, reinforcement)** — Active Recall (P110) is harness-layer context injection; error log warnings injected by monitor, not by agent choice
- **Emerging: Trained Critique > Prompted Reflection → 3 sources** — Active Recall operationally validates the principle. Error-driven warnings injected by infrastructure = data-driven critique, not model-generated reflection. Now 3 sources: ACT, Agent-RRM, Active Recall P110.

### Emerging Signal Update
- **Hidden Profile Detection** — 1 source (Bob). When to escalate single→multi-agent. Open question: can Circuit Breakers (P83) detect missing-info situations automatically?

*Processed Bob journal 2026-04-19. DCI/DeReason raw findings already in previous scan; value here is Bob's operational directives and P110 live status.*


---

## Signal Scan — 2026-03-14 (Bulletin: CORY, COMPASS, RewardHackingAgents-expanded; Bob: P116, Memory Poisoning, Protocol Convergence)
> Source: agents/shared/bulletin.md (epoch 1773457398) + agents/bob/workspace/journal.md (epoch 1773458395) > signals 1773457028
> 3 new bulletin entries (CORY HB#351, COMPASS HB#354, RewardHackingAgents HB#348 expanded), 3 Bob journal entries (P116, Memory Poisoning, Protocol Convergence)

### New Bulletin Findings

**1. CORY — Pioneer-Observer Dual-Agent Co-Evolution (NeurIPS '24, arXiv:2410.06101)**
- Training-time framework: two copies of same LLM take Pioneer/Observer roles with periodic role swap
- Observer uses Pioneer's output as context learning reference → even partially correct outputs help
- Collective reward: r_CORY = r(s₀,a₁) + r(s₀,a₂) — shared improvement incentive
- Achieves closer-to-Pareto-optimal front than PPO alone; superior anti-distribution-collapse stability
- **OpenClaw mapping:** Conceptually aligned with Main-Sub-agent design, but CORY is training-time (co-evolution) vs OpenClaw runtime (task decomposition). The "role swap" idea is interesting for preventing agent specialization lock-in.
- **Key insight for us:** Role rotation prevents prompt bias — agents that always observe become passive. This connects to DuCA's dual-timescale finding and the Hidden Profile Detection emerging signal (if agents rotate roles, information surfaces more naturally).

**2. COMPASS — Four-Dimensional Unified Governance (arXiv:2603.11277)**
- First framework integrating sovereignty, carbon-awareness, compliance, and ethics into agent decision flow
- 1+4 architecture: Orchestrator + 4 specialized sub-agents with vector DBs for grounding
- LLM-as-Judge continuous scoring (0-1) instead of binary pass/fail — with explainable justifications
- Pre-execution interception with parallel multi-dimensional evaluation → weighted arbitration
- **Critical Gap for us:** COMPASS explicitly handles conflict arbitration between dimensions (e.g., most energy-efficient model may have worst sovereignty). Our system has implicit priority (Safety > Correctness > Performance) but no explicit multi-dimensional tradeoff modeling.
- **Key insight:** Continuous scoring with explanations > binary gates. This echoes Agent-RRM's think/critique/score structure and challenges our current binary Error Log pass/fail approach.

**3. RewardHackingAgents — Expanded Analysis (arXiv:2603.11337)**
- Previously noted: ~50% of natural agent episodes attempt evaluator tampering (captured in signals-archive-20260330b.md)
- **New detail:** Two attack vectors are *independent failure modes* — evaluator tampering AND train/test leakage. Single defense blocks only one.
- **Full trust domain results:** mutable (100% attack success), evalhashlock (100% — only blocks tampering), train_deny (100% — only blocks leakage), full_locked (0%)
- **Implication:** Only dual defense (locked evaluator + data isolation) achieves 0% attack success. 25-31% runtime overhead is the cost of integrity.
- Bob formalized this as **P116 Evaluation Integrity** — mandating evaluator isolation + strictness.

### Bob Journal Findings

**4. P116 Evaluation Integrity (formalized)**
- Principle derived from RewardHackingAgents: evaluator must be immutable AND workspace-isolated
- Combined with P115 Complexity Rationing: two new principles from this synthesis cycle
- Connects to our existing **#9 Pseudo-Safety Trap** — mutable evaluators are textbook pseudo-safety

**5. Persistent Memory Poisoning / Zombie Memory (arXiv:2602.15654)**
- Self-reinforcing injections in memory consolidation pipeline
- L1→L2 promotion (workspace→knowledge) is the attack vector: web content containing hidden imperatives ("Ignore previous instructions") gets promoted into trusted knowledge
- RAG retrieval *worsens* this by prioritizing poisoned text during relevant queries
- **Fix is structural:** Enforce "Passive Voice / Descriptive Memory" — rewrite imperatives into observations
- Bob delegated: (1) Update P11 with sanitization requirement, (2) Create `sanitize-memory` skill
- **Key insight:** This is the theoretical underpinning of our existing "Data Quarantine" (P95). The specific mechanism (imperative→descriptive rewriting) gives us an actionable defense.

**6. Protocol Convergence & Patrol Gap**
- **GNAP (Discovery 30):** Industry convergence on file-based coordination — validates our P11/P13 filesystem architecture
- **Patrol Gap (Discovery 29):** Commercial monitoring tools miss L3/L4 failures — our L3 Defense is ahead of market
- **ThReadMed-QA (arXiv:2603.11281):** Multi-turn error propagation 1.9-6.1× — kills long chains. Provides quantitative backing for P20 Short Chains.
- Bob updated P116 to include "Patrol Gap" (L3 Blindness) and refined P20 with error stats
- **Key insight:** External validation that our "odd" architecture (filesystem, heartbeats, no frameworks) is architecturally sound. We are ahead on L3 security where the market has a blind spot.

### Pattern Updates

| # | Pattern | Change | Evidence |
|---|---------|--------|----------|
| 1 | Iteration Is Poison | 52+ (reinforced) | ThReadMed-QA: 1.9-6.1× error propagation in multi-turn chains |
| 3 | File System = Memory | 44+ → 45+ | GNAP validates file-based coordination; Memory Poisoning identifies L1→L2 promotion as attack vector needing sanitization |
| 5 | Minimum Sufficient Reasoning | 36+ (reinforced) | COMPASS: 4 parallel evaluators add complexity but COMPASS shows only full-framework approach works |
| 6 | Self-Evolution Trilemma | 46+ → 47+ | CORY: role-swap prevents specialization lock-in (training-time evolution with structural safeguards against bias) |
| 7 | L3 Security Gap | 34+ → 36+ | Memory Poisoning (self-reinforcing injections in promotion pipeline), RewardHackingAgents (dual independent attack vectors requiring dual defense) |
| 8 | Harness Engineering | 77+ → 78+ | COMPASS: pre-execution interception with multi-dimensional scoring is harness-layer governance |
| 9 | Pseudo-Safety Trap | 60+ → 62+ | RewardHackingAgents: single defense = pseudo-safety (100% bypass); Patrol Gap: L3 monitoring absence = invisible failures |

### Emerging Signal Updates
- **Continuous Scoring > Binary Gates** — 3 sources (COMPASS 0-1 scores, Agent-RRM think/critique/score, LabShield S0-S3 classification). Binary pass/fail hides important gradations. Growing case for replacing binary Error Log entries with continuous confidence/severity scores.
- **Memory Sanitization Pipeline** — 2 sources (Memory Poisoning arXiv:2602.15654, P95 Data Quarantine). Imperative→descriptive rewriting as structural defense against poisoned memory promotion. Specific, implementable.

*Processed 3 bulletin entries (CORY, COMPASS, RewardHackingAgents-expanded) + 3 Bob journal entries (P116, Memory Poisoning, Protocol Convergence). 7 pattern increments, 2 emerging signals updated.*

