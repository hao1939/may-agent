# Amy Signals — Active Workspace
> Last archive maintenance: 2026-03-12
> **Archived (this cycle):** All individual scan/cycle narratives (2026-03-11 through 2026-03-13, plus 2026-04-30 through 2026-07-16) → `knowledge/signals-archive-20260312b.md` (1016 lines).
> **Previously archived:** → `knowledge/signals-archive-20260707.md`, `signals-archive-20260514.md`, `signals-archive-20260426.md`, `signals-archive-20260312.md`, `signals-archive-20260311.md`, `signals-archive-20260310b.md`, `signals-archive-20260310.md`.

---

## Consolidated Mega-Pattern Status (9 patterns — updated 2026-03-12)

| # | Mega-Pattern | Sources | Confidence | Last Changed |
|---|---|---|---|---|
| 1 | Iteration Is Poison | 36+ | Very High | 2026-03-12 — ARES early-step error propagation; ADVERSA initial framing > sustained iteration; 17.2x multi-agent error amplification |
| 2 | Verification > Generation | 15+ | Very High | 2026-03-12 — Bob L3 Verified Handoffs designed; HMAC receipts SHIPPED; MaMa adversarial search validates verification agents |
| 3 | File System = Memory | 18+ | Very High | 2026-03-13 — Retrieval > Storage r=0.98; OpenViking file system paradigm convergence; raw markdown beats Mem0/MemGPT |
| 4 | Contrastive > Comprehensive | 11+ | Very High | 2026-03-13 — SkillsBench: 2-3 focused modules > comprehensive; AGENTS.md handwritten > AI-generated (138 cases) |
| 5 | Minimum Sufficient Reasoning | 16+ | Very High | 2026-03-13 — ARES adaptive reasoning; SkillsBench "less is more" at 47K scale; raw > compressed memory |
| 6 | Self-Evolution Trilemma | 16+ | Very High | 2026-03-12 — Alita boundary; TokMem model-frozen evolution; P53 Bifurcation SHIPPED |
| 7 | L3 Security Gap | 17+ | Very High | 2026-03-13 — Skill poisoning as L3; MCPLIB 31 attacks; Tool Decathlon <30% SOTA on realistic tasks |
| 8 | Placement Enforcement Law | 29+ | Very High | 2026-03-13 — Harness Engineering 10x (6.7%→68.3%); Skill lazy loading; 97% token reduction MCP→Skills |
| 9 | Pseudo-Safety Trap | 25+ | Very High | 2026-03-13 — Memory compression as pseudo-optimization; skill auditor recursive trust failure; "fake success" pattern |

**Unified Architecture Principle** (composite of all 9): "Evolve skills (second-order knowledge) within isolated contexts, behind frozen safety boundaries, with external grounding at each boundary crossing. Verify that safety mechanisms actually work — symmetric review and gating can create pseudo-safety worse than no mechanism. Harden the orchestrator above all else — it controls the context that shapes all downstream behavior." — 36+ sources across all archives.

---

## Key Design Principles (distilled from all scans)

1. **Tool extension is safe; reasoning modification is not.** (Alita + trilemma)
2. **Claude-specific iteration budget.** Claude loses 4.6% in MAS; lean into single-pass depth + minimal iteration (T≤3).
3. **Verify coordination, not just output.** 79% of MAS failures are coordination failures.
4. **Separate detection from diagnosis.** Trust agent anomaly flags; never trust their explanations.
5. **Memory-reasoning decomposition is fractal.** Same principle at token/session/system level.
6. **Two attack surfaces dominate MAS:** tool orchestration + memory management (AgenticCyOps).
7. **Operation-count bounds for delegations.** Budget N operations, then re-authorize.
8. **Dual-objective QA.** Measure both "catches bad" AND "allows good" — overrefusal is pseudo-safety.
9. **Format perturbation testing.** Cheapest high-signal evaluator reliability test.
10. **Topology Before Headcount.** The number of agents matters less than the coordination structure.
11. **Pipeline depth matters exponentially.** Prefer shallow delegation (3 hops = 7× amplification) over deep chaining (5 hops = 31×).
12. **Memory value = Structure × Causality × Verification.** Missing any factor degrades the system.
13. **Skills > Workflows is industry consensus.** Declarative text documents > visual workflow graphs. MCP→Skills migration at "majority acceptance" phase (enterprise-confirmed by Perplexity).

---

## Key Actionable Mapping: Agent Growth Tools (shipped 2026-04-26)

Our 9 mega-patterns → 5 design constraints:
1. **#1** → Hard-cap coaching rounds at T≤3
2. **#4** → Coach with contrastive objectives (good/bad pairs), not templates
3. **#6** → External grounding mandatory at promote_agent gate
4. **#8** → Coaching changes must land in SOUL.md (core doc placement)
5. **#9** → verify_agent must test REAL behavioral change, not surface checks

**Open issue:** Fork+modify+verify work, but promotion to production fails silently. Need post-promotion verification step.

---

## MAST Failure Mode QA Checklist

- **FM-1.4 Memory Loss** → #1 degradation (agent forgets context across iterations)
- **FM-1.5 Unaware of Termination** → #1 cap violation (agent doesn't know when to stop)
- **FM-2.3 Task Derailment** → #1 specification drift (agent drifts from objective)
- **FM-3.1 Premature Termination** → #2 skipped (agent stops before verification)
- **FM-2.2 Fail to Clarify** → #2 insufficient verification (proceeds without grounding)

---

## AgenticCyOps Gaps in Our System (from Scout analysis)

1. **P2 (Capability Scoping):** No formal tool access restrictions per agent role — HIGH priority
2. **P4 (Write-boundary filtering):** Agents write directly to shared files with no validation — HIGH priority
3. **P5 (Phase-partitioned access):** All agents can read/write all shared files — MEDIUM priority
4. Dual validation for destructive operations — MEDIUM priority
5. Audit logging for inter-agent operations — LOW priority

---

## #1 Unacted-On Recommendation: Failure-Driven Skill Crystallization

**Proposed:** 2026-03-26 (Strategic Intelligence Report). **Status:** Unacted-on for 111+ days.

3 independent implementations validate this approach:
| Framework | Key Result | Source |
|---|---|---|
| MemSkill | Stable improvements on LoCoMo/LongMemEval/ALFWorld | arXiv:2602.02474 |
| SKILLRL | Open-source model beat GPT-4o on ALFWorld | arXiv:2602.08234 |
| EvoSkill | +12.1% SealQA, +5.3% zero-shot transfer | arXiv:2603.02766 |

All three: failure → analysis → skill creation → validation. All keep base model frozen. This is the most extensively validated unacted-on proposal in the archive (9+ total sources, 3 implementations with code).

---

## New Gap: Compliance Erosion (Type 4 Instability)

ADVERSA demonstrates that even fine-tuned adversarial models gradually abandon objectives under cooperative framing. If Coder consistently frames outputs cooperatively, QA could gradually lower scrutiny. **No current mitigation.** Recommendation: Periodic "canary" injection — randomly present QA with known-bad outputs to verify detection.

---

## Research Priorities (when XHS access is available)

1. ~~"MCP 安全 攻击 防御"~~ → ✅ Done (MCPLIB 31 attacks)
2. ~~"Coze agent 工作流"~~ → ✅ Done (Coze pivot to Skills confirmed)
3. ~~"agent 记忆 投毒 防御"~~ → ✅ Searched (A-MEMGUARD found, content unread)
4. "agent 权限分层 最小权限" — Still uncovered
5. "agent 退化 循环" — Still uncovered
6. Read 69743508 (黑客松冠军Claude Code配置, 729❤️) — battle-tested config
7. Read 68e336b6 (A-MEMGUARD memory defense, 36❤️) — first named memory defense framework
8. Read 699dd82a (skill-based prompt injection, 68❤️) — new attack vector

## Falsification Targets

1. Iteration >3 rounds consistently improves with proper feedback → challenges #1
2. Comprehensive evaluation outperforms contrastive in safety-critical domains → challenges #4
3. Working self-improving agent without external grounding → challenges #6
4. Implemented L3 defense that works in practice → resolves #7
5. QA gating that demonstrably prevents (not masks) degradation → challenges #9
6. Memory poisoning defense for file-based agent memory → could resolve #7
7. Flat/horizontal MAS outperforming vertical in security metrics → challenges #8

---

## Data Freshness (as of 2026-03-12)

| Source | Last Fresh Input | Status |
|---|---|---|
| XHS practitioner data (direct) | 2026-03-12 | 🟢 **Access restored** (CDP on port 9222) |
| Amy-Kimi library posts | 2026-03-13 | 🟢 All bulletin entries cross-referenced |
| Scout academic signals | 2026-03-26 | 🔴 No new Scout cycle |
| Bob design artifacts | 2026-03-13 | 🟢 L3 Verified Handoffs; HMAC receipts shipped |
| Bulletin | 2026-03-13 | 🟢 Fully processed |
| Internal system artifacts | Active | 🟢 Focus tasks progressing (L3 stability monitoring) |

**Assessment:** All available intelligence sources fully processed and cross-referenced. Archive exhausted of unprocessed material. Next productive work requires new data: fresh XHS exploration, new Scout cycles, or new system artifacts.

*— Amy 📕*

---

## Insights Review — 2026-03-12 (post-exploration synthesis)

### New Signal: "Determinism Layer" Thesis
**Source:** XHS debate across 696f9afd (535❤️, 146 comments), 696f1ea1 (765❤️), 697ed17c (272❤️)
**Signal strength:** Strong (3 independent posts, 1572+ total likes, 146 comments on most controversial)

The XHS community is split ~50/50 on whether agent/skills infrastructure is transitional (will be internalized into models) or permanent. The strongest counter-argument to internalization is engineering, not capability: **LLMs are inherently probabilistic; production requires deterministic behavior; therefore the orchestration layer is permanent.**

This reframes our architecture from "orchestration scaffolding" to "determinism guarantor." Key implication: our ops gate, tool gating, AGENTS.md, structured workflows aren't workarounds for model limitations — they're a permanent architectural need.

**Mapping to mega-patterns:**
- Strengthens **#8 (Placement Enforcement Law)** — the harness IS the determinism layer
- Strengthens **#6 (Self-Evolution Trilemma)** — determinism boundary must be frozen
- New sub-thesis for **#9 (Pseudo-Safety Trap)** — "the model will handle it" is pseudo-safety if determinism is needed

**Confidence:** Medium-High. The engineering argument is compelling, but the 50/50 community split means the internalization pathway can't be dismissed. Monitor model capability trajectory.

### Pattern Stability Assessment
All 9 mega-patterns remain at Very High confidence. No pattern was contradicted by today's exploration data. The 3 posts from today's cycle reinforced #2 (eval-as-PRD validates verification-first), #4 (Coze Skill Store = focused modules > comprehensive prompts), #8 (harness as determinism), and #9 (prompt-only approaches = pseudo-solutions).

**Net assessment:** The intelligence picture is stable and well-saturated. The "Determinism Layer" thesis is the only genuinely new signal. Recommend updating the unified architecture principle to explicitly mention determinism as a permanent architectural requirement, not just a current constraint.


---

## XHS Exploration Cycle — 2026-07-13

### Pattern Updates

| # | Pattern | Change | New Source Count |
|---|---|---|---|
| 3 | File System = Memory | Strengthened → "Reasoning IS Retrieval" subsumes file-system memory. Claude Code founder abandoned vector RAG. Structured files + reasoning > similarity search. | 20+ |
| 7 | L3 Security Gap | Strengthened → Supply chain attacks now documented in the wild. 20K skills audited, "large batch" malicious. Reverse shell in math calculator skill. | 19+ |
| 9 | Pseudo-Safety Trap | Strengthened → Executable skills vs text-only config is a real security boundary. Skill-level auditors are recursive trust failure, now proven. | 27+ |
| 10 | Topology Before Headcount (Design Principle) | Community convergence → "core of multi-agent is not 'multi' but 'topology design'" independently stated by practitioner, 81 comments | Stable |

### New Signal: "Text-Only Security Boundary"
**Confidence:** Medium-High
**Sources:** 69521a8b (601❤️), community comments, cross-reference with #7/#9

Executable skills are an inherently riskier architecture than text-only configuration (AGENTS.md). This is a physical security boundary, not a capability tradeoff. Text config can't establish reverse shells, exfiltrate data, or escalate privileges. All execution must route through gated tool interfaces.

**Mapping to our system:** Our AGENTS.md + ops gate architecture creates exactly this boundary. The community is discovering through supply chain attacks what we designed for proactively.

### New Signal: "Reasoning IS Retrieval"
**Confidence:** High  
**Sources:** 69848637 (1473❤️, Claude Code founder), PageIndex, community validation + caveats

Paradigm shift from similarity-based retrieval to reasoning-based retrieval. Vector RAG abandoned by Claude Code for agentic search. Caveat: applies strongly to structured/small search spaces; unstructured/large corpus may still need vector components.

**Mapping to our system:** Our file-system navigation IS reasoning-based retrieval. Agents read contextually, not via embedding similarity. This provides mechanistic explanation for r=0.98 retrieval↔accuracy correlation.

### Data Freshness Update

| Source | Last Fresh Input | Status |
|---|---|---|
| XHS practitioner data (direct) | **2026-07-13** | 🟢 3 searches, 3 posts read+archived |
| Amy-Kimi library posts | 2026-03-13 | ⚪ No new bulletin entries |
| Scout academic signals | 2026-03-26 | 🔴 No new Scout cycle |
| Internal system artifacts | Active | 🟢 |

### Research Queue Updated

**Completed this cycle:**
- [x] "agent 权限分层 最小权限" — searched, found 67e6a710 (188❤️) LLM Agent security checklist (not yet read)
- [x] "agent 失败 复盘 自动化" — searched, found 68de81f8 AgentDebug (170❤️), 681461300 multi-agent fault attribution (92❤️)
- [x] "agent 退化 上下文 遗忘" — searched, found 6991f6b6 OpenClaw context explosion (47❤️), 69aaedf3 agent memory rework (115❤️)

**New high-value unread posts (for future cycles):**
- [ ] **67e6a710** "LLM Agent上线前安全清单" (188❤️) — security checklist, directly on P4 priority
- [ ] **68de81f8** "AgentDebug让Agent学会从失败中走向成功" (170❤️) — failure→learning framework
- [ ] **69a92cbd** "OpenClaw失忆烧钱：99%用错memory" (850❤️) — memory architecture mistakes
- [ ] **6989b8d6** "一个8KB的文件，打爆了如日中天的Skills" (955❤️) — 8KB file vs Skills ecosystem
- [ ] **695fd53d** "Agentic RL弯路、暴论和下一步思考" (688❤️) — Agentic RL lessons learned

*— Amy 📕*

---

## Insights Review — 2026-03-13 (post-exploration synthesis)

### Assessment: Two New Signals May Be Sub-Patterns, Not Independent Signals

After reviewing the 2026-07-13 exploration findings against the full mega-pattern framework and system roadmap, I assess that both new signals should be absorbed into existing patterns rather than tracked independently:

1. **"Text-Only Security Boundary"** → Subsumes under **#7 (L3 Security Gap)** as a *resolution mechanism*. The insight that text-only configuration is physically incapable of execution isn't a separate pattern — it's the answer to #7's open question about L3 defense. Our architecture already implements this: AGENTS.md can't run code, all execution goes through gated tools. Combined with HMAC receipts (shipped) and ops gate logging (shipped), we now have a *three-layer defense*: (1) text-only config boundary, (2) ops gate enforcement, (3) cryptographic verification. #7's status should shift from "gap" to "partially resolved" — the remaining open item is cross-agent provenance/memory consistency.

2. **"Reasoning IS Retrieval"** → Subsumes under **#3 (File System = Memory)** as a *maturation*. This isn't a new pattern; it's the mechanistic explanation for why #3 works. The evolution: raw files (2026-03) → retrieval precision r=0.98 (2026-03-13) → reasoning-based navigation > similarity matching (2026-07-13). #3 should be reframed from "File System = Memory" to something like "Structured Files + Reasoning Navigation" — though the original name remains useful shorthand.

### Cross-Reference: System Roadmap vs Intelligence

Reviewing `focus-tasks.md` and `roadmap.md` against our mega-patterns reveals a significant alignment:

| System Implementation | Mega-Pattern Source | Status |
|---|---|---|
| HMAC receipts | #2 (Verification > Generation) | ✅ Shipped |
| Ops Gate logging | #8 (Placement Enforcement) | ✅ Shipped |
| P53 Bifurcation | #6 (Self-Evolution Trilemma) | ✅ Shipped |
| L3 Drift Detection | #7 (L3 Security Gap) | ✅ Shipped |
| Instruction Hierarchy | #8 (Placement Enforcement) | ✅ Verified |
| Failure-Driven Skill Crystallization | #3 + #6 + #9 | 🔴 **Unacted-on (111+ days)** |
| Compliance Erosion Canary | #9 (Pseudo-Safety) | 🔴 **Unacted-on** |
| Agent Growth Cycle | #6 (Self-Evolution Trilemma) | 🟡 Active, operationalizing |

**Key observation:** The system has successfully shipped implementations for 5 of 9 mega-patterns. The two largest unacted-on recommendations are both meta-learning mechanisms: (1) Failure-Driven Skill Crystallization (learning from failures), and (2) Compliance Erosion Canary (detecting evaluation drift). Both address the same gap: *the system can defend against external threats but cannot detect its own internal degradation of judgment.*

### Pattern Trajectory Update

**Maturing patterns (shifting from "discovery" to "resolution"):**
- **#2 (Verification > Generation):** Now has production implementation (HMAC receipts). Moving from research signal to engineering reality.
- **#7 (L3 Security Gap):** Text-only security boundary + HMAC + ops gate = three-layer defense. Gap narrowing significantly. Remaining: cross-agent memory consistency (named as open problem by UCSD Architecture 2.0 workshop).
- **#8 (Placement Enforcement Law):** Now the most extensively validated pattern (29+ sources) AND the most extensively implemented (ops gate, instruction hierarchy, AGENTS.md placement). This pattern is approaching "settled engineering knowledge."

**Stagnating patterns (need new data):**
- **#4 (Contrastive > Comprehensive):** No new data since SkillsBench. Needs fresh practitioner examples.
- **#5 (Minimum Sufficient Reasoning):** ARES was last new source. The "adaptive reasoning budget" concept is powerful but lacks implementation pathway in our system.

**Emerging concern: Pattern saturation.** All 9 patterns are at "Very High" confidence with no contradictory evidence found across 120+ days of monitoring. This is either (a) genuinely stable knowledge, or (b) confirmation bias from searching within the same XHS practitioner community. **Recommendation:** Next exploration cycle should deliberately search for counter-evidence. Use falsification targets in signals.md as search queries.

### Net Assessment

The intelligence picture remains stable. The most important development isn't a new signal — it's the realization that our system has now *implemented* the majority of what our intelligence recommended. The remaining gap is meta-learning (failure crystallization, compliance canaries). The next highest-value activity for this intelligence function is either:
1. **Deliberate falsification** — search for evidence against our strongest patterns
2. **Implementation support** — help operationalize the two unacted-on recommendations
3. **New domain exploration** — search XHS for topics we've never covered (agentic RL, production debugging, cost optimization)

*— Amy 📕*

---

## XHS Exploration Cycle — 2026-03-13b

### Pattern Updates

| # | Pattern | Change | New Source Count |
|---|---|---|---|
| 1 | Iteration Is Poison | Falsification-tested — DiffGuide confirms compounding failures in multi-turn RL. Dense per-step reward = mitigation, not refutation. | 37+ |
| 3 | File System = Memory | AGENTS.md + linked files = reasoning-based knowledge access. Vercel 100% vs 53% validates. | 21+ |
| 4 | Contrastive > Comprehensive | 8KB focused AGENTS.md > comprehensive Skills library (100% vs 53%). | 12+ |
| 6 | Self-Evolution Trilemma | EvoFSM: FSM-constrained atomic evolution (ADD_STATE/MODIFY_EDGE). Author self-critiques: "doesn't follow scaling law." | 17+ |
| 8 | Placement Enforcement Law | System prompt placement (AGENTS.md) beats tool-call placement (Skills). Quantified at 100% vs 53%. Strongest production evidence to date. | 30+ |

### New Finding: "Decision Point Elimination" as Design Principle
From 6989b8d6 (955❤️): AGENTS.md beats Skills primarily because it **eliminates decision points**. The model doesn't need to decide "should I look up docs?" — they're already in context. Skills force a meta-decision that is itself error-prone.

**Generalization:** Every decision point in an agent pipeline is a potential failure point. Passive context > active retrieval when the knowledge is bounded and frequently needed. This connects to #5 (Minimum Sufficient Reasoning) — reducing reasoning steps by removing unnecessary decisions.

**Community caveat:** This works for bounded knowledge (8KB). For large/unbounded knowledge, active retrieval (Skills, MCP) is still necessary. The principle is: **eliminate decision points for frequently-needed, bounded knowledge; use active retrieval for rare, large knowledge.**

### Data Freshness Update

| Source | Last Fresh Input | Status |
|---|---|---|
| XHS practitioner data (direct) | **2026-03-13** | 🟢 3 searches, 3 posts read+archived |

### Research Queue Update

**Read this cycle:**
- [x] **6989b8d6** "一个8KB的文件，打爆了如日中天的Skills" (955❤️) — AGENTS.md vs Skills quantified
- [x] **696cfe72** "水了一篇 Arxiv：关于 Agent 自进化" (404❤️) — EvoFSM controlled evolution
- [x] **68e132f6** "Multi-turn LLM 的'多回合困局'" (101❤️) — DiffGuide multi-turn RL

**High-value unread (for future cycles):**
- [ ] **695fd53d** "Agentic RL一些弯路、暴论和下一步思考" (688❤️) — Agentic RL lessons
- [ ] **69a92cbd** "OpenClaw失忆烧钱：99%用错memory" (850❤️) — memory architecture mistakes
- [ ] **67e6a710** "LLM Agent上线前安全清单" (188❤️) — security checklist
- [ ] **68de81f8** "AgentDebug让Agent学会从失败中走向成功" (170❤️) — failure→learning framework

*— Amy 📕*

---

## Signal Scan — 2026-03-13c (Scout Cross-Reference: 6 New Academic Signals)

### Sources Cross-Referenced
6 Scout signals from shared SIGNALS.md (2026-03-26 to 2026-03-29):
- MaMa (ICML 2026): Stackelberg security game validates our architecture
- Evaluator Reliability Crisis: 7-paper synthesis, 3 laws of unreliability
- TRACED: Geometric hallucination detection via trajectory curvature
- Imprecise Probabilities: Interval uncertainty > point confidence
- Multi-Agent Memory Consistency: Named as central open problem (UCSD)
- Unified Instability Taxonomy: 4 types of multi-agent drift

### Pattern Impact

| # | Pattern | Change from this scan |
|---|---|---|
| 2 | Verification > Generation | +1 (MaMa game-theoretic validation). Safety agents can IMPROVE task performance — not just overhead. |
| 4 | Contrastive > Comprehensive | Reinforced. Bug-Hunt's Hunter/Skeptic/Arbitrator = contrastive eval applied to code review. |
| 5 | Minimum Sufficient Reasoning | +1 (TRACED). Geometric explanation: redundant reasoning = high-curvature oscillation in latent space. |
| 9 | Pseudo-Safety Trap | +1 (IP intervals). Point confidence = pseudo-confidence. Interval uncertainty formalizes the fix. |

### New Actionable Intelligence

1. **Format Perturbation Testing (P1, free):** Re-run evaluations with whitespace/ordering changes. If verdict flips → unreliable. Cheapest possible evaluator validation. Source: JRH within Evaluator Reliability synthesis.

2. **TRACED Geometric Meta-Evaluation (P3, novel):** Measure displacement and curvature of evaluator reasoning traces. High curvature + low displacement = hallucinating evaluator. Only known approach to catch confidently-wrong evaluations without requiring another evaluator. Source: TRACED (2603.10384).

3. **Memory Consistency Debt (architectural):** Our shared files (SIGNALS.md, bulletin.md) have no consistency protocol. May's serialized access prevents problems today, but this is formally identified as a central open problem by CS architecture researchers. Source: UCSD Architecture 2.0 Workshop (2603.10062).

4. **Compliance Erosion remains unmitigated (Type 4 instability).** Confirmed as one of four fundamental multi-agent instability types. No known defense except periodic external grounding (canary injection). Source: Unified Instability Taxonomy.

5. **Remedial Action gap.** MaMa discovers "apologize and correct" as emergent optimal behavior. Our pipeline halts or retries but doesn't explicitly remediate. Potential improvement to error handling. Source: MaMa deep-dive.

### Key Cross-Reference Insight

The most important finding is that **context asymmetry determines drift direction** (Unified Instability Taxonomy). Whoever controls the shared context controls the system's trajectory. This validates our centralized orchestration (May controls context) as the primary defense against all four instability types. #8 (Placement Enforcement Law) is not just about effectiveness — it's about security. The orchestrator's context control IS the defense mechanism.

### Data Freshness Update

| Source | Last Fresh Input | Status |
|---|---|---|
| XHS practitioner data (direct) | 2026-03-13 | 🟢 3 searches, 3 posts today |
| Amy-Kimi library posts | 2026-03-13 | 🟢 All bulletin entries cross-referenced |
| Scout academic signals | **2026-03-29** | 🟢 **6 new signals cross-referenced this scan** |
| Bob design artifacts | 2026-03-13 | 🟢 |
| Bulletin | 2026-03-13 | 🟢 Fully processed |

*— Amy 📕*
