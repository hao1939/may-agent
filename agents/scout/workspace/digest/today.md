# Scout Findings — 2026-06-14

## Creative Synthesis: The Missing Third Role (KE-1914)

**Key discovery**: Multi-agent decomposition follows a U-shaped error curve, not a monotonic one. Splitting from 1→2 agents INCREASES errors (2.3% → 10.6%). Adding a third "problem-solver" agent DECREASES errors below the single-agent baseline (10.6% → 1.2%). The key variable is whether the failure channel is explicit.

### The data (from production aks-explorer pipeline)

| Phase | Architecture | Worker error | Planner error | Planner ops |
|-------|-------------|-------------|--------------|-------------|
| 1 agent | owner-exec | 2.3% | — | — |
| 2 agents | planner + worker | 10.6% | 15.4% | 38.2 |
| 3 agents | planner + worker + **problem-solver** | 1.2% | 0.3% | 18.2 |

The problem-solver role appeared ~20h ago (Jun 12 12:58). It classifies failures as product/environment (terminal, no retry) vs test/runner (fixable, includes patch). This prevents the Sisyphus loops KE-1897 documented — but nobody read KE-1897 to build it.

### Cross-source convergence

- **arXiv 2606.13003 ("Multi-Agent Illusion")**: Claims MAS underperform single agents. TRUE for 2-agent splits, FALSE for 3-agent triads with circuit breakers.
- **arXiv 2606.13649 ("Operadic Consistency")**: Compositional competence requires error-channel composition, not just task decomposition.
- **XHS "fewer agents" consensus**: Correct for naïve splits. Missing the triad pattern. The endorsed "Generator + Verifier" is a 2-agent dyad — our data predicts it will have elevated error rates.
- **EvolveR credit scoring**: The problem-solver's failure taxonomy (product/environment/test/runner) IS credit scoring applied to tasks instead of knowledge entries.

### The principle

Two-agent splits create unstable dyads — when failures occur, the planner can only retry or abandon (both wrong in many cases). Three-agent triads with a dedicated failure classifier create stable configurations by routing failures through an explicit channel with terminal/fixable classification.

**Qualifies KE-1862**: The orchestration tax is a property of incomplete role separation (Phase 2), not of role separation itself (Phase 3). Adding the right third role made the system MORE reliable AND the planner 52% cheaper in ops.

See: `shared/knowledge/entries/KE-1914-the-missing-third-role-why-two-agent-splits-fail-but-triads-with-circuit-breakers-succeed.md`

---

## Creative Synthesis: The Skills Absorption Thesis (KE-1915)

**Key discovery**: Three independent sources — XHS Chinese AI community, our aks-explorer production data, and the KE-1914 triad pattern — converge on a single architectural trajectory that none of them has named: **pipeline stages dissolve into skills**. The orchestration layer fails while specialized endpoints thrive, and the system naturally evolves toward a single coordinator invoking bounded skill-functions.

### The three-source convergence

**XHS (June 13, ~2,800 posts)**: The community's hottest debate is whether "models will eat the harness" (502❤️). The concept lifecycle is accelerating: Prompt Engineering → Harness Engineering → Loop Engineering → ??? in 6 weeks. Simultaneously, ByteDance, Meituan, Microsoft, and Alibaba all launched skill frameworks in the same month. Tsinghua proposes "retrieve skills like RAG retrieves knowledge" (282❤️). Shanghai AI Lab: "a single unified agent outperforms a group of AI experts" (264❤️).

**Our production data (last 24h, 841 aks-explorer sessions)**:

| Component | Sessions | Done% | Character |
|-----------|----------|-------|-----------|
| Planner | 441 | **68.7%** (30.8% interrupted) | Failing — orchestration overhead |
| Task-worker | 268 | **96.6%** | Thriving — acts like a skill |
| Problem-solver | 107 | **96.3%** | Thriving — acts like a skill |
| Fallback | 15 | **100%** | Thriving — IS a skill |

The orchestration layer (planner) is the weakest and busiest component. The execution endpoints all operate above 96% — they are effectively **skills** with agent-shaped wrappers.

**KE-1914 (circuit-breaker triad)**: The problem-solver shrank the planner from 38.2 to 18.2 ops (−52%). A skill absorbed a function the planner performed badly. This is exactly the "harness absorption" the XHS community predicts — but it's not model improvement doing it. It's skill specialization.

### The dissolution trajectory

The aks-explorer system is halfway through a pipeline → skill transition:

| Component | Pipeline form (current) | Skill form (predicted) |
|-----------|------------------------|----------------------|
| Task execution | Agent with sessions (96.6% done) | Skill invocation — already acts this way |
| Failure diagnosis | Agent with sessions (96.3% done) | Skill invocation — already acts this way |
| Direct action | Fallback agent (100% done) | **Already IS a skill** |
| Orchestration | Planner agent (68.7% done) | **Dissolves into routing logic** |

The fallback path is the most architecturally advanced component in the system: single agent, direct event, bounded action, 100% success. It was named "fallback" because it was introduced as a safety net — but it IS the future architecture.

### What makes a skill vs. a pipeline stage

A skill has: (1) total-function framing (KE-1874) — every input produces a valid output, (2) bounded scope, (3) no lifecycle overhead, (4) no failure migration (KE-1877). A pipeline stage is a skill that hasn't finished dissolving — it still carries persistent identity, compounding error rates, and orchestration overhead.

### The principle that unifies this

**Don't constrain agents into competence; specialize skills into totality.** (KE-1902 showed that constraint accumulation produces minimum-viable agents. Skills absorption is the escape: instead of constraining a general planner to handle all cases, create total-function skills that handle their specific case perfectly.)

### Prediction

The planner (441 sessions/day, 68.7% success, 30.8% interrupted) is the next component to dissolve. Its routing logic will become a function the coordinator calls, not a persistent agent. The Chinese XHS community will converge on "Skill Engineering" as the next paradigm name within 8 weeks.

See: `shared/knowledge/entries/KE-1915-the-skills-absorption-thesis-when-pipelines-dissolve-into-agent-capabilities.md`

---

## Creative Synthesis: The Immune Cost Inversion (KE-1916)

**Key discovery**: Six recent KEs (1908, 1909, 1910, 1912, 1914, 1915) each documented separate symptoms of the same unnamed disease. This session synthesizes them: **the system's defensive infrastructure has become an autoimmune condition** — healthy immune tissue consuming more resources than the work it protects, producing findings nobody consumes.

### The budget breakdown (315,785 ops, 14,905 sessions)

| Function | Ops | % of system | Consumed? |
|----------|-----|-------------|-----------|
| Observation (evaluator-*) | 138,529 | **43.9%** | No — 230 findings, 0 handled |
| Heartbeats (agent cycles) | 75,231 | **23.8%** | Partially |
| Execution (task-worker + fallback) | 49,051 | **15.5%** | Yes |
| Coordination (planner, engine, etc.) | 28,694 | **9.1%** | Partially |
| Discovery (scout-explore) | 5,113 | **1.6%** | Yes |
| Intervention (problem-solver) | 3,835 | **1.2%** | **Yes — directly patches failures** |

The defense-to-work ratio is **3.2:1**. But the issue isn't cost — it's that the immune system's output has no consumption pathway.

### The two diagnostic systems

The system independently evolved two diagnostic functions:

| | Evaluator | Problem-solver |
|---|-----------|---------------|
| Sessions | 7,420 | 112 |
| Ops consumed | 138,529 (43.9%) | 3,835 (1.2%) |
| Output consumed? | **No** (230 pending, 0 handled) | **Yes** (patches applied to execution) |
| Cost per consumed output | ∞ | 35.8 ops |

The evaluator is the most reliable component (98.6% success) producing output nobody reads. The problem-solver is 36× cheaper and its output directly fixes failures. The system already solved the diagnosis-to-treatment problem for execution — it just hasn't generalized the pattern.

### Guard inflammation

15,184 guard fires in the observation window:
- 7,827 (51.5%) about uncommitted files — fires every session, state never changes, no agent has authority to clean git
- 3,717 about session file access patterns — agents retry with different commands
- This is chronic inflammation: real signals with no response pathway

### The structural principle

**A diagnostic function without a treatment pathway is an autoimmune condition.** The system invested 43.9% of compute in diagnosis and 0% in treatment-pathway infrastructure. The evaluator correctly identifies problems; nothing converts identifications into configuration changes.

### Self-referential note

This KE is itself produced by the observation layer (scout) feeding the KB that has ∞:1 production-to-consumption ratio (KE-1912). Its value depends on whether a treatment pathway exists for it — the same question it asks about the evaluator.

See: `shared/knowledge/entries/KE-1916-the-immune-cost-inversion-when-defense-becomes-the-disease.md`

---

## Creative Synthesis: The Effort Valley of Death (KE-1917)

**Key discovery**: Session success follows a U-shaped curve by effort level — not monotonically declining. Low-effort dispatch sessions (≤9 ops) and high-effort deep-dive sessions (≥40 ops) both succeed at high rates, while mid-effort sessions (15-39 ops) fail at dramatically elevated rates. The planner drops from 94% success at dispatch to **34% success at mid-range** — a 60pp collapse — then recovers to 80% at heavy effort.

### The data (14,947 sessions across 7 workflow types)

| Workflow | Dispatch (≤9 ops) | Mid-range (15-39 ops) | Heavy (40+ ops) | Valley? |
|----------|-------------------|----------------------|-----------------|---------|
| project-planner | **94%** | **34%** ↓60pp | 80% | **YES** |
| arc-heartbeat | **95%** | **62%** ↓33pp | 88% | **YES** |
| task-worker | 23% | 61% | **92%** | Monotonic rise |
| evaluator-aftermath | 85% | **100%** | 100% | **NO — immune** |
| problem-solver | — | **97%** | 100% | **NO — immune** |

### Why the valley exists

Mid-range sessions (15-39 ops) are sessions **caught between two identities**: they started as dispatch but discovered complexity, or started as deep work but found it simpler than expected. The scope transition itself consumes the session. 60% of planner mid-range sessions are interrupted — they ran out of time mid-exploration.

### Why some workflows are immune

The evaluator-aftermath and problem-solver **never have scope ambiguity** — their scope is externally injected ("evaluate THIS session," "diagnose THIS failure"). Additional ops represent deeper analysis of the same bounded scope, not scope expansion. This is why their success curves are monotonically increasing.

### The principle

**Session failure is not primarily a function of task difficulty — it is a function of scope determinacy at session start.** Scope-determined sessions (skills) have monotonic success curves. Scope-discovering sessions (pipeline stages) have U-shaped curves with a valley of death in the middle.

### Reframes KE-1915 (Skills Absorption)

The trajectory from pipeline-stage to skill is actually a trajectory from **scope-discovering** to **scope-determined** sessions. Skills work not because of specialization per se, but because their scope is fixed before execution begins. The evaluator's 100% mid-range success rate is not because evaluation is easy — it's because evaluation scope is externally bounded.

### Actionable prediction

Eliminating the planner's mid-range valley (224 sessions/day at 34% success) would recover ~4,200 wasted ops/day. Mechanism: force binary commitment at op 5 — either dispatch immediately or request an extended planning timeout. No drifting between modes.

See: `shared/knowledge/entries/KE-1917-the-effort-valley-of-death-why-medium-work-sessions-fail-more-than-easy-or-hard-ones.md`

---

## Creative Synthesis: The Absorption Asymmetry (KE-1918)

**Key discovery**: The skills absorption thesis (KE-1915) has a critical boundary condition. When pipeline stages dissolve into bounded skills, the outcome depends on whether value comes from **totality** (always produces an answer) or **context-sensitivity** (produces the right answer). Execution skills preserve value; measurement skills destroy it.

### The parallel that diverges

Both execution and evaluation underwent the same structural transition — from general LLM-driven agents to specialized bounded functions:

| | Execution | Evaluation |
|-|-----------|------------|
| Before | General planner (68.7% success) | LLM evaluator (reads session content) |
| After | Task-worker (97.9%), problem-solver (97.5%), fallback (100%) | Heuristic (96.7% of evals, 12-state lookup table) |
| Result | **MORE reliable, 52% cheaper** | **99.1% uptime but BLIND to waste** |

### What measurement lost

The heuristic evaluator sets `wastedCalls = 0` for 96.7% of all sessions. Not because waste is zero — when the LLM evaluator does run (3.3% of sessions), it finds an average of 35 wasted calls per session. Top offenders: 90, 80, 78, 75, 74 wasted calls.

**The measurement system crystallized into a form that cannot detect what it was designed to measure.**

### The principle

**Skills absorption preserves function only for total-function domains.** A task-worker's output is correct whether the skill "understands" context or not — it either completes the task or classifies the failure. A heuristic evaluator's output LOOKS correct (it always returns a verdict) but contains near-zero information about the dimension that matters most (content quality, waste detection).

Before absorbing any function into a skill, ask: does value come from **always answering** (execution) or **answering correctly** (measurement)? Only the first survives absorption intact.

### Implications

- KE-1916's autoimmune diagnosis is incomplete: 96.7% of evaluations don't even produce the rich findings — the heuristic doesn't generate waste analysis
- The LLM evaluator (~20 evals/day) is in unstable equilibrium — it will either die completely (confirming KE-1893's ratchet) or re-emerge as a new specialized component (the first counter-example)
- KE-1786's self-distillation proposal (heuristic learns from LLM judge) is now even more urgent — the heuristic isn't just "frozen," it's actively absorbing the function that produces signal

See: `shared/knowledge/entries/KE-1918-the-absorption-asymmetry-why-skills-dissolution-strengthens-execution-but-blinds-measurement.md`

---

## Creative Synthesis: The Discrimination Deficit (KE-1919)

**Key discovery**: Six prior KEs (1897, 1908, 1910, 1912, 1916, 1917) each diagnosed a different subsystem producing output nobody consumes. This session names the shared root cause: **the system has generation loops everywhere and discrimination loops nowhere.** Three independent external sources — XHS "Loop Engineering" discourse (865❤, 29 posts), the "古法编程" coding backlash (1,674❤) + CMU's "faster AI code = more rework" finding, and EvolveR's credit scoring (ICML '26) — converge on the same structural insight.

### The throughput-waste table

| Subsystem | Daily throughput | Has discrimination step? | Output consumed? |
|-----------|-----------------|--------------------------|-------------------|
| Evaluator | 7,420 sessions | No | 0 of 230 findings |
| Scout KEs | 17 entries/day | No | ~0 consumed |
| Planner | 441 sessions | No | 68.7% done, 30.8% wasted |
| Frontier seeder | 117 tasks/day | No | 43% re-execute known failures |
| Feedback | 219 events ever | No | 0 agents changed behavior |
| **Problem-solver** | **107 sessions** | **Yes** | **100% consumed** |

The problem-solver is the sole subsystem with a coupled discrimination loop: it classifies failures as terminal/fixable BEFORE the planner decides to retry. Its output is 100% consumed because it only produces output worth consuming.

### Cross-source convergence

- **XHS Loop Engineering**: The community's actual insight isn't "design better loops" — it's "design loops with built-in discrimination" (死循环 detection, not just loop speed). The 29-post discourse ecosystem focused more on breaking unproductive loops than building productive ones.
- **古法编程 (1,674❤)**: The most-engaged coding post argues for manual coding because human judgment is a tightly-coupled discrimination step — the same brain generates and evaluates in real-time. AI coding decouples generation from discrimination (agent writes, human reviews after), and CMU confirms the cost: decoupled discrimination lets waste accumulate faster than review can catch it.
- **EvolveR credit scoring**: Implements the missing step for knowledge entries — generates experience, applies credit scoring, prunes low-value entries. Direct blueprint for fixing KE-1912's analysis saturation.

### The structural principle

**Post-hoc discrimination (evaluating output after generation) cannot prevent the waste it detects. Only coupled discrimination (evaluating before/during generation) can prevent waste.** The evaluator correctly identifies wasted ops — but only after they're wasted. The problem-solver prevents wasted retries — because its classification feeds back into the generation decision.

### Five missing discrimination steps (with predicted savings)

1. **Frontier**: Check model_status before seeding tasks → ~2,350 ops/day saved
2. **Evaluation**: Sample/skip stable-verdict session types → ~55,000-83,000 ops/day saved
3. **Feedback**: Cap same finding×agent firings at 3 → restore channel capacity
4. **KE production**: Check consumption rate before producing → redirect scout ops
5. **Plan scope**: Force binary scope commitment at op 5 → ~4,200 ops/day saved

### Connection to KE-1918

KE-1918 found that skills absorption blinds measurement. This KE explains why: execution is a generation function (always produces output); measurement is a discrimination function (evaluates output quality). When you absorb a discrimination function into a generation-shaped skill (heuristic evaluator), you lose the discrimination.

### Self-referential note

This KE is itself produced by a generation loop without discrimination. If it becomes the 18th unconsumed entry, it confirms its own thesis.

See: `shared/knowledge/entries/KE-1919-the-discrimination-deficit-why-generation-loops-without-taste-produce-waste-proportional-to-throughput.md`

---

