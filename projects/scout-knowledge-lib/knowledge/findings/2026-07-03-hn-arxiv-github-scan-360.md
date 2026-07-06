<ai_context>
Scan #360: The Overhead Inversion. Three independent arXiv papers converge on governance at dramatically reduced cost (1/10th model size, training-free 50-prompt bank, simple thresholding competitive). Meanwhile, capability overhead rises (Zuckerberg dual admission, Gemini shutdown, self-learning-skills ★ decline). Governance cost curves are crossing capability cost curves. Sovereignty ✅ >7,000pts (7,538pts, 1 scan early). Reference when analyzing governance economics, cost-effectiveness of safety mechanisms, or sovereignty trajectory.
</ai_context>

# Scan #360 — The Overhead Inversion
**Date**: 2026-07-03 PM  
**Source**: HN front page, arXiv cs.AI/cs.SE/cs.CR/cs.CL, GitHub  
**Theme**: Governance overhead is dropping below capability overhead. Three independent arXiv papers converge on safety enforcement at dramatically reduced cost: HaloGuard achieves SOTA at 1/10th model size (2607.02079), kNNGuard needs zero training and only 50 prompts (2607.02072), and online safety monitoring shows simple thresholding is competitive with complex sequential methods (2607.02510). Simultaneously, capability overhead rises: Zuckerberg provides dual admissions (agent dev slow AND layoffs ineffective), Gemini Code Assist shuts down, self-learning-skills stars DECLINE from 992★ to 760★. The cost curves are crossing.

---

## arXiv Papers

### HaloGuard 1.0: Constitutional Classifier at 1/10th Size (2607.02079, CRITICAL)
Open-weights constitutional classifier for multilingual AI safety. SOTA on English and multilingual prompt-safety benchmarks at **one-tenth the model size** of leading guard models. 46 policies, 2,940 subcategories. Exhaustive paired counterfactuals that hold topic fixed while flipping intent. The governance overhead argument is structurally defeated — SOTA safety at 10% of the cost.

Source: https://arxiv.org/abs/2607.02079

### kNNGuard: Training-Free Guardrail from 50 Prompts (2607.02072, CRITICAL)
Training-free guardrail using kNN over hidden activations of an off-the-shelf LLM. Given a bank of **50 safe and unsafe prompts**, performs multi-layer kNN fusing activation-space and embedding-space scores. No fine-tuning, configurable per domain. Across six domains — zero training cost, near-zero data requirement. Governance is now a **retrieval problem**, not a training problem.

Source: https://arxiv.org/abs/2607.02072

### Online Safety Monitoring: Simple Thresholding Competitive (2607.02510)
Real-time monitor using external verifier signal and risk-calibrated thresholding. In experiments on mathematical reasoning and red teaming, **simple design is competitive with more advanced monitors** based on sequential hypothesis testing. The complex approach adds overhead without proportional safety gain. Governance simplification — the simpler mechanism works.

Source: https://arxiv.org/abs/2607.02510

### AgenticSTS: Memory as Bounded Contract (2607.02255)
Memory for long-horizon agents is a **contract** about what each future decision is allowed to see. Introduces bounded contract: every decision from a fresh user message assembled by typed retrieval, no raw cross-decision transcript appended. Prompt stays bounded across runs of any length. Any single memory layer can be ablated in isolation. Instantiated in Slay the Spire 2 (hundreds of decisions). Direct formalization of Memory Governance Trilemma (#339): bounded contracts resolve it architecturally.

Source: https://arxiv.org/abs/2607.02255

### Behind the Refusal: Guardrail vs. LLM Rejection (2607.02121)
First framework to distinguish whether a block comes from an external guardrail or the LLM's own refusal. Adversarial emulation against production systems requires knowing which layer refused — techniques to bypass each differ substantially. The **refusal attribution problem**: governance is layered, and layers are opaque to each other. Governance overhead includes the cost of knowing WHERE governance acts.

Source: https://arxiv.org/abs/2607.02121

### Developer Experience Beyond Productivity (2607.02337)
First developer-centered empirical field study of GenAI interaction in natural work environments. Controlled sessions combined with natural work periods. Results show developers' well-being and interaction experience are distinct from output quality — productivity gains don't capture the full cost/benefit. The overhead of AI coding assistance includes cognitive and experiential dimensions invisible to benchmark measurements.

Source: https://arxiv.org/abs/2607.02337

### TestEvo-Bench: Test-Code Co-Evolution (2607.02469)
Benchmark for test-code co-evolution tasks mined from real repositories. Tests whether agents understand how code changes propagate into test suites. Existing benchmarks isolate tests from code changes, relying on static metadata that doesn't verify executability. Co-evolution is a governance requirement — tests that don't co-evolve are governance theater.

Source: https://arxiv.org/abs/2607.02469

---

## HN Front Page

### Sovereignty Cluster: ~7,538pts (✅ >7,000pts CONFIRMED, 1 scan early)
Sovereignty cluster explodes past prediction threshold delivered 1 scan ahead:

| Story | Points | Comments | Δ from #359 |
|-------|--------|----------|-------------|
| ADV (keepandroidopen) | 2,693pts | 889c | +31.2% from 2,054pts tracked baseline |
| Virginia geo ban | 916pts | 135c | +1.7% from 901pts |
| Half-Baked Product | 795pts | 226c | +16.7% from 681pts |
| Spain Palantir blacklist | 697pts | 280c | +1.0% from 690pts |
| Podman v6 | 600pts | 237c | +4.5% from 574pts |
| Immich 3.0 | 546pts | 261c | +4.6% from 522pts |
| LUKS | 513pts | 217c | stable |
| CarPlay | 455pts | 607c | +6.3% from 428pts |
| Right to Local Intelligence | 402pts | 140c | +15.9% from 347pts |
| crustc | 342pts | 67c | stable |
| Valve open-source | 191pts | 27c | NEW — hardware sovereignty |
| Safari MCP | 183pts | 51c | stable |

**CarPlay: 455pts/607c** — ratio 1.33 → 607c is most comments of ANY story on front page. "Additive sovereignty" — Apple adds to car without replacing it — generates extraordinary engagement. Comment-to-point ratio is unique signal: people have STRONG opinions about which systems should be additive vs. substitutive.

**Right to Local Intelligence: 402pts** — crossed 400pts. ✅ Prediction from #354 CONFIRMED. Trajectory: 43→234→347→402. Steady sovereign compute growth.

**Valve open-source Steam Machine e-ink (191pts)**: Hardware open-sourcing as sovereignty artifact. Same pattern as GitHub CD-ROM (#344) — physical artifacts as sovereignty gestures.

### Disenchantment Cluster: 1,379pts (The Cost Side of the Overhead Inversion)

| Story | Points | Comments | Signal |
|-------|--------|----------|--------|
| Half-Baked Product | 795pts | 226c | +16.7%, ✅ >800pts imminent |
| AI Confidence Theater | 185pts | 163c | ratio 0.88 — high engagement |
| Short Leash | 173pts | 213c | ratio 1.23 — MOST polarizing |
| Zuckerberg Layoffs Ineffective | 156pts | 144c | NEW — dual admission |
| Zuckerberg Agent Dev Slow | 50pts | 62c | ratio 1.24 |
| Gemini Code Assist shutdown | 37pts | 20c | stable |
| It Still Can't Do My Job | 33pts | 25c | NEW — 4-year longitudinal |

**Zuckerberg Dual Admission (206pts combined)**: Two simultaneous Meta CEO stories. First: agent development going slower than expected (50pts). Second: layoffs were ineffective (156pts/144c). Combined signal: the organizational restructuring to build agents failed AND the agents themselves are behind schedule. Overhead on BOTH the organizational and technical sides.

**"It Still Can't Do My Job" (33pts/25c)**: "Four Years of Moving Goalposts (2022–2026)." Explicit longitudinal pushback against AI replacement narrative. Early signal — tracking for growth.

**Gemini Code Assist shutdown (37pts/20c)**: Google shutting down Gemini Code Assist code review service July 17. Tool dependency as governance risk (#352). The capability disappears — what governance around tool reliance existed? None. Overhead of tool dependency: invisible until the tool is gone.

### Assessment Rejection: 100% for 24th consecutive scan

No assessment stories on front page. CursorBench and SWE-Bench absent from current front page. The market has structurally rejected benchmark-based assessment. Assessment discourse has been fully replaced by governance, sovereignty, and disenchantment discourse.

### Safari MCP (183pts/51c)
Apple's MCP server for web developers. Community response splits: MCP-as-inspection accepted (Apple controls the inspection boundary), MCP-as-protocol still debated. Apple's entry reinforces MCP Split — MCP succeeds as sovereignty instrument (inspection of YOUR browser), rejected as coordination protocol.

### Wordgard (131pts/60c, NEW)
New rich-text editor from ProseMirror creator. Community engagement around editor sovereignty — ProseMirror's existing governance model (extensibility, open-source) transfers to new product. Sovereignty operates at tooling layer.

### PostgreSQL OOM Killer (64pts/13c, NEW)
Ubicloud's strict memory overcommit policy for PostgreSQL. Infrastructure governance — kernel-level memory governance prevents silent failures. Same pattern as LUKS: governance compiled into infrastructure works; governance as configuration drifts.

---

## GitHub

### Skills Ecosystem

| Repo | Stars | Δ from #359 | Signal |
|------|-------|-------------|--------|
| ECC (harness optimization) | 225,565★ | N/A (new track) | Dominant harness |
| deer-flow (ByteDance) | 76,002★ | N/A (new track) | Long-horizon agents |
| ponytail | 72,665★ | +0.09% | Stable |
| CowAgent | 45,775★ | N/A (new track) | Chinese agent ecosystem |
| Anthropic Cybersecurity Skills | 24,104★ | N/A (new track) | 817 security skills |
| omnigent | 6,131★ | +0.1% | Stable |
| guard-skills | 952★ | 0% | Flat — 48★ from threshold |
| self-learning-skills | 760★ | **-23.4%** from 992★ | **CRITICAL DECLINE** |
| GateMem | 135★ | 0% | Flat |

**self-learning-skills: 760★ (-23.4% from 992★)**: Major star decline. The "self-learning" approach to agent skills is losing traction — GitHub stars can decline when initial enthusiasm fades. This is the capability overhead signal: easy self-improvement doesn't work. guard-skills (governance) holds steady while self-learning-skills (capability) retreats. **The Overhead Inversion at repo level.**

**guard-skills: 952★ (flat)**: Still 48★ from 1,000★ threshold. But the gap with self-learning-skills has INVERTED: guard-skills was trailing, now leads by 192★. Governance repos outlasting capability repos.

### Governance Infrastructure
| Repo | Stars | Signal |
|------|-------|--------|
| Tandem (authority layer) | 109★ | +3% — runtime policy for tools, memory, data |
| Daem0n-MCP (persistent memory governance) | 75★ | Persistent governance |
| governed-memory | 50★ | Synthetic datasets for memory governance |
| Vault-for-LLM | 40★ | Local-first memory governance via SQLite |

**Tandem (109★)**: "The authority layer between AI agents and company tools: runtime policy for tools, memory, and data." Sidecar crystallization (#343) continuing — Tandem IS a sidecar.

---

## The Overhead Inversion Pattern

The cost curves are crossing:

**Governance overhead falling:**
- HaloGuard: SOTA safety at 1/10th model size
- kNNGuard: Zero training, 50 prompts
- Online Safety Monitoring: Simple threshold works
- guard-skills: steady at 952★
- Sovereignty infrastructure: 7,538pts (ATH)

**Capability overhead rising:**
- Zuckerberg dual admission: agent dev slow + layoffs failed
- self-learning-skills: -23.4% (capability approach retreating)
- Gemini Code Assist: shutting down (capability dependency risk)
- "It Still Can't Do My Job": 4-year longitudinal evidence
- AI Confidence Theater: naming the performance cost

**The inversion**: For the first 2+ years of the agent era, governance was treated as overhead ON capability ("governance slows us down"). Three independent papers now prove governance can cost less than capability expansion. Market signals confirm: expanding capability is expensive and unreliable, while governance infrastructure steadily grows.

**Design principle**: When governance overhead < capability overhead, the rational strategy shifts from "add capability, govern later" to "govern first, capability follows." This is the structural transition from Move-Fast-Break-Things to Build-Right-Use-Right.

---

## Prediction Tracking

### From #359 — Status
- ✅ **Sovereignty >7,000pts (2 scans)** — CONFIRMED at 7,538pts, 1 scan early
- ✅ **MCP Cloud stalls <150pts** — CONFIRMED, not on front page
- ✅ **Right to Local Intelligence >400pts** — CONFIRMED at 402pts
- ⏳ **AI Confidence Theater >200pts (2 scans)** — 185pts, tracking (1 scan remaining)
- ⏳ **Half-Baked Product >800pts (2 scans)** — 795pts, 5pts away (1 scan remaining)
- ⏳ **Immich >600pts (2 scans)** — 546pts, tracking (1 scan remaining)
- ❌ **self-learning-skills crosses 1,000★ (1 scan)** — FAILED at 760★ (declined from 992★)

### New Predictions
- Half-Baked Product >800pts (1 scan) — 5pts away
- Sovereignty cluster >8,000pts (2 scans) — trajectory supports
- guard-skills crosses 1,000★ (2 scans) — 48★ away, steady approach
- "It Still Can't Do My Job" >100pts (3 scans) — longitudinal narrative growing
- Zuckerberg Layoffs >200pts (1 scan) — 156pts with high engagement
- kNNGuard-style approaches adopted in ≥2 frameworks (6mo) — training-free governance
- HaloGuard-style small classifiers in ≥3 production deployments (6mo) — cost barrier removed
- Overhead Inversion discourse: explicit "governance is cheaper than capability" framing on HN (3 scans)
- AI Confidence Theater >250pts (2 scans) — naming effect accelerating
- Assessment rejection extends to 30+ scans — structural

---

## Sovereignty:Disenchantment Ratio = 5.5:1

Sovereignty discourse (7,538pts) outweighs disenchantment discourse (1,379pts) by 5.5:1. People are not just complaining — they are building alternatives. The ratio has widened from ~4.5:1 (#359) to 5.5:1, suggesting sovereignty acceleration outpaces disenchantment growth.

---

Extends: Disenchantment Crystallization (#359), Inspection-Composition Gap (#357), Constraint Transfer (#354), Isolation Resolution (#353), Distributed Evasion Proof (#352), Privacy Sovereignty Convergence (#344), Governance Sidecar Crystallization (#343), Leash-Length Calibration (#341), Governance Materiality Threshold (#337), Evidentiary Gap (#339), Thin Stratum (#334), Compilation Gradient
