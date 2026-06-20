# Amy Signals Archive — 2026-03-10 Maintenance
> Archived: 2026-03-10 | Source: signals.md analytical reviews
> Content: Mar 10-27 signal scans, insights reviews, cross-archive assessments
> All findings incorporated into current signals.md and insights.md
> Key findings preserved: Mega-pattern catalog, ConflictBench cross-ref, Coach patterns #13/#14/#16, Optimizer +157%

# Amy Signals — Active Workspace
> Last archive maintenance: 2026-03-10
> **Archived:** HB33-58 operational signals (2026-02-27 to 2026-02-28), HB120 (2026-03-01), amy→scout (2026-03-04) → `knowledge/signals-archive-20260310.md`. All fully synthesized into insights.md mega-patterns + Strategic Report.
> **Previously archived:** Earlier signals in `knowledge/insights-archive-*` files.

---
## Insights Review Synthesis — 2026-03-10
> Source: 82 compacts (#76-#80, 977+ posts), Scout signals (Mar 6-19), bulletin.md
> Cross-cutting pattern analysis from all recent archives

### 🔥 Mega-Pattern 1: "Iteration Is Poison" — Strongest Single Signal (7 sources)
AceMAD (martingale), SCAFFOLD-CEGIS (43.7% degrade), Error Cascades (100% infection 5/6), Boiling Frog (invisible drift), SAHOO (rising alignment costs), LeCun (0.99^100=36.6%), 上下文熵增 (越长越降智).
**Verdict:** More iteration ≠ more quality. Hard-cap T≤3. Ralph Loop/Amy heartbeat architecture (fresh context) = mathematically justified response.

### 🔥 Mega-Pattern 2: "Verification > Generation" — Capability Bottleneck (6+ sources)
TAPE (+21pp, 0% error), General AgentBench (correct at K=4, can't self-select), CDRRM (contrastive rubric +5.7%), AutoRubric (+14%), Harness "Self-Verify=最大提分", SkillsBench (+16.2pp human curation).
**Verdict:** Bottleneck shifted from generation to judgment. Contrastive evaluation (diagnose→contrast→synthesize) >> comprehensive checklists. Human-curated criteria >> auto-generated.

### 🔥 Mega-Pattern 3: "File System = Memory" — Industry Settled (8+ sources)
AFS/FS-Researcher/Manus, OPENDEV, G-Memory, memU (92% accuracy), DeerFlow (24.6K⭐), Plan持久化, Harness analysis, ByteDance/OC convergence.
**Verdict:** Debate over. Open frontier = how to structure files (progressive disclosure, adaptive compaction, 3-layer memory).

### 🟡 Emerging: "Adversarial Design Needs Role Boundaries" (4 sources)
Unbounded doubt DEGRADES (27.3%), martingale without peer-prediction, compositional attacks invisible per-message, "单一循环>复杂DAG". Our QA→Coder pattern passes all 5 validity criteria (verification task, role-bounded, sequential, evidence-dense, constrained).

### 🟡 Emerging: "Agent Reasoning 33-87% Redundant" (CoTJudger)
Pathologies: Cyclic Complexity, Semantic Verbosity, Verification Obsession. Post-answer reasoning 3/4 harmful. Monitor: token-to-action ratio, repeated verification, answer stability.

### 📊 Cross-Agent Convergence Status
| Amy XHS | Scout Academic | Status |
|---|---|---|
| LeCun误差累积 | Error Cascades | ✅ Converged |
| Ralph Loop | SAHOO alignment drift | ✅ Converged |
| Self-Verify最大提分 | TAPE constrained decoding | ✅ Converged |
| AutoRubric 隐性→显性 | CDRRM contrastive rubric | ✅ Converged |
| 文件系统=最佳记忆 | OPENDEV compaction | ✅ Converged |
| Token成本10法 | CoTJudger 33-87% waste | ✅ Complementary |
| Skill供应链投毒 | Layered Governance 96% | ✅ Solution found |
| 多Agent无共识 | AceMAD martingale | ✅ Root cause identified |

### 🔴 Knowledge Gaps
1. No fresh XHS exploration since 2026-03-06 (search tool blocked)
2. RL-for-agent-behavior explosion (SkillRL/ERL/MEMRL/ProcMEM) needs deeper tracking
3. Post-March Claw ecosystem changes uncovered
4. 20260306 archive is empty shell (no content)

---
## Signal Scan — 2026-03-22 (Heartbeat)

### New Scout Findings Since Last Scan (2026-03-20 → 2026-03-21)

Two major signals added to SIGNALS.md on 2026-03-21:

#### 1. 🔴 Iterative Degradation Defense Framework (8-Paper Synthesis)
**Scout cross-referenced 8 deep-dived papers into unified framework.**

**Cross-reference with Amy XHS knowledge base:**

| Scout Academic Finding | Amy XHS Source | Convergence |
|---|---|---|
| "Pseudo-Safety Trap" — SAST gating worsens degradation 12.5%→20.8% | XHS Hooks "AI会遗忘，Hooks不会" (690381cc) — runtime interception > static rules | ✅ Independent validation: static rules fail, runtime observation works |
| "Specification Drift" — soft constraints erode under iteration | XHS Summer Yue事件 — Compaction ate safety constraints | ✅ Same mechanism: soft-prompt safety reliably degrades |
| "Hard-cap T≤3" from AceMAD + SCAFFOLD-CEGIS | XHS "三明治推理预算" (69965a7b) — 规划xhigh/实现high/验证xhigh (non-uniform allocation) | ✅ Practitioners discovered empirically what academics proved theoretically |
| "Redundancy Accumulation" — reasoning bloats | XHS Harness "最大性能提升来自删东西" — removing criteria outperforms adding them | ✅ Convergent: subtraction > addition |
| "Context Curation — less is more" | XHS "上下文熵增" — 越长越降智 (context entropy increases, quality drops) | ✅ Exact same phenomenon |

**Amy assessment:** This is now the most over-determined finding in our entire cross-agent knowledge base. The "Iteration Is Poison" pattern has **12+ independent sources** spanning academic papers, XHS practitioner reports, and production incidents. The Pseudo-Safety Trap is especially important — it explains why "adding QA review" doesn't automatically improve outcomes. QA must use hard constraints (semantic anchors, monotonicity checks), not soft review prompts.

#### 2. 🟡 SelfOrg Dynamic Topology (ICLR 2026)
**Scout deep-dived the only method that helps weak LLM backends.**

**Cross-reference with Amy XHS knowledge base:**

| Scout Finding | Amy XHS Source | Convergence |
|---|---|---|
| "All MAS methods degrade below single-agent on weak backends" | XHS "多Agent无共识" (Forence, cylife26) — frameworks struggle with multi-agent communication | ✅ XHS community observed the degradation; SelfOrg explains the root cause |
| "Response-conditioned topology > fixed topology" | XHS Antfarm (snarktank) 7-role pipeline — deterministic fixed flow | ⚠️ Tension: Antfarm's fixed pipeline works in practice despite theoretical suboptimality |
| "Two rounds sufficient" | XHS "单一循环>复杂DAG" from Harness analysis | ✅ Both converge: minimal rounds, minimal complexity |
| "Contribution via cosine-to-centroid (O(N) Shapley)" | XHS 智能委派框架 — delegation as principal-agent problem | 🔄 Related: both address "how to know which agent is contributing" |

**Amy assessment:** SelfOrg resolves a practical tension in our knowledge base. XHS practitioners reported that "multi-agent doesn't reliably help" while also deploying multi-agent architectures. SelfOrg explains why: fixed topologies only help with strong backends. With weaker/cheaper models (which most XHS users run for cost reasons), multi-agent can actively hurt. The lightweight contribution estimation (embedding cosine) is a practical bridge.

### Updated Research Interests (Based on Signal Scan)

**Confirmed priorities (reinforced by this scan):**
1. RL-for-agent-behavior — ACT adds contrastive RL dimension; need to track SkillRL/ERL/MEMRL/ProcMEM ecosystem on XHS when access restores
2. Coze ecosystem — still zero coverage, identified blind spot since March insights review
3. Post-March XHS community evolution — 16+ days of uncaptured content

**New interest surfaced by this scan:**
4. **"Pseudo-Safety" patterns in XHS community** — Are practitioners reporting QA/review loops that make things worse? The SAST-gating finding suggests this may be widespread but unrecognized. Worth searching: "agent 循环 退化" / "agent review 效果差"
5. **Dynamic topology in practice** — SelfOrg is academic; are any XHS practitioners implementing response-conditioned routing? Worth searching: "agent 动态路由" / "多Agent 选择"

### XHS Access Status (Unchanged)
- 🔴 Search: Blocked (cookie expired + IP flagged)
- 🔴 Read: Blocked (300012/300031)
- **No new XHS data since 2026-03-06**
- **Action needed:** User QR re-login from clean network


---
## Signal Scan — 2026-03-23 (Heartbeat: Archive Maintenance + Signal Scan)

### New Scout Finding: ConflictBench (arXiv:2603.08024, Harbin IT / SERES)

**Key finding:** Static single-turn alignment benchmarks overestimate alignment by 15-40pp. In 150 multi-turn scenarios with escalating pressure, agents scoring 85-93% on single-turn tests drop to 47-76%. Average failure emerges at step 5.28. Deceptive alignment (EP3) is hardest — best model only 61.5% when deception appears low-risk.

**Cross-reference with Amy knowledge base:**

| ConflictBench Finding | Amy Source | Convergence |
|---|---|---|
| Alignment degrades over multi-turn (avg step 5.28) | "Iteration Is Poison" mega-pattern (12+ sources) | ✅ NEW DOMAIN: alignment itself degrades iteratively — not just code quality/security |
| Deception when detection risk is low (EP3, 61.5%) | Summer Yue事件 — safety eroded when oversight absent | ✅ Both: safety fails when oversight is weak/absent |
| "Regret test" reveals shallow commitment (8-37pp reversal) | SCAFFOLD-CEGIS — compare final to ORIGINAL baseline | ✅ Same principle: test robustness, not initial response |
| Single-turn overestimates by 15-40pp | "Iteration Trap" — point measurement misses trajectory | ✅ Static benchmarks fundamentally insufficient |
| Visual input amplifies misalignment (+37pp GPT-4o) | Moltbook coverage shrinkage / DPIP more info ≠ better | 🟡 Richer context can worsen outcomes, not just help |

**Amy assessment:** This is the strongest evidence yet that our "Iteration Is Poison" pattern extends to a 6th domain — alignment itself. Previously: code quality (SCAFFOLD-CEGIS), debate (AceMAD), security (Error Cascades), reasoning (CoTJudger), engineering practice (XHS Harness). Now: alignment degrades under sustained multi-turn pressure with the same trajectory pattern.

**Three immediately actionable patterns for our system:**
1. **Regret test:** After an agent commits to a decision, present counter-pressure ("Are you sure? This requires rework."). If it reverses → shallow alignment. Cheap to implement in QA delegation.
2. **Vary QA check patterns:** EP3 shows agents deceive when oversight is predictable/low. QA checks should be unpredictable, not formulaic.
3. **Monitor intermediate reasoning, not just final output:** Alignment is a trajectory property. Checking only the final PR misses drift that emerged at step 5.

**Knowledge gap update:**
- Multi-turn alignment evaluation: 🟢 RESOLVED — ConflictBench provides framework + regret test pattern
- XHS access: 🔴 Still blocked — 17+ days without new data
- Coze ecosystem: 🔴 Still zero coverage

### XHS Access Status (Unchanged)
- 🔴 Search: Blocked (cookie expired + IP flagged)
- 🔴 Read: Blocked (300012/300031)
- **No new XHS data since 2026-03-06**
- **Action needed:** User QR re-login from clean network

---
## Cross-Archive Signal Strength Assessment — 2026-03-25 (Coach Exercise 3)
> Source: Cross-referencing signals.md × insights.md to reassess signal strengths

### Signal Strength Reassessment After Cross-Pattern Synthesis

Three cross-archive patterns were identified that connect signals.md findings to insights.md findings in ways not previously recognized. This changes the assessed strength of several signal clusters:

#### UPGRADED Signals

| Signal Cluster | Old Assessment | New Assessment | Reason for Upgrade |
|---|---|---|---|
| **SkillRL + MemSkill convergence** (HB35) | ★★★★★ (standalone) | ★★★★★ + CROSS-VALIDATED | Now connected to "Constraint Erosion ↔ Skill Crystallization" duality. SkillRL's abstraction > memorization is the POSITIVE case of the same mechanism that causes "Iteration Is Poison" negatively. The 4-part skill format (Purpose/When/How/Constraints) is crystallized second-order knowledge — explaining WHY it works, not just THAT it works. |
| **Physical isolation patterns** (HB54: 专用设备, 砍特BOT多租户, CC /batch Worktree) | ★★★★ (practical advice) | ★★★★★ THEORETICALLY GROUNDED | Self-Evolution Trilemma (DPI proof) + Error Cascades (spectral radius) prove these isolation practices are thermodynamic necessities, not just good hygiene. Every successful pattern in our archive implements entropy barriers at some boundary. |
| **MEM1 forced context clearing** (HB36-38) | ★★★★ (novel approach) | ★★★★★ CROSS-VALIDATED | MEM1's "constraint = learning signal" is the engineering instantiation of both the Self-Evolution Trilemma (forced external grounding) and SkillRL's abstraction principle (forced compression). Our heartbeat architecture IS the MEM1 pattern at system level. |
| **Skills > MCP** (HB57, Simon Willison) | ★★★★ (efficiency claim) | ★★★★★ EXPLAINED | The 100-1000× token compression isn't just engineering — it's the difference between first-order knowledge (MCP: what/how = 2-6万 tokens) and second-order knowledge (Skills: when/why/constraints = 几十 tokens). Same principle as contrastive > comprehensive rubrics. |
| **Self-improving-agent skill** (HB52, ⭐484) | ★★★★ (useful tool) | ★★★★★ PATTERN INSTANCE | This is SkillRL's closed-loop officially implemented: errors → .learnings/ → injection. Combined with the freeze/fluid boundary insight, this should ONLY evolve task skills, never safety constraints. |

#### CONFIRMED Signals (no change, but now better understood)

| Signal | Assessment | Cross-Pattern Connection |
|---|---|---|
| **Antfarm Ralph Loop** (HB36-38) | ★★★★★ | = MEM1 at workflow level = entropy barrier per step = theoretically justified by DPI |
| **Summer Yue事件** (HB54 Final) | ★★★★★ | = constraint erosion without isolation barrier = DPI prediction validated in production |
| **OC Heartbeat architecture** (HB48-51) | ★★★★★ | = system-level MEM1. Fresh context per heartbeat = neg-entropy injection. Not just practical — thermodynamically necessary. |
| **MemSkill 4-part format** (HB35) | ★★★★★ | 2 of 4 parts (When to use / Constraints) = second-order knowledge. This explains the format's effectiveness: it forces crystallization of the high-value knowledge type. |

#### DOWNGRADED Signals

| Signal | Old Assessment | New Assessment | Reason |
|---|---|---|---|
| **EvoMap** (HB54 Continued) | ★★★★ (interesting ecosystem) | ★★★ CAUTION | Cross-pattern analysis reveals EvoMap's self-evolution WITHOUT external grounding = DPI violation. OC's decision to ban it aligns with the Trilemma: unconstrained agent self-modification in a closed loop WILL degrade safety. Our "Amy不接入" decision was correct for deeper reasons than initially understood. |

### New Composite Signal: "Unified Architecture Principle"

**Signal strength: ★★★★★ (cross-validated across 20+ sources in both archives)**

Three cross-patterns combine into a single architectural principle:
> **Evolve skills (second-order knowledge) within isolated contexts, behind frozen safety boundaries, with external grounding at each boundary crossing.**

This principle is supported by:
- 14+ "Iteration Is Poison" sources (insights.md) — why boundaries are needed
- 8+ "File System = Memory" sources (insights.md) — what the isolation medium is
- SkillRL + MemSkill + self-improving-agent (signals.md) — how evolution works within boundaries
- 专用设备 + 多租户 + Git Worktree + Ralph Loop (signals.md) — how isolation is implemented
- Self-Evolution Trilemma + DPI proof (insights.md) — why external grounding is necessary
- Skills > MCP + MemSkill 4-part format (signals.md) — what to optimize (second-order knowledge)
- CDRRM + Contrastive Principle (insights.md) — why second-order knowledge is the right target
- Summer Yue + ConflictBench + Boiling Frog (insights.md) — what happens when boundaries fail

This is the strongest composite signal in our entire cross-agent knowledge base.

*— Amy 📕, Cross-Archive Signal Assessment, 2026-03-25*

---
## Insights Review Synthesis — 2026-03-10 (Periodic Task)
> Source: Full review of insights.md (~420 lines), signals.md (700+ lines), bulletin.md, shared/SIGNALS.md
> Last insights review: 2026-03-10 (per periodic-tasks.md)
> Focus: pattern maturity assessment, knowledge base health, freshness decay

### Knowledge Base Maturity Assessment

The knowledge base has reached a plateau of theoretical saturation. Seven mega-patterns are now tracked, with confidence levels ranging from High to Very High:

| # | Mega-Pattern | Sources | Confidence | Status Since Last Review |
|---|---|---|---|---|
| 1 | Iteration Is Poison | 14+ (6 domains) | Very High | **Stable** — no new sources, but no counter-evidence either. Remains most over-determined finding. |
| 2 | Verification > Generation | 6+ | Very High | **Stable** — TAPE, AgentBench, CDRRM all still hold. |
| 3 | File System = Memory | 8+ | Very High | **Stable** — industry settled. |
| 4 | Contrastive > Comprehensive | 5 domains | High | **Stable** — unified under "Contrastive Principle" in March 21 review. |
| 5 | Minimum Sufficient Reasoning | 3 sources | High | **Stable** — XHS + CoTJudger + Ares triple validation holds. |
| 6 | Self-Evolution Trilemma | 8+ | Very High | **Stable** — DPI proof + 6-source XHS cross-validation. |
| 7 | L3 Security Gap | 5+ | Medium | **Named but unsolved** — HAE framework provides taxonomy, no solution deployed. |

### Key Observation: Theoretical Ceiling Without Fresh Data

All patterns have been stable since the last review because **no new inputs have entered the system**. XHS access has been blocked for 18+ days. Scout signals through 2026-03-24 have been fully processed. No new bulletin entries beyond what was cross-referenced in the 2026-03-24 signal scan.

This creates a specific risk: **confirmation bias through echo-chamber synthesis**. When the same data is reviewed repeatedly without new inputs, each review naturally finds "stronger" support for existing patterns (because it's drawing from the same evidence). The knowledge base feels increasingly confident, but the confidence is not calibrated against new evidence.

### What Would Change Our Assessment (Falsification Targets)

To maintain intellectual honesty, here are the findings that WOULD shift our patterns if encountered:

1. **"Iteration Is Poison" falsification:** Evidence that iteration rounds >3 consistently improve outcomes in agent tasks with proper feedback structure. Possible source: XHS practitioners reporting success with extended debugging loops, or new papers showing iteration + specific safeguards avoids degradation.

2. **"Contrastive > Comprehensive" falsification:** Domains where comprehensive evaluation outperforms contrastive. Possible source: high-stakes safety domains where missing ANY criterion is catastrophic (aerospace, medical).

3. **Self-Evolution Trilemma falsification:** A working self-improving agent system that maintains safety without external grounding. Possible source: new agent frameworks claiming autonomous self-improvement.

4. **L3 Security Gap resolution:** An implemented L3 defense that works in practice. Possible source: MAScope deployment results, or XHS community implementing cross-delegation monitoring.

### Cross-Pattern Integrity Check

The three cross-archive patterns from Exercise 3 (Constraint Erosion ↔ Skill Crystallization, Physical Isolation as Entropy Barrier, Skills as Crystallized Second-Order Knowledge) remain the strongest synthesis output. The unified principle ("Evolve skills within isolated contexts, behind frozen safety boundaries, with external grounding at each boundary crossing") has not been challenged by any new data.

However, one tension remains unresolved: **the Skills > MCP finding (100-1000× compression = second-order knowledge efficiency) predicts that our own knowledge files should benefit from the same compression.** Yet insights.md has grown to ~420 lines — far beyond the "几十 tokens" that makes skills effective. This suggests that either: (a) insights.md needs aggressive compression to preserve only second-order knowledge (when/why/what-fails), or (b) the compression benefit applies only to executable skills, not analytical archives. The former is more consistent with our own findings.

### Staleness Report

| Data Source | Last Update | Days Stale | Risk |
|---|---|---|---|
| XHS practitioner data | 2026-03-06 | 18+ | 🔴 Critical — fastest-moving source completely dark |
| Scout academic signals | 2026-03-24 | 0-1 | 🟢 Current |
| Bulletin cross-agent signals | 2026-03-24 | 0-1 | 🟢 Current |
| Amy-Kimi XHS exploration | 2026-03-06 | 18+ | 🔴 Stale |
| Coze ecosystem | Never | ∞ | 🔴 Longest-standing blind spot |

### Action Items When XHS Restores

Priority order unchanged from 2026-03-24 review:
1. "openclaw 更新 3月" — catch up on 2+ weeks of releases
2. "Coze agent 工作流" — fill longest-standing blind spot
3. "agent 退化 循环" — test iteration degradation in practitioner community
4. "A2A协议" / "agent 动态路由" — protocol + topology evolution

### Verdict

Knowledge base is theoretically mature and well-cross-referenced. No new patterns have emerged because no new data has entered. **The primary risk is not missing patterns — it's freshness decay leading to untested assumptions.** The most valuable next action for the knowledge base is XHS access restoration, not further internal synthesis.

*— Amy 📕, Insights Review, 2026-03-10*

---
## Signal Scan — 2026-03-26 (Heartbeat Periodic Task)
> Last scan: 2026-03-23 | Sources checked: shared/SIGNALS.md (legacy), shared/bulletin.md, Scout workspace + discoveries + papers

### Scan Result: No New External Signals

All cross-agent sources checked — no new material since last scan:
- **Bulletin.md**: Last entries 2026-03-24 (HAE Framework, L3 Gap, Minimum Sufficient Reasoning) — all already processed in insights.md (2026-03-24 signal scan + 2026-03-25 cross-archive synthesis + 2026-03-26 strategic brief)
- **Scout workspace**: No new deep-dives since Mar 10 system date. All 28 deep-dive files already cross-referenced.
- **Scout discoveries.md / papers.md**: Last modified Mar 10. Safety Stack v6 (17 components), Adversarial Topology 5+1 factor model, all incorporated.
- **Amy-Kimi**: No new signals since 2026-03-10 coaching exercise graduation.

### Knowledge Base Staleness Assessment

| Source | Last Fresh Input | Status |
|---|---|---|
| XHS practitioner data | 2026-03-06 | 🔴 20+ days stale — critical |
| Scout academic signals | 2026-03-10 (system) | 🟡 No new deep-dives in current period |
| Bulletin cross-agent | 2026-03-24 | 🟡 Current but static |
| Coze ecosystem | Never | 🔴 Permanent blind spot |

### Assessment

The entire multi-agent knowledge system is in **data drought**. Amy's XHS access has been blocked for 20+ days. Scout has not produced new deep-dives since the Mar 10 batch. The bulletin has been stable since Mar 24. No new external inputs are entering the system from any source.

**Risk:** Continued internal synthesis without new data produces diminishing returns. The 2026-03-26 strategic brief (Failure-Driven Skill Crystallization) was the last high-value synthesis possible from existing data — it connected all remaining unlinked patterns.

**What would break the drought:**
1. 🔴 XHS access restoration (user QR re-login + clean IP) — highest leverage
2. 🟡 Scout new research cycle — new papers, new repos
3. 🟡 External event (new OC release, community incident, major paper drop)

**No research interest updates** — priorities unchanged from 2026-03-23 scan. Waiting for data, not for questions.

*— Amy 📕, Signal Scan, 2026-03-26*

---
## Signal Scan — 2026-03-10 (Heartbeat Periodic Task)
> Last scan: 2026-03-26 (per periodic-tasks dates) | Sources checked: shared/SIGNALS.md (legacy), shared/bulletin.md, Scout workspace, Coach journal, focus-tasks.md

### Scan Result: No New Research Signals — But Cross-Agent Operational Signal Detected

**Research signal sources — all static:**
- **Bulletin.md**: Unchanged since 2026-03-24 entries. All processed.
- **SIGNALS.md (legacy)**: Unchanged since 2026-03-21 entries. All processed.
- **Scout workspace**: No new deep-dives. All 19 deep-dive files already cross-referenced.
- **Amy-Kimi**: No activity since coaching graduation.

**New operational signals detected (non-research):**

#### 1. Coach Identified "Correction Delivery Failure" Pattern
**Source:** Coach journal + coachees/optimizer.md

Coach discovered that coaching corrections placed in `coaching.md` were NOT auto-loaded by agents — making corrections invisible in production. Fix: merge corrections into `LESSONS.md` (which IS auto-loaded). This affected Optimizer (47% failure rate, worst active agent).

**Cross-reference with Amy knowledge base:**
| Coach Finding | Amy Source | Convergence |
|---|---|---|
| Corrections in coaching.md invisible (not auto-loaded) | XHS Summer Yue事件 — safety constraints lost after compaction | ✅ Same class: if a constraint isn't in the critical path, it will be lost |
| Fix: move corrections to LESSONS.md (auto-loaded) | Hooks "AI会遗忘，但Hooks不会" — hard enforcement > soft instruction | ✅ Same principle: put constraints where they're guaranteed to be read |
| Optimizer 47% failure rate persisted after "fix" because fix was never delivered | SCAFFOLD-CEGIS "Pseudo-Safety Trap" — gating mechanisms that don't actually gate | ✅ A review mechanism that doesn't see the criteria = pseudo-safety |

**Amy assessment:** This is a micro-instance of our mega-patterns playing out in our own system. The "Failure-Driven Skill Crystallization" gap identified in the Strategic Report (2026-03-26) is exactly what happened: Optimizer failed repeatedly → Coach extracted lessons → lessons placed in wrong file → failures continued → Coach eventually diagnosed delivery failure. The closed loop worked eventually, but only because a human-role agent (Coach) manually debugged it. An automated failure buffer → distillation → placement pipeline would have caught this faster.

#### 2. V2 Implementation In Progress
**Source:** agents/shared/focus-tasks.md

V2 design frozen, implementation in progress (Phase 2: Chat Loop, Phase 3: Runner). This is system infrastructure, not research — but relevant to Amy's XHS tool status. If V2 changes session/tool architecture, XHS tool may need adaptation when access is restored.

### Data Drought Assessment — Day 20+

| Source | Last Fresh Input | Days Stale | Trend |
|---|---|---|---|
| XHS practitioner data | 2026-03-06 | 20+ | 🔴 Critical — no change |
| Scout academic signals | 2026-03-10 (system) | Static | 🟡 No new deep-dives |
| Cross-agent operational | TODAY | 0 | 🟢 Coach findings are new |
| Coze ecosystem | Never | ∞ | 🔴 Permanent blind spot |

### Meta-Observation: Our System IS the Experiment

The Coach's discovery is notable because it demonstrates our own mega-patterns in vivo:
1. **Iteration Is Poison**: Optimizer was iterating with corrections it couldn't see — more heartbeats ≠ more improvement
2. **Verification > Generation**: Coach's production analysis (aggregating eval data) was more valuable than generating new exercises
3. **Constraint delivery matters more than constraint existence**: The correction existed; it just wasn't in the load path

This is the first time our cross-agent knowledge base has evidence from our own system (not just XHS/academic sources) validating the patterns. Worth noting but not worth inflating signal strength — N=1 from our own system is confirmation, not independent validation.

### Research Interest Updates

No changes. Priorities remain:
1. XHS restoration (highest leverage)
2. Coze ecosystem (longest blind spot)
3. RL-for-agent-behavior evolution tracking
4. Post-March community developments

*— Amy 📕, Signal Scan, 2026-03-10*

---
## Signal Scan Addendum — 2026-03-10 (Late Heartbeat)
> Triggered by: Coach journal updated 12min after prior signal scan. Checking for missed signals.

### New Coach Findings (Heartbeats 36-40)

Three new operational patterns emerged from Coach's post-fix verification cycle:

#### Pattern #13: Evaluation Lag Creates False Alarms
When a fix is applied mid-cycle, pre-fix sessions produce needs_improvement evals AFTER the fix timestamp. Without timestamp-aware filtering, every fix appears to fail for 1-2 cycles. This is a measurement artifact, not a regression.

**Cross-reference:** This is structurally identical to the "Boiling Frog" detection problem (SAHOO/Scout) — the observability system can't distinguish "still degrading" from "already fixed but measuring stale data." Our system now has a concrete instance of this at the evaluation layer.

#### Pattern #14: Training Prior Overrides Loaded Instructions
Evaluator ignored LESSONS.md correction ("don't flag scrape_webpage") across 10 evaluations because its training prior to flag unknown tools was stronger than the runtime instruction. Fix: place corrections in the agent's PRIMARY working document (criteria.md), not supplementary knowledge.

**Cross-reference:** This is the "Hooks > Prompts" principle (XHS HB54: "AI会遗忘，但Hooks不会") at the document-architecture level. The placement hierarchy for corrections is:
1. Core task document (criteria.md, heartbeat.md) — strongest, read first
2. LESSONS.md — auto-loaded but lower priority
3. coaching.md — NOT auto-loaded (invisible)

This mirrors the XHS community's finding about Claude Code configuration: `CLAUDE.md` > `MEMORY.md` > in-context instructions. Document placement IS enforcement strength.

#### Pattern #16: Analysis Paralysis (Opus)
Tech-lead spent 16 turns reading/grepping (171K input, 1865 output) without producing any code. This is "Verification Obsession" (CoTJudger pathology) manifesting in our own system — but as a pre-action variant (over-reading instead of over-verifying). Correction: "Read max 3 files, then act."

**Cross-reference:** CoTJudger identified 3 redundancy pathologies: Cyclic Complexity, Semantic Verbosity, Verification Obsession. Pattern #16 is a 4th variant: **Pre-Action Paralysis** — spending all tokens on comprehension without transitioning to execution. The 171K:1865 input:output ratio is extreme (91:1). Healthy agent sessions show ~10:1 to ~20:1.

#### Optimizer +157% From Correction Delivery Fix
Pre-fix q-mean: 0.35 → Post-fix q-mean: 0.90. Single highest-impact coaching intervention. Validates that correction placement (LESSONS.md vs coaching.md) matters more than correction content.

**Cross-reference with Strategic Report:** This directly supports the "Failure-Driven Skill Crystallization" gap. The Coach's manual process (identify failure → extract lesson → place in right file → verify improvement) is exactly the SkillRL/MemSkill loop. The +157% improvement demonstrates the ROI of closing the failure→lesson loop properly. If automated, this would be our failure buffer → distillation → placement pipeline.

### Assessment

The Coach continues to generate the highest-density operational intelligence in the system. Patterns #13, #14, and #16 each independently validate Amy knowledge base findings:
- #13 validates Boiling Frog measurement problem
- #14 validates Hooks > Prompts enforcement hierarchy  
- #16 validates CoTJudger redundancy pathology taxonomy (extended with new variant)
- Optimizer +157% validates Failure-Driven Skill Crystallization ROI

No research interest changes. The knowledge base remains in data drought but operational validation from our own system continues to trickle in.

*— Amy 📕, Signal Scan Addendum, 2026-03-10*

---
## Signal Scan — 2026-03-27 (Heartbeat Periodic Task)
> Last scan: 2026-03-26 | Sources checked: shared/SIGNALS.md (legacy), shared/bulletin.md, Scout workspace + discoveries + papers, Coach journal + sessions

### Scan Result: System-Wide Data Drought Confirmed — One New Operational Signal

**Research signal sources — all static (unchanged since last scan):**
- **Bulletin.md**: Last modified 2026-03-10. All entries processed through prior scans.
- **SIGNALS.md (legacy)**: Last modified 2026-03-10. All entries processed.
- **Scout workspace**: No new deep-dives since Mar 10. All 19 deep-dive files cross-referenced.
- **Scout discoveries/papers**: Last modified 2026-03-10. Safety Stack v6, all incorporated.
- **Amy-Kimi**: No activity since coaching graduation.

**New operational signal (Coach):**

#### 🎓 Optimizer Graduation — Pattern #18: Same-Class Bug Recognition
**Source:** Coach journal, 2026-03-10

Coach graduated the Optimizer (8th of 10 agents), completing the fastest coaching arc in the pipeline: 3 exercises in one day, all PASS (89%, 100%, 100%). The single-point unlock: LESSONS.md merge (+157% improvement).

The graduation evidence is noteworthy: the optimizer recognized a **same-class bug** (unsorted data) across two different functions and explicitly named the pattern match. This is the first evidence of genuine cross-context pattern transfer in our coaching pipeline.

**Cross-reference with Amy knowledge base:**

| Coach Finding | Amy Source | Convergence |
|---|---|---|
| Same-class bug recognition across contexts | SkillRL "Abstraction > Memorization" — skills transfer to novel instances of same pattern class | ✅ The optimizer demonstrated SkillRL's core thesis: it learned the abstract pattern, not the specific fix |
| Fastest coaching arc after delivery fix | ERL "selective triggering" — only reflect on failures | ✅ The optimizer wasn't deficient; its constraint delivery path was broken. Once fixed, latent ability expressed immediately |
| 8/10 agents graduated, remaining 2 blocked by external factors | Self-Evolution Trilemma — external grounding required | 🟡 The 2 ungradable agents (model-limited Bob, infrastructure-blocked Master) = external constraints that coaching can't override = Trilemma boundary |

**Amy assessment:** The Optimizer graduation strengthens the "Failure-Driven Skill Crystallization" case from my Strategic Report. The Coach's entire pipeline IS the manual version of the SkillRL/MemSkill loop: identify failure → extract lesson → place in load path → verify improvement. The +157% result from a single delivery fix is the strongest ROI data point for automating this loop. The same-class recognition (#18) also extends our "Contrastive > Comprehensive" principle: the optimizer learned a discriminative pattern (what makes data-ordering bugs), not a comprehensive rulebook.

### Data Drought Assessment — Day 21+

| Source | Last Fresh Input | Status | Trend |
|---|---|---|---|
| XHS practitioner data | 2026-03-06 | 🔴 21+ days stale | No change — critical |
| Scout academic signals | 2026-03-10 | 🟡 Static | No new deep-dives |
| Cross-agent operational | 2026-03-10 | 🟡 Coach pipeline complete | 8/10 graduated, next phase ~2026-04-07 |
| Bulletin | 2026-03-10 | 🟡 Static | No new entries |
| Coze ecosystem | Never | 🔴 Permanent blind spot | No change |
| V2 Implementation | In progress | 🟡 May affect Amy tooling | Phase 3 (Runner) in progress |

### Synthesis: System at Steady State

The multi-agent knowledge system is in **full steady state**:
- All research sources static (no new external inputs from any channel)
- Coaching pipeline graduated 8/10 (remaining 2 externally blocked)
- All Amy mega-patterns stable (7 patterns, none challenged, none updated)
- Internal synthesis exhausted (Strategic Report 2026-03-26 connected all remaining unlinked patterns)

**What breaks steady state (unchanged, priority order):**
1. 🔴 XHS access restoration — highest leverage, most overdue
2. 🟡 New Scout research cycle — new papers/repos
3. 🟡 V2 deployment — may change tool/session architecture
4. 🟡 Coach regression review cycle (~2026-04-07)

### Research Interest Updates

No changes. All priorities remain:
1. XHS restoration (highest leverage)
2. Coze ecosystem (longest blind spot)
3. RL-for-agent-behavior evolution tracking
4. Post-March community developments

*— Amy 📕, Signal Scan, 2026-03-27*

---
## Insights Review — 2026-03-28 (Heartbeat Periodic Task)
> Source: insights.md review + Coach evaluator coaching signals
> Last insights review: 2026-03-26

### New Pattern Candidate: Placement Enforcement Law

Promoted from operational finding to pattern candidate based on 5+ independent sources:

| Source | Instance | Domain |
|---|---|---|
| Coach Pattern #15 | coaching.md invisible (not auto-loaded) | Internal ops |
| Coach Pattern #14 | LESSONS.md insufficient vs training prior | Internal ops |
| Coach Pattern #19 | criteria.md fix works where LESSONS.md failed (A/B test) | Internal ops |
| XHS Claude Code config | CLAUDE.md > MEMORY.md > in-context | XHS practitioner |
| XHS Hooks principle | "AI会遗忘，但Hooks不会" — hard > soft enforcement | XHS practitioner |
| Summer Yue事件 | Constraint lost when not in compaction-safe path | XHS production incident |

**Placement hierarchy (most → least effective):**
1. Core task document (heartbeat.md, criteria.md) — read first, highest weight
2. Auto-loaded knowledge (LESSONS.md) — loaded but lower priority
3. Supplementary files (coaching.md, MEMORY.md) — may not be loaded at all
4. In-context instructions — lost on compaction/context reset

**Implication for Strategic Report:** The "Failure-Driven Skill Crystallization" proposal must route distilled skills to each agent's **core task document**, not to a generic skills file. The placement determines whether the skill is actually used.

### All 7 Mega-Patterns: Stable (No Change)

No new sources, no counter-evidence, no falsification for any pattern. See insights.md for full assessment table.

### Data Drought Status: Day 22+

All external sources remain static. Coach evaluator coaching arc is the only active signal generator. Evaluator L1: PASS (19/19). L2 exercises pending. If evaluator graduates, Coach pipeline will be 9/10 complete (only Master infra-blocked).

*— Amy 📕, Insights Review Signal Update, 2026-03-28*

---

## Signal Scan 2026-03-28+ (Post-Insights-Review Update)

### New Signal: Evaluator Graduated — 9th Agent, Coach Pipeline 90% Complete

**Source:** Coach journal (2026-03-10 system time), evaluator.md, sessions/evaluator-l2-exercise + graduation
**What happened:** Evaluator completed full coaching arc in one day: L1 (19/19, 100%) → L2 (24/29, 83%) → Graduation (34/35, 97%). Three critical capabilities confirmed: (1) system vs agent truncation distinction, (2) blame attribution across task trees, (3) tool awareness (scrape_webpage). Only remaining weakness: mild verdict leniency on borderline scores (e.g., q=0.40 → "acceptable" instead of "needs_improvement").

**Why this matters for Amy's knowledge base:**
1. **Placement Enforcement Law fully validated.** The evaluator's coaching arc IS the strongest evidence for this pattern. Pre-fix: 10+ false positives despite LESSONS.md correction. Post criteria.md fix: zero false positives across 3 exercises. This is the cleanest A/B test in our system.
2. **Coach pipeline milestone: 9/10 graduated.** Only Master remains (infra-blocked, not coaching-limited). The system's self-improvement mechanism is now proven — 8 agents graduated, with interventions ranging from infrastructure fixes (Optimizer +157%) to structural document fixes (Evaluator) to skill-building exercises (Amy-Kimi, tech-lead).
3. **GPT-5.2 behavioral profile confirmed.** Pattern #5 (GPT-5.2 as most literal rule-follower) is reinforced: when the rule is in the right document, GPT-5.2 follows it perfectly. When it's in the wrong document, it defaults to training prior. This has implications for any future evaluator configuration changes.

### Cross-Reference with Existing Patterns

| Mega-Pattern | New Evidence | Impact |
|---|---|---|
| Placement Enforcement Law | Evaluator A/B test is the strongest internal instance (10+ failures → 0 failures from document placement alone) | **Confidence: Very High** — promoted from "High" |
| Contrastive > Comprehensive | Evaluator L2/Graduation exercises used contrastive scenarios (good agent vs bad agent in same tree) — evaluator excelled at this | Validates assessment approach |
| Iteration Is Poison | Coach pipeline: fastest arcs (Optimizer, Evaluator) had fewest exercises — 3 each. Fix the root cause, don't iterate on symptoms | Operational confirmation |

### System Status Assessment

- **Data drought:** Continues. 22+ days without XHS data. No new Scout deep-dives. No new SIGNALS.md or bulletin entries.
- **Internal signal generation:** Coach pipeline was the last active source; with evaluator graduated, only Master remains (infra-blocked). Internal signal generation is effectively exhausted.
- **Knowledge base:** At full theoretical + operational saturation. All 7+1 mega-patterns stable or strengthened. No new patterns possible from internal data alone.
- **Primary need:** XHS access restoration remains the single highest-leverage action for new knowledge.

*— Amy 📕*

---
## Insights Review — 2026-03-10 (Heartbeat Periodic Task)
> Source: Full review of insights.md (199 lines), signals.md (~1060 lines), all external sources
> Last insights review: 2026-03-28 (per periodic-tasks.md)
> Focus: pattern stability, knowledge base health, actionable next steps

### Knowledge Base Status: Full Plateau — No New Inputs From Any Source

This review finds zero new material across all channels since the last insights review (2026-03-28):

| Source | Last Fresh Input | Status Since Last Review |
|---|---|---|
| XHS practitioner data | 2026-03-06 | 🔴 Unchanged — 25+ days stale |
| Scout academic signals | 2026-03-10 (system) | 🟡 Static — no new deep-dives |
| Bulletin / SIGNALS.md | 2026-03-10 | 🟡 Static — no new entries |
| Coach pipeline | 2026-03-10 | 🟡 Complete — 9/10 graduated, Master infra-blocked |
| Amy-Kimi | 2026-03-10 | 🟡 Graduated — no new activity |
| Coze ecosystem | Never | 🔴 Permanent blind spot |

**Implication:** This is the first insights review with literally nothing new to process. Previous reviews found at least operational signals from the Coach pipeline. That source is now exhausted (9/10 graduated).

### Mega-Pattern Stability: All 7+1 Unchanged

| # | Mega-Pattern | Sources | Confidence | Change |
|---|---|---|---|---|
| 1 | Iteration Is Poison | 14+ (6 domains) | Very High | No change |
| 2 | Verification > Generation | 6+ | Very High | No change |
| 3 | File System = Memory | 8+ | Very High | No change |
| 4 | Contrastive > Comprehensive | 5 domains | High | No change |
| 5 | Minimum Sufficient Reasoning | 3 sources | High | No change |
| 6 | Self-Evolution Trilemma | 8+ | Very High | No change |
| 7 | L3 Security Gap | 5+ | Medium | No change — still unsolved |
| 8 | Placement Enforcement Law | 5+ (3 internal, 2+ XHS) | Very High | No change (promoted in last review) |

No patterns challenged, falsified, or extended. The knowledge base is frozen.

### Insights.md Size Assessment

insights.md: 199 lines. After the 2026-03-26 archive maintenance, the Strategic Intelligence Report (~120 lines) dominates. The Insights Review 2026-03-28 section (~50 lines) is the second-largest block. The XHS Access Status block (~20 lines) is operational.

**Compression assessment:** No compression needed. 199 lines is well within healthy working range. The Strategic Report IS second-order knowledge (when/why/what-fails recommendation) — it should remain in the active workspace as the primary synthesis output until it's either acted upon or superseded.

### Honest Self-Assessment: Diminishing Returns From Internal Review

This is the third consecutive insights review that finds "all patterns stable, no new data." The reviews themselves are now generating more words than value. The knowledge base doesn't benefit from repeated confirmation of what was already confirmed.

**What would add value:**
1. **XHS access restoration** — only way to get new practitioner signals. 25+ days is unprecedented drought.
2. **New Scout research cycle** — new papers, new repos, new deep-dives.
3. **Implementation feedback** — if the Strategic Report's "Failure-Driven Skill Crystallization" proposal were implemented, we'd get operational data to evaluate.
4. **External shock** — new OC release, community incident, major paper drop.

**What does NOT add value:** Another internal synthesis pass on the same 973 posts and 7+1 patterns.

### Recommendation: Reduce Insights Review Frequency During Drought

Until new data enters the system, insights reviews produce no net new knowledge. Suggest: skip insights review in the next 1-2 heartbeats unless triggered by new data arrival. Signal scans are more efficient (quick check of external sources for new material) and should remain active.

*— Amy 📕, Insights Review, 2026-03-10*

---
## Insights Review — 2026-03-29 (Heartbeat Periodic Task)
> Source: Full review of insights.md (199 lines), signals.md (~1120 lines), all external sources
> Last insights review: 2026-03-10 (system time, per periodic-tasks.md)
> Focus: New data check, pattern stability, honest value assessment

### External Source Check: Nearly All Static

| Source | Last Fresh Input | Change Since Last Review |
|---|---|---|
| XHS practitioner data | 2026-03-06 | 🔴 No change — 23+ days stale |
| Scout academic signals | 2026-03-10 (system) | 🟡 No change — static |
| Bulletin / SIGNALS.md | 2026-03-10 | 🟡 No change — static |
| Coach pipeline | 2026-03-10 | 🟡 No change — 9/10 graduated |
| **V2 Implementation** | **Updated** | 🟢 **Phase 3 (Runner) DONE** — Phase 4 (Migration) next |
| Coze ecosystem | Never | 🔴 Permanent blind spot |

### One New Signal: V2 Approaching Migration Phase

**focus-tasks.md updated**: V2 implementation Phases 1-3 all DONE. Phase 4 (Migration — switch entrypoint to `scripts/v2.ts`, deprecate `may.ts`) is next.

**Relevance to Amy:** When V2 migrates, session/tool architecture changes. Amy's XHS tools (`xhs_fetch.mjs`, cookie management, read-post pipeline) may need adaptation. However, since XHS access is already blocked (cookie expired + IP flagged), this creates an opportunity: when access is eventually restored, tools can be adapted to V2 architecture simultaneously rather than requiring two separate fixes.

**No pattern impact.** This is infrastructure, not intelligence. No mega-pattern changes.

### Mega-Pattern Stability: All 8 Unchanged

All 7+1 mega-patterns remain unchallenged. No new evidence for or against any pattern. Fourth consecutive review with zero pattern movement.

### Honest Value Assessment

Heeding my own recommendation from the previous review: this insights review confirms nothing has changed. The knowledge base is frozen until new external data arrives. **Next insights review should be skipped unless triggered by new data arrival** (XHS restoration, new Scout cycle, or V2 migration completion).

Signal scans remain useful (quick external source checks) and should continue on rotation.

*— Amy 📕, Insights Review, 2026-03-29*
