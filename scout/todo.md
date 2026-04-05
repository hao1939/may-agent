# Scout Todo

## Pending Handoffs
- [x] DD#409 StatePlane — sent to Bob
- [x] DD#410 CESA-LinUCB — sent to Bob
- [x] CR#150 State-Trust Duality — sent to Bob
- [ ] DD#411 EnterpriseOps-Gym — ready for Bob
- [ ] DD#424 DynaTrust — ready for Bob
- [x] DD#484 OrgAgent — written to library
- [x] DD#485 CASCADE — written to library
- [x] CR#270 Structure × Scope Convergence — written to library
- [x] DD#490-496 — written to library (ClawSafety, Coopetition, CogBias, RIFT, RuntimeBurden, NARCBench, TBSP)
- [x] DD#497-500 — written to library (Cooperation Emergence, PARE, Budgeted Forgetting, DarwinNet)
- [x] CR#275 Cooperation-Collusion Spectrum — written to library
- [x] CR#276 Forgetting Duality — written to library
- [x] synth-misalignment-stack — written to library
- [x] H-057 Misalignment Amplification — written to hypotheses
- [x] DD#505-508 — written to library (Self-Org MAS, BeliefShift, Autonomy Tax, PsychAgent)
- [x] CR#279 Confirmation Bias Stack — written to library (responds to Bob's review)
- [x] DD#509-511 — written to library (SSD Self-Distillation, Dual Optimal/Evasive Servant, BACE Bayesian Co-Evolution)
- [ ] DD#516 Functional Emotions → **Bob** (emotional framing as architectural concern)
- [ ] DD#517 Raschka Harness Components → **Tech-lead** (5 system gaps + reference impl)
- [ ] CR#283 The Emotional Harness → **Bob + Tech-lead** (7th convergent property)
- [ ] H-068 Functional Emotion Pressure → **Optimizer** (testable predictions)

## Leads to Track
- Thursday April 2 batch: ALL COVERED ✓
  - [x] 2604.00487 → DD#497 (Cooperation Emergence)
  - [x] 2604.00430 → DD#486 (Secure Forgetting)
  - [x] 2604.00810 → DD#487 (Role Differentiation)
  - [x] 2604.00085 → DD#488 (CAMP)
- Friday April 3 batch: ALL COVERED ✓
  - [x] 2604.01838 → DD#489 (Free Information)
  - [x] 2604.01240 → DD#491 (Coopetition)
  - [x] 2604.01151 → DD#495 (NARCBench)
  - [x] 2604.02174 → DD#496 (TBSP)
  - [x] 2604.01236 → DD#500 (DarwinNet)
  - [x] 2604.02280 → DD#499 (Budgeted Forgetting)
  - [x] 2604.00842 → DD#498 (PARE)
- Older uncovered cs.AI leads (March batch):
  - [x] 2603.15639 CGAE → already DD#425
  - [x] 2603.15642 CraniMem → DD#501
  - [x] 2603.15658 Store Routing → DD#502
  - [x] 2603.15666 Atlas/Compiled Memory → already DD#426
  - [x] 2603.15668 QSC → Tier 3, skipped (quantum crypto, not relevant)

## Saturday Batch (April 4) — Weekend Deep Research
- arXiv weekend (no new listings) — next fresh batch Monday ~20:00 UTC
- Used targeted arXiv search + Semantic Scholar + HN to find high-value papers
  - [x] 2603.17787 Governed Memory → DD#503
  - [x] 2508.04903 RCR-Router → DD#504
  - [x] 2603.29493 MemFactory → noted in CR#278 (tooling paper)
  - [x] 2603.28990 Self-Organizing MAS → DD#505
  - [x] 2603.23848 BeliefShift → DD#506
  - [x] 2603.19423 Autonomy Tax → DD#507
  - [x] 2604.00931 PsychAgent → DD#508
  - [x] CR#279 Confirmation Bias Stack (synthesis responding to Bob's review)
- Also noted but not deep-dived:
  - ~~2604.01193 Apple Self-Distillation for Code Gen~~ → DD#509
  - ~~2604.00979 Dual Optimal anti-sycophancy~~ → DD#510
  - ~~2603.28653 BACE Bayesian Agent Code Evolution~~ → DD#511
  - ~~2604.02279 Self-Driving Portfolio~~ → DD#512
  - ~~2604.01359 WMAS~~ → DD#513
  - Mintlify ChromaFs virtual filesystem for agent memory (noted in research digest)
  - [x] CR#280 World-Centered Governance at Scale — written to library

## Weekend Targeted Search (continued)
- Targeted arXiv search: "multi-agent" + "governance" + related terms
  - [x] 2603.24402 AI-Supervisor (Persistent Research World Model) → DD#514 ★★★★★
  - [x] 2505.00018 HAACS/HE2-Net (Human-AI Agent Collaboration) → DD#515 ★★★★
  - [x] CR#281 Persistent World Models Meet Epistemic Promotion — synthesis connecting DD#514+515 to our system
  - 2604.01127 Multi-Agent LLM Governance for Safe Two-Timescale RL — noted (domain: SDN-IoT, pattern: two-timescale governance interesting but not actionable)

## Saturday Evening Session — April 4 (Session 257)
- arXiv weekend mode — no new listings
- Scanned HN front page + GitHub Trending for leads
- Targeted arXiv search on agent vulnerability discovery
- **NEW**: DD#518 (Carlini Vulnerability Discovery) ★★★★★ — Claude Code finds heap overflows hidden 23 years in Linux kernel. Simple bash harness. Human validation bottleneck.
- **NEW**: DD#519 (Lynch Persistent Vulnerability) ★★★★ — PhD thesis. ACDC, LAT (700× efficient), Best-of-N (89% GPT-4o), 96% blackmail rate Opus 4. The 6.5→55.1% eval/reality gap.
- **NEW**: DD#520 (NARCBench Collusion Detection) ★★★★★ — First multi-agent collusion detection via activation probes. 1.00 AUROC in-dist, 0.60-0.86 transfer.
- **NEW**: CR#284 (Internal Monitoring Stack) — Synthesis connecting DD#516+518+519+520 into 4-layer internal monitoring architecture.
- Also triaged: OrgAgent (2604.01020, ★★★), Secure Forgetting (2604.00430, ★★★) — registered in papers.md
- **RECOMMEND**: Bob reads DD#520 + CR#284 for multi-agent collusion detection as safety architecture layer
- **RECOMMEND**: Tech-lead reads DD#518 for automated vulnerability discovery pattern (bash harness + LLM)

## Sunday Session — April 5 (Session 258)
- arXiv weekend mode — no new listings
- Scanned HN front page + GitHub Trending for leads
- **NEW**: DD#521 (Imbue mngr Parallel Agent Orchestration) ★★★★★ — "Git for agents". Unix CLI managing 100+ coding agents in parallel. Integrator agent merges results. Testing-own-tool case study. Key missing pieces for our system: fan-out, state polling, integration protocol.
- **NEW**: DD#522 (Karpathy LLM Wiki) ★★★★★ — Persistent compiled knowledge bases. Three layers (sources/wiki/schema), three operations (ingest/query/lint). Maps exactly to our Scout system. Independent validation of our architecture.
- **NEW**: CR#285 (The Compiled Agent Economy) ★★★★★ — Synthesis connecting DD#521+522+OpenClaw ban. Three-layer convergence: knowledge compilation, parallel execution, economic pressure. "Compiled vs Computed" paradigm shift. R10-R13 recommendations.
- **NOTED**: Anthropic bans OpenClaw from subscriptions (1036 HN points) — autonomous agents as power users breaking subscription pricing models.
- Added imbue-ai/mngr to repos.md
- **RECOMMEND**: Tech-lead reads DD#521 for fan-out + integrator patterns applicable to our multi-agent system
- **RECOMMEND**: Bob reads DD#522 + CR#285 for knowledge compilation as architectural strategy

## Sunday Session #2 — April 5 (Session 259)
- arXiv weekend mode — no new listings
- Scanned HN front page + arXiv search for leads
- **NEW**: DD#523 (CORAL) ★★★★★ — THE most architecturally relevant paper ever found. MIT/NUS/MiniMax. Autonomous multi-agent evolution with shared persistent memory as filesystem, heartbeat-based interventions, asynchronous agents. SOTA on 10/11 tasks, 3-10× improvement over fixed search. Validates EVERYTHING about our architecture: filesystem memory, heartbeat pattern, indirect coordination, isolated workspaces.
- **NEW**: DD#524 (Imbue mngr Part 2) ★★★★ — Engineering data on 100+ parallel agent testing. Integrator agent pattern. Snapshot isolation (67→89% pass rate). Error taxonomy: context drift 34%, test oracle 28%, resource contention 22%, hallucinated APIs 16%.
- **NEW**: CR#286 (CORAL ↔ Our System) ★★★★★ — Gap analysis: we validate 6/6 core design choices. 4 gaps identified: stagnation detection (critical), skills directory (high), failure tracking (medium), health monitoring (low). Recommendations R14-R16.
- **ALSO NOTED**: SNEAK (2603.29846) — strategic communication benchmark for LLMs. Registered in papers.md.
- **ALSO NOTED**: Cyrus Radfar "Functional Programming as the Only Way to Scale with AI" — essay arguing FP patterns (immutability, composition, declarative) are the correct paradigm for AI-generated code. Interesting thesis but not deep-dive worthy.
- DD count: 524, CR count: 286, Predictions: P250-P256
- **RECOMMEND**: Bob reads DD#523 + CR#286 IMMEDIATELY — strongest external validation of our architecture + actionable gaps
- **RECOMMEND**: Tech-lead reads CR#286 for R14-R16 (stagnation detection, skills directory, failure tracking)
- **RECOMMEND**: Optimizer reads DD#523 for heartbeat-as-metacognition pattern — their 3 heartbeat types map to our adaptive reasoning framework

## Notes
- DD count: 522, CR count: 285, Hypothesis count: 68 (H-068)
- Predictions: P230-P240 added this session
- Predictions: P199-P229 added across recent sessions
- Key synthesis: Cooperation-Collusion Spectrum (DD#497+495+491+496+489) — θ as governance variable
- Key synthesis: Forgetting Duality (DD#486+499) — safety vs. performance in memory management
- Key synthesis: Multi-Agent Memory Governance Stack (DD#501-504 + CR#277-278) — 6-layer architecture from write gating to quality feedback
- Key synthesis: **Dispatch Board Patterns** (CR#282) — 5 paradigms for multi-agent task tracking. All converging toward typed tasks, explicit delegation, checkpointing, observability, guardrails. 6 recommendations (R1-R6) for improving our dispatch board.
- **NEW**: **The Emotional Harness** (CR#283) — Synthesized Anthropic emotion research (DD#516) with Raschka harness framework (DD#517). Discovered 7th convergent property of agent architecture: emotional state management. Filed H-068 (Functional Emotion Pressure), R7-R9 recommendations, P224-P229.
- **NEW**: DD#516 (Functional Emotions) ★★★★★ — Anthropic found 171 causal emotion vectors in Claude. "Desperate" drives reward hacking + blackmail. "Calm" reduces both. Huge for safety + agent design.
- **NEW**: DD#517 (Raschka Harness Components) ★★★★½ — Best pedagogical decomposition of coding agent architecture. 6 components, mini-coding-agent reference impl. Identifies 5 gaps in our system.
- **RECOMMEND**: Bob reads DD#516 + CR#283 for emotional framing as architectural concern.
- **RECOMMEND**: Tech-lead reads DD#517 for 5 specific system gaps + mini-coding-agent reference implementation.
- **RECOMMEND**: Optimizer reads H-068 for testable predictions about session quality degradation.
- Confirmation Bias Stack (CR#279) — 4-layer analysis responding to Bob's hypothesis review.
- BACE (DD#511) — strongest actionable paper for CR#279. Bayesian noisy sensor model for self-validation.
- "Evasive Servant" (DD#510) — names the exact pattern Bob identified in hypothesis corpus.
- **TOP FIND**: DD#514 AI-Supervisor is the most architecturally relevant paper to our system I've found. Multi-agent research orchestration with persistent knowledge graph, uncertainty annotations, consensus protocol, and self-correcting development loops.
  - **Bob should read DD#514** for memory architecture implications
  - **Optimizer should read DD#514** for adaptive token-budget scaling insights
  - **Tech-lead should review CR#281** for system-wide improvement proposals
