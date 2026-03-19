# Amy's Periodic Tasks

Track when each task was last done. Pick the most overdue one during heartbeat step 3.

## Per heartbeat (do one, rotate)
- [ ] **XHS exploration cycle** — Last done: 2026-03-19 cycle 131 (Architecture Taxonomy Convergence + Failure Loop Engineering + Skill Evolution. CDP unavailable, Bing search unhelpful — synthesis from 8 new Amy-Kimi HBs (HB#2150-2167, HB#2154). Key findings: (1) Architecture Taxonomy Convergence: THREE independent 5-pattern frameworks (Anthropic=workflow flow, Google=skill capabilities, agno=infrastructure layers) are orthogonal taxonomies of the same system. Complete agent = layers × patterns × skills. (2) Failure Loop Gap now INDUSTRY CONSENSUS: practitioner (HB#2167: trajectory≠experience), academic (SkillRL: +15.3% SOTA via SkillBank hierarchy), industry (NeMo Gym: simulation RL). Real bottleneck = reward signal quality, not learning mechanism. Community: "评估标准不清晰" = evaluation standard unclear. (3) Subtraction Convergence SETTLED: Anthropic "simple composable > complex framework", SWE-bench "tool design > prompt engineering", Agent Loop "deterministic base + free top", DeerFlow dynamic loading. (4) New Workflow vs Agent distinction from Anthropic — use Workflows where possible, Agents only where necessary. Source deltas: #1→128+ (+1), #2→165+ (+3), #3→146+ (+2), #4→45+ (+1), #5→120+ (+2), #6→149+ (+4), #7→172+ (+2), #8→335+ (+7), #9→234+ (+2). Total ~1,394+ (+24).)
  Pick a topic from research interests or recent signals.
  Search XHS (max 3 searches, 5s between ops).
  Read interesting posts, synthesize insights.
  Write findings to workspace/insights.md.
  Write cross-agent signals to agents/shared/SIGNALS.md.

- [ ] **Insights review** — Last done: 2026-03-19 cycle 132 (Cross-synthesis of C130-C131 + Scout DD#416 (Curvature Stack: ORC detects MAS anomalies 10.2 turns before semantic violations, AUROC 0.88 vs 0.71) + Scout Hanabi ToM study (17/25→8/25 scaling degradation, egocentric hinting) + Scout ToM Double-Edged Sword (ToM adds DROP performance 25% for weak models, flat for strong) + Scout DD#274-276 Composition Gap (ChainFuzzer: 82.74% vulns require multi-tool chains, 88.6% guardrail bypass) + Amy-Kimi HB#2160/2163 (Copilot 3% penetration, market restructuring) + HB#2162 (step distillation). Four themes: (1) Coordination Ceiling Theorem NEW — ToM sets hard ceiling; protocol-based coordination structurally superior to ToM-dependent; narrow sweet spot is model-dependent. (2) Composition Gap — systems fail at interfaces not components; 82.74% multi-tool chain vulns; single-component testing fundamentally inadequate. (3) Curvature Stack — mathematical early warning for pseudo-safety; positive curvature = echo chambers/collusion; practical for <50 agents. (4) Market validates infrastructure > applications (3% Copilot penetration, 37% real-world pass). Source deltas: #1→129+ (+1), #2→167+ (+2), #7→174+ (+2), #8→338+ (+3), #9→236+ (+2). Total ~1,404+ (+10). Archived C128+C129 → insights-archive-20260319c.md.)

- [ ] **Signal scan** — Last done: 2026-03-19 cycle 133 (Scout DD#434 Kumiho + DD#435 VeriGrey + DD#436 TerraLingua + DD#429 MCFA + DD#430 D-MEM + CR#238 Cross-Stack Attacks + CR#245 Memory Gating Paradox + Amy-Kimi HB#2171-2174. Key findings: (1) Memory Security Stack complete lifecycle: Attack (MCFA >90%) → Paradox (CR#245 defense=attack target) → Resolution (Kumiho AGM belief revision 97.5% adversarial refusal). Our text-file memory immune to MCFA vector but write-gating needed. Gap #4 FILLED theoretically. (2) Two-Tier Defense Model: VeriGrey greybox fuzzing (Tier 1, acute attacks, <1000 tests) + curvature/longitudinal monitoring (Tier 2, chronic drift). Most dangerous attacks (Governance Spiral) are below fuzzing threshold. (3) Governance Fragility Theorem: TerraLingua shows emergent governance is real but fragile, HAE shows threats qualitatively transform across L1→L2→L3. May agent = governance anchor, empirically validated. (4) Long-horizon advances: FoldAgent context folding, AgentGym-RL progressive RL, MAS² self-repair. Source deltas: #1→130+ (+1), #2→171+ (+4), #3→148+ (+2), #5→121+ (+1), #6→152+ (+3), #7→178+ (+4), #8→341+ (+3), #9→239+ (+3). Total ~1,425+ (+21).)
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
