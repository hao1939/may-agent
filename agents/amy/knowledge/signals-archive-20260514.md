# Amy Signals — Active Workspace
> Last archive maintenance: 2026-03-12
> **Archived (this cycle):** Insights Review 2026-04-30 + Signal Scans 2026-03-11 (x2) + Signal Scan 2026-03-12 → `knowledge/signals-archive-20260312.md`.
> **Previously archived:** 4 Signal Scans (2026-03-11 x2, 2026-03-29, 2026-04-26) → `knowledge/signals-archive-20260426.md`. Earlier → `knowledge/signals-archive-20260311.md`, `knowledge/signals-archive-20260310b.md`, `knowledge/signals-archive-20260310.md`.

---

## Consolidated Mega-Pattern Status (9 patterns — updated 2026-03-12)

| # | Mega-Pattern | Sources | Confidence | Last Changed |
|---|---|---|---|---|
| 1 | Iteration Is Poison | **22+** (7 domains) | Very High | 2026-03-11 — 8-paper mechanistic synthesis; "code security" as 7th domain |
| 2 | Verification > Generation | 6+ | Very High | 2026-03-11 — Refined: second-order verification only; naive re-checking = martingale |
| 3 | File System = Memory | 8+ | Very High | 2026-03-11 — ContextForge + memory persistence report confirm |
| 4 | Contrastive > Comprehensive | **7 domains** | Very High | 2026-03-11 — ACT adds training domain (7th); CDRRM joint validation with #8 |
| 5 | Minimum Sufficient Reasoning | **5 sources** | **Very High** | 2026-03-11 — OPSDC + CoTJudger structural quantification (33-87% redundancy) |
| 6 | Self-Evolution Trilemma | **9+** | Very High | 2026-03-11 — Coach D5/D6/E4 confirm internal monitoring limitations; May hub-agent amplification = empirical R=βρ(A)/δ |
| 7 | L3 Security Gap | 5+ | **High** | 2026-03-11 — Defense landscape mapped; CaMeL = first provable defense; gap NOT closed |
| 8 | Placement Enforcement Law | **10+ sources, 7 internal** | Very High | **2026-03-12 — Growth cycle dry-run: fork obeys LESSONS.md, production agent doesn't = another placement/context-weight failure** |
| **9** | **Pseudo-Safety Trap** | **6** | **High→Very High** | **2026-03-12 — Growth cycle: verify_agent passes on fork but production behavior diverges = test-in-lab ≠ test-in-production pseudo-safety; 6th independent instance** |

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

## Research Priorities (when XHS access restored)
1. "agent 成长 fork coach" — practitioner experience with agent self-improvement cycles
2. "openclaw 更新 4月" — 51+ days of missed releases
3. "Coze agent 工作流" — fill longest-standing blind spot
4. "agent 退化 循环" — iteration degradation in practice
5. "Pseudo-Safety" patterns — QA/review loops that make things worse
6. "agent 记忆 架构" / "memory consolidation" — episodic→semantic transition gap

## Falsification Targets (intellectual honesty)
1. Iteration >3 rounds consistently improves with proper feedback → challenges #1
2. Comprehensive evaluation outperforms contrastive in safety-critical domains → challenges #4
3. Working self-improving agent without external grounding → challenges #6
4. Implemented L3 defense that works in practice → resolves #7
5. QA gating that demonstrably prevents (not masks) degradation → challenges #9

---

## Data Drought Status (as of 2026-03-12)
| Source | Last Fresh Input | Days Stale | Status |
|---|---|---|---|
| XHS practitioner data | 2026-03-06 | **6** | 🔴 Cookie expired, IP banned |
| Scout academic signals | 2026-03-11 | **1** | 🟡 Most recent: karpathy/autoresearch, agent-native convergence |
| Agent Growth Cycle | 2026-03-12 | 0 | ✅ First dry-run data analyzed |
| Coach regressions | 2026-03-11 | 1 | ✅ 4/9 complete |
| Coze ecosystem | Never | ∞ | 🔴 Permanent blind spot |

**Next productive scan**: when Scout runs a new research cycle, XHS access is restored, or growth cycle generates more data. Monthly cadence during drought.

*— Amy 📕*

---

## Signal Scan — 2026-05-14 (Cross-Reference: Scout Late-Feb + March Reports + System State)

### Scan Context
- **XHS data drought:** ~69 days (last: 2026-03-06). No new practitioner data.
- **Scout data:** Last discoveries batch: 2026-03-17 (AceMAD + paper triage). Two un-cross-referenced deep-dives from 2026-03-12: IH-Challenge (instruction hierarchy), Chaotic Dynamics (multi-LLM deliberation). Plus a large Feb-24/25 batch of ecosystem discoveries (MAST, TabAgent, MCP SEPs, Memory Poisoning, Skill-Inject, etc.) that haven't been mapped against mega-patterns.
- **System state:** All focus tasks DONE. Phase 2 "Hardening" complete. Bulletin + SIGNALS.md both static since mid-March.

### Cross-Reference 1: Chaotic Dynamics (2603.09127) → Strengthens #1, #2, #6, refines #9

**Finding:** Multi-LLM deliberation is chaotic even at T=0 (positive Lyapunov exponents). Two independent instability routes: (A) role differentiation, (B) model heterogeneity. Critically, **combining roles + heterogeneity is LESS unstable than heterogeneity alone** — roles *channel* divergence rather than amplifying it. The Chair/coordinator role is the dominant amplifier. Shorter memory windows attenuate chaos.

**Mega-pattern impact:**
- **#1 Iteration Is Poison** — new mechanistic basis: iterative deliberation is *chaotic*, not just suboptimal. Even T=0 doesn't give reproducibility. Source count: 22+ → **23+** (8th domain: dynamical systems theory).
- **#2 Verification > Generation** — chaotic dynamics explain why self-verification is unreliable: the verifier's state diverges across runs. External/formal verification is the only way to get deterministic outcomes from a chaotic process.
- **#6 Self-Evolution Trilemma** — empirical evidence for a specific degradation mechanism: multi-agent deliberation in self-evolution loops inherits chaotic instability. This strengthens the DPI argument with a concrete dynamical-systems demonstration.
- **#9 Pseudo-Safety Trap** — the finding that roles can EITHER stabilize or destabilize depending on design is a refinement. Our QA role is correctly structured (verification task, bounded scope) → stabilizing. But a poorly designed adversarial role (unbounded doubt, no evidence anchor) → destabilizing. The Chair-as-amplifier finding is directly relevant: **May (our coordinator) is the single highest-leverage stability/instability point**, consistent with Error Cascades hub-agent finding.

**New actionable insight:** Shorter memory windows reduce chaotic amplification. This suggests our agents should NOT accumulate unbounded conversation history within a session. Periodic context summarization mid-session could serve as a "memory window reset."

### Cross-Reference 2: IH-Challenge (2603.10521) → Validates #8, informs system security

**Finding:** OpenAI open-sources an RL training dataset for instruction hierarchy (system > developer > user > tool). Fine-tuning GPT-5-Mini achieves +10% IH robustness (84→94%), reduces unsafe behavior 6.6→0.7%. The key design: tasks are instruction-following-simple but IH-conflict-hard. Programmatic grading eliminates LLM-judge noise. Anti-shortcut task diversity prevents heuristic learning.

**Mega-pattern impact:**
- **#8 Placement Enforcement Law** — IH-Challenge provides the TRAINING-SIDE validation: you can RL-train models to respect the hierarchy we identified empirically (core doc > LESSONS > coaching > in-context). The instruction priority formalization (B_i = B_{i-1} ∩ C_i if non-empty, else B_{i-1}) is a clean mathematical model of what we've been calling "placement enforcement." Source count stays at 10+ but gains formal grounding.
- **#7 L3 Security Gap** — the IH dataset's approach (programmatically graded IH conflicts) is directly applicable to testing whether our agents respect system-level constraints when user-level or tool-level instructions conflict. We could construct IH-style test cases for our own agent pipeline.

**New actionable insight:** Anti-shortcut task diversity is essential. If our verification tests only check one type of IH conflict, agents learn a heuristic rather than genuine priority reasoning.

### Cross-Reference 3: MAST Failure Taxonomy (Feb 2026) → Operationalizes #1, #2, #9

**Finding:** IBM's MAST provides the first rigorous taxonomy of multi-agent failure modes with quantified prevalence. 14 failure modes across 3 categories (System Design, Inter-Agent Misalignment, Task Verification). Most critical: FM-3.3 Incorrect Verification (declaring victory) is the #1 failure in the best-performing model (Gemini). FM-2.6 Reasoning-Action Mismatch hits 92-94% in weaker models.

**Mega-pattern impact:**
- **#1 Iteration Is Poison** — MAST quantifies: weaker models accumulate 4.7-5.3 failure modes per failed trace, meaning each iteration round introduces ~1 new failure mode. This is the micro-mechanism behind iteration degradation.
- **#2 Verification > Generation** — FM-3.3 (Incorrect Verification) is the top failure even in the strongest model. The engineering fix (externalize verification — require hard tool evidence before exit) is exactly what our Hard-Gated Coder implements. **Validation: our Hard-Gated Coder is the correct response to FM-3.3.**
- **#9 Pseudo-Safety Trap** — MAST's fatal vs. non-fatal distinction is crucial: Step Repetition (FM-1.3) and Disobey Task Spec (FM-1.1) appear in SUCCESSFUL traces too. A QA system that flags these as failures would create false rejections. True fatals (Memory Loss, Task Derailment, Premature Termination) are the ones that actually predict failure.

**New actionable insight:** Our QA should focus on MAST's fatal failure modes, not surface-level non-fatal ones. A checklist of {FM-1.4 Memory Loss, FM-1.5 Unaware of Termination, FM-2.3 Task Derailment, FM-3.1 Premature Termination, FM-2.2 Fail to Clarify} would be a targeted, evidence-based QA rubric.

### Cross-Reference 4: MCP Protocol Evolution → New research priority

**Finding:** Three Final MCP SEPs landed: Tasks (call-now-fetch-later), Sampling With Tools (servers running agent loops), MCP Apps (interactive UIs). Plus Persistent Memory Poisoning (2602.15654) and Skill-Inject (80% attack success on frontier models, 2602.20156).

**Impact:** MCP is now a full application runtime (Tools + Resources + Prompts + Tasks + Sampling + Apps). The security surface has expanded dramatically. Skill-Inject's 80% success rate on frontier models means **any MCP tool from a third party is a potential attack vector** — directly strengthens #7 (L3 Security Gap). Persistent Memory Poisoning means our file-based memory (journals, insights) is an attack surface if we ingest untrusted content — **this is already flagged in our insights (XHS Content as Attack Surface) but the severity is higher than previously estimated.**

**Research priority update:** When XHS access is restored, add "MCP 安全 攻击" and "agent 记忆 投毒" as search targets.

### Cross-Reference 5: Scout Feb Ecosystem Batch → Landscape Shift Assessment

**Notable ecosystem signals from Scout's Feb 24-25 batch:**
1. **Framework convergence:** Microsoft Agent Framework (successor to AutoGen + Semantic Kernel), Anthropic Claude Agent SDK, AWS Strands SDK — the "Big Three" cloud providers all now have production agent SDKs. This was predicted by XHS community discussion but is now confirmed.
2. **Filesystem-as-memory is canonical:** LangChain's blog + LangSmith Agent Builder both explicitly use filesystem-as-memory. LangChain's COALA taxonomy (Procedural/Semantic/Episodic → all as files) maps 1:1 to our pattern. **#3 File System = Memory is now industry standard, not just "validated."**
3. **Agent-as-Tool is the composition primitive:** Strands, Microsoft AF, and Anthropic all implement agent-as-tool for multi-agent composition. Our sub-agent pattern is aligned.
4. **Durable execution emerging:** LangGraph's core value prop is crash-resilient agent execution with checkpoint/resume — directly relevant to our Crash Recovery feature (shipped).

### Updated Research Priorities (when XHS access restored)
1. "MCP 安全 攻击 防御" — MCP security attack surface (NEW — based on Skill-Inject + Memory Poisoning)
2. "agent 失败模式 分类" — practitioner experience with MAST-like failure taxonomies (NEW)
3. "openclaw 更新" — 69+ days of missed releases
4. "Coze agent 工作流" — fill longest-standing blind spot
5. "agent 退化 循环" — iteration degradation in practice
6. "agent 记忆 投毒 防御" — memory poisoning defense (NEW)
7. "agent 成长 fork coach" — practitioner self-improvement cycles

### Updated Falsification Targets
(adding one new target)
6. Memory poisoning defense that works for file-based agent memory → could resolve security aspect of #7

### Drought Status Update
| Source | Last Fresh Input | Days Stale | Status |
|---|---|---|---|
| XHS practitioner data | 2026-03-06 | **69** | 🔴 Cookie expired, IP banned |
| Scout academic signals | 2026-03-17 | **58** | 🔴 No new cycles since AceMAD batch |
| Bulletin | 2026-03-24 | **51** | 🔴 Static |
| Agent Growth Cycle | 2026-03-12 | **63** | 🟡 One dry-run analyzed; no new data |
| Coze ecosystem | Never | ∞ | 🔴 Permanent blind spot |
| MCP protocol specs | 2026-02-24 (Scout) | **79** | 🟡 3 Final SEPs landed but not tracked since |

**Assessment:** The intelligence drought is now the longest in Amy's operational history. All 9 mega-patterns are stable but increasingly theoretical — they're grounded in March data in a field that moves weekly. The Feb Scout batch reveals significant ecosystem shifts (Big Three SDKs, MCP as application runtime, MAST failure taxonomy) that practitioners are likely already discussing on XHS. **XHS restoration remains the single highest-value unblock.**

*— Amy 📕*
