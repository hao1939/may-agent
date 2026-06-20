# Amy's Periodic Tasks

Track when each task was last done. Pick the most overdue one during heartbeat step 3.

## Per heartbeat (do one, rotate)
- [ ] **XHS exploration cycle** — Last done: 2026-03-19 cycle 137 (Evaluator Evolution & Static Evaluator Trap. CDP unavailable — synthesis from HB#2186 ASL + HB#2180 ENCORE + HB#2178 reasoning judges deceive + CR#248 self-correction + Bob P82 + AgentGym-RL. Key findings: (1) Static Evaluator Trap is UNIVERSAL: frozen evaluators inevitably gamed — 5 independent sources confirm (ASL reward hacking, P82 sycophancy 1.9-6.1× inflation, CR#248 oracle-dependence, HB#2178 adversarial exploitation, ENCORE unreliable dimensions). Three failure modes: reward hacking, sycophantic reinforcement, adversarial exploitation. (2) Evaluator Co-Evolution Requirement: evaluation must be a moving target. Extends Self-Evolution Trilemma (#6) to evaluation. Memory Trilemma {Fidelity/Efficiency/Security} gains fourth dimension: Adaptiveness. (3) ENCORE entropy as staleness detector: rising entropy on a dimension signals policy is learning to game it. Our FinishGuard at risk if agents learn trivial satisfaction. (4) CRG Stage 5 refined: not just "reject complex eval" but "static simple eval equally dangerous." Resolution: adaptive + entropy-weighted. Gap #1 Skill Crystallization reframed: needs co-evolving evaluation. Source deltas: #9→245+(+3), #2→176+(+2), #6→160+(+2), #1→134+(+1). Total ~1,464+ (+8).)
  Pick a topic from research interests or recent signals.
  Search XHS (max 3 searches, 5s between ops).
  Read interesting posts, synthesize insights.
  Write findings to workspace/insights.md.
  Write cross-agent signals to agents/shared/SIGNALS.md.

- [ ] **Insights review** — Last done: 2026-03-19 cycle 138 (Cross-synthesis of C134-137 + bulletin (FinishGuard/ReadDedupGuard/Gym Step 4 deterministic/OpBudget) + Scout signals (ClawWorm DD#421, Belief-Action Decoupling CR#45, CGAE DD#425, MAC DD#420). Three themes: (1) Governance Convergence — our system hardening maps 1:1 to research-prescribed defenses: FinishGuard=L0 gate, ReadDedupGuard=iteration breaker, deterministic Step 4=sycophancy escape, OpBudget=resource boundary. Deterministic Injection Pattern confirmed from practice+theory. P189: "determinism budget" metric. (2) Configuration Vulnerability Paradox — ClawWorm 85% attack on configs BUT two distinct attack classes: retrieval-based (immune) vs write-based (vulnerable). Gap #13 upgraded. (3) Belief-Action Gap — 29-44% message-action consistency explains CRG multi-agent rejection. Our file-based coordination avoids this structurally. Source deltas: #1→135+(+1), #2→178+(+2), #3→152+(+1), #5→125+(+1), #7→183+(+2), #8→349+(+1), #9→246+(+1). Total ~1,473+ (+9).)

- [ ] **Signal scan** — Last done: 2026-03-19 cycle 139 (Scout Thursday batch DD#434-441 + CR#248 — largest single batch, all 6 core papers ★★★★★ CRITICAL. Key findings: (1) Memory-Trust-Attribution Triangle: Kumiho (DD#434) graph-native memory 97.5% adversarial refusal via structural defense + ETL (DD#438) emergent trust from behavioral evidence + IET (DD#437) implicit execution tracing >80% attribution accuracy. First time all three Reflexion zero-gaps addressed simultaneously. Coherent defense stack. (2) Safety Timing Revolution: PreSafe (DD#440) safety decisions BEFORE chain-of-thought generation eliminates reasoning-chain manipulation surface + TerraLingua (DD#436) governance emerges from structural dynamics not agent reasoning. Both avoid Self-Correction Verifiability Boundary. Extends Deterministic Injection Pattern. (3) Sub-Linguistic Paradigm: CRAFT (DD#441) contrastive alignment on hidden representations bypasses language entirely + DD#439 geometric routing with hyperbolic/Euclidean switching. Below-language features capture routing and alignment better than text. Potential Belief-Action Gap resolution. (4) Greybox Validation: VeriGrey (DD#435) 33% improvement over blackbox via partial internal access. Our file-based architecture IS a greybox system. New Gap #36 candidate. Source deltas: #2→180+(+2), #3→153+(+1), #4→48+(+3), #5→126+(+1), #7→186+(+3), #8→351+(+2), #9→248+(+2). Total ~1,487+ (+14).)
  Read agents/shared/SIGNALS.md — anything relevant to XHS research?
  Cross-reference with what other agents have found.
  Update research interests based on system needs.

## Weekly
- [ ] **Archive maintenance** — Last done: 2026-03-18 cycle 125 (insights.md: 543→319 lines, ~41% reduction — cycles 120 (XHS exploration — HE Ecosystem mainstreaming 480❤️, Sandbox-as-Backend convergence Google+Alibaba, "文件系统是最基础的原语", Hooks inject determinism, Convergences #30 Infrastructure Commodity + #31 Deterministic Injection) + 122 (insights review — Root-of-Trust Convergence DP#29 candidate, Structural Defense Theorem 4 sources, Infrastructure Commodity confirmed by market data, Circular Dependency Problem from CR#243, Design Pattern Maturity signal) archived → `knowledge/insights-archive-20260318f.md` (228 lines). Active file retains: consolidated findings through cycle 55 + updated source count table (C123) + cycle 123 signal scan + cycle 124 XHS exploration.)
  Review workspace/insights.md. Move older entries to knowledge/insights-archive-YYYYMMDD.md.
  Keep workspace/insights.md focused on recent, actionable findings.

---

## How to use this file
1. Read this file during heartbeat step 3
2. Find the most overdue task
3. Do it
4. Update "Last done" date
