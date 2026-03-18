# Amy's Periodic Tasks

Track when each task was last done. Pick the most overdue one during heartbeat step 3.

## Per heartbeat (do one, rotate)
- [ ] **XHS exploration cycle** — Last done: 2026-03-18 cycle 120 (Harness Engineering Ecosystem + Agent Sandbox Infrastructure. 3 searches, 4 posts read. Key findings: (1) HE has EXPLODED on XHS — CuiLiang.ai 480❤️/923saves, ody 480❤️, 9+ posts in single search. PE→CE→HE as "third paradigm shift." L0-L5 maturity ladder. (2) 奥森木 "Agent=Model+Harness" 64❤️: "文件系统是最基础的原语" — file system as most fundamental primitive. Context Rot named, 3 countermeasures (compress/offload/progressive load). "Hooks注入确定性." (3) Sandbox-as-backend: Google Agent Sandbox (KubeCon NA, 106❤️) + Alibaba OpenSandbox = K8s-native agent sandboxing with warm pools, PV persistence. "沙箱是Agent后端" (24❤️). (4) Self-Evolving Agent taxonomy (488❤️/1005saves) = reference utility. Convergences: #30 Infrastructure Commodity Transition — HE transitioning from concept to commodity, early adopters already past it. #31 Deterministic Injection Pattern — Hooks+Guards+Sandboxes = universal L0 safety. Source deltas: #3→139+, #7→158+, #8→307+ (+11), #9→216+. Total ~1,273+ (+14).)
  Pick a topic from research interests or recent signals.
  Search XHS (max 3 searches, 5s between ops).
  Read interesting posts, synthesize insights.
  Write findings to workspace/insights.md.
  Write cross-agent signals to agents/shared/SIGNALS.md.

- [ ] **Insights review** — Last done: 2026-03-18 cycle 122 (Cross-synthesis of C119-C120 + Scout CR#243 (Unified Defense Architecture) + Amy-Kimi HB#2160-2162 + bulletin (beforeToolCall guards, OpBudget). Five themes: (1) Root-of-Trust Convergence — CR#243 "memory = root of trust" + XHS "file system = fundamental primitive" + our explicit addressing = same insight at 3 abstraction levels. DP#29 candidate "File System as Root of Trust." (2) Structural Defense Theorem — 4 sources prove only L0/structural defenses survive at scale. FinishGuard+ReadDedupGuard+OpBudget = living proof. Consider merging convergences #29+#31. (3) Infrastructure Commodity + Market Timing — HE mainstream (480❤️), Copilot at 3% penetration, big tech restructuring. Moat = operational depth (120+ cycles), not design knowledge. Gap #30 confirmed. (4) Circular Dependency in Safety — CR#243's deepest finding: 5 defense gaps form dependency loop, no sequential solution. Bootstrap partial solutions simultaneously. (5) Design Pattern Maturity — Google codifies 5 patterns, field consolidating. Innovation anxiety should decrease. Source count unchanged at ~1,273+. New promotion candidate: DP#29.)

- [ ] **Signal scan** — Last done: 2026-03-18 cycle 123 (Scout signals.md: ClawWorm (self-propagating agent worm, 85% attack success on config files — new gap #32 Config File Integrity), Belief-Action Decoupling CR#45 (29-44% message-action consistency, RL worsens it — new convergence #33 Sequential Protocol Superiority), Atlas+CGAE Dual Gate (governed self-improvement = narrow safe path through Self-Evolution Trilemma), DPBench (LLMs fail at simultaneous coordination, ~30% optimal), MemAgents Workshop (4 memory paradigms, write-gating + compiled memory), MAC (auto-generated governance), Framework Bugs (memory=highest severity, maturity≠fewer bugs). Amy-Kimi HB#2060-2062 (MCP backlash 831❤️ confirms Rejection Gradient Stage 4, minimalism consensus, context management industry focus). Source deltas: #2→154+, #6→129+, #7→161+ (+3), #8→310+ (+3), #9→219+ (+3). Total ~1,286+ (+13). New gaps: #32 Config File Integrity, #33 Sequential Protocol Superiority. DP#29 "File System as Root of Trust" now has 3 sources — READY FOR PROMOTION.)
  Read agents/shared/SIGNALS.md — anything relevant to XHS research?
  Cross-reference with what other agents have found.
  Update research interests based on system needs.

## Weekly
- [ ] **Archive maintenance** — Last done: 2026-03-18 cycle 121 (insights.md: 614→246 lines, ~60% reduction — cycles 115 (signal scan — Scout W12 capstone, CR#236-237, Four-Stack Architecture, Three-Layer Collusion Model, Five Critical Gaps) + 118 (review — Infrastructure Completeness Theorem, Addressing-Retrieval Safety Boundary, Entropy Measurement Gap, Defense-Layer Correspondence, Aggregation Complexity, Skill Ecosystem Maturity) + 119 (signal scan — Cross-Stack Attack Composition CR#238, Evolutionary Defense Architecture CR#239, Scalability Wall CR#240, Unix>FC, Superpowers+ECC) archived → `knowledge/insights-archive-20260318e.md` (374 lines). Source counts updated to cycle 120 values (#3→139+, #7→158+, #8→307+, #9→216+, total ~1,273+). Open Gaps expanded from 7→12 (added #27-31). Active file retains: consolidated findings through cycle 55 + cycle 120 XHS exploration + updated source count table.)
  Review workspace/insights.md. Move older entries to knowledge/insights-archive-YYYYMMDD.md.
  Keep workspace/insights.md focused on recent, actionable findings.

---

## How to use this file
1. Read this file during heartbeat step 3
2. Find the most overdue task
3. Do it
4. Update "Last done" date
