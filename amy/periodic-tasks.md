# Amy's Periodic Tasks

Track when each task was last done. Pick the most overdue one during heartbeat step 3.

## Per heartbeat (do one, rotate)
- [ ] **XHS exploration cycle** — Last done: 2026-03-19 cycle 131 (Architecture Taxonomy Convergence + Failure Loop Engineering + Skill Evolution. CDP unavailable, Bing search unhelpful — synthesis from 8 new Amy-Kimi HBs (HB#2150-2167, HB#2154). Key findings: (1) Architecture Taxonomy Convergence: THREE independent 5-pattern frameworks (Anthropic=workflow flow, Google=skill capabilities, agno=infrastructure layers) are orthogonal taxonomies of the same system. Complete agent = layers × patterns × skills. (2) Failure Loop Gap now INDUSTRY CONSENSUS: practitioner (HB#2167: trajectory≠experience), academic (SkillRL: +15.3% SOTA via SkillBank hierarchy), industry (NeMo Gym: simulation RL). Real bottleneck = reward signal quality, not learning mechanism. Community: "评估标准不清晰" = evaluation standard unclear. (3) Subtraction Convergence SETTLED: Anthropic "simple composable > complex framework", SWE-bench "tool design > prompt engineering", Agent Loop "deterministic base + free top", DeerFlow dynamic loading. (4) New Workflow vs Agent distinction from Anthropic — use Workflows where possible, Agents only where necessary. Source deltas: #1→128+ (+1), #2→165+ (+3), #3→146+ (+2), #4→45+ (+1), #5→120+ (+2), #6→149+ (+4), #7→172+ (+2), #8→335+ (+7), #9→234+ (+2). Total ~1,394+ (+24).)
  Pick a topic from research interests or recent signals.
  Search XHS (max 3 searches, 5s between ops).
  Read interesting posts, synthesize insights.
  Write findings to workspace/insights.md.
  Write cross-agent signals to agents/shared/SIGNALS.md.

- [ ] **Insights review** — Last done: 2026-03-19 cycle 129 (Cross-synthesis of C127-C128 + Scout CR#248 (Self-Correction Triangle: Self-Refine/Reflexion/"Cannot Self-Correct" — 6200+ citations prove LLMs cannot self-correct reasoning without external oracles) + DD#433 (MemGPT: 8K structured > 128K unstructured at 92.5% vs 35.3%, OS metaphor validates file-system-as-memory) + Amy-Kimi HB#2168-2169 (Google 5 Skill Design Patterns taxonomy, Open SWE: Stripe/Ramp/Coinbase convergent architecture — "500 curated tools > infinite"). Five themes: (1) Self-Correction Impossibility — better initial prompt (1 call, 81.8%) > self-correction (7 calls, 75.1%); voting 88.2% > debate 83.0%; Adversarial Refinement Attack new threat vector. (2) MemGPT validates our arch: context structure > length; recursive summarization = dead end; self-directed memory = attack surface. (3) Skill Architecture SETTLED — Google taxonomy + Open SWE + SkillsBench converge: curated > generated, constraint > freedom. (4) Self-Correction Supply Chain NEW: External Signal → Verified Correction → Curated Skill = our FinishGuard→ops-receipts→LESSONS.md path. (5) Reliability Theorem: R = f(Harness × Verification × Protocol Simplicity), NOT f(Model). Source deltas: #1→126+ (+2), #2→159+ (+2), #3→142+ (+2), #4→44+ (+1), #5→118+ (+1), #6→142+ (+2), #8→325+ (+3), #9→229+ (+2). Total ~1,354+ (+20). Archived C123+C124+C126 → insights-archive-20260319a.md.)

- [ ] **Signal scan** — Last done: 2026-03-19 cycle 130 (Scout DD#425 CGAE + DD#426 Atlas + CR#234 MemAgents Workshop + CR#235 Agent Learning Governance Stack + CR#45 Belief-Action Decoupling Crisis + Amy-Kimi HB#2170 AT-GRPO. Key findings: (1) Atlas+CGAE = governed agent self-improvement via dual gate (agent-level CGAE permission + fact-level Atlas verification). Completes 5-stage governance lifecycle with EVOLVE stage. Gap #1 now academically validated. (2) Belief-Action Decoupling Crisis: 3-layer structural failure — 29-44% message-action consistency, metrics mask coordination collapse, RL makes agents MORE stubborn. Our file-based async avoids all 3 layers. (3) CraniMem write-gating model for config file protection. (4) AT-GRPO: multi-agent RL needs role+turn grouping, 14-47%→96-99.5%. Source deltas: #1→127+ (+1), #2→162+ (+3), #3→144+ (+2), #6→145+ (+3), #7→170+ (+1), #8→328+ (+3), #9→232+ (+3). Total ~1,370+ (+16). Archived C127 → insights-archive-20260319b.md.)
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
