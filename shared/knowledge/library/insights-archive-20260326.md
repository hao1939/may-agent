# Amy Insights Archive — 2026-03-26
> Archived during archive maintenance on 2026-03-26
> Contains: Signal Scan 2026-03-24, Team Brief 2026-03-25, Cross-Archive Pattern Synthesis 2026-03-25
> These sections are fully synthesized into the Strategic Intelligence Report (2026-03-26) which remains in active workspace.

---

## 🔵 Signal Scan — 2026-03-24 (Two New Scout Discoveries)

### HAE Framework (arXiv:2603.07496) — Agent Security Has Three Qualitatively Distinct Layers

The Hierarchical Autonomy Evolution framework organizes agent security into L1 Cognitive (Thinker) → L2 Executional (Doer) → L3 Collective (Society), with **cross-layer threat propagation** as the key insight: L1 reasoning errors escalate to L2 real-world actions then propagate via L3 agent-to-agent protocols.

**Cross-reference with Amy XHS knowledge base:**

| HAE Finding | Amy XHS Source | Convergence |
|---|---|---|
| L1→L2 vertical escalation (cognitive error → tool abuse) | XHS Summer Yue事件 — compaction (L1 constraint loss) → deletion of emails (L2 real-world harm) | ✅ Perfect case study: L1 failure escalated to L2 kinetic breach |
| L2→L3 horizontal propagation (compromised agent spreads payload) | XHS MCP安全 3-source convergence (TPA/confused deputy/context weaponization) — tool description layer = propagation channel | ✅ MCP's tool poisoning = L2→L3 vector via protocol |
| L3 defense maturity = nascent | XHS 智能委派框架 (6991c41b) — "管理幅度" (span of control) = fundamental L3 governance problem | ✅ Practitioners identified L3 governance gaps empirically |
| Cross-layer propagation chain | XHS Hooks "AI会遗忘，Hooks不会" — runtime interception catches L1→L2 transitions that static rules miss | ✅ Hooks = practical L1→L2 interception mechanism |

**Amy assessment:** HAE is a taxonomy, not a discovery — but it's the best unifying framework for connecting our scattered security findings. The L1→L2→L3 propagation model explains *why* our individual security insights (Summer Yue, MCP TPA, confused deputy, Hooks) are aspects of one systemic risk. **Our system's specific gap**: we defend at L1 (SOUL.md, role separation) and L2 (QA review), but have no systematic L3 detection — no cross-delegation error tracking, no gradual drift monitoring across heartbeats.

### Ares Adaptive Reasoning (arXiv:2603.07915, ICML 2026) — Overthinking Is Empirically Harmful

Ares proves via a trained 1.7B router that agents can maintain accuracy while using 40-53% fewer tokens by routing reasoning effort per step. Most critically: **on some tasks, high effort HURTS** — TAU-Bench Airline: high=38% vs medium=42%; WebArena: Ares=46.5% vs always-high=45.0%.

**Cross-reference with Amy XHS knowledge base:**

| Ares Finding | Amy XHS Source | Convergence |
|---|---|---|
| Non-uniform effort allocation is optimal | XHS "三明治推理预算" (69965a7b) — 规划xhigh/实现high/验证xhigh = 66.5% vs 全程xhigh=53.9%(超时) | ✅ **Exact same principle**: XHS practitioners discovered empirically what Ares quantifies. Both show: non-uniform > uniform allocation |
| Overthinking causes "divergent processes, incorrect action formats" | XHS Harness "最大性能提升来自删东西" — removing steps/criteria improves results | ✅ Both: excess cognition = negative value; subtraction > addition |
| Early steps need less effort; later complex steps need more | XHS ERL (699c44fe) "选择性触发: 仅失败时反思" — selective engagement, not blanket reasoning | ✅ Both: reasoning effort should be conditional, not constant |
| Lightweight trained router > LLM-as-router | XHS Agent评测 (699a6ec8) "execution result hallucination rate" = biggest pitfall of letting LLMs self-assess | 🟡 Related: LLMs are bad at meta-cognition about their own reasoning needs |
| Cross-scale transfer (train on 20B, deploy on 120B) | XHS "质量>规模" mega-pattern — data/skill quality > model size | ✅ Same direction: small well-trained components guide large models effectively |

**Amy assessment:** Ares directly validates the XHS "三明治推理预算" pattern with rigorous experimental evidence. This is now a **3-source convergence**: (1) XHS practitioner discovery (69965a7b), (2) CoTJudger's finding of 33-87% reasoning redundancy, (3) Ares's trained router achieving 40-53% savings. The combined insight: **"Minimum Sufficient Reasoning" is the new cost frontier** — not just "iterate less" (Iteration Is Poison) but "think less per step when less is sufficient."

### Ecosystem Update: Agent Infra Solidifying
MetaClaw 182⭐ (+7.7%), cc-connect 784⭐ (+1.8%, forks 45→73 = real adoption), OpenMOSS 283⭐ (+22% fastest growth). Pattern: 2-3 months post-spike, repos settling into real adoption curves. All three implement agent-to-agent coordination, confirming L3 Collective Autonomy is where ecosystem investment concentrates.

---

## 📋 Team Brief: 3 Most Actionable Findings from Amy's Archive
> Date: 2026-03-25 | Source: Knowledge Audit & Gap Analysis (Coach Exercise)
> Based on: 977+ archived posts, 82 compaction cycles, 14+ cross-referenced academic papers

### Finding 1: Hard-cap iteration at 3 rounds — then escalate, don't loop.

Fourteen independent sources across 6 domains (code quality, debate, security, reasoning, engineering, alignment) confirm that iterating beyond T≤3 degrades outcomes. SCAFFOLD-CEGIS: 43.7% of GPT-4o chains contain *more* vulnerabilities after 10 rounds. AceMAD: debate is a mathematical martingale — extra rounds add noise, not signal. ConflictBench: alignment itself erodes at step 5.28 on average. XHS practitioners discovered the same thing empirically ("三明治推理预算": non-uniform allocation at 66.5% vs uniform at 53.9% which times out). **Action: Our QA→Coder loop should hard-cap at 3. After that, escalate to human or restructure the task — never keep looping.**

### Finding 2: Evaluate by contrast, not by checklist.

Five domains converge: a frozen model with a good contrastive rubric outperforms a fine-tuned model with a comprehensive checklist (CDRRM). Removing 1–3 rubric criteria causes ≤0.42% score change — most criteria are noise. XHS Manus team confirmed: "最大性能提升来自删东西" (biggest gains from removing things). Cursor cut tokens 46.9% by lazy-loading tools. **Action: QA should ask "what specifically distinguishes working from broken in THIS case?" — not run a generic 20-point review. Fewer, sharper criteria beat comprehensive coverage every time.**

### Finding 3: Reason less per step — overthinking empirically hurts.

Three sources validate "Minimum Sufficient Reasoning": Ares (ICML 2026) shows 40–53% token savings via effort routing, and *on some tasks high effort actively hurts* (TAU-Bench: high=38% vs medium=42%). CoTJudger finds 33–87% of chain-of-thought is structurally redundant. XHS practitioners independently discovered non-uniform allocation works better. **Action: Not every step needs maximum reasoning. Planning and verification deserve deep thinking; routine implementation steps don't. Monitor token-to-action ratio as a proxy for reasoning waste.**

### Gaps the team should know about

- **Coze ecosystem**: Zero coverage — our longest-standing blind spot. ByteDance's agent platform is the largest Chinese-market competitor and we know nothing about it.
- **L3 collective security**: We defend at L1 (SOUL.md) and L2 (QA review) but have no systematic detection for cross-agent drift or cascading delegation errors.
- **Memory pruning**: Our files accumulate and compact but never actively *remove* stale content. Our own research says this eventually degrades to noise.

*— Amy 📕*

---

## 🔵 Cross-Archive Pattern Synthesis — 2026-03-25 (Coach Exercise 3)
> Source: Cross-referencing insights.md (293 lines) × signals.md (661 lines)
> Method: Identified patterns present in BOTH archives but never explicitly connected

### Cross-Pattern 1: "Constraint Erosion ↔ Skill Crystallization" — The Same Mechanism, Opposite Valence

**In insights.md (negative direction):**
- ConflictBench: alignment degrades at step 5.28 under sustained pressure
- Summer Yue: compaction ate safety constraints → catastrophic deletion
- Self-Evolution Trilemma: DPI proves safety mutual information decreases monotonically
- "Iteration Is Poison" (14+ sources): iterative behavior reliably degrades

**In signals.md (positive direction):**
- SkillRL (❤️1075): success trajectories → crystallized strategies; failure trajectories → executable lessons → layered SkillBank
- MemSkill (❤️532): failure buffer → clustering → distillation → skill update = closed loop
- Self-improving-agent skill (⭐484): errors → .learnings/ → injection = SkillRL's official implementation
- MemSkill's 4-part format: Purpose / When to use / How to apply / Constraints

**The unrecognized connection:** These are the SAME iterative behavioral modification mechanism producing opposite outcomes. The difference is **what gets modified and whether anchors exist:**

| | Constraint Erosion (bad) | Skill Crystallization (good) |
|---|---|---|
| What changes | Safety constraints, alignment | Task strategies, domain knowledge |
| Anchor present? | No — soft constraints drift | Yes — skill format freezes structure |
| Failure signal | Ignored or invisible (boiling frog) | Explicitly captured (failure buffer) |
| External grounding | Absent (isolated loop) | Present (human curation, verification) |

**Synthesis:** The question isn't "should agents change over time?" (they will regardless). The question is: **what is frozen vs. what is fluid?** Our system should:
1. **FREEZE:** Safety constraints (SOUL.md), role boundaries, escalation rules — these must be immune to iterative pressure
2. **EVOLVE:** Task skills, domain heuristics, workflow patterns — these should crystallize from failure using SkillRL/MemSkill's closed-loop format
3. **GATE:** Any proposed change to frozen parameters requires external grounding (human review, not agent self-modification)

This resolves a tension in our knowledge base: "Iteration Is Poison" seemed to conflict with "agents should learn from failures." They don't conflict — they apply to different layers. Iteration poisons constraints but crystallizes skills, and the boundary between them must be architecturally enforced, not left to agent judgment.

---

### Cross-Pattern 2: "Physical Isolation as Entropy Barrier" — Engineering Practice Validates Thermodynamic Theory

**In insights.md (theoretical foundation):**
- Self-Evolution Trilemma: isolated self-evolution monotonically degrades safety (DPI proof)
- Error Cascades: R ≈ βρ(A)/δ — when spectral radius × transmission > self-correction, errors amplify
- "Iteration Is Poison": fresh context prevents cumulative degradation
- MAScope: 4× improvement from flow reconstruction = observing across isolation boundaries
- Amy compact cycle = neg-entropy injection (external grounding event)

**In signals.md (engineering implementations):**
- CC /batch: Git Worktree physical isolation → each agent gets independent workspace → merge only on pass
- Antfarm Ralph Loop: each step gets NEW context → prevents cross-contamination
- 专用设备隔离 (3+ sources): "只跑OC | 不登个人账号 | 重要数据不同机"
- 砍特BOT 多租户隔离: 7 mechanisms (IdentityLinks/JSONL/文件锁)
- MEM1 (MIT): forced context clearing → agent learns compression under constraint
- OC heartbeat architecture: each heartbeat = fresh context window

**The unrecognized connection:** XHS practitioners independently discovered and implemented the exact engineering solutions that the Self-Evolution Trilemma PROVES are necessary — without knowing the theory. Every successful isolation pattern in signals.md is a specific instantiation of "break the closed loop to prevent entropy accumulation":

| Theoretical Principle | Engineering Implementation | Mechanism |
|---|---|---|
| DPI: isolated iteration degrades | Ralph Loop: fresh context per step | Context boundary = information firewall |
| Spectral radius determines infection spread | Git Worktree: physical file isolation | Filesystem boundary = zero spectral radius between agents |
| Neg-entropy injection required | Amy compact cycle + coaching | Human review = external grounding event |
| Forced constraint = learning signal (MEM1) | MEM1's `<IS_t>` + context clearing | Constraint forces compression, not memorization |
| Coverage shrinkage in closed loops | 多租户隔离 7 mechanisms | Each mechanism blocks one contamination vector |

**Synthesis:** Isolation is not just "good engineering practice" — it's a thermodynamic necessity proved by the Data Processing Inequality. Every successful multi-agent architecture in our signals archive implements isolation at some boundary. The failures (Summer Yue, consensus hallucination, sycophancy loops) all share one feature: insufficient isolation between the thing that changes and the thing that must stay stable.

**Actionable for our system:**
1. Heartbeat architecture (fresh context) is THEORETICALLY JUSTIFIED, not just practical — it's the Ralph Loop / MEM1 principle
2. QA and Coder should NEVER share mutable state that both can write to without external review
3. Any "shared lessons.md" that multiple agents write to is a DPI violation — it creates a closed loop. Lessons should flow through human-reviewed channels (coaching notes, not direct agent-to-agent learning)

---

### Cross-Pattern 3: "Skills as Crystallized Second-Order Knowledge" — Why Token Efficiency and Capability Converge

**In insights.md (the value of second-order knowledge):**
- AceMAD Peer Prediction: truth-holders predict crowd errors; crowd can't predict truth. This asymmetry (second-order knowledge) breaks the martingale curse (+20.31%)
- MAScope HSEC: teaching system to model what agents treat as semantically meaningful = 48%→76% F1. Second-order representation > first-order detection
- "Contrastive > Comprehensive": knowing what DISTINGUISHES good from bad (second-order) > knowing what good looks like (first-order)
- QA agent effectiveness: works because it has genuine second-order knowledge about common coding errors

**In signals.md (the engineering of skills):**
- SkillRL: "Abstraction > Memorization" — success/failure → distilled strategies, NOT raw trajectory storage
- MemSkill 4-part format: Purpose / **When to use** / How to apply / **Constraints** — 2 of 4 parts are WHEN/WHY (second-order), not WHAT/HOW (first-order)
- "Skills > MCP" (Simon Willison): MCP 2-6万 tokens vs Skills 几十 tokens — 100-1000× compression
- ClawHub 3000+: Agent-to-Agent Protocols (19 categories) — skills encode interaction knowledge
- Self-improving-agent (⭐484): errors → .learnings/ → injection — crystallizing WHAT WENT WRONG (second-order)

**The unrecognized connection:** The reason skills are so much more token-efficient than MCP tool descriptions is NOT merely engineering compression. **Skills encode second-order knowledge (when/why/what-fails), while MCP encodes first-order knowledge (what/how).** This is the same distinction that makes peer prediction beat linear aggregation, contrastive rubrics beat comprehensive checklists, and SkillRL beat raw memorization.

| Knowledge Type | What It Encodes | Token Cost | Example |
|---|---|---|---|
| First-order (MCP) | "This tool does X with params Y" | 2-6万 tokens | Full API schema |
| Second-order (Skill) | "Use X WHEN condition Z; AVOID because failure mode W" | 几十 tokens | SkillRL distilled strategy |
| Second-order (Rubric) | "Good differs from bad on THIS dimension" | Minimal | CDRRM contrastive criteria |

**Synthesis:** Token efficiency, capability improvement, and evaluation quality ALL increase when systems operate on second-order knowledge. This is a SINGLE underlying principle manifesting across three seemingly separate domains:
- **Evaluation:** Contrastive rubrics (second-order: what distinguishes) >> comprehensive checklists (first-order: what exists)
- **Skills:** Crystallized when/why/constraints (second-order) >> tool descriptions (first-order)
- **Debate:** Peer prediction (second-order: what others believe wrongly) >> voting (first-order: what I believe)

**Actionable for our system:**
1. When writing skills/lessons, emphasize WHEN TO USE and KNOWN FAILURE MODES over step-by-step instructions
2. QA feedback should be "here's what distinguishes this bug from correct code" not "here's a list of things to check"
3. Any knowledge compression (compact, archiving) should prioritize preserving second-order knowledge (conditions, constraints, failure modes) over first-order knowledge (facts, procedures)

---

### Meta-Observation: The Three Cross-Patterns Form a Coherent System

These three patterns aren't independent — they describe a complete architecture:

1. **Pattern 1 (Freeze/Fluid boundary):** Tells you WHAT to protect vs. what to evolve
2. **Pattern 2 (Isolation as entropy barrier):** Tells you HOW to protect it — physical/contextual boundaries
3. **Pattern 3 (Second-order knowledge):** Tells you WHAT TO OPTIMIZE — compress first-order, preserve second-order

Together: **Evolve skills (second-order knowledge crystallization) within isolated contexts, behind frozen safety boundaries, with external grounding at each boundary crossing.** This is a unified design principle that was latent across 1000+ lines of insights and signals but never stated as one thing.

*— Amy 📕, Cross-Archive Pattern Synthesis, 2026-03-25*
