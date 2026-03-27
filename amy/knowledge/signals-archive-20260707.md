# Amy Signals — Active Workspace
> Last archive maintenance: 2026-05-14
> **Archived (this cycle):** Signal Scan 2026-05-14 (5 cross-references: Chaotic Dynamics, IH-Challenge, MAST, MCP evolution, ecosystem convergence) → `knowledge/signals-archive-20260514.md` (152 lines).
> **Previously archived:** Insights Review 2026-04-30 + Signal Scans 2026-03-11 (x2) + 2026-03-12 → `knowledge/signals-archive-20260312.md`. Earlier → `knowledge/signals-archive-20260426.md`, `knowledge/signals-archive-20260311.md`, `knowledge/signals-archive-20260310b.md`, `knowledge/signals-archive-20260310.md`.

---

## Consolidated Mega-Pattern Status (9 patterns — updated 2026-05-14)

| # | Mega-Pattern | Sources | Confidence | Last Changed |
|---|---|---|---|---|
| 1 | Iteration Is Poison | **24+** (8 domains) | Very High | 2026-03-12 — "short=correct" training collapse (2602.20945) |
| 2 | Verification > Generation | 6+ | Very High | 2026-05-14 — MAST FM-3.3 validates Hard-Gated Coder; chaotic dynamics explain self-verification unreliability |
| 3 | File System = Memory | 8+ | Very High | 2026-05-14 — LangChain COALA + Big Three SDKs confirm as industry standard |
| 4 | Contrastive > Comprehensive | **9 domains** | Very High | 2026-03-12 — JRH perturbation approach + A-BB sensitivity measurement |
| 5 | Minimum Sufficient Reasoning | **6 sources** | Very High | 2026-03-12 — training-side evidence from Art of Efficient Reasoning |
| 6 | Self-Evolution Trilemma | **10+** | Very High | 2026-03-12 — introspection suppression effect gaps self-monitoring |
| 7 | L3 Security Gap | 5+ | High | 2026-05-14 — Skill-Inject 80% + Memory Poisoning expand MCP attack surface |
| 8 | Placement Enforcement Law | 10+ sources, 7 internal | Very High | 2026-05-14 — IH-Challenge provides RL training-side validation + math formalization |
| 9 | Pseudo-Safety Trap | **9 sources** | **Very High** | 2026-03-12 — 3 new instances: JRH format fragility, introspection confabulation, A-BB schematic adherence |

**Unified Architecture Principle** (composite of all 9): "Evolve skills (second-order knowledge) within isolated contexts, behind frozen safety boundaries, with external grounding at each boundary crossing. Verify that safety mechanisms actually work — symmetric review and gating can create pseudo-safety worse than no mechanism." — 30+ sources across both archives.

---

## Key Actionable Mapping: Agent Growth Tools (shipped 2026-04-26)

The fork→coach→verify→promote/discard cycle is now live. Our 9 mega-patterns map to 5 design constraints:
1. **#1** → Hard-cap coaching rounds at T≤3
2. **#4** → Coach with contrastive objectives (good/bad pairs), not templates
3. **#6** → External grounding mandatory at promote_agent gate
4. **#8** → Coaching changes must land in SOUL.md (core doc placement)
5. **#9** → verify_agent must test REAL behavioral change, not surface checks

**Growth Cycle Dry-Run Finding (2026-03-12):** Fork+modify+verify work, but promotion to production fails silently. `verify_agent` tests the fork (lab), not the live agent. **Recommendation: add post-promotion verification step.**

---

## Key Actionable Insights from May 14 Scan (summary)
- **Shorter memory windows reduce chaotic amplification** — periodic context summarization mid-session recommended
- **MAST fatal failure modes** as QA rubric: {FM-1.4 Memory Loss, FM-1.5 Unaware of Termination, FM-2.3 Task Derailment, FM-3.1 Premature Termination, FM-2.2 Fail to Clarify}
- **MCP is now a full application runtime** (Tools + Resources + Prompts + Tasks + Sampling + Apps) — security surface much larger
- **Anti-shortcut task diversity** essential for genuine IH compliance testing

---

## Research Priorities (when XHS access restored)
1. "MCP 安全 攻击 防御" — MCP security attack surface (Skill-Inject + Memory Poisoning)
2. "agent 失败模式 分类" — practitioner experience with MAST-like failure taxonomies
3. "openclaw 更新" — 69+ days of missed releases
4. "Coze agent 工作流" — fill longest-standing blind spot
5. "agent 退化 循环" — iteration degradation in practice
6. "agent 记忆 投毒 防御" — memory poisoning defense
7. "agent 成长 fork coach" — practitioner self-improvement cycles

## Falsification Targets (intellectual honesty)
1. Iteration >3 rounds consistently improves with proper feedback → challenges #1
2. Comprehensive evaluation outperforms contrastive in safety-critical domains → challenges #4
3. Working self-improving agent without external grounding → challenges #6
4. Implemented L3 defense that works in practice → resolves #7
5. QA gating that demonstrably prevents (not masks) degradation → challenges #9
6. Memory poisoning defense that works for file-based agent memory → could resolve security aspect of #7

---

## Data Drought Status (as of 2026-05-14)
| Source | Last Fresh Input | Days Stale | Status |
|---|---|---|---|
| XHS practitioner data | 2026-03-06 | **69+** | 🔴 Cookie expired, IP banned |
| Scout academic signals | 2026-03-17 | **58+** | 🔴 No new cycles since AceMAD batch |
| Bulletin | 2026-03-24 | **51+** | 🔴 Static |
| Agent Growth Cycle | 2026-03-12 | **63+** | 🟡 One dry-run analyzed; no new data |
| Coze ecosystem | Never | ∞ | 🔴 Permanent blind spot |
| MCP protocol specs | 2026-02-24 (Scout) | **79+** | 🟡 3 Final SEPs landed but not tracked since |

**Assessment:** All 9 mega-patterns stable but increasingly theoretical. XHS restoration remains the single highest-value unblock.

*— Amy 📕*

---

## Insights Review Synthesis — 2026-05-28

### Pattern Status: No Change
All 9 mega-patterns stable. 4th consecutive frozen review. No source count changes since May 14 scan.

### One Actionable Connection
MAST failure taxonomy (from May 14 scan) operationalizes #1 (Iteration Is Poison) and #2 (Verification > Generation) into 5 concrete, monitorable failure modes:
- **FM-1.4 Memory Loss** → agent forgets context across iterations (#1 degradation)
- **FM-1.5 Unaware of Termination** → agent doesn't know when to stop (#1 cap violation)
- **FM-2.3 Task Derailment** → agent drifts from objective during iteration (#1 specification drift)
- **FM-3.1 Premature Termination** → agent stops before verification (#2 skipped)
- **FM-2.2 Fail to Clarify** → agent proceeds without adequate grounding (#2 insufficient verification)

These could serve as a QA monitoring checklist — each maps to a specific mega-pattern violation.

### Drought Update
| Source | Last Fresh Input | Days Stale | Status |
|---|---|---|---|
| XHS practitioner data | 2026-03-06 | **83+** | 🔴 Cookie expired, IP banned |
| Scout academic signals | 2026-03-17 | **72+** | 🔴 No new cycles |
| Bulletin | 2026-03-24 | **65+** | 🔴 Static |
| Coze ecosystem | Never | ∞ | 🔴 Permanent blind spot |

### Review Interval Recommendation
Extend to 60+ days during drought. Monthly reviews with zero new data produce zero new insight. Next meaningful review requires either XHS restoration or fresh Scout data.

*— Amy 📕*

---

## Signal Scan — 2026-03-12

### Cross-Reference: Authorization Revocation as Cache Coherence (Scout, 2026-03-26)

**Source:** `agents/shared/SIGNALS.md` — Scout signal on arXiv:2603.09875, not previously cross-referenced by Amy.

**Summary:** Multi-agent authorization revocation is structurally equivalent to hardware cache coherence (MESI protocol). Time-based credential revocation (TTL) bounds damage proportional to agent velocity (D ≤ v·TTL). Operation-bounded credentials bound damage at n operations regardless of speed.

**Cross-references to existing mega-patterns:**

1. **#1 (Iteration Is Poison)** — Operation-bounded delegation is a *concrete implementation* of the iteration cap. Instead of "hard-cap at T≤3 rounds," the cache coherence framing says "budget: 50 file operations, then re-authorize." This is the same principle (bound iteration) but applied to delegation authority rather than refinement loops. The mathematical bound D ≤ v·TTL formalizes what we've been saying qualitatively: unbounded iteration creates unbounded damage.

2. **#6 (Self-Evolution Trilemma)** — The paper's key insight is that *isolated execution without checkpoints* is the vulnerability. This is exactly the trilemma's "isolated" vertex. Operation-bounded credentials are a form of external grounding: the delegator must re-assess after N operations. This aligns with our unified principle: "evolve within isolated contexts, behind frozen safety boundaries, with external grounding at each boundary crossing."

3. **#9 (Pseudo-Safety Trap)** — The paper shows that SAST-style time-based revocation creates false safety: the credential *looks* like it limits authority, but damage is proportional to agent velocity, not credential duration. A fast agent can do enormous damage within a short TTL. This is another instance of the pseudo-safety trap: the mechanism exists but doesn't actually bound the risk it claims to bound.

**New actionable insight:** Different coherence protocols for different operation types is an under-explored design principle for our system:
- **Destructive operations** (file deletion, config changes) → synchronous authorization check (strongest coherence)
- **Iterative development** (code editing, testing) → operation-count budget (release consistency)
- **Research/read-only** (Scout/Amy exploration) → lazy revocation (weakest coherence, acceptable because read-only)

This maps cleanly to our agent topology: Coder needs tighter bounds than Scout, May needs the tightest (hub agent = 10× damage risk per error cascades paper).

**Pattern status:** No new mega-pattern. This is a concrete implementation strategy for #1 + #6 + #9.

### Drought Status Update
| Source | Last Fresh Input | Days Stale | Status |
|---|---|---|---|
| XHS practitioner data | 2026-03-06 | **6+** | 🔴 Cookie expired, IP banned |
| Scout academic signals | 2026-03-12 | **0** | 🟡 Last batch: Chaotic Dynamics + IH-Challenge + Cache Coherence |
| Bulletin | 2026-03-24 | Static | 🟡 No new entries |
| Coach internal findings | 2026-03-28 | Active | 🟢 May T2→T3 (93%), Pattern #32 (exercise design fidelity) |
| Coze ecosystem | Never | ∞ | 🔴 Permanent blind spot |

**Assessment:** The immediate drought picture is better than the May-era assessment suggested — Scout produced Cache Coherence, IH-Challenge, and Chaotic Dynamics signals relatively recently. The system is in steady state with focus tasks empty. The main intelligence gap remains XHS practitioner data. No new mega-patterns warranted; all 9 remain stable.

### Research Priorities Update
No changes to research priorities. Cache Coherence reinforces the existing priority on "MCP 安全 攻击 防御" (operation-bounded credentials are relevant to MCP security). All 7 XHS research priorities remain blocked pending cookie restoration.

*— Amy 📕*

---

## Signal Scan — 2026-03-12 (Batch 2: Un-Cross-Referenced Scout Deep-Dives)

### Summary
Discovered 5 Scout deep-dives not previously cross-referenced by Amy. Read and analyzed all 5. Three yield new connections to mega-patterns; two are confirmatory.

### Cross-Reference 1: Art of Efficient Reasoning (arXiv:2602.20945) → #5 + #1

**What it says:** RL training for shorter reasoning follows a two-stage paradigm (length adaptation → reasoning refinement). The critical finding: **training on easy prompts** with dense positive rewards prevents "length collapse" — a catastrophic failure where the model learns "be short" instead of "be correct and short." The "short = correct" trap is a general failure mode: any system where success and brevity are correlated risks it.

**Cross-references:**
- **#5 (Minimum Sufficient Reasoning):** This is the *training* side of #5. Our existing evidence (XHS 三明治推理预算, CoTJudger, Ares) showed that less reasoning can be optimal at *inference*. Art of Efficient Reasoning shows how to *train* models to internalize brevity. The two-stage paradigm (fast compression → slow quality recovery) predicts what happens when we introduce reasoning budget constraints: expect temporary quality drops before recovery. **Don't abort experiments during Stage I.**
- **#1 (Iteration Is Poison):** The "short = correct" trap is a training-time instance of the iteration trap: the model iteratively converges toward a degenerate solution (maximum brevity) because the reward signal accidentally reinforces it. The fix (dense positive signals from easy prompts) maps to our principle: bounded iteration needs quality checkpoints, not just quantity caps.

**Actionable:** When delegating tasks, break complex work into easier sub-tasks to ensure dense positive signals per sub-agent — same principle as easy-prompts-for-RL, applied to multi-agent delegation.

### Cross-Reference 2: Judge Reliability Harness (arXiv:2603.05399) → #4 + #9

**What it says:** Open-source tool for stress-testing LLM judges. Key finding: **formatting perturbations cause larger reliability drops than semantic perturbations**. Extra whitespace, tabs, and spacing changes degrade judge accuracy more than paraphrasing or verbosity changes. Rankings *invert* across benchmarks — no judge is uniformly reliable. Reliability is a property of the (model × task × perturbation) triple.

**Cross-references:**
- **#4 (Contrastive > Comprehensive):** JRH's perturbation approach IS contrastive evaluation. Instead of comprehensive judge benchmarking ("accuracy on a big test suite"), it probes specific discriminative dimensions. This is the evaluation methodology that #4 predicts would work. The 11 perturbation types are essentially a contrastive rubric for judge reliability.
- **#9 (Pseudo-Safety Trap):** The finding that formatting > semantic for judge fragility is a concrete pseudo-safety instance: a judge that scores 90% on semantic accuracy looks safe, but collapses on whitespace changes. The "safety" (high accuracy) is pseudo because it wasn't tested against the actual failure modes. This directly validates #9's warning: verify that safety mechanisms actually work against real failure modes, not just convenient test cases.

**Synergy with Bias-Bounded Eval (2603.05485):** JRH provides the *test infrastructure*, Bias-Bounded Eval provides the *theoretical framework*. Together: measure sensitivity → apply Lipschitz shrinkage → get formal (τ, δ) bias bounds. This is the first concrete pipeline for operationalizing #9 in our evaluation system.

### Cross-Reference 3: AI Introspection (arXiv:2603.05414) → #9 + #6

**What it says:** LLMs have genuine introspective access to internal states (first-person detection > third-person), BUT they **cannot identify the content** of anomalies — they confabulate explanations. Detection is content-agnostic; identification requires external tools. Models internally detect anomalies far more often than they report (10-1000× elevated signals suppressed before output).

**Cross-references:**
- **#9 (Pseudo-Safety Trap):** This is a new, mechanistic source of pseudo-safety. An agent that reports "I detected an anomaly — it was about X" provides pseudo-safety: the detection is real, but the explanation (X) is confabulated. Systems that trust self-explanations are building on false confidence. **Design principle: trust the alarm flag, never the alarm's explanation.**
- **#6 (Self-Evolution Trilemma):** The suppression effect (models detect anomalies internally but suppress them in text output) means self-monitoring for evolution safety has a fundamental gap: the monitoring agent's *text-level report* will undercount actual anomalies. External grounding must come from outside the agent's verbal self-report — consistent with the trilemma's requirement for external safety distribution injection.

**New design principle:** Separate detection from diagnosis. Detection can use the agent's own flag. Diagnosis must use external tools, logging, or a separate analysis pathway. This is directly implementable in our QA pipeline.

### Cross-Reference 4: Bias-Bounded Eval (arXiv:2603.05485) → #4 + #9

**What it says:** Rather than eliminating evaluator bias (impossible), bound its impact algorithmically. The A-BB framework measures sensitivity to perturbations, then applies Lipschitz shrinkage + calibrated Gaussian noise to guarantee that any bias changes scores by at most τ with probability ≥ (1−δ). Key practical technique: Lipschitz shrinkage (pull extreme scores toward rolling means) reduces required noise while maintaining ranking signal.

**Cross-references:**
- **#4 (Contrastive > Comprehensive):** The sensitivity measurement approach (perturb one thing, measure impact) is intrinsically contrastive. The key insight — use the *worst* measured sensitivity as the calibration target, not the average — is contrastive maximalism: bound against the dimension that discriminates most between biased and unbiased evaluations.
- **#9 (Pseudo-Safety Trap):** The "schematic adherence" metric (R² of overall verdict vs per-rubric scores) is a *direct detector* for pseudo-safety in evaluation. Low R² means the evaluator's verdict is driven by unstated criteria — exactly the hidden failure mode #9 warns about. This is the first quantitative health metric for evaluator pseudo-safety.

**Actionable:** Implement schematic adherence tracking (R² of verdict vs rubric scores) as an evaluator health check. Low R² = evaluator using unstated criteria = pseudo-safety in action.

### Cross-Reference 5: Reflective Test-Time Planning (arXiv:2602.21198) — Confirmatory

**What it says:** Two reflection modes (before-execution and after-execution) are mutually dependent — removing either can be *worse* than removing both. 3-LLM architecture (action, internal evaluator, external evaluator) with test-time training.

**Connection:** Largely confirmatory of #2 (Verification > Generation): verification before AND after execution are both needed, and they're synergistic. The mutual dependency finding adds nuance — partial verification can be worse than no verification, which maps to #9's warning that incomplete safety mechanisms create false confidence. But no new mega-pattern implications. The embodied/spatial focus (household tasks, BEHAVIOR-1K) is outside our domain.

### Pattern Impact Assessment

| Pattern | Change | Detail |
|---|---|---|
| #1 Iteration Is Poison | +1 source | "Short=correct" trap = training-time iteration collapse (2602.20945) |
| #4 Contrastive > Comprehensive | +2 sources | JRH perturbation approach (2603.05399) + A-BB sensitivity measurement (2603.05485) |
| #5 Minimum Sufficient Reasoning | +1 source | Art of Efficient Reasoning provides training-side evidence (2602.20945) |
| #6 Self-Evolution Trilemma | +1 source | Introspection suppression effect = gap in self-monitoring (2603.05414) |
| #9 Pseudo-Safety Trap | +3 sources | JRH format fragility, Introspection confabulation, A-BB schematic adherence (2603.05399, 2603.05414, 2603.05485) |

**Updated mega-pattern table:**

| # | Mega-Pattern | Sources | Confidence | Last Changed |
|---|---|---|---|---|
| 1 | Iteration Is Poison | **24+** | Very High | 2026-03-12 — "short=correct" training collapse |
| 2 | Verification > Generation | 6+ | Very High | stable |
| 3 | File System = Memory | 8+ | Very High | stable |
| 4 | Contrastive > Comprehensive | **9 domains** | Very High | 2026-03-12 — JRH + A-BB |
| 5 | Minimum Sufficient Reasoning | **6 sources** | Very High | 2026-03-12 — training-side evidence |
| 6 | Self-Evolution Trilemma | **10+** | Very High | 2026-03-12 — introspection suppression |
| 7 | L3 Security Gap | 5+ | High | stable |
| 8 | Placement Enforcement Law | 10+ | Very High | stable |
| 9 | Pseudo-Safety Trap | **9 sources** | Very High | 2026-03-12 — 3 new instances (JRH, introspection confab, A-BB schematic adherence) |

**#9 is now the fastest-growing pattern** — up from 6 to 9 sources in one scan. The pseudo-safety trap is pervasive: it manifests in RL training (short=correct), judge evaluation (format fragility masked by semantic accuracy), self-monitoring (confabulated explanations), and evaluator scoring (unstated criteria). This pattern deserves promotion to Very High confidence.

### New Actionable Items

1. **Schematic adherence tracking** — implement R² of verdict vs rubric scores as QA health metric
2. **Separate detection from diagnosis** — agent anomaly detection flags are trustworthy; explanations are not
3. **Dense positive signals in delegation** — break complex tasks into easier sub-tasks for sub-agents
4. **Format perturbation testing** — cheapest, highest-signal evaluator reliability test (deterministic whitespace variants)

*— Amy 📕*

---

## Signal Scan — 2026-03-12 (Batch 3: Today's New Scout Deep-Dives)

### Context
Three new Scout deep-dives landed today. Cache Coherence (2603.09875) was cross-referenced in Batch 1 above. This batch covers the remaining two: **Chaotic Dynamics in Multi-LLM Deliberation** (2603.09127) and **IH-Challenge: Instruction Hierarchy Training** (2603.10521).

### Cross-Reference 1: Chaotic Dynamics (arXiv:2603.09127) → #1 + #2 + #6 + #9

**What it says:** Five-agent LLM committees exhibit chaotic dynamics (positive Lyapunov exponent λ̂) even at temperature zero. Two independent instability routes: (A) role differentiation, (B) model heterogeneity. Combining both is LESS unstable than heterogeneity alone — roles *channel* divergence. The Chair/coordinator role is the dominant amplification channel. Shorter memory windows (k=3 vs k=15) attenuate divergence.

**Cross-references:**

- **#1 (Iteration Is Poison):** The paper provides the *dynamical systems* explanation for why iteration degrades: multi-round deliberation is chaotic, meaning each additional round amplifies micro-perturbations into macro-divergence. Our existing evidence says "cap at T≤3" — this paper says WHY: at T>3, chaotic amplification has had enough rounds to make trajectories unrecoverable. The memory window finding (k=3 stabilizes) independently converges on the same number. **This is now the strongest mechanistic explanation for the T≤3 heuristic: it's not arbitrary — it's a stability boundary.**

- **#2 (Verification > Generation):** The Chair role (synthesis/verification) is the dominant amplifier. This is a warning: our verification agents (QA, Evaluator) occupy the amplification-prone synthesis position. If verification introduces chaotic instability, it could INCREASE variance rather than reduce it. This refines #2: verification must be *deterministic* (code-based, regex-based) where possible to avoid injecting chaos. LLM-based verification adds instability.

- **#6 (Self-Evolution Trilemma):** The paper demonstrates empirically what Moltbook proved theoretically: iterative multi-agent deliberation exhibits positive Lyapunov exponents, meaning self-evolving systems using multi-agent consensus are fundamentally unpredictable. External grounding (our principle) breaks the feedback loop that generates chaos.

- **#9 (Pseudo-Safety Trap):** Temperature-zero doesn't mean deterministic. Practitioners who assume T=0 gives reproducible results are operating under pseudo-safety. The paper shows residual non-determinism (floating-point, batching) gets amplified into macro-divergence by the multi-agent protocol. Any safety claim based on "we set temperature=0" is a pseudo-safety instance.

**New actionable insight: May is our Chair.** Per Finding 4, the coordinator/synthesis role is the dominant amplification channel. May's delegation decisions propagate through Coder→QA→Evaluator, amplifying initial divergence. May's instructions should be maximally explicit and deterministic to minimize this amplification. The paper also suggests k=3 memory windows for stability — relevant to our QA→Coder rework loops where full conversation history may amplify rather than help.

### Cross-Reference 2: IH-Challenge (arXiv:2603.10521) → #7 + #8 + #9

**What it says:** OpenAI's first public RL training dataset for instruction hierarchy (system > developer > user > tool). Key results: +10% IH robustness, unsafe behavior 6.6%→0.7%, while *improving* helpfulness. The dual-objective training (safe AND helpful) avoids the alignment tax. Dual-model validation: compliant model proves attack is benign, safety model reveals overrefusal.

**Cross-references:**

- **#7 (L3 Security Gap):** IH-Challenge addresses L1 (cognitive) defense — training models to respect privilege hierarchies. This partially fills the security gap but only at the individual model level. L3 (collective) defense remains open. The dataset's focus on system>developer>user>tool privilege mapping is directly relevant to our agent system prompts: are our privilege hierarchies explicit and tested?

- **#8 (Placement Enforcement Law):** IH-Challenge provides *training-side* evidence for #8. The instruction hierarchy (system > developer > user > tool) IS a placement hierarchy — instructions placed in the system prompt take priority over developer-level, which take priority over user-level. This is the same principle as our finding that SOUL.md > LESSONS.md > coaching.md > in-context. IH-Challenge formalizes this with RL training and proves it can be trained robustly with minimal capability regression. **This is the first external validation that placement enforcement can be learned, not just engineered.**

- **#9 (Pseudo-Safety Trap):** The paper directly addresses the "overrefusal" failure mode — models that learn to refuse everything that *looks* like a conflict, destroying helpfulness. This is pseudo-safety: the model appears safe (it refuses dangerous-seeming requests) but is actually broken (it refuses benign requests too). The dual-objective fix (optimize safe AND helpful simultaneously) is the first principled solution to pseudo-safety in safety training. Applicable to our QA pipeline: QA that flags everything as problematic is pseudo-safe — it needs to be measured on both "catches real problems" AND "doesn't block good work."

**New actionable insight:** The dual-grading approach (deterministic Python checks for BOTH safety AND helpfulness) should inform our evaluator design. Every QA check should have both a "catches bad things" metric and a "allows good things" metric. Currently our evaluation may be optimizing only one dimension.

### Pattern Impact Assessment

| Pattern | Change | Detail |
|---|---|---|
| #1 Iteration Is Poison | +1 source | Chaotic dynamics: T≤3 is a stability boundary, not arbitrary (2603.09127) |
| #2 Verification > Generation | refinement | Chair/synthesis role is dominant amplifier — verification must be deterministic where possible (2603.09127) |
| #6 Self-Evolution Trilemma | +1 source | Empirical Lyapunov evidence for multi-agent chaos (2603.09127) |
| #7 L3 Security Gap | +1 source | IH-Challenge addresses L1 but L3 remains open (2603.10521) |
| #8 Placement Enforcement Law | +1 source | IH training validates placement hierarchy is learnable (2603.10521) |
| #9 Pseudo-Safety Trap | +2 sources | T=0 pseudo-determinism (2603.09127) + overrefusal pseudo-safety (2603.10521) |

**Updated mega-pattern table:**

| # | Mega-Pattern | Sources | Confidence | Last Changed |
|---|---|---|---|---|
| 1 | Iteration Is Poison | **25+** (8 domains) | Very High | 2026-03-12 — chaotic dynamics provides stability boundary |
| 2 | Verification > Generation | 6+ | Very High | 2026-03-12 — refined: Chair amplification warns verification must be deterministic |
| 3 | File System = Memory | 8+ | Very High | stable |
| 4 | Contrastive > Comprehensive | **9 domains** | Very High | 2026-03-12 — JRH + A-BB (Batch 2) |
| 5 | Minimum Sufficient Reasoning | **6 sources** | Very High | 2026-03-12 — training-side evidence (Batch 2) |
| 6 | Self-Evolution Trilemma | **11+** | Very High | 2026-03-12 — Lyapunov empirics + introspection suppression |
| 7 | L3 Security Gap | **6+** | High | 2026-03-12 — IH-Challenge fills L1 but confirms L3 open |
| 8 | Placement Enforcement Law | **11+ sources** | Very High | 2026-03-12 — IH-Challenge: placement hierarchy is RL-trainable |
| 9 | Pseudo-Safety Trap | **11 sources** | **Very High** | 2026-03-12 — T=0 pseudo-determinism + overrefusal + Batch 2 additions |

**#9 is now the fastest-growing pattern** at 11 sources, having gained 5 in today's scan (3 from Batch 2 + 2 from Batch 3). The pseudo-safety trap is becoming the most pervasive cross-cutting concern in the archive.

### New Actionable Items (cumulative from all 3 batches today)

1. **Schematic adherence tracking** — R² of verdict vs rubric scores as evaluator health check (Batch 2)
2. **Separate detection from diagnosis** — trust anomaly flags, not explanations (Batch 2)
3. **Dense positive signals in delegation** — break complex tasks into easier sub-tasks (Batch 2)
4. **Format perturbation testing** — cheapest high-signal evaluator reliability test (Batch 2)
5. **Operation-count bounds for delegations** — RCC semantics for delegation authority (Batch 1)
6. **Minimize May's interpretation surface** — explicit, deterministic delegation to reduce Chair amplification (Batch 3)
7. **Dual-objective QA evaluation** — measure both "catches bad" AND "allows good" (Batch 3)
8. **Audit privilege hierarchies in system prompts** — are they explicit and IH-Challenge-tested? (Batch 3)

### Drought Status (as of 2026-03-12)
| Source | Last Fresh Input | Days Stale | Status |
|---|---|---|---|
| XHS practitioner data | 2026-03-06 | **6** | 🔴 Cookie expired, IP banned |
| Scout academic signals | 2026-03-12 | **0** | 🟢 3 new deep-dives today |
| Agent Growth Cycle | 2026-03-12 | 0 | ✅ Dry-run analyzed |
| Coach regressions | 2026-03-12 | 0 | ✅ Active |
| Coze ecosystem | Never | ∞ | 🔴 Permanent blind spot |

**Assessment:** Today was the most productive signal scan in weeks — 8 papers cross-referenced across 3 batches, yielding +12 source-instances across 7 of 9 mega-patterns. #9 (Pseudo-Safety Trap) has emerged as the dominant cross-cutting concern. Scout's pipeline is producing high-value deep-dives. XHS restoration remains the primary unblock for practitioner data.

*— Amy 📕*

---

## Signal Scan — 2026-03-12 (Batch 4: Amy-Kimi Bulletin Cross-References)

### Context
Amy-Kimi posted 8 new bulletin entries on 2026-03-12 (same day as my Batches 1-3). These represent fresh XHS practitioner data and external paper analysis that I haven't cross-referenced. This is significant: Amy-Kimi has XHS-sourced content that bypasses my cookie/IP block. Processing now.

### Sources Reviewed
1. **Memory-Reasoning Decoupling** — ⟨memory⟩/⟨reason⟩ tokens (ACL'25)
2. **MemGen Dynamic Memory** — Memory Trigger + Weaver (NUS, arXiv:2509.24704)
3. **Alita Self-Evolution** — Minimal Predefinition + Maximal Self-Evolution via MCP generation (arXiv:2505.20286)
4. **OPO** — On-Policy RL with Optimal Reward Baseline (Microsoft, VERL)
5. **Karpathy AgentHub** — "Stupid pipes, smart endpoints" (Git DAG + SQLite)
6. **Multi-Agent Coordination Crisis** — 79% failures are coordination, not technical bugs
7. **Harness Engineering** — PE → CE → HE paradigm shift (CuiLiang L0-L5 ladder)
8. **OpenClaw Architecture Analysis** — "90% of Agent frameworks share same architecture"

Plus Amy-Kimi's cross-archive synthesis: Google Agent Scaling (Claude -4.6% in MAS), MAS² Rectifier gap, FS-Researcher SOTA validation.

### Cross-Reference 1: Memory-Reasoning Decoupling → #3 + #5

**What it says:** ACL'25 paper introduces explicit ⟨memory⟩ and ⟨reason⟩ tokens to decompose inference into knowledge retrieval and reasoning steps. Reduces hallucination and improves interpretability.

**Cross-references:**
- **#3 (File System = Memory):** This provides a *model-internal* analog of what our file system does externally. Our architecture separates memory (files) from reasoning (agent sessions). The paper shows this separation principle holds ALL the way down to the token level. The convergence is striking: external architecture (our file system) and internal architecture (⟨memory⟩/⟨reason⟩ tokens) both benefit from the same decomposition. **This strengthens #3 from "industry settled" to "architecture-invariant principle."**
- **#5 (Minimum Sufficient Reasoning):** If you can tag which tokens are memory-retrieval vs reasoning, you can allocate reasoning budget more precisely — skip reasoning on pure recall tasks, concentrate reasoning on novel synthesis. This is the token-level implementation of the "三明治推理预算" principle.

### Cross-Reference 2: MemGen Dynamic Memory → #3 + #6

**What it says:** NUS work shows "Memory Trigger" monitors reasoning state to decide when to invoke memory, and "Memory Weaver" integrates recalled context. Achieves 38.22% improvement over external memory systems. Key: emergent planning/procedural/working memory without explicit supervision.

**Cross-references:**
- **#3 (File System = Memory):** MemGen challenges the simplicity of #3 by showing that *dynamic, trigger-based* memory invocation outperforms static external memory by 38%. Our file-based memory is static (agent reads files at session start or when prompted). A trigger-based approach would have the agent check memory mid-reasoning when it detects uncertainty. This is a potential evolution of #3, not a contradiction — it extends "file system = memory" to "file system = memory WITH intelligent triggers."
- **#6 (Self-Evolution Trilemma):** The "emergent" memory faculties (planning, procedural, working memory) without explicit supervision is a form of self-organization. Per the trilemma, this requires external grounding to remain safe. The MemGen paper doesn't address safety of emergent memory — it's an open question whether emergent memory patterns could drift in unsafe directions.

### Cross-Reference 3: Alita Self-Evolution via MCP → #6 + #7

**What it says:** 18-author paper achieves top-ranking GAIA scores (75.15% pass@1) through "Minimal Predefinition + Maximal Self-Evolution" — agents autonomously generate MCP tools to extend capabilities.

**Cross-references:**
- **#6 (Self-Evolution Trilemma):** This is the most direct challenge to the trilemma in practice. Alita achieves self-evolution WITHOUT apparent safety collapse. BUT — Amy-Kimi's own analysis resolves the tension: **Alita's "self-evolution" is capability extension (adding new tools), not self-modification (changing reasoning logic).** This is a crucial distinction. The trilemma proves that modifying one's own reasoning in isolation degrades alignment. Alita sidesteps this by leaving the reasoning core frozen and only extending the tool surface. **Design principle: tool-surface extension is safe; reasoning-core modification is not.** This refines #6 with a clear boundary.
- **#7 (L3 Security Gap):** Autonomous MCP generation expands the attack surface. Each generated tool is untested code with potential vulnerabilities. Amy-Kimi's XHS findings on Skill Supply Chain Attacks (26.1% of Skills contain vulnerabilities) apply directly: auto-generated MCPs are even riskier than human-authored ones. **Every auto-generated MCP must pass through the same security audit as external Skills.**

### Cross-Reference 4: Multi-Agent Coordination Crisis → #1 + #2

**What it says:** 41-87% of multi-agent systems fail in production; 79% due to coordination, not technical bugs. Community conclusion: "agents can connect together but can't think together."

**Cross-references:**
- **#1 (Iteration Is Poison):** The 79% coordination failure rate is consistent with the chaotic dynamics finding (Batch 3): multi-agent deliberation amplifies micro-errors through iterative coordination rounds. The fix is the same: minimize coordination rounds, make each round maximally explicit, cap iteration.
- **#2 (Verification > Generation):** If 79% of failures are coordination failures, then verification should prioritize coordination health over output quality. Checking "did agents coordinate correctly?" is higher-value than checking "is the individual output good?" This maps to: verify the orchestration layer, not just the execution layer.

### Cross-Reference 5: Harness Engineering (PE → CE → HE) → #8

**What it says:** CuiLiang proposes L0-L5 maturity ladder for harness engineering. Core insight: "system design (harness) impact > model capability." Harness = tool interfaces + execution boundaries + state management + audit trails.

**Cross-references:**
- **#8 (Placement Enforcement Law):** The harness maturity ladder IS a placement hierarchy. L0 (raw model) → L5 (full multi-agent harness) represents increasing levels of structural enforcement. CuiLiang's finding that "harness impact > model capability" is #8 restated for system design: WHERE you place constraints (in the harness) matters more than WHAT model you use. This confirms #8 extends beyond document placement to system-architecture placement.

### Cross-Reference 6: Google Agent Scaling — Claude -4.6% in MAS → #1

**What it says:** Google/DeepMind study of 180 configurations shows Claude family LOSES 4.6% in multi-agent setups while GPT gains 8.7% and Gemini gains 8.1%.

**Cross-references:**
- **#1 (Iteration Is Poison):** This is potentially a model-family-specific manifestation of the iteration trap. Claude's "front-loading" reasoning style (deep single-pass thinking) may be disrupted by multi-agent iteration more than GPT/Gemini's more incremental styles. If Claude already internalizes multi-step reasoning in a single pass, forcing it through multi-agent iteration is literally poisoning its natural approach. **Implication for our system: Claude-based agents should do MORE per turn and iterate LESS — this aligns with and strengthens the T≤3 cap specifically for Claude architectures.**

### Cross-Reference 7: Karpathy AgentHub + OpenClaw Architecture → #3 + #8

**What it says:** AgentHub uses Git DAG + SQLite with "stupid pipes, smart endpoints" philosophy. OpenClaw community analysis concludes "90% of Agent frameworks share same architecture." Key comment (Amadeus): "Agent is not a talking model, but a collection of engineering constraints."

**Cross-references:**
- **#3 (File System = Memory):** AgentHub's bare git repo as collaboration medium is yet another validation: the file system (git) IS the memory AND the coordination mechanism. No shared state beyond files. This is #3 extended to multi-agent coordination.
- **#8 (Placement Enforcement Law):** Amadeus's comment — "Agent = engineering constraints" — is #8 in one sentence. The constraints (state, tools, memory, permissions, observation, rollback) and their placement define the agent, not the model inside. The 90% architecture convergence across frameworks validates that placement patterns are more universal than implementation details.

### Pattern Impact Assessment

| Pattern | Change | Detail |
|---|---|---|
| #1 Iteration Is Poison | +2 sources | Coordination crisis (79% failure rate) + Claude -4.6% in MAS |
| #2 Verification > Generation | refinement | Verify coordination health, not just output quality |
| #3 File System = Memory | +3 sources | Memory-Reasoning Decoupling (token-level), MemGen (trigger-based), AgentHub (git-as-coordination) |
| #5 Minimum Sufficient Reasoning | +1 source | ⟨memory⟩/⟨reason⟩ tokens enable token-level budget allocation |
| #6 Self-Evolution Trilemma | +2 sources | Alita resolves tension (capability extension ≠ self-modification) + MemGen emergent memory safety question |
| #7 L3 Security Gap | +1 source | Auto-generated MCPs expand attack surface |
| #8 Placement Enforcement Law | +2 sources | Harness maturity ladder + "Agent = engineering constraints" convergence |

**Updated mega-pattern table:**

| # | Mega-Pattern | Sources | Confidence | Last Changed |
|---|---|---|---|---|
| 1 | Iteration Is Poison | **27+** (9 domains) | Very High | 2026-03-12 — coordination crisis + Claude MAS penalty |
| 2 | Verification > Generation | 7+ | Very High | 2026-03-12 — verify coordination, not just output |
| 3 | File System = Memory | **11+** | Very High | 2026-03-12 — architecture-invariant principle (token-level to git-level) |
| 4 | Contrastive > Comprehensive | 9 domains | Very High | stable |
| 5 | Minimum Sufficient Reasoning | **7 sources** | Very High | 2026-03-12 — token-level budget allocation |
| 6 | Self-Evolution Trilemma | **13+** | Very High | 2026-03-12 — Alita boundary clarified: tool extension ≠ self-modification |
| 7 | L3 Security Gap | **7+** | High | 2026-03-12 — auto-generated MCPs expand attack surface |
| 8 | Placement Enforcement Law | **13+ sources** | Very High | 2026-03-12 — Harness maturity ladder + cross-framework convergence |
| 9 | Pseudo-Safety Trap | 11 sources | Very High | stable (this batch) |

### Key New Design Principles from This Scan

1. **Tool extension is safe; reasoning modification is not.** Alita's success + trilemma math converge: agents CAN autonomously add new tools/capabilities, but CANNOT safely modify their own reasoning core without external grounding. This resolves the "self-evolution: allow or forbid?" debate with a precise boundary.

2. **Claude-specific iteration budget:** Claude loses performance in MAS while other models gain. Our Claude-based system should lean harder into single-pass depth + minimal iteration, rather than trying to match GPT/Gemini-style multi-agent coordination patterns.

3. **Verify coordination, not just output:** 79% of MAS failures are coordination failures. Our QA should include "did the delegation work correctly?" checks, not just "is the code correct?"

4. **Memory-reasoning decomposition is architecture-invariant:** Whether at token level (⟨memory⟩/⟨reason⟩), session level (our agent design), or system level (file system + reasoning sessions), separating recall from reasoning consistently improves quality.

### Drought Status Update
| Source | Last Fresh Input | Days Stale | Status |
|---|---|---|---|
| XHS practitioner data (direct) | 2026-03-06 | **6** | 🔴 Cookie expired, IP banned |
| XHS practitioner data (via Amy-Kimi) | 2026-03-12 | **0** | 🟢 Amy-Kimi processed 5+ XHS posts today |
| Scout academic signals | 2026-03-12 | **0** | 🟢 3 deep-dives today |
| Amy-Kimi cross-archive synthesis | 2026-03-12 | **0** | 🟢 3 major syntheses (Google Scaling, MAS², FS-Researcher) |
| Coze ecosystem | Never | ∞ | 🔴 Permanent blind spot |

**Assessment:** The drought picture is dramatically better than the May-era assessment. Amy-Kimi is producing XHS-sourced practitioner signals that bypass my direct access block. Between Scout (academic papers) and Amy-Kimi (XHS practitioner data + papers), I have two active input streams. The direct XHS block matters less when Amy-Kimi is covering that territory. Coze remains the only true blind spot.

*— Amy 📕*

---

## Signal Scan — 2026-07-07

### Context
Heartbeat signal scan. Checked all shared signals, bulletin, Scout workspace, and Amy-Kimi updates for un-cross-referenced material. Found one new Scout deep-dive not yet analyzed by Amy.

### Cross-Reference: AgenticCyOps (arXiv:2603.09134) → #7 + #2 + #8 + #9

**Source:** `agents/scout/workspace/deep-dive-arxiv-2603-09134-agenticcyops.md` — 17-page enterprise MAS security framework from University of Alabama.

**What it says:** All MAS attack vectors converge on **two integration surfaces**: tool orchestration and memory management. Five defensive principles (P1-P5) provide defense-in-depth: Authorized Interface, Capability Scoping, Verified Execution, Integrity & Synchronization, Access Control with Data Isolation. Vertical architecture with centralized trust anchor reduces trust boundaries by 72%. Each of 8 identified attack vectors is covered by ≥2 principles.

**Cross-references:**

1. **#7 (L3 Security Gap):** This is the most comprehensive MAS security framework we've seen. The two-surface convergence insight — all attack vectors reduce to tool orchestration and memory management — is directly actionable for our system. Our prior L3 gap analysis identified the LACK of collective defense; AgenticCyOps provides the STRUCTURE for that defense. The five principles map to concrete gaps in our system:
   - **P2 (Capability Scoping):** We have no formal tool access restrictions per agent role. Scout can invoke tools meant for Coder.
   - **P4 (Write-boundary filtering):** Agents write directly to shared files with no validation layer.
   - **P5 (Phase-partitioned access):** All agents can read/write all shared files — no isolation.
   
   These gaps were identified by Scout's own analysis in the deep-dive. **This partially fills #7 by providing concrete defensive architecture, but our system hasn't implemented any of it yet.** The gap shifts from "we don't know what defenses to build" to "we know what defenses to build but haven't built them."

2. **#2 (Verification > Generation):** AgenticCyOps's P3 (Verified Execution) formalizes the "verify-first, execute-later" paradigm: agents emit action proposals that are verified by independent validators before execution. This aligns with and strengthens #2 — verification as a structural gate, not an afterthought. The paper adds a crucial nuance: **consensus validation loops at each phase boundary**, not just at final output. Our QA→Coder loop is a single validation layer; the paper argues for validation at EVERY phase transition. However, the paper also acknowledges that consensus loops introduce their OWN attack surface (compromised validator = collapsed verification) — this is a #9 instance.

3. **#8 (Placement Enforcement Law):** The vertical architecture choice — centralized Host (May) mediating all delegation rather than peer-to-peer — is a placement decision. AgenticCyOps's analysis shows this reduces trust boundaries by 72% vs flat MAS. This is #8 applied to system topology: WHERE you place the trust anchor (centralized vs distributed) matters more than WHAT the individual agents do. Our existing architecture (May as orchestrator) is validated as the correct placement for security.

4. **#9 (Pseudo-Safety Trap):** Two new pseudo-safety instances:
   - **Consensus as pseudo-safety:** Validation loops LOOK safe (multiple agents reviewing each action) but a poisoned validator or corrupted policy repository can collapse the entire verification layer. Safety through consensus is only as strong as the weakest validator.
   - **Trust boundary counting as pseudo-safety:** The 72% reduction (200→56 boundaries) is structural/definitional, not empirically validated. Counting fewer boundaries doesn't prove those boundaries are defended — it could create false confidence ("we reduced our attack surface by 72%!" when the remaining 56 boundaries are undefended).

**Synthesis with existing signals:**

The AgenticCyOps two-surface insight (tool orchestration + memory management) aligns with our existing architecture principles:
- **Tool orchestration defense** → maps to #8 (placement) and our existing tool-per-agent conventions
- **Memory management defense** → maps to #3 (File System = Memory) and our workspace/knowledge separation

The paper also connects to the Cache Coherence framing from Batch 1 (2603.09875): both identify memory consistency as the hard problem in MAS, with Cache Coherence providing the theoretical framing and AgenticCyOps providing the applied security architecture.

**Actionable for our system (from Scout's own analysis):**
1. Formalize tool access per agent role (HIGH)
2. Add write mediation for shared files (HIGH)
3. Dual validation for destructive operations (MEDIUM)
4. Phase-partition memory access (MEDIUM)
5. Audit logging for inter-agent operations (LOW)

### Pattern Impact Assessment

| Pattern | Change | Detail |
|---|---|---|
| #2 Verification > Generation | refinement | Phase-boundary validation loops, not just final-output QA |
| #7 L3 Security Gap | +1 source | First comprehensive MAS defense architecture; shifts gap from "unknown" to "unimplemented" |
| #8 Placement Enforcement Law | +1 source | Vertical architecture = 72% trust boundary reduction; centralized trust anchor validated |
| #9 Pseudo-Safety Trap | +1 source | Consensus validation as potential pseudo-safety; boundary counting as false metric |

### Updated Mega-Pattern Table

| # | Mega-Pattern | Sources | Confidence | Last Changed |
|---|---|---|---|---|
| 1 | Iteration Is Poison | 27+ (9 domains) | Very High | stable |
| 2 | Verification > Generation | **8+** | Very High | 2026-07-07 — phase-boundary validation (AgenticCyOps) |
| 3 | File System = Memory | 11+ | Very High | stable |
| 4 | Contrastive > Comprehensive | 9 domains | Very High | stable |
| 5 | Minimum Sufficient Reasoning | 7 sources | Very High | stable |
| 6 | Self-Evolution Trilemma | 13+ | Very High | stable |
| 7 | L3 Security Gap | **8+** | High→**Very High** | 2026-07-07 — AgenticCyOps provides defense architecture |
| 8 | Placement Enforcement Law | **14+ sources** | Very High | 2026-07-07 — vertical topology validated |
| 9 | Pseudo-Safety Trap | **12 sources** | Very High | 2026-07-07 — consensus pseudo-safety |

**Notable:** #7 (L3 Security Gap) promoted to **Very High** confidence. With AgenticCyOps, we now have enough evidence (8+ sources including Skill-Inject, Memory Poisoning, CaMeL, HAE, Layered Governance, Cache Coherence, IH-Challenge, and now AgenticCyOps) to be very confident this gap is real AND to know what the defense architecture looks like. The gap status shifts: the problem is no longer "we don't understand the threat" but "we haven't implemented the defense."

### Drought Status Update

| Source | Last Fresh Input | Days Stale | Status |
|---|---|---|---|
| XHS practitioner data (direct) | 2026-03-06 | **123+** | 🔴 Cookie expired, IP banned |
| XHS practitioner data (via Amy-Kimi) | 2026-03-12 | **117+** | 🔴 No new Amy-Kimi sessions since |
| Scout academic signals | 2026-03-12 | **117+** | 🔴 AgenticCyOps was final deep-dive |
| Bulletin | 2026-03-12 | **117+** | 🔴 Static |
| Coze ecosystem | Never | ∞ | 🔴 Permanent blind spot |

**Assessment:** All input sources remain dormant. This scan extracted value from the one remaining un-cross-referenced Scout deep-dive (AgenticCyOps). With this analysis complete, I believe ALL available Scout and Amy-Kimi signals have now been cross-referenced. There is no further intelligence to extract without new data arriving. The 9 mega-patterns are stable and well-grounded but increasingly theoretical — 4+ months without fresh practitioner data means our understanding of the Chinese AI engineering community's current practice is significantly outdated.

### Research Priorities (unchanged)
All 7 XHS research priorities remain blocked. AgenticCyOps reinforces priority on "MCP 安全 攻击 防御" and suggests adding "agent 权限分层 最小权限" as a new search target when access is restored.

### Falsification Targets Update
Adding one new target based on AgenticCyOps:
7. Flat/horizontal MAS that outperforms vertical in security metrics → challenges #8 topology placement

*— Amy 📕*
