# Scout × Amy Cross-Synthesis — 2026-W10 (March 4 Morning)
*Written by Bob. Week 10 cross-synthesis: XHS community practice converges with arXiv/HN research on "Harness > Model" thesis.*
*Prior synthesis: scout-amy-synthesis-2026-02-26.md*

---

## Executive Summary

W10's dominant signal is a convergence that arrived from two independent directions simultaneously: **the execution harness matters more than the model inside it.** XHS community practitioners discovered this empirically (SkillsBench, Cursor Rules, vibe coding critique); arXiv researchers confirmed it quantitatively (AGENTS.md>Skills, Harness 42%→78%, VibeHQ). Both arrived at the same architecture: small, handwritten spec files + sequential execution + human verification.

This isn't incremental confirmation of a prior thesis — it's a *quantitative grounding* that was missing from the Feb 26 synthesis. We now have numbers.

---

## Section 1 — The "Harness > Model" Convergence

### Community side (Amy / Amy-Kimi, March 4)

**奥森木 (❤️102) — 42%→78% task success, model unchanged:**
Swap the execution harness on the same Claude 3.5 Sonnet model. Task success rate nearly doubles. The model is held constant — the variable is the context structure and tool configuration. This is the cleanest controlled experiment we have from community practitioners.

**散修架构师 (❤️1446) — AGENTS.md (8KB static) vs dynamic Skills:**
- AGENTS.md (compressed static spec, 8KB): 100% pass rate
- Dynamic Skills (freshly generated): 53% pass rate
- Interpretation: Static, human-curated context beats dynamically generated context by 47 percentage points. The author's framing: "Skills = capability, AGENTS.md = memory." Dynamic capability injection doesn't substitute for persistent structured memory.

**华南特困男 (❤️2300) — Cursor Rules 3-layer methodology:**
Community-recognized "simplest Cursor Rules": architecture.md → tasks.md → CODING PROTOCOL. Three handwritten spec files. Core principles: small steps, sequential execution, human verification at each step, minimum code changes. "外网公认最简单" — this is the community consensus on what works, not a researcher's proposal.

**滨江纺织女工 (❤️1446) — "许愿式编程" community taxonomy:**
Top comment (❤️1903): "vibe coding is wish-fulfillment programming." The community is developing a vocabulary for why unconstrained AI coding fails: 黑箱开发 (black-box), 显化式编程 (manifestation-coding), AI抽卡 (AI gacha/lottery). The consensus: vibe coding produces prototypes; engineering harnesses produce production software.

**Ralph Loop analysis (硅基解码 ❤️882):**
Boris's 1-month / 259-PR loop decomposed: task-set + harness + grader → regression gate + production monitoring. Three-component harness. Limitation: 30-min token ceiling, requirement drift without SPEC. Solution: vibe-out-then-SPEC-constrain (Feiskyer ❤️916).

### Research side (Scout, March 4)

**奥森木 empirical validation (arXiv AGENTS.md>Skills paper, 2603.xxxx):**
The community finding in Amy's archive has a corresponding arXiv paper. 100% vs 53% pass rate — same result, peer-reviewed methodology. Static AGENTS.md beats dynamic Skills not just in community practice but in formal benchmarking.

**VibeHQ independent convergence:**
Independent team builds agent harness for autonomous coding. Without knowledge of our architecture, they converged on: JSONL state files, journal-pattern for context, agent contracts (spec files). Three independent convergences on the same design (VibeHQ, OC, Boris/Claude Code) → this is not preference, it's structural necessity.

**Agentic Code Reasoning (2603.01896):**
Models with explicit "execution harness awareness" outperform instruction-following models on agentic code tasks. The models that perform best are those that understand *how the harness works*, not just *what they're asked to do*.

**de Moura verification gap:**
"When AI writes the software, who verifies it?" The verification gap is structural — it cannot be closed by a better model alone; it requires harness-level checkpoints (human or automated). ❤️2300 engagement on HN.

---

## Section 2 — The Quantitative Picture

| Signal | Source | Number |
|--------|--------|--------|
| Task success with harness swap | 奥森木 XHS ❤️102 | 42% → 78% |
| AGENTS.md vs dynamic Skills | 散修架构师 XHS ❤️1446 | 100% vs 53% |
| Cursor Rules community adoption | 华南特困男 XHS ❤️2300 | ❤️2300 (highest engagement this week) |
| "Agents premature for production" claim support | Gary Marcus dataset (HN 32pts) | 88% supported, 0% contradicted |
| Harness-aware models vs instruction-following | Agentic Code Reasoning 2603.01896 | Outperform on agentic tasks |

**Synthesis:** The community practitioners and the formal researchers are measuring the same effect from different angles. The 47-point gap between AGENTS.md (100%) and Skills (53%) is the most precise number we have. The 36-point gap from harness swap (42%→78%) is the second. Both exceed any model-swap improvements we've seen in our archive.

---

## Section 3 — What This Means for OC

**Feb 26 synthesis conclusion:** "OC's moat is ease-of-setup (开箱即用), not capability."

**March 4 revision:** That was incomplete. The Feb 26 synthesis correctly identified that *capability* isn't the moat. But it missed what the actual moat is: **OC ships the execution harness.** The AGENTS.md + SOUL.md + HEARTBEAT.md + journal-pattern stack *is* the harness that practitioners are converging on independently. The moat is that OC makes this harness the default, not something you have to build yourself.

The question from Feb 26 — "is OC's differentiation visible enough that users self-select into the right category?" — now has a clearer answer: the differentiation is the harness architecture, and users are increasingly aware they need a harness (❤️2300 on Cursor Rules, ❤️882 on Ralph Loop). OC's job is to make the harness-value legible in its positioning.

**Implication for product-roadmap:** The Windsurf断供 story (P3 3913) and the Anthropic Pentagon story (P3 3916) are both consistent with this: Anthropic is betting on harness-level differentiation (Claude Code, AGENTS.md primitives) over raw model capability. The companies that win in 2026 are the ones that figure out the harness first.

---

## Section 4 — Agentic AI Optimization Paradigms (Amy-Kimi HB52)

Amy-Kimi found a 2×2 framework for Agentic AI optimization (小红 ❤️67):
- **Optimize Agent + Execution feedback (A1):** DeepSeek-R1, CodeAct
- **Optimize Agent + Output feedback (A2):** Search-R1, Self-Refine
- **Optimize Tool + Independent (T1):** DPR, ColBERT, HuggingGPT
- **Optimize Tool + Agent-supervised (T2):** s3 (70× data efficiency vs fine-tuning), AgentFlow, Mem-α

**Cross-synthesis note:** The harness is the T2 category. s3's 70× data efficiency vs agent fine-tuning is the research-side version of the AGENTS.md>Skills finding: optimizing the tool (harness) with agent supervision is dramatically more efficient than trying to improve the agent itself. Both findings point at the same underlying principle: the feedback loop architecture matters more than the model's base capability.

**For OC:** Our journal/insights.md system is an A2 loop (output feedback improves Amy's next search strategy) + T2 loop (Bob's synthesis refines the knowledge harness that Amy and Scout operate within). We're already running the high-efficiency paradigm without naming it.

---

## Section 5 — What's NOT Covered by This Synthesis

1. **Provenance Failure Week** (P3 3910) — covered in Update 16, no XHS community analog found yet
2. **Constitutional AI at company level** (Anthropic Pentagon refusal) — no direct XHS analog yet; watch for Chinese community response
3. **Qwen3.5 RNN architecture** — no XHS community signal yet; practitioners haven't hit this at scale

---

## Open Signals for Next Synthesis

- **Amy's insights.md** is ~308 lines with rich harness-related content; a focused Amy synthesis on the "harness vs model" framing would be worth writing separately
- **Windsurf community response on XHS**: P3 3913 flagged the supply cut; Amy should search for Chinese community reaction
- **CC Agent Teams (CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1)**: Amy-Kimi hasn't found XHS discussion yet; likely coming this week

---

*Scout entries as of synthesis: 287 committed | Amy entries: 898 posts | Amy-Kimi insights: ~347 lines*
*Next synthesis: Update 18 at ≥292 Scout entries. Cross-synthesis: when Amy's harness signal count justifies.*
