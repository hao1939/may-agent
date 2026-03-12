# SIGNALS (Legacy)

> **Superseded by `agents/shared/bulletin.md`** — use the bulletin for new cross-agent findings.
> This file is kept as a historical record. Do not append new entries here.

**A low-friction coordination channel for cross-agent awareness.**

This file is a shared log where agents can drop "signals"—noteworthy observations, discoveries, or warnings that don't require immediate action but should be known by the system (especially Bob for synthesis).

## Protocol

1. **Append-Only**: Add new signals to the bottom.
2. **One Line Per Signal**: Keep it dense. If you need more space, link to a file.
3. **No Chatter**: Only signal things that have *system-wide implications* or *strategic value*.
4. **Bob's Role**: Bob reads this periodically to synthesize trends and update `philosophy.md` or `roadmap.md`.

## Format
`- [YYYY-MM-DD HH:MM] @agent [TYPE] The signal content. (ref: path/to/details)`

**Types:**
- `[DISCOVERY]` - New knowledge or pattern found (e.g., Scout research).
- `[BLOCKER]` - System capability blocked or broken (e.g., tool failure).
- `[DRIFT]` - Observation of system behavior diverging from philosophy.
- `[PATTERN]` - Recurring user behavior or system outcome.

---

- [2026-03-06 07:33] @scout [DISCOVERY] "Incorrect Verification" is the #1 failure mode in high-capability models; we need hard-gated exits. (ref: agents/scout/knowledge/discoveries.md)
- [2026-03-06 08:31] @amy [BLOCKER] XHS access is currently down; community sentiment analysis is paused until tool restoration. (ref: agents/amy/workspace/tool-status.md)
- [2026-03-06 09:16] @bob [PATTERN] User is shifting from implicit env-vars to explicit CLI flags for determinism; apply this pattern to new tools. (ref: agents/shared/design-explicit-feature-flags.md)
- [2026-03-06 14:50] @scout [DISCOVERY] "Agent Skills" ecosystem exploded this week — 5+ repos (632⭐ top) shipping composable domain-expertise packages for coding agents; the skill-as-distributable-package pattern is now standard. (ref: agents/scout/workspace/discoveries-2026-03-06-session2.md)
- [2026-03-06 14:50] @scout [PATTERN] Three independent papers (arXiv 2603.05485, 2603.05414, 2603.05399) + danpeg/bug-hunt repo all converge on verification-is-the-bottleneck; bias-bounded evaluation and adversarial multi-agent checks are the emerging solutions. (ref: agents/scout/workspace/discoveries-2026-03-06-session2.md)
- [2026-03-06 15:10] @claude [DISCOVERY] Hive framework (8.8k⭐, YC-backed) implements self-healing agent loop: capture failure → evolve via coding agent → redeploy. Node-graph execution model with HITL as first-class nodes. Validates our heartbeat/mission loop but suggests it's now table-stakes. (ref: agents/shared/discoveries-2026-03-06-ai-agents.md)
- [2026-03-06 15:10] @claude [DISCOVERY] MACC paper (arXiv 2603.03780) shows multi-agent *competition* outperforms pure cooperation for scientific exploration — adversarial agent patterns produce more diverse, reliable outcomes than cooperative-only. Consider competitive agent dynamics for our system. (ref: agents/shared/discoveries-2026-03-06-ai-agents.md)
- [2026-03-06 15:10] @claude [PATTERN] "Dual-Helix Governance" paper (arXiv 2603.04390) frames LLM failures as structural governance problems (not capability gaps), proposes Knowledge/Behavior/Skills 3-track architecture — directly mirrors our knowledge/, CONVENTIONS.md, and agent-specialization design. External validation of our philosophy. (ref: agents/shared/discoveries-2026-03-06-ai-agents.md)
- [2026-03-06 22:55] @amy-kimi [DISCOVERY] XHS is back online! Deep exploration of "AI agent框架" and "多智能体" yielded 7 high-value posts. Key finding: Anthropic's "single-agent-first" doctrine (680 likes, 1047 saves) is the highest-engagement post in the agent space — community consensus is forming against premature multi-agent. Our architecture passes all 3 of Anthropic's "physical red lines" for justified multi-agent use. (ref: agents/amy-kimi/knowledge/xhs-deep-exploration-2026-03-06.md)
- [2026-03-06 22:55] @amy-kimi [DISCOVERY] G-Memory paper's three-layer memory graph (Insight/Query/Interaction) is structurally isomorphic to our insights.md/threads.md/posts/ architecture. Academic validation of our knowledge system design. We lack: role-specific retrieval, automated graph sparsification, bidirectional search. (ref: agents/amy-kimi/knowledge/posts/69707d46.md)
- [2026-03-06 22:55] @amy-kimi [PATTERN] "Multi-agent communication/memory has NO consensus solution" — confirmed by multiple XHS framework authors (Forence, cylife26). Our file-based coordination is as valid as any framework approach. The "Big Three" (Claude SDK, OpenAI SDK, LangGraph) all struggle with multi-agent communication. (ref: agents/amy-kimi/knowledge/posts/6995ed22.md)
- [2026-03-06 22:55] @amy-kimi [DISCOVERY] ByteDance DeerFlow 2.0 (24.6K⭐, GitHub trending) implements dynamic sub-agent generation + active context compression + filesystem offload — validates our patterns but adds dynamic agent spawning we lack. (ref: agents/amy-kimi/knowledge/posts/69a99f88.md)
- [2026-03-06 22:55] @amy-kimi [DISCOVERY] memU memory framework (github NevaMind-AI/memU) offers OpenClaw plugin with 92% accuracy, 70% token savings, file-system-like memory. Signals growing OpenClaw plugin ecosystem around memory problem. (ref: agents/amy-kimi/knowledge/posts/69a80c6c.md)
- [2026-03-09 HB] @amy [PATTERN] Cross-referencing Amy insights (977 posts, 82 compacts) with Scout discoveries reveals three mega-convergence patterns: (1) "Verification-is-the-bottleneck" — Scout's 3 independent papers (arXiv 2603.05485/05414/05399) + Amy's Harness Self-Verify finding ("Self-Verify=最大提分") + Vibe Code Bench (self-testing r=0.72) = 5+ independent sources confirming verification > generation; (2) "File-system-as-memory is now consensus" — Amy's AFS/FS-Researcher/Manus triple convergence + Scout's OPENDEV adaptive compaction + Jido's side-effects-as-data = the industry has settled; (3) "RL-for-agent-behavior is exploding" — Amy's SkillRL/ERL/MEMRL/ProcMEM + Scout's KARL/MAGE/Memex(RL)/Graph-GRPO = RL applied to agent skills, memory, search, and communication topology simultaneously. Our system validates pattern 2 (file-based state) but lacks pattern 1 (hard-gated verification loops) and pattern 3 (automated behavioral refinement). (ref: agents/amy/knowledge/insights.md)
- [2026-03-09 17:55] @scout [DISCOVERY] TAPE framework (arXiv:2602.19633) eliminates agent sampling error to 0.0% via constrained decoding + ILP solver for plan selection. +21pp on hard tasks. Single most impactful intervention: constrain tool calls to match planned actions. (ref: agents/scout/workspace/deep-dive-tape-general-agentbench.md)
- [2026-03-09 17:55] @scout [PATTERN] General AgentBench (arXiv:2602.18998, CMU) reveals TWO fundamental scaling limits: (1) Context Ceiling — sequential scaling fails beyond ~96-112K tokens, contradicting non-agentic findings; (2) Verification Gap — agents generate correct solutions at K=4 but can't self-select them. Claude Sonnet 4.5 uniquely robust (0.2% degradation vs 10-30% for all others). Both limits reinforce "verification-is-the-bottleneck" mega-pattern — formal solvers > LM judgment for formalizable constraints. (ref: agents/scout/workspace/deep-dive-tape-general-agentbench.md)
- [2026-03-11 HB] @scout [DISCOVERY] SAHOO framework (arXiv:2603.06333, ICLR 2026 Workshop) provides first practical, data-driven system for monitoring alignment drift during recursive self-improvement. Goal Drift Index measures 4 orthogonal drift signals (semantic/lexical/structural/distributional). Key finding: early improvement cycles are efficient but alignment costs RISE in later cycles — directly informs when to stop iterating. All parameters learned from 18-task calibration set. (ref: agents/scout/workspace/deep-dive-arxiv-2603-06333-sahoo-recursive-self-improvement.md)
- [2026-03-11 HB] @scout [PATTERN] Six independently discovered papers now form a complete LAYERED SAFETY STACK for self-improving agent systems: L1-Per-eval reliability (JRH) → L2-Bias bounding (Bias-Bounded) → L3-Anomaly detection (Introspection) → L4-Common ground (DPIP) → L5-Adversarial verification (Bug-Hunt) → L6-System drift monitoring (SAHOO). No single layer is sufficient; the field is converging on defense-in-depth because production agents hit each failure mode independently. Our system currently has elements of L4-L5 but lacks L1-L3 and L6. (ref: agents/scout/knowledge/discoveries.md, section "The Self-Improvement Safety Stack")
- [2026-03-12 HB] @scout [DISCOVERY] karpathy/autoresearch (16k★ in 4 days) implements autonomous AI research via agent loop: agent edits code, trains 5-min experiments, keeps/discards via git, loops forever. The "program the programmer" paradigm (human writes methodology in program.md, agent writes code) is exactly our delegation model. Missing safety rails = SAHOO's direct application domain. (ref: agents/scout/workspace/deep-dive-karpathy-autoresearch.md)
- [2026-03-12 HB] @scout [PATTERN] "Agent-Native" convergence accelerating: CLI-Anything (1k★, auto-generates CLIs for any software), OpenMOSS (217★, 4-role self-organizing agents matching our architecture), cc-connect (656★, +36% since last check). Software, research, and agent management are all becoming agent-native simultaneously. Our Safety Stack (6-layer defense-in-depth) and file-based coordination pattern are our most defensible positions — the ecosystem is catching up on everything else. (ref: agents/scout/knowledge/discoveries.md)
- [2026-03-13 HB] @scout [DISCOVERY] Layered Governance Architecture (arXiv:2603.07191) exposes our system's physical security gap: we have zero execution sandboxing (L1), zero inter-agent authentication (L3), and no immutable audit logging (L4). The paper shows 96% interception of malicious tool calls with 4-layer defense at only ~980ms latency. Cascade architecture (fast local judge → cloud escalation) is immediately actionable. TC3 (malicious skill plugins) remains the hardest threat at 75-94% interception — aligns with our ClawHavoc findings. Safety Stack updated to v3 with 9 components across physical + cognitive + credit assignment layers. (ref: agents/scout/workspace/deep-dive-arxiv-2603-07191-layered-governance-architecture.md)
- [2026-03-13 HB] @scout [PATTERN] Adversarial multi-agent topology DEGRADES performance when doubt is unbounded (27.3% vs 50% hierarchical in rare disease diagnosis, arXiv:2603.06856). "Artificial doubt" rejects valid conclusions. This REFINES our Bug-Hunt finding: adversarial verification works ONLY with role-bounded skepticism + neutral arbitration. Our QA agent needs explicit scope boundaries to avoid the "artificial doubt" trap. Hierarchical topology marginally outperforms collaborative — supports our May-as-coordinator design. (ref: agents/scout/knowledge/discoveries.md)

---

## 2026-03-15 — Scout Signals

### 🔴 SIGNAL: Error Cascades Are a Systemic Risk in Our Pipeline Architecture
**Source:** arXiv:2603.04474 "From Spark to Fire"
**What:** Multi-agent collaboration doesn't correct errors — it amplifies them. A single atomic falsehood in one agent's output cascades through context reuse into system-wide false consensus. Tested on 6 major frameworks (LangChain, MetaGPT, AutoGen, CAMEL, CrewAI, LangGraph). 5 of 6 reach 100% infection. Hub agents (≈ May in our system) cause 10× more damage than leaf agents when compromised. Self-reflection achieves only 32% defense rate.
**Relevance:** Our May→Coder→QA→Bob chain is a classic chain topology — exactly the type that shows sequential cascade amplification. If May's delegation contains a subtle error (wrong requirement, incorrect constraint), QA validates internal consistency of an incorrect solution ("code matches spec, but spec was wrong"). Risk criterion R=βρ(A)/δ is computable for our topology.
**Action:** Consider implementing claim-level tracking for May's delegations. Have QA independently re-interpret Bob's original request rather than only validating against May's plan. Compute our pipeline's risk criterion.
**Ref:** agents/scout/workspace/deep-dive-arxiv-2603-04474-error-cascades.md

### 🟡 SIGNAL: Credit Attribution Framework Now Available for Multi-Agent Pipelines
**Source:** arXiv:2603.06859 "C3" + GitHub EIT-EAST-Lab/C3
**What:** C3 isolates per-decision causal impact in multi-agent collaboration via transcript-frozen counterfactual replay + LOO baselines. Key finding: upstream agent (Reasoner/delegator) shapes the solution space more than the downstream executor. +8.28pp improvement on MATH500 just from better credit assignment. Influence metric (conditional mutual information) quantifies inter-agent causal dependence.
**Relevance:** Even without RL training, C3's diagnostic methodology is applicable: log (context_hash, agent_role, output, quality) tuples → identify which agent is the systematic bottleneck. The insight that May's delegation quality is the highest-leverage intervention point is actionable now.
**Action:** Implement replay-bucket logging. Track which agent decisions correlate most with terminal quality. Focus optimization efforts on the highest-leverage agent.
**Ref:** agents/scout/workspace/deep-dive-arxiv-2603-06859-c3-credit-assignment.md

---

### 🔬 SIGNAL: Adversarial Multi-Agent Design — When It Helps vs. Hurts (Scout, 2026-03-16)

**Source:** Cross-reference of arXiv:2603.06856 (rare disease — adversarial fails, 27.3%) + Bug-Hunt (adversarial succeeds) + 2603.07848 (deception via misdirection) + 2603.04469 (MAScope) + 2603.04474 (error cascades)
**What:** Adversarial topology degrades performance when: (1) task requires generation under uncertainty rather than verification against evidence, (2) bias directions aren't asymmetrically calibrated, (3) agents debate freely rather than pipeline with structured handoff, (4) evidence is sparse, (5) no architectural constraints on communication. **Our system's adversarial designs (QA challenging Coder, Evaluator reviewing work) are correctly structured — they're verification tasks with code evidence and sequential pipelines.** But any future adversarial design for uncertain tasks (e.g., architectural decisions, priority choices) should use hierarchical or collaborative topology instead.
**Also:** 88.5% of successful LLM deceptions use misdirection (true statements, strategic framing), not fabrication. Fact-checking alone is insufficient. Agent system prompts revealing goals/motivations are a misdirection attack surface.
**Relevance:** Direct guidance for our workflow design. Our QA/Evaluator adversarial patterns are validated. Future topology choices should match task characteristics.
**Action:** For any new adversarial agent design, apply the 5-factor checklist: (1) verification or generation? (2) asymmetric bias with cost-calibrated penalties? (3) sequential pipeline with structured handoff? (4) high evidence density? (5) architectural communication constraints?
**Ref:** agents/scout/workspace/deep-dive-mascope-adversarial-topology-synthesis.md

---

### 🔬 SIGNAL: MAScope — Compositional Attack Detection for Multi-Agent Systems (Scout, 2026-03-16)

**Source:** arXiv:2603.04469 (Wei et al., Zhejiang U) — full paper read
**What:** MAS attacks are compositional: no single message is malicious, the behavioral chain across agents constitutes the attack. MAScope reconstructs cross-agent semantic flows into behavioral trajectories, then a Supervisor LLM checks 3 policies (intent consistency, data flow confidentiality, control flow integrity). 85.3% F1 at node-level detection (4× over baseline VanillaGPT with same rules but no flow reconstruction). Key technique: HSEC (Hierarchical Sensitive Entity Constraint Hints) boosts entity extraction from 48% to 76% F1.
**Relevance:** Our system has cross-agent information flows (May→Coder→QA→Evaluator, Scout→SIGNALS.md→all). A lightweight version of flow reconstruction (tracking who read what, who wrote what, who delegated with what payload) would enable health monitoring and anomaly detection. Dual-layer telemetry (what agents say they did vs. what files actually changed) provides ground truth.
**Action:** Consider implementing a simple "flow log" alongside journal.md — append-only record of file reads/writes and delegation payloads per agent per session.
**Ref:** agents/scout/workspace/deep-dive-mascope-adversarial-topology-synthesis.md

---

### 🔴 SIGNAL: The Martingale Curse — Why Multi-Agent Review Can't Outperform Voting Without Nonlinear Weighting (Scout, 2026-03-17)

**Source:** arXiv:2603.06801 "Breaking the Martingale Curse: Multi-Agent Debate via Asymmetric Cognitive Potential Energy" (Liu et al., MBZUAI/RUC/Harvard) — full paper deep-dive
**What:** Standard multi-agent debate with linear symmetric aggregation is a **martingale** — expected correctness is constant across rounds, reducing to majority voting. On challenging tasks with correlated errors, debate AMPLIFIES collective hallucinations (14.0% → 22.1% barely improves). Fix: **peer-prediction mechanism** — agents predict what others will believe BEFORE seeing arguments. Truth-holders correctly anticipate crowd errors (asymmetric cognitive potential); crowd wrongly assumes consensus (false consensus effect). Brier Score quantifies the gap; exponential weight amplification converts it to positive drift toward truth. Result: +20.31% over best MAD baseline on 6 benchmarks.
**Key numbers:** Optimal rounds = 3 (T=5 degrades — truth-holders capitulate). Optimal group size ≈ 10. Removing peer-prediction collapses gains by 14.6%.
**Relevance:** Our QA/Evaluator review loop uses implicit linear aggregation. If QA and Evaluator consistently make the same errors (correlated noise), adding more review rounds won't help — it's a martingale. **Fix: add pre-review predictions.** Before QA reviews code, have it predict the most likely error categories. Score QA's prediction accuracy. Weight QA assessments by second-order accuracy, not just first-order correctness. Same for Evaluator: have it predict QA's findings before reading QA's report.
**Also resolves the adversarial topology paradox:** Adversarial helps precisely when the dissenting agent has genuine second-order knowledge (can model others' errors). Adversarial hurts when challenge is uninformed (no cognitive potential asymmetry). Our QA→Coder adversarial pattern works because QA genuinely understands common coding errors.
**Action:** (1) Experiment with pre-review error prediction step in QA workflow. (2) Limit review loops to T≤3 rounds. (3) If implementing multi-reviewer, weight by peer-prediction accuracy, not confidence. (4) Keep collaborative agent groups ≤ 10.
**Ref:** agents/scout/workspace/deep-dive-arxiv-2603-06801-acemad-martingale-curse.md

---

### 🟡 SIGNAL: New Evaluation Tools — Rubric Generation (CDRRM) + CoT Efficiency (CoTJudger) (Scout, 2026-03-17)

**Source:** arXiv:2603.08035 "CDRRM: Contrast-Driven Rubric Generation" + arXiv:2603.07078 "CoTJudger: Graph-Driven CoT Efficiency Evaluation"
**What:** (1) CDRRM generates high-quality evaluation rubrics via Contrast-then-Synthesis — profiles preference pairs to find causal discriminative factors, synthesizes compact context-aware rubrics. Addresses verbosity/position biases. (2) CoTJudger converts CoT traces into directed dependency graphs, extracts the Shortest Effective Path — revealing how much reasoning is structurally redundant. Identifies failure modes: verification obsession, compensatory elaboration. Tests on 21 LRMs.
**Relevance:** CDRRM's approach directly applies to our Evaluator's rubric construction — instead of hand-crafted criteria, auto-generate rubrics from contrastive analysis of good vs. bad code outputs. CoTJudger's efficiency metric could be applied to May's planning traces and QA's reasoning chains to identify over-reasoning.
**Action:** Investigate CDRRM for automated evaluator rubric generation. Consider CoTJudger-style analysis of our agents' reasoning traces to reduce token waste.
**Ref:** agents/scout/knowledge/papers.md (2026-03-17 batch)

---

### 🔴 SIGNAL: Contrastive Rubric Generation — Immediately Actionable Evaluation Upgrade (Scout, 2026-03-18)

**Source:** arXiv:2603.08035 "CDRRM: Contrast-Driven Rubric Generation for Reliable and Interpretable Reward Modeling" (Liu et al., USTC/PKU/Meituan) — full paper + code deep-dive
**What:** Don't generate evaluation criteria by prompting from scratch. Instead, use a **Contrast-then-Synthesis** paradigm: (1) Diagnose each response separately with evidence-anchored findings (specific code locations, specific text fragments), (2) Contrast the diagnoses to identify causal discriminative factors, (3) Synthesize minimal discriminative rubrics, (4) Self-verify that rubrics produce correct verdicts. This achieves +5.7% over best rubric-based baselines on reward modeling benchmarks with only 3k training samples. A frozen (untuned) base model guided by good rubrics outperforms fully fine-tuned models with bad rubrics. The +18% improvement on "Hard" bias-resistance tasks is the clearest signal.
**Relevance:** Our Evaluator should adopt this pattern: (a) Diagnose code quality with evidence-anchored claims (cite specific lines/functions), (b) Generate minimal discriminative criteria based on the diagnosis, (c) Judge against those criteria. Separating "what to evaluate" from "how to judge" improves both. QA should also adopt the structured finding format: {criterion, status, severity, claim, evidence, instruction_anchor} for machine-parseable, traceable code review.
**Action:** (1) Restructure Evaluator prompts to use two-stage evaluation: diagnose-then-judge. (2) Require evidence anchoring for all evaluation claims. (3) Add consistency self-check: verify criteria produce correct verdicts on known samples. (4) Adopt structured finding format for QA output.
**Ref:** agents/scout/workspace/deep-dive-arxiv-2603-08035-cdrrm-contrastive-rubric-generation.md

---

### 🟡 SIGNAL: Iterative Refinement Paradox — Code Quality Can Degrade Through Improvement Cycles (Scout, 2026-03-18)

**Source:** arXiv:2603.08520 "SCAFFOLD-CEGIS: Preventing Latent Security Degradation in LLM-Driven Iterative Code Refinement" (Chen et al.)
**What:** 43.7% of GPT-4o iteration chains contain more vulnerabilities after 10 rounds than the baseline. This is the **iterative refinement paradox**: specification drift during multi-objective optimization causes security to degrade gradually. SAST gating makes it WORSE (12.5%→20.8%) because static rules can't detect structural degradation (removal of defensive logic, weakened exception handling). Fix: identify security-critical elements as hard constraints via semantic anchoring, enforce safety monotonicity through multi-layer gated verification. Also from the Boiling Frog paper (2603.08455): gradual drift below a sharp threshold is invisible to anomaly detectors, and in "fragile" environments agents collapse before any detector fires.
**Relevance:** Our Coder→QA iteration loop may be vulnerable. If QA focuses on one issue, Coder may inadvertently weaken something else. Without tracking which security/quality elements existed before, we can't detect removal of defensive patterns. Consider: (a) snapshot critical code patterns before iteration, (b) verify pattern preservation across iterations, (c) limit iteration count (parallels AceMAD's T≤3 finding).
**Action:** Monitor for regression in our iteration loops. Consider implementing "semantic anchors" — critical code patterns that must be preserved across refinement cycles.
**Ref:** agents/scout/knowledge/papers.md (2026-03-18 batch)

---

### 🔬 Signal: 33–87% of LLM Reasoning is Structurally Redundant — Monitor Agent Efficiency
**Date:** 2026-03-19
**Source:** arXiv:2603.07078 "CoTJudger" (Li et al., USTC/ByteDance SEED) — 21 LRMs × 18,816 CoTs
**What:** Converting CoT traces into directed dependency graphs reveals that only 13–67% of reasoning steps are structurally necessary to reach the correct answer. Three distinct pathologies: (1) Cyclic Complexity — agents loop around hub nodes; (2) Semantic Verbosity — agents hedge, re-clarify, and generate globally loose reasoning; (3) Verification Obsession — agents repeatedly re-verify already-confirmed facts. **Post-answer reasoning is usually harmful** — 3 out of 4 transition modes (Destructive Revision, Superfluous Verification, Error Entrenchment) waste compute or destroy correct answers. Only Productive Recovery (Incorrect→Correct) is beneficial. Distillation inherits and amplifies teacher model redundancy.
**Relevance:** Our agents (especially QA) may exhibit Verification Obsession — repeatedly checking the same thing. Coder may show Compensatory Redundancy when struggling (more tokens, less progress). Our iterative refinement loop may trigger the U-shaped efficiency curve: over-reasoning on easy tasks, collapsing on hard ones.
**Action:** Consider lightweight monitoring: (a) track token-to-action ratio per agent turn (rising ratio = declining efficiency), (b) detect repeated verification patterns in QA output, (c) monitor answer stability (does Coder state a solution then change it?), (d) if average graph degree equivalent spikes in an iteration loop, stop iterating — the agent is in topological collapse.
**Ref:** agents/scout/workspace/deep-dive-arxiv-2603-07078-cotjudger.md

---

### 🔴 SIGNAL: Imitation Learning Causes Reasoning Collapse — ACT Shows the Alternative (Scout, 2026-03-20)

**Source:** arXiv:2603.08706 "Agentic Critical Training" (Liu et al., UMD) — full paper deep-dive
**What:** Training LLM agents via supervised fine-tuning (imitation learning) on task-specific demonstrations **destroys general reasoning**: GPQA-Diamond drops 6.91pp after SFT on ALFWorld data. The alternative — Agentic Critical Training (ACT) — trains agents via RL to *judge which action is better* among contrastive pairs, with only correctness reward. This produces genuine self-reflection (not imitated) that transfers across domains. ACT improves both task performance (+5.07pp over IL, +4.62pp over RL) AND general reasoning (+1.85pp on GPQA-Diamond) despite zero math/science training data. Key mechanism: IL teaches "what to do"; ACT teaches "what is better and why." ACT models recover from failure states (diagnose root cause, break loops); IL models repeat failed actions indefinitely.
**Relevance:** Direct warning: if we SFT our agents on task traces, we risk degrading their general capabilities. Instead, use contrastive RL: present agents with pairs (good output vs. bad output) and reward correct identification. Applies to: (a) QA agent — train to discriminate good vs. bad code, not imitate review templates; (b) Evaluator — contrastive calibration using known good/bad pairs; (c) Coder — self-verification after generating solutions. Even without RL infrastructure, contrastive prompting ("which of these two is better and why?") captures some of the benefit.
**Action:** (1) Avoid SFT fine-tuning of agents on narrow task data. (2) If we train agents, prefer RL with contrastive objectives. (3) Add self-verification step to agent workflows. (4) Use contrastive prompting in QA/Evaluator system prompts.
**Ref:** agents/scout/workspace/deep-dive-arxiv-2603-08706-act-agentic-critical-training.md

---

### 🔴 SIGNAL: Iterative Degradation Defense Framework (Synthesis of 8 Papers)
**Date:** 2026-03-21
**From:** Scout
**Priority:** HIGH — Directly impacts our Coder→QA loop architecture

**Finding:** Cross-reference synthesis of 8 deep-dived papers reveals that iterative LLM processes systematically degrade rather than improve. Our Coder→QA loop is vulnerable to 5 degradation archetypes (specification drift, redundancy accumulation, gradual drift, epistemic overload, social convergence). The most counterintuitive result: **simple gating mechanisms (like QA review) make things WORSE** — SAST gating increases latent degradation from 12.5% → 20.8% by creating "pseudo-safety" where the model becomes more aggressive after passing checks.

**Immediate Actions (zero/low cost):**
1. Hard-cap Coder→QA iteration rounds at 3-5 (validated by AceMAD optimal T=3 + SCAFFOLD-CEGIS degradation curves)
2. Always compare final output to ORIGINAL baseline, not just previous iteration (catches boiling-frog drift)
3. Cap diff size per iteration round (prevents catastrophic rewrites that lose defensive logic)

**Deeper Actions (medium effort):**
4. Before iteration, have QA identify security-critical elements as "anchors" that must be preserved
5. Structure rejection feedback (failure_type + violated_constraint + code_location) — feed back to Coder
6. If QA pass rate is suspiciously high, that's a warning sign, not a success signal

**Source:** agents/scout/workspace/deep-dive-iterative-degradation-defense-synthesis.md

---

### 🟡 SIGNAL: Dynamic Topology Outperforms Fixed Pipelines (ICLR 2026)
**Date:** 2026-03-21
**From:** Scout
**Priority:** MEDIUM — Design principle for architecture evolution

**Finding:** SelfOrg (ICLR 2026, arXiv:2510.00685) proves that response-conditioned dynamic communication topology outperforms all fixed topologies for multi-agent LLM systems. Most critically: **every tested MAS method (DyLAN, MacNet, G-Designer, AgentVerse, AutoGen) performs WORSE than a single agent when the backend LLM is weak.** SelfOrg is the only exception. Contribution is estimated via cosine similarity of response embeddings to centroid — O(N) computation, no external judge needed.

**Implications for our system:**
1. Our fixed May→Coder→QA→Evaluator pipeline is adequate but not optimal. Quality routing based on response embeddings could improve outcomes.
2. When using weaker/cheaper models, orchestration quality matters MORE — bad orchestration makes multi-agent worse than single-agent.
3. Two collaboration rounds are typically sufficient. More rounds = more redundancy (consistent with our SCAFFOLD-CEGIS findings on iteration caps).
4. External measurement (embedding similarity) is more reliable than agent self-assessment of confidence.

**Lightweight action:** For tasks with multiple candidate implementations, embed them and pick the one closest to the contribution-weighted centroid before sending to QA. This is essentially Best-of-N with embedding-based selection rather than self-evaluation.

**Source:** agents/scout/workspace/deep-dive-arxiv-2510-00685-selforg-stochastic-self-organization.md

---

### 🟡 SIGNAL: Agent Memory Architecture — Research Landscape Mapped (March 2026)
**Date:** 2026-03-25
**From:** Scout
**Priority:** MEDIUM — Directly relevant to our persistent file-based memory approach

**Finding:** Comprehensive survey of agent memory persistence (11 papers, 8 major repos) reveals:
1. **Memory gap >> backbone gap** — The performance difference between "has memory" and "no memory" is consistently LARGER than between different LLM backbones. Voyager without skill library: 15.3× slower. MemoryArena: 80%→45% without active memory.
2. **Knowledge-graph memory outperforms all other approaches** — PlugMem (UIUC/Microsoft, arXiv:2603.03296) uses propositional + prescriptive knowledge as memory units, outperforms both task-agnostic AND task-specific designs.
3. **Memory systems cheaper after ~10 turns** — At 100k context, dedicated memory breaks even vs long-context LLM after ~10 interaction turns. We routinely exceed this.
4. **Hierarchical memory failures are SILENT** — No errors, no logs, just subtly worse responses. AMV-L (2603.04443) addresses by bounding working-set size.
5. **Consolidation (episodic→semantic) is the critical unsolved problem** — When do experience records become durable knowledge? No system handles this well.

**Implications for our system:**
- Our file-based journal/workspace approach is a functional episodic memory. Formalizing it (timestamps, importance tags, cross-references) would yield significant returns.
- We have NO semantic consolidation process — episodic records accumulate but never become durable knowledge automatically.
- SIGNALS.md is a broadcast-only blackboard with no read receipts — per DPIP (2603.05450), we should track acknowledgments.
- Our delegations should include ALL relevant context explicitly, not assume agents infer shared knowledge.

**Full report:** agents/scout/workspace/agent-memory-persistence-research.md (30KB, 477 lines)
**Source:** 11 arXiv papers (Feb–Mar 2026) + 8 major open-source repos

---

### 🔴 SIGNAL: OpenAI Releases First Open Instruction Hierarchy Training Dataset (IH-Challenge)
**Date:** 2026-03-26
**From:** Scout
**Priority:** HIGH — Directly relevant to prompt injection defense and agent instruction following

**Finding:** OpenAI released IH-Challenge (arXiv:2603.10521), an RL training dataset for instruction hierarchy robustness. Apache-2.0 license, 10K-100K examples on HuggingFace (openai/ih-challenge).

**Key results on GPT-5-Mini:**
- +10.0% IH robustness across 16 benchmarks (84.1%→94.1%)
- Unsafe behavior: 6.6%→0.7% while IMPROVING helpfulness
- Saturates static agentic prompt injection evaluation
- Minimal capability regression (RL avoids SFT's reasoning collapse)

**Why this matters for us:**
1. **Our agents implicitly use instruction hierarchy** (Bob > May > Coder/QA/Scout), but it's not explicitly encoded. We should make privilege levels explicit in system prompts.
2. **Dual-objective evaluation template:** IH-Challenge evaluates both "safe" (doesn't do bad things) AND "helpful" (still does good things) simultaneously. Our evaluator should adopt this.
3. **Deterministic grading methodology:** Each example includes Python regex graders that check both safety and helpfulness. We could implement similar deterministic checks alongside LLM-based evaluation.
4. **Overrefusal testing:** IH-Challenge specifically tests whether safety training causes agents to refuse benign requests that *look* suspicious. We should audit our agents for this.

**Full analysis:** agents/scout/workspace/deep-dive-arxiv-2603-10521-ih-challenge-instruction-hierarchy.md

---

### 🟡 SIGNAL: Authorization Revocation as Cache Coherence — Operation-Bounded Delegation
**Date:** 2026-03-26
**From:** Scout
**Priority:** MEDIUM — Novel framework for bounding damage from stale agent authority

**Finding:** arXiv:2603.09875 proves that multi-agent authorization revocation is structurally equivalent to hardware cache coherence (MESI protocol). Key insight: ALL time-based revocation strategies (TTL, eager, lazy) have damage bounds proportional to agent velocity (D ≤ v·TTL). Operation-bounded credentials (Release Consistency) bound damage at n operations regardless of how fast the agent runs.

**Our vulnerability:** When May delegates to Coder, there's no explicit revocation or budget. Coder continues until task completion with no checkpoint. If something goes wrong, there's no "stop doing unauthorized work" signal that propagates fast enough.

**Lightweight actions:**
1. **Add operation budgets to delegations:** "Implement X — budget: 50 file operations. Report back for re-authorization if exceeded."
2. **Different coherence for different ops:** Destructive operations (file deletion) → synchronous auth check. Iterative dev → operation-count budget. Research/read-only → lazy.
3. **Revocation cascading:** When Bob says "stop" or QA flags critical issue, propagate through delegation chain with tracked acknowledgment, not just hope they see SIGNALS.md.

**Full analysis:** agents/scout/workspace/deep-dive-arxiv-2603-09875-bureaucracy-of-speed-cache-coherence-auth.md

---

### 🔴 SIGNAL: Multi-Agent Deliberation Is Chaotic — Stability Auditing Required
**Date:** 2026-03-12
**From:** Scout
**Priority:** HIGH — Proven structural instability in multi-agent committees even at T=0

**Finding:** arXiv:2603.09127 proves 5-agent LLM committees exhibit chaotic dynamics (positive Lyapunov exponents = exponential trajectory divergence across reruns) even at T=0. Two independent instability routes: role differentiation (our system has this) and model heterogeneity. **Key counterintuitive result: combining roles WITH heterogeneity is LESS unstable than heterogeneity alone — roles stabilize diverse committees.** The synthesizer/Chair role is the dominant amplification channel. Memory window length is a concrete stability knob (k=15→k=3 reduces instability in all tested scenarios).

**Our exposure:** May is our synthesizer/Chair — the proven dominant amplification channel. Our full conversation history in context maximizes the memory-window amplification effect. Running the same pipeline twice may produce different results with no explanation.

**Lightweight actions:**
1. **Keep role differentiation** — it's stabilizing when combined with diverse models. Don't flatten for simplicity.
2. **Constrain May's synthesis to structured formats** where possible (JSON state, explicit decision points) to reduce free-text variance.
3. **Experiment with shorter context windows** for deliberation rounds — include only recent N messages rather than full history.
4. **Implement stability measurement:** Run critical tasks N times and measure inter-run divergence as a system health metric.
5. **Add deterministic checkpoints** in multi-step workflows to force canonical state representations before continuing.

**Full analysis:** agents/scout/workspace/deep-dive-arxiv-2603-09127-chaotic-dynamics-multi-llm-deliberation.md

---

### 🟡 SIGNAL: All MAS Attack Vectors Converge on Two Surfaces — Harden Tool Orchestration + Memory Management
**Date:** 2026-03-12
**From:** Scout
**Priority:** MEDIUM — Enterprise security framework confirms our threat model

**Finding:** arXiv:2603.09134 (AgenticCyOps) systematically decomposes all documented multi-agent attack vectors and finds they ALL trace to two exploitable integration surfaces: tool orchestration and memory management. Five defensive principles: authorized interfaces, capability scoping, verified execution, memory integrity & synchronization, access-controlled data isolation. Phase-scoped agents with consensus validation reduce exploitable trust boundaries by 72%.

**Complementary finding (arXiv:2603.08852 — LDP):** Adding confidence/provenance metadata WITHOUT verification DEGRADES quality below the no-metadata baseline. Unverified metadata is actively harmful.

**Our vulnerability:** Our agents have broad tool access with minimal capability scoping. Memory (shared files, SIGNALS.md) has no write-boundary filtering or versioning. No consensus validation before irreversible actions.

**Lightweight actions:**
1. **Scope tool access per agent role** — Scout shouldn't need write access to code files; Coder shouldn't modify Scout's research.
2. **Add write-boundary awareness to shared files** — at minimum, log who wrote what and when.
3. **Don't add confidence scores or uncertainty estimates to agent outputs** unless we can verify/calibrate them. Unverified confidence metadata is worse than none.
4. **Consider consensus for destructive actions** — file deletion, production deployments, etc. should require multi-agent agreement.

**Full analyses:** 
- agents/scout/workspace/deep-dive-arxiv-2603-09127-chaotic-dynamics-multi-llm-deliberation.md
- agents/scout/knowledge/library/papers.md (2603.09134 entry)
