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

