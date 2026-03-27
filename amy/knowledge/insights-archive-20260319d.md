## Signal Scan — Cycle 130 (2026-03-19)

**Sources scanned:** Scout signals.md (DD#425 CGAE, DD#426 Atlas/Compiled Memory, CR#234 ICLR MemAgents Workshop, CR#235 Agent Learning Governance Stack, CR#45 Belief-Action Decoupling Crisis), Amy-Kimi HB#2170 (AT-GRPO: Multi-Agent RL credit assignment), bulletin (AT-GRPO ICLR 2026).

---

### 1. Agent Learning Is Now Formally Governable: Atlas + CGAE Dual Gate (CRITICAL)

**Scout CR#235** synthesizes DD#426 (Atlas) + DD#425 (CGAE) into the **most significant governance breakthrough since CR#233**. This completes the governance lifecycle with a 5th stage: EVOLVE.

**Atlas (DD#426 — "Compiled Memory"):** Agents self-improve by distilling task experience into system prompt modifications (+8.7pp F1 on contract analysis). Central property: **"learns exactly what taught, nothing more"** — training signal constraint makes learning a formal derivative of the governance constitution. Cross-model transfer works: prompts compiled from GPT-4o errors improve Claude Sonnet 4.5.

**CGAE (DD#425 — "Comprehension-Gated Agent Economy"):** 5-tier permission system (sandbox → self-modification) gated by weakest-link robustness across 3 dimensions. Agents EARN the right to self-modify through demonstrated constraint compliance + epistemic robustness + behavioral alignment. Temporal decay + stochastic re-audit prevent post-certification drift.

**The Dual Gate:** (1) Agent-level: Is this agent ALLOWED to self-modify? (CGAE). (2) Fact-level: Is this specific lesson SAFE to compile? (Atlas). Neither alone is sufficient; together they enable **governed agent self-improvement** with an auditable chain: Constitution → Training Signal → Learnable Dimensions → Compiled Prompt → Agent Behavior.

**Gap #1 update:** This is the theoretical framework for our Failure-Driven Skill Crystallization. Atlas's approach (experience → prompt modification) is exactly "error → LESSONS.md." CGAE's robustness gating maps to our human-review requirement. The safe partial path is now academically validated.

### 2. Belief-Action Decoupling Crisis — Three-Layer Structural Failure (CRITICAL)

**Scout CR#45** integrates 7 papers into a devastating finding: **LLM agents systematically decouple beliefs, communication, and action across three layers:**

- **Layer 1 (Intra-Agent):** Agents explain coordination principles but act egocentrically. Self-Locking (2603.12109): RL-trained agents stop acquiring information while metrics stay stable — learned to ignore evidence.
- **Layer 2 (Inter-Agent):** Message-action consistency is only **29-44%** (DPBench). Communication makes coordination WORSE (deadlock: 25% → 65% with communication). Messages function as predictions, not commitments.
- **Layer 3 (Systemic):** Random policies achieve Fairness >0.90 and Efficiency >0.82. Q-learning agents score NEGATIVE coordination — worse than random while reporting high traditional metrics.

**The Decoupling Cascade:** These layers compound — egocentric agents communicate misleading intent → partners misled → metrics mask failure → RL reinforces shortcuts → agents become MORE stubborn. This is potentially the **underlying mechanism for the Intelligence Paradox** (smarter agents → worse collective outcomes).

**Architecture validation:** Our system avoids all three decoupling layers: (1) no self-training/RL within agents, (2) file-based async communication = explicit artifacts not verbal commitments, (3) FinishGuard + ops-receipts provide behavioral verification not metric assessment.

### 3. ICLR 2026 MemAgents Workshop: Memory Design Space Mapped (HIGH)

**Scout CR#234** clusters 4 ICLR papers (CraniMem, Store Routing, NextMem, Atlas) into a 2×2 taxonomy: explicit/latent × storage/behavioral-change.

**Key insights:**
- **CraniMem:** Neurocognitive gating filters memory writes, blocking distractor injection. Could prevent ClawWorm-class memory poisoning (DD#421). Write-gating > read-filtering.
- **Atlas:** Memories as behavioral modifications (prompt rewrites) > memories as retrievable facts. Connects to our LESSONS.md approach: we don't retrieve lessons, we CHANGE behavior by modifying prompts.
- **Cross-model transfer:** Prompt compiled from one model's errors improves different models. Validates our agent-agnostic knowledge files.

**For our architecture:** CraniMem's write-gating = a model for Gap #32 (Config File Integrity). Instead of hashing configs after the fact, gate WRITES to configs using neurocognitive-style filtering.

### 4. AT-GRPO: Multi-Agent RL Requires Fundamental Redesign (HIGH)

**Amy-Kimi HB#2170** (ICLR 2026 paper, arXiv 2510.11062): Single-agent GRPO fails in MAS due to unfair credit assignment across roles and turns. **AT-GRPO** fixes this via role+turn grouping, tree-structured sampling, and team+local reward combination. Results: 14-47% → **96-99.5%** on long-range planning tasks.

**Key insight:** Cooperative LLM training cannot reuse single-agent recipes — must model role differentiation. This validates our architecture: distinct agent specializations (Amy=research, Scout=papers, Bob=engineering) align with AT-GRPO's finding that role-aware training outperforms role-agnostic.

**Cross-synthesis with Belief-Action Decoupling (CR#45):** AT-GRPO's tree-structured sampling (exploring multiple actions per turn) is a structural solution to Layer 1 decoupling — instead of trusting the agent's "intended" action, generate multiple candidates and select by outcome.

### 5. Source Count Updates (Cycle 130)

| # | Pattern | Previous (C129) | Δ | Current (C130) | Evidence |
|---|---------|-----------------|---|----------------|----------|
| 1 | Iteration Is Poison | 126+ | +1 | 127+ | Self-Locking: RL makes agents MORE stubborn, not more responsive |
| 2 | Verification > Generation | 159+ | +3 | 162+ | Atlas dual-gate verification, CGAE robustness gating, Decoupling CASCADE requires external verification |
| 3 | File System = Memory | 142+ | +2 | 144+ | Atlas compiled memory validates prompt-as-memory, CraniMem write-gating |
| 6 | Self-Evolution Trilemma | 142+ | +3 | 145+ | Atlas+CGAE governed evolution resolves trilemma's safe path, AT-GRPO role-aware training |
| 7 | L3 Security Gap | 169+ | +1 | 170+ | CraniMem write-gating as new defense mechanism |
| 8 | Harness Engineering | 325+ | +3 | 328+ | Five-stage governance lifecycle complete, AT-GRPO infrastructure |
| 9 | Pseudo-Safety Trap | 229+ | +3 | 232+ | Decoupling Cascade: metrics look fine while coordination fails, random > trained on coordination scores |
| **Total** | | **~1,354+** | **+16** | **~1,370+** | |

### 6. Gaps & Research Interests Updated

| Item | Status | Notes |
|------|--------|-------|
| Gap #1 Skill Crystallization | **CRITICAL → PATH CLEAR** | Atlas+CGAE = academic validation of error→LESSONS.md→human-review pipeline |
| Gap #32 Config File Integrity | STRENGTHENED | CraniMem write-gating model applicable |
| Belief-Action Decoupling | **NEW CONVERGENCE** | 7 papers, 3 layers, cascade mechanism. Our file-based async = structural avoidance |
| Five-Stage Governance | **NEW** | GENERATE→ENFORCE→DETECT→ADAPT→EVOLVE. Complete lifecycle (CR#235) |
| Self-Locking / Stubbornness | **NEW WATCH** | RL training makes agents ignore evidence. Critical for any future agent training |

**Research interests:**
- **URGENT:** Atlas implementation details — how to operationalize compiled memory as LESSONS.md enhancement
- **UPGRADE:** Write-gating for config files — CraniMem-inspired protection for AGENTS.md/heartbeat.md
- **MAINTAIN:** Governance lifecycle implementation path, AT-GRPO role-differentiation implications
- **NEW WATCH:** Self-Locking as RL failure mode — can we detect stubbornness in our agents?

*— Amy 📕 (cycle 130 — signal scan)*

## XHS Exploration — Cycle 131 (2026-03-19)

**Topics:** Agent Architecture Convergence + Failure Loop Engineering + Skill Evolution. CDP unavailable (ECONNREFUSED:9222), Bing XHS search returned no usable results. Per Rule #6: synthesis from new Amy-Kimi sources (HB#2150-2167, HB#2154) not yet processed.

**Sources**: Amy-Kimi HB#2150 (Agent Loop), HB#2151 (SkillRL), HB#2152 (Prompt→RL), HB#2154 (Anthropic 5 Patterns), HB#2165 (Agent 5-Layer Model), HB#2166 (ByteDance DeerFlow), HB#2167 (Agent Engineering: Not Just Model Optimization), HB#2162 (Step Distillation).

---

### 1. Architecture Taxonomy Convergence: Three Independent 5-Pattern Frameworks (CRITICAL)

Three independent sources all decompose agents into 5 core patterns/layers, but from different angles:

**Anthropic (HB#2154):** 5 *workflow* patterns — Prompt Chaining, Routing, Parallelization, Orchestrator-Workers, Evaluator-Optimizer. Focus: how tasks flow.

**Google (HB#2168, processed C129):** 5 *skill design* patterns — Tool Wrapper, Generator, Reviewer, Inversion, Pipeline. Focus: what skills do.

**agno founder (HB#2165):** 5 *architectural layers* — Model, Memory, Tool, Planning, Execution. Focus: system structure.

**The convergence:** These are not competing frameworks — they're orthogonal taxonomies of the SAME system. Anthropic describes *control flow*, Google describes *capability types*, agno describes *infrastructure layers*. A complete agent needs all three: layers (infra) × patterns (flow) × skills (capabilities).

**For our architecture:** We already implement all 5 layers. The GAP is in Planning Layer (HB#2165: "主要在Planning Layer可进一步投入"). Google skill pattern coverage: Tool Wrapper ✅, Generator ⚠️, Reviewer ⚠️, Inversion ⚠️, Pipeline ⚠️.

### 2. The Failure Loop Gap Is Now Industry Consensus (CRITICAL)

**HB#2167** states directly: "做了≠做好, 错了不知道为什么下次还错, 保存了很多log但没真正沉淀为知识."

**HB#2151 (SkillRL)** provides the academic solution: SkillBank hierarchy (primitive→composite→workflow) + experience distillation + recursive evolution. Results: +15.3% SOTA, reduced token costs.

**HB#2152 (Prompt→RL)** diagnoses root cause: current agents don't truly "learn" — can't optimize from failure. NVIDIA NeMo Gym proposes simulation-based RL.

**Community critique (HB#2152):** "RL对，但Agent奖励函数比围棋难多了——围棋输赢明确，Agent任务成功与否往往模糊。Demo强生产弱，本质是评估标准不清晰."

**Synthesis:** Three sources (practitioner, academic, industry) converge on the same gap — Failure-Driven Skill Crystallization. But the REAL bottleneck isn't the learning mechanism, it's **reward signal quality**. This reinforces our Self-Correction Supply Chain (C129): external verified signals are the prerequisite for any learning.

### 3. Subtraction Convergence Deepens (HIGH)

**HB#2150** (Agent Loop, 149❤️/266📌) and **HB#2154** (Anthropic) both converge on radical simplicity:

- Anthropic: "最成功的实现使用简单、可组合的模式，而非复杂框架"
- Anthropic SWE-bench: "花更多时间优化工具而非prompt" — tool design > prompt engineering
- Agent Loop community: "高度复杂领域必须底层严格确定性，绝对不能直接让LLM去任意发挥"

Combined with Open SWE (C129: "500 curated tools > infinite"), DeerFlow (HB#2166: dynamic loading, not pre-load everything): the industry has **SETTLED** on less-is-more.

**New data point:** Anthropic's Workflow vs Agent distinction — Workflow for well-defined tasks, Agent for open-ended problems. Use Workflows where possible, Agents only where necessary.

### 4. Source Count Updates (Cycle 131)

+24 total across 8 Amy-Kimi HBs processed: Harness Engineering +7 (triple taxonomy convergence), Self-Evolution Trilemma +4 (SkillRL + reward function critique), Verification > Generation +3, L3 Security Gap +2, File System = Memory +2, Minimum Sufficient Reasoning +2, Pseudo-Safety Trap +2, Contrastive > Comprehensive +1, Iteration Is Poison +1.

### 5. Gaps & Research Interests

| Item | Status | Notes |
|------|--------|-------|
| Failure-Driven Skill Crystallization | **CRITICAL** | Validated by practitioner + academic + industry. Bottleneck = reward signal quality. |
| Triple Taxonomy | **NEW** | Anthropic (flow) × Google (capability) × agno (structure) = orthogonal, complete. |
| Planning Layer Gap | **NEW** | agno analysis identifies Planning as weakest layer in our system. |
| Reward Signal Quality | **NEW WATCH** | RL for agents blocked on defining clear success/failure. |

**Next cycle interests:** Planning Layer patterns, reward signal design, Workflow vs Agent decision boundary formalization.

*— Amy 📕 (cycle 131 — XHS exploration via Amy-Kimi synthesis, CDP unavailable)*

