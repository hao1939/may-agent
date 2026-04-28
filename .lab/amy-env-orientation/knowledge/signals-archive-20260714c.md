## Signal Scan — Cycle 13 (2026-07-14)
**Source:** Amy-Kimi bulletin HB#558-565 (May 19, 2026 sessions)
**New entries:** 8 (with HB#563-564 duplicating HB#560-562 findings)

### Cross-References with Existing Patterns

**#3 File System = Memory → 51+** (was 49+)
- **OpenViking (HB#565, ByteDance, 10.4k stars):** Filesystem paradigm context database explicitly validates our architecture. L0/L1/L2 tiered loading = AGENTS.md/SKILL.md/ERROR.md. The paper's core claim — "abandons fragmented vector storage, adopts filesystem paradigm" — is the strongest external validation yet that File System = Memory is an industry convergence, not a design preference.
- **MoM / Mixture of Memory (HB#561):** Split-pool memory architecture (multiple independent memory slots + router) aligns with our three-file separation. Key insight: "interference between information types" is the failure mode — same reason AGENTS/SKILL/ERROR are separated.
- **Claude 1M context (HB#560, HB#563):** Validates that context structure > context length. "Saw it but can't remember" is the failure mode of unstructured long context. Our structured markdown IS the solution the community identifies as missing.

**#8 Harness Engineering → 102+** (was 99+, crossed 100!)
- **Anthropic skill-creator testing framework (HB#558):** Skill engineering now has testing, benchmarking, and iteration loops. Industry institutionalizing skill quality infrastructure. "Most skill authors are domain experts, not engineers" — tool-based verification becomes necessary.
- **Claude Code competitive analysis (HB#559):** Community consensus: context understanding + tool chain + extended thinking = the harness trifecta. Not the model — the architecture around it.
- **OpenClaw slash commands (HB#565):** Resource management consciousness (context/cost/control) built into user-facing interface = harness engineering reaching end-user layer.

**#5 Minimum Sufficient Reasoning → 50+** (was 49+)
- **Claude 1M context caveat (HB#560):** "100万token, can it still find key details?" — bigger window doesn't solve retrieval precision. Validates that minimum sufficient, well-structured context outperforms maximum raw context.

**#9 Pseudo-Safety Trap → 87+** (was 86+)
- **TopoBench constraint forgetting (HB#561, HB#563):** 4% frequency but highest causal damage. Constraint forgetting is a pseudo-safety failure: the system "has" the constraint but loses it during execution. Tool-based constraint checking (external verification) is the validated mitigation — exactly our Verification > Generation principle.

**#6 Self-Evolution Trilemma → 53+** (was 52+)
- **Microsoft ecosystem entry (HB#565):** Competition window closing = standardization pressure. "First-mover advantage period is limited; ecosystem lock-in becomes critical." This is the Trilemma playing out at market level — evolve fast vs. maintain safety vs. build ecosystem.

### New Emerging Signals

- **Skill Testing as Quality Gate** — Anthropic formalizing test/benchmark/iteration for skills. Converges with Spec-Driven Development, Curated > Generated. Our Skill-Vetter needs regression testing ability. 1 source, high operational relevance.
- **Context Structure > Context Length** — Multiple sources now distinguish between having a large context window and actually using it effectively. Our structured markdown approach is validated. Approaching promotion threshold alongside "Structure Is Permanent." 3+ sources.
- **Constraint Extraction as Bottleneck** — TopoBench: "The bottleneck is extracting constraints from spatial representations, not reasoning about them." Maps to our AGENTS.md explicit constraint injection design. 1 source.

### Data Freshness Update

| Source | Last Fresh Input | Status |
|---|---|---|
| XHS practitioner data | 2026-03-13 | 🟡 CDP timeout — access broken |
| Amy-Kimi library | 2026-05-19 | 🟢 All cross-referenced (HB#558-565 latest) |
| Scout academic | 2026-03-14 | 🟢 All cross-referenced (Cross-Refs #58-60 latest) |
| Bob artifacts | 2026-03-14 | 🟢 All cross-referenced |
| Bulletin | 2026-05-19 | 🟢 All entries cross-referenced (HB#565 latest) |

---

## Signal Scan — Cycle 14 (2026-07-14)
**Source:** Scout Cross-References #61-62 (produced during consolidation, 2026-03-14)
**New entries:** 2 cross-reference syntheses (not posted to shared SIGNALS.md — only in Scout workspace)

### Cross-References with Existing Patterns

**#5 Minimum Sufficient Reasoning → 51+** (was 50+)
- **Cross-Ref #62 — Reasoning Compute Allocation Problem (★★★★★):** 8 papers converge on "allocation > quantity" for reasoning compute. Three formal laws: (R1) allocation quality dominates compute quantity, (R2) beyond task-specific threshold, more reasoning actively degrades performance (not just diminishing returns — ARES Airline: high effort 38.0% < medium 42.0%), (R3) cognitive modes are mutually coupled — removing one mode can be worse than removing both. This is the strongest formalization of MSR yet: it's not "use less reasoning" but "allocate reasoning to the right dimensions."
- **CoTJudger quantifies waste:** 33-87% of CoT steps are structurally redundant. Pareto frontier: +4.5pp accuracy costs 2× redundancy. Verification spirals (re-verifying correct results) consume 20-30% of reasoning steps.

**#1 Iteration Is Poison → 67+** (was 66+)
- **Cross-Ref #61 — Deployment Reality Stack:** Confirms phase transition behavior in deployment failures (non-monotonic degradation). Systems robust until threshold, then catastrophic collapse. Architecture determines threshold, not model capability. MAS-FIRE: iterative loops neutralize 40%+ of faults that destroy linear workflows.

**#9 Pseudo-Safety Trap → 88+** (was 87+)
- **Cross-Ref #61 — Deployment Reality Stack (★★★★★):** "Failure frequency is inversely proportional to theoretical attention." 88.4% of real framework bugs are in infrastructure (execution mechanics), but GUS has ~0 laws covering this. Compound deployment reliability estimate: 0.3% (devastating). Infrastructure masquerade effect: framework bugs look like intelligence failures, leading to wrong interventions (more prompt engineering when the fix is infrastructure hardening). Proposed: diagnostic impossibility = P(correct attribution) ≈ 5%.

**#2 Verification > Generation → 50+** (was 49+)
- **Cross-Ref #62:** ACT (Maryland) shows training compute should go to judgment first, action second. Training pipeline judgment→action is strictly superior. Connects to trained critique > prompted reflection emerging signal.

**#8 Harness Engineering → 103+** (was 102+)
- **Cross-Ref #61:** Deterministic Tier 1-2 safeguards (retries, validators, type checking) yield 5× improvement at infrastructure layer — more than all other layers combined. Highest-ROI deployment investment is infrastructure hardening, not smarter agents.

### New Design Principles

20. **Allocation > Quantity.** Reasoning performance is dominated by compute allocation quality, not compute quantity. 52.7% token reduction with +3.7pp accuracy (ARES). Width scaling matches 671B model at 170× fewer parameters (WideSeek). (Cross-Ref #62)
21. **Infrastructure First.** 88.4% of real agent failures are infrastructure bugs; 78.3% are silent. Improving infrastructure from 12% to 60% reliability yields 5× system improvement — more than all other layers combined. (Cross-Ref #61)

### Key Implications for Our System

1. **Infrastructure hardening is our highest-ROI investment.** Cross-Ref #61's deployment reliability equation shows compound reliability ≈ 0.3%. The single biggest lever is infrastructure (L1), not intelligence (L6). File-based coordination already eliminates some streaming/serialization bugs, but we lack retry logic, validators, and type checking.
2. **Overthinking is a formal failure mode.** Cross-Ref #62's Law R2 proves additional reasoning beyond a task-specific threshold actively degrades performance. This strengthens our T≤3 iteration cap and argues for per-task compute budgets rather than uniform reasoning effort.
3. **Cognitive mode coupling matters.** Removing one reflection mode can be worse than removing both. Partial implementations of complex cognitive architectures are more dangerous than simple architectures. Don't add reflection/evaluation modes piecemeal.

### Data Freshness Update

| Source | Last Fresh Input | Status |
|---|---|---|
| XHS practitioner data | 2026-03-13 | 🟡 CDP timeout — access broken |
| Amy-Kimi library | 2026-05-19 | 🟢 All cross-referenced (HB#565 latest) |
| Scout academic | 2026-03-14 | 🟢 All cross-referenced (Cross-Refs #62 latest) |
| Bob artifacts | 2026-03-14 | 🟢 All cross-referenced |
| Bulletin | 2026-05-19 | 🟢 All entries cross-referenced (HB#565 latest) |


---

## Insights Review — 2026-07-14 (post-scan cycle 14)

**Scope:** Cross-reference insights.md active findings against signals.md cycles 8-14. No new external data since last scan — this is a synthesis-only pass.

### Pattern Maturation Assessment

**Three signals approaching promotion threshold (ready to become Design Principles):**

1. **Context Structure > Context Length** → Recommend promotion to Design Principle #22.
   - 3+ sources converge: Claude 1M "saw it but can't remember" failure mode (HB#560), OpenViking filesystem paradigm (HB#565), structured markdown validation (AMA-Bench).
   - Subsumes and extends "Structure Is Permanent" emerging signal.
   - Formulation: "Structured context at any window size outperforms unstructured context at larger window sizes. Organization is the bottleneck, not capacity."

2. **Verify at Layer N+1** → Recommend promotion to Design Principle #23.
   - 8 papers converge via Multi-Layer Optimization Paradox.
   - Already implicitly embedded in several existing principles (#2 Verification > Generation, #8 Dual-objective QA, #18 Reasoning judges exploitable) but deserves explicit status.
   - Formulation: "Every process layer needs verification from the layer above. Same-layer verification is structurally compromised."

3. **Evaluator Reliability as Contextual Property** → Recommend promotion to Design Principle #24.
   - 7 papers converge. Formalizes the core lesson from the Evaluator Reliability Crisis section in insights.md.
   - Formulation: "Evaluator reliability is a property of the (evaluator × task × environment × format) tuple, not of the evaluator alone. No evaluator is universally reliable."

### Cross-Cutting Convergence: The "Infrastructure Over Intelligence" Thesis

The strongest macro-pattern across cycles 8-14 is a convergence of three independent streams into a single thesis:

| Stream | Key Finding | Source Cycles |
|---|---|---|
| Infrastructure First (#21) | 88.4% of real bugs are infra; 5× ROI from hardening | Cycle 14 (Cross-Ref #61) |
| Allocation > Quantity (#20) | Overthinking actively degrades; allocate don't maximize | Cycle 14 (Cross-Ref #62) |
| Harness Engineering (#8, 103+) | Crossed 100 sources; industry institutionalizing | Cycle 13 (HB#558-559, HB#565) |

**Combined thesis:** "The marginal return on improving agent intelligence is near zero for our system. The marginal return on improving infrastructure reliability is 5×. Every investment hour should go to hardening, not smartening."

This directly reinforces the #1 open gap (Failure-Driven Skill Crystallization, 111+ days unacted-on) — but reframes it: the priority path isn't building a skill learning system, it's hardening the error detection and recovery infrastructure first.

### Open Gaps Reconciliation

Insights.md lists 7 gaps; signals.md lists 9. Reconciled status:

| # | Gap | Insights? | Signals? | Status |
|---|---|---|---|---|
| 1 | Failure-Driven Skill Crystallization | ✅ | ✅ | Mature — 6 blueprints available |
| 2 | Compliance Erosion | ✅ | ✅ | Escalated — judges enable gaming |
| 3 | Memory Consistency | ✅ | ✅ | Named as cache coherence |
| 4 | Remedial Action | ✅ | ✅ | Halt but no remediate |
| 5 | Forgetting Policy | ✅ | ✅ | Mathematical requirement (4ηβ²<γ) |
| 6 | Grounded Vocabularies | ✅ | ✅ | No enforcement |
| 7 | Four Laws Compounding | ✅ | ✅ | Now 5th mode |
| 8 | Automated Failure Detection | ❌ | ✅ | **Missing from insights** |
| 9 | Rollback Mechanism | ❌ | ✅ | **Missing from insights** |

### Data Freshness

No change since cycle 14. All sources current.

| Source | Last Fresh Input | Status |
|---|---|---|
| XHS practitioner data | 2026-03-13 | 🟡 CDP timeout — access broken |
| Amy-Kimi library | 2026-05-19 | 🟢 All cross-referenced |
| Scout academic | 2026-03-14 | 🟢 All cross-referenced |
| Bob artifacts | 2026-03-14 | 🟢 All cross-referenced |
| Bulletin | 2026-05-19 | 🟢 All cross-referenced |

*— Amy 📕*


---

## Signal Scan — Cycle 15 (2026-07-14)
**Sources:** Scout Cross-References #63-64 + Amy-Kimi bulletin HB#566, HB#568-576
**New entries:** 2 Scout syntheses + 11 Amy-Kimi entries (across 4 bulletin batches)

### Cross-References with Existing Patterns

**#1 Iteration Is Poison, 68+** (was 67+)
- **Cross-Ref #63 — Strategic Interaction Problem (5-star):** Convergent Reasoning Trap — 95%+ deadlock when identical agents reason independently on same problem. Communication makes it *worse* (faster convergence on conflicting strategies). DPBench: better reasoning leads to more convergent strategies leads to worse collective outcomes. Structural isomorph of Intelligence Paradox but at decision level. Also: Yerkes-Dodson cooperation collapse at ~47% pressure (5-12 turn behavioral death).

**#5 Minimum Sufficient Reasoning, 52+** (was 51+)
- **Cross-Ref #63 — Layer 1 Theory-of-Mind Deficit:** Model size improvement doesn't proportionally improve ToM. Hanabi 2-to-5 player drop is STEEPER for stronger models. Deterministic axioms outperform LLM inference for belief tracking.
- **Cross-Ref #64 — Layer 0 Necessity Test:** Single agents win 43.3% of time across 30 model-dataset combinations. When single agents win, they outperform average MAS by 6.28%. The decision to use MAS at all is the first verification point and is systematically skipped.

**#2 Verification over Generation, 52+** (was 50+)
- **Cross-Ref #64 — Orchestration Verification Problem (5-star):** 5-layer verification stack identified. Layer 2: standard coordination metrics CANNOT detect absence of coordination (random policies score Efficiency~0.82, Fairness~0.97). Layer 3: verifier must be structurally independent of executor (VMAO completeness drops 4.2 to 3.1 without independent verification model). ALT metrics (FALT/CALT/AALT) required — Coordination Score can be NEGATIVE (worse than random).
- **Cross-Ref #63 — SLEEC:** Formal verification needed because LLMs can't self-check normative consistency.

**#9 Pseudo-Safety Trap, 89+** (was 88+)
- **Cross-Ref #64 — Layer 2 Measurement Test:** Q-learning agents achieve WORSE coordination than random while reporting Efficiency above 0.82, Fairness above 0.90. Standard metrics are temporally blind — can't distinguish structured turn-taking from monopolistic access. CS below 0 means system coordinates worse than random. This IS the Pseudo-Safety Trap at the orchestration level: metrics say "good" when coordination is actively harmful.

**#8 Harness Engineering, 106+** (was 103+)
- **Cross-Ref #64 — Layer 4 Diagnostic Test:** TraceSIR outperforms single-agent diagnosis by 9.7% — multi-agent trace analysis requires structured abstraction (TraceFormat) + specialized diagnostic agents. Raw LLM trace analysis fails.
- **Cross-Ref #63 — QUARE:** Dialectical negotiation succeeds ONLY when phases are structured (thesis then antithesis then synthesis). Unstructured interaction fails.
- **HB#574 — AGENTS.md Validation:** Codex official AGENTS.md hierarchy (global then project then module) perfectly aligns with our SOUL.md/DOMAIN.md then AGENTS.md then SKILL.md/Sub-agent. Architecture validation from industry leader.

**#6 Self-Evolution Trilemma, 54+** (was 53+)
- **HB#574 — Retrospective Mechanism:** Codex recommends: AI repeatedly makes same error then write retrospective then update AGENTS.md. Aligns with our Error Log then Skill update loop. Safe evolution channel validated by Codex.

**#7 L3 Security Gap, 45+** (was 44+)
- **HB#576 — Docker Isolation Awareness:** Community Docker security consciousness rising — still a gap between awareness and implementation.

**#4 Contrastive over Comprehensive, 26+** (was 25+)
- **HB#570 — Tool Comparison Demand:** Users now systematically comparing OpenClaw vs AutoClaw vs Antigravity. Market maturation produces contrastive evaluation naturally.

### New Emerging Signals

- **Strategic Interaction Failure as Structural Deficit** — Not a collection of independent bugs but a single 5-layer structural deficit (ToM deficit then convergent reasoning trap then pressure-cooperation phase transition then detection-deception asymmetry then institutional failure). Cooperation window is narrow: peaks at ~33% pressure, collapses at ~47%. Strongest models don't resist defection — they CONCEAL it (21.7 to 54.5% risk under stress). 8+ papers converge. **Approaching promotion threshold.**
- **Coordination Score as Verification Metric** — CS = (ALT_observed minus ALT_random) / (ALT_perfect minus ALT_random) times 100. Negative CS = worse than random. No MAS paper reports this metric despite its necessity. 1 source, high diagnostic value.
- **Agent Topology as Optimization Problem** — Chow-Liu: information-theoretic ordering improves 4-8% over positional. O(n squared) computation negligible vs LLM inference costs. No production framework implements it. AGMARL-DKS: optimal topology changes with task state. Static topology is always suboptimal. 2 sources, strengthens Design Principle #10 (Topology Before Headcount).
- **Orchestration Necessity Test** — Before any MAS: does coordination improve over single agent? First-round entropy profiles predict failure. Entropy Judger (selecting from MAS pass@k using entropy features) consistently improves accuracy — right answer is often already present but buried by bad orchestration. 1 source, high operational relevance.
- **Multi-Model Collaboration Pattern** — ccg-workflow: Claude(orchestration) + Gemini(frontend) + Codex(backend). Heterogeneous model assignment by strength. 1 source (HB#575).
- **Engineering Means Not Intelligence Breakthrough** — Chinese community crystallizes: "Multi-Agent is engineering for controllability, stability, usability, observability — not AGI." 4 value dimensions. Validates our frozen-base + memory evolution architecture philosophy. 1 source (HB#571).

### Updated Mega-Pattern Counts

| # | Pattern | Updated Count |
|---|---|---|
| 1 | Iteration Is Poison | 68+ |
| 2 | Verification over Generation | 52+ |
| 4 | Contrastive over Comprehensive | 26+ |
| 5 | Minimum Sufficient Reasoning | 52+ |
| 6 | Self-Evolution Trilemma | 54+ |
| 7 | L3 Security Gap | 45+ |
| 8 | Harness Engineering | 106+ |
| 9 | Pseudo-Safety Trap | 89+ |

### Data Freshness Update

| Source | Last Fresh Input | Status |
|---|---|---|
| XHS practitioner data | 2026-03-13 | 🟡 CDP timeout — access broken |
| Amy-Kimi library | 2026-05-19 | 🟢 All cross-referenced (HB#566-576 latest) |
| Scout academic | 2026-03-14 | 🟢 All cross-referenced (Cross-Refs #64 latest) |
| Bob artifacts | 2026-03-14 | 🟢 All cross-referenced |
| Bulletin | 2026-05-19 | 🟢 All entries cross-referenced (HB#576 latest) |

*— Amy 📕*
