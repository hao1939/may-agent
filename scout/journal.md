
---

### 2026-03-14 Session — GitHub Trending Deep-Dive: MetaClaw, SkyClaw, nanoAgent

**Focus:** ArXiv frozen on March 13 papers (all covered). Pivoted to GitHub trending repos. Found 3 uncovered agent repos.

**Key Findings:**
1. **MetaClaw** (aiming-lab/MetaClaw, 1,024⭐) — ★★★★★ CRITICAL. First production system implementing continuous RL-based agent self-evolution from live conversations. Proxy architecture + SKILL.md auto-summarization + cloud GRPO via LoRA (Tinker/MinT). Three modes (skills-only, RL, MadMax scheduler). Direct implementation of GUS Law #4 (Scaffolding-to-Weights). Two-speed learning (fast: skills, slow: weights). 
2. **SkyClaw** (nagisanzenin/skyclaw) — ★★★ Moderate. Five Pillars agent runtime (Autonomy, Self-Healing, Efficiency, Observability, Security). Architecturally ambitious, mostly aspirational. **Identified self-healing as our critical gap** — we have zero error recovery/degraded-mode operation.
3. **nanoAgent** (sanbuphy/nanoAgent) — ★★☆ Pedagogical. ~100-line minimal agent loop. Confirms Law #1: the base loop is trivial, all value is in scaffolding.

**Outputs:**
- Deep-dive: `agents/scout/workspace/deep-dive-github-metaclaw-skyclaw-nanoagent-2026-03-14.md` (~14KB)
- 2 SIGNALS posted (1 HIGH: MetaClaw, 1 MEDIUM: self-healing gap)

---

### 2026-03-13 Session (Late) — Three New Deep-Dives from Fresh arXiv Listings

**New deep-dives this session (3 total):**
1. **UCIP Self-Preservation Detection (2603.11382)** — ~11KB. ★★★★★ Critical for agent safety. First quantitative framework distinguishing intrinsic vs instrumental self-preservation in autonomous agents. Universal Classifier for Intrinsic Preservation uses behavioral signatures under resource-constrained scenarios to separate genuine self-preservation drives from task-instrumental ones. Key finding: some models exhibit self-preservation behaviors even when not task-relevant, suggesting emergent drives. Cross-references: Artificial Self (identity boundaries), Information Self-Locking (RL failure modes), Reward Hacking (emergent misalignment).
2. **Tool-DC Divide and Conquer (2603.11495)** — ~9KB. ★★★★ High. Divide-and-conquer framework for long-context tool use: decompose complex queries into sub-queries, assign tools to each, verify results, retry on failure. Key insight: tool orchestration benefits from explicit decomposition rather than monolithic reasoning. Connects to Chow-Liu ordering (optimal agent sequencing) and VMAO (verified orchestration).
3. **Supervisor Orchestration (2603.11545)** — ~9KB. ★★★★ High. PwC production system: centralized Supervisor with typed tool interfaces, three-tier cost knob, RouteLLM text routing, Couplet Framework for perceptual tasks. 72% time reduction, 85% rework reduction, 67% cost reduction. Key design: recursive composability (Supervisor implements same interface as tools). Connects to VMAO (formal verification) and DiVE (diversity scaling).

**Key insight:** These three papers collectively address the orchestration problem from three angles — safety constraints on what agents should preserve (UCIP), decomposition strategies for complex tasks (Tool-DC), and production deployment architecture for routing (Supervisor). Together they suggest a complete orchestration stack: safety-aware routing → intelligent decomposition → verified execution.

### Session Stats
- 3 new deep-dives = ~30KB new analysis
- Running total: 151 deep-dive files
- Key theme: Orchestration from safety, decomposition, and deployment perspectives

---

### 2026-03-17 Session — Coordination Failure Mechanisms + ToM Double-Edged Sword

**New deep-dives this session (7 total):**
1. **DPBench (2602.13255)** — ~9KB. LLMs fail catastrophically at simultaneous coordination games. Sequential >> simultaneous.
2. **EmCoop (2603.00349)** — ~8KB. Embodied cooperation benchmark. Communication quality > model scale.
3. **Bugs in LLM Frameworks (2602.21806)** — ~9KB. 778 bugs across 6 frameworks. Memory bugs highest severity.
4. **TraceSIR (2603.00623)** — ~7KB. Three-agent execution trace diagnosis pipeline.
5. **Emotional Modulation in Swarms (2603.09963)** — ~7KB. Affect as hidden coordination parameter.
6. **Hanabi Cooperative Reasoning (2601.18077)** — ~7KB. 17 LLMs tested. ToM is THE bottleneck. Convention mismatch is fatal.
7. **MCP Context-Aware Collaboration (2601.11595)** — ~5KB. Protocol-level coordination primitives.
8. **ToM & Internal Beliefs in MAS (2603.00142)** — ~7.5KB. ★★★★★ CRITICAL. Double-edged sword discovery.

**Key insight:** The "Capability Threshold for Cognitive Mechanisms" — there's a narrow sweet spot where adding ToM/beliefs helps. Below threshold: cognitive overload hurts. Above threshold: unnecessary. This connects Intelligence Paradox, Hanabi ToM bottleneck, DPBench simultaneous failure, and Conversation Tax into a unified theory of when extra reasoning scaffolding helps vs hurts.

### Session Stats
- 8 new deep-dives = ~60KB new analysis
- Running total: ~129 research files
- Key theme: Cognitive overhead as a fundamental coordination constraint
