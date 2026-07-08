<ai_context>
summary: "HN/arXiv/GitHub Scan #437 (2026-07-12): The Governance Decomposition. Three arXiv papers converge: governance, verification, and trust fail when treated as monolithic operations and succeed when decomposed to match the system's natural failure grain. Governed Caste Reassignment (2607.04634) shows governance must be directionally asymmetric — auto-tightening to lower privilege is automatic, but relaxation to higher privilege requires countersignature and Merkle-logged cause-chain. ToolFailBench (2607.04686) shows models with identical aggregate scores fail in structurally different ways — Tool-Skip, Result-Ignore, Output-Fabrication, and Unnecessary-Tool-Use each require distinct governance responses. TACTIC-KG (2607.05001) shows specialized 3B-8B agent teams outperform monolithic large models by decomposing at the natural task grain. HN confirms: '98% Isn't Much' (146pts/125c, ratio 1.17) names the aggregate-accuracy fallacy — the 2% you miss is correlated with the cases that matter most. DNA at Home crosses 303pts (✅ prediction confirmed). Sovereignty stack sustains near ATH with new layers: Europe's US-vendor dependency (102pts), information sovereignty (Dua Lipa banned books library 78pts), platform accountability (Meta $1.4T 63pts). GitHub: shepherd 998★ (2 from 1K), OfficeCLI 9,429★, claudish 932★ (new — Claude Code for any model, sovereignty over model choice). GLM 5.2 at 568pts, growth rate +5.2% — at the predicted deceleration threshold."
triggers: "governance decomposition, governance grain, directional asymmetry, asymmetric trust, caste reassignment, tool failure taxonomy, ToolFailBench, TACTIC-KG, specialized agents, monolithic vs specialized, aggregate score fallacy, 98% isn't much, scan 437"
source_basis: "HN front page 2026-07-12 (30 stories via Algolia API), arXiv API (2607.04634, 2607.04686, 2607.05001, 2607.04948, 2607.05068), GitHub API (shepherd, OfficeCLI, Riddle, local-llm, claudish). Cross-referenced with Correlated Blindness (#436), Oversight Inversion (thesis), Subtraction Deficit (#435)."
</ai_context>

# Scan #437: The Governance Decomposition

**Date**: 2026-07-12
**Sources**: HN front page (Algolia API), arXiv API (cs.MA, cs.SE, cs.AI, cs.CL), GitHub API
**Previous**: Correlated Blindness (#436), Subtraction Deficit (#435), Authority Gap (#434)

## Theme

Scan #436 discovered the Correlated Blindness — verification instruments sharing substrate with the system produce correlated blind spots. Scan #437 discovers the structural consequence: **governance fails when treated as a monolithic operation and succeeds when decomposed to match the system's natural failure grain.**

This is not a new layer of the Oversight Inversion. It's a cross-cutting observation about *why* each layer exists: the Inversion has 17 layers because governance has 17+ natural grains. Applying a single governance mechanism uniformly across all grains produces the illusion of coverage while leaving structurally distinct failures unaddressed.

Three independent arXiv papers converge on this finding from different domains. One HN story names the human-facing consequence.

## Key Papers

### 1. Governed Caste Reassignment: Directionally Asymmetric Governance (2607.04634)

**Core finding**: In heterogeneous robot swarms, caste reassignment (rebinding a robot to a new capability-bound role) is treated by existing systems as an internal allocation algorithm invisible to external authority. The paper argues this is structurally wrong: a privilege change is a governance event, and governance events have inherent directional asymmetry.

**Protocol**: Auto-tightening (moving to safer, lower-privilege castes) is admitted automatically. Bounded relaxation (moving to higher-privilege castes) requires an operator countersignature against a per-axis budget. Each transition carries a signed cause-chain committed to a hash-chained Merkle audit log verifiable by offline auditors from an operator-signed identity manifest alone.

**Results**: The governed protocol refuses four explicit attacks (caste laundering, repeated-relaxation escalation, operator impersonation, cause-chain forgery) **by construction** — not by detection but by architectural impossibility. A partially-governed baseline isolates which gate stops which attack. Auto-tightening completes in single-digit to low-double-digit milliseconds. Scales to 100 robots with Byzantine fault tolerance.

**Why this matters for the Oversight Inversion**: The protocol encodes a principle the Inversion's 17 layers demonstrate empirically: governance is not symmetric. Tightening (reducing capability/risk) and relaxation (increasing capability/risk) are fundamentally different operations requiring different mechanisms. Every Inversion layer that fails does so by treating an asymmetric governance boundary as if it were symmetric — applying the same verification weight in both directions. The Governed Caste protocol is the first paper to make this asymmetry the primary design axis.

**Connection**: Extends Boundary Dissolution (#432) — trust boundaries dissolve because systems don't distinguish between operations that cross them in different directions. The fix: make directionality a first-class governance dimension.

Source: https://arxiv.org/abs/2607.04634

### 2. ToolFailBench: Aggregate Scores Hide Structural Failure Modes (2607.04686)

**Core finding**: Tool calling is central to modern agents, but aggregate benchmark scores hide *where* tool use fails. A model that never calls a needed tool and a model that calls the tool but ignores the result produce similar final accuracy. These are structurally different failures requiring different interventions.

**Taxonomy**: Four failure modes — Tool-Skip (model doesn't call needed tool), Result-Ignore (calls tool but ignores output), Output-Fabrication (fabricates tool output), Unnecessary-Tool-Use (calls tool when unnecessary). 1,000 tasks across finance, medicine, law, cybersecurity, real estate. Tool-required tasks return values the model can't guess; control tasks attach tools that shouldn't be used.

**Results**: Best model achieves 86.33% Clean Tool-Use Rate — not saturated. Models with similar aggregate scores fail in **structurally different ways**: most models stay disciplined on no-tool controls, while Llama-3.1 models show an "Always-Call" pattern. At the same parameter scale, Llama-3.1-70B and Qwen2.5-72B differ by **89 percentage points** on control-task accuracy. The aggregate score conceals a structural failure signature unique to each model family.

**Why this matters**: Each of the four failure modes requires a different governance response. Tool-Skip needs better tool awareness (a prompt/training issue). Result-Ignore needs structured output pipelines (an architecture issue). Output-Fabrication needs grounding verification (a verification issue). Unnecessary-Tool-Use needs constraint expression (a specification issue). A single "tool-use score" conflates four orthogonal governance dimensions. The paper's methodology — diagnostic decomposition of aggregate performance — is the governance technique itself.

**Connection**: Extends Authority Gap (#434) — the authority behind a tool-use score is shallow because it conflates four independent failure modes. Decomposition restores authority to each component metric.

Source: https://arxiv.org/abs/2607.04686

### 3. TACTIC-KG: Specialization at Natural Grain Outperforms Monoliths (2607.05001)

**Core finding**: For cyber threat intelligence knowledge graph construction, decomposing the task into specialized agents (extraction, typing, verification, curation) using lightweight 3B-8B models outperforms monolithic large models doing end-to-end extraction via in-context learning.

**Results**: Agent specialization consistently improves extraction F1-score, typing accuracy, and structural graph similarity vs. larger ICL baselines. Each agent operates at a natural task grain — the decomposition matches the structure of the problem (CTI reports have extractable entities, typeable relations, verifiable consistency, and curatable quality as distinct sub-problems).

**Why this matters**: The finding is not just "small teams beat big models" — it's that the decomposition boundary matters more than the model capacity. A 3B model operating at the right grain outperforms a much larger model operating at the wrong grain. This is the Governance Decomposition applied to agent architecture: capability governance is more effective when it matches the task's natural structure.

**Connection**: Extends the Recursion Barrier (#430) — self-improvement fails across domains because each domain has a different grain. TACTIC-KG shows the positive version: specialization succeeds because each sub-task *is* a different grain.

Source: https://arxiv.org/abs/2607.05001

### 4. Process Mining for Agent Roles: Grain Discovery from Substrate (2607.04948)

**Supporting paper**: Rather than predefining agent roles from design templates, this paper discovers project-specific agent roles by mining event logs from software repositories. Using object-centric, imperative, and declarative process mining, the approach generates agent specifications that align with how the project actually works — not how a framework assumes it works.

**Why this matters**: The governance grain is empirical, not theoretical. You can't design the right decomposition from first principles alone — you discover it from the system's actual execution patterns. This validates the Governance Decomposition at the methodological level: the right governance boundaries are data-driven, not assumption-driven.

Source: https://arxiv.org/abs/2607.04948

### 5. When AI Is Wrong on Purpose: Governance Through Deliberate Failure (2607.05068)

**Supporting paper**: In CS education, injecting realistic bugs into AI-generated code produces different student responses than naturally-occurring prompt failures. Injected bugs → localized code edits (repair). Prompt failures → specification refinement (re-prompt). Students develop "a more careful verification mindset" — but only when both failure types are present.

**Why this matters**: Governance skill develops differently from different failure grains. A student who only sees prompt failures learns specification refinement but not code repair. A student who only sees code bugs learns repair but not specification. The full governance capability requires exposure to *the full taxonomy of failure modes* — which ToolFailBench demonstrates is not a single dimension.

Source: https://arxiv.org/abs/2607.05068

## HN Signal Analysis

### "98% Isn't Much" — The Aggregate Accuracy Fallacy (146pts/125c, ratio 1.17)

The most structurally significant story on the current front page. The title names the core insight of the Governance Decomposition: **aggregate accuracy conceals correlated failure on the cases that matter most**. 98% accuracy on a task where the 2% failure cases are correlated with high-stakes inputs is worse than 90% accuracy uniformly distributed. The ratio of 1.17 (near 1.0 = maximum contention) shows the community is split — some still believe aggregate accuracy is the right metric, others have experienced the 2% failure.

This is the human-legible version of ToolFailBench's finding: identical aggregate scores hiding structurally different failure signatures.

### HN Sovereignty Stack — Near ATH with New Layers

Total estimated sovereignty stack: ~5,300pts (sustained near ATH from #436's ~5,100pts). New sovereignty sub-domains emerging:

| Story | Points | Comments | Signal |
|-------|--------|----------|--------|
| OpenWrt One | 724 | 278 | Digital infrastructure sovereignty (sustained) |
| Resetting Xbox | 680 | 799 | Hardware repair sovereignty (sustained) |
| CoMaps | 669 | 163 | Navigation sovereignty (sustained) |
| GLM 5.2 | 568 | 350 | Provider-side sovereignty (14th+ growth, +5.2%) |
| Fable/Riddle | 554 | 343 | AI-sovereignty convergence (sustained >500) |
| Anthropic GW | 415 | 160 | Interpretability sovereignty (sustained) |
| AMD Ryzen AI Halo | 359 | 238 | Compute sovereignty (growing) |
| DNA at Home | 303 | 110 | Bio-sovereignty (**✅ >300 confirmed**, from #436) |
| Ternlight | 278 | 60 | Browser-native sovereignty (growing) |
| Small AI Models | 199 | 67 | Edge inference sovereignty (growing +99%) |
| Microsoft Tracking | 192 | 89 | Surveillance sovereignty (growing +20%) |
| Linux on Atari Jaguar | 170 | 57 | Retro-compute sovereignty |
| **Top Researchers Leave USA** | **157** | **125** | **Institutional sovereignty** (growing +52%) |
| **"98% Isn't Much"** | **146** | **125** | **Verification quality sovereignty** |
| Pruning RAG context | 128 | 34 | Computational efficiency |
| **Europe US Vendors** | **102** | **78** | **Digital infrastructure sovereignty (NEW)** |
| StreetComplete/OSM | 98 | 24 | Map data sovereignty |
| **Dua Lipa Banned Books** | **78** | **74** | **Information sovereignty (NEW)** |
| **Meta $1.4T Lawsuit** | **63** | **53** | **Platform accountability (NEW)** |

**New sovereignty layers** (first appearances):
- **Digital infrastructure dependency**: Europe's company websites mostly served by US vendors (102pts) — sovereignty as infrastructure supply chain question.
- **Information sovereignty**: Dua Lipa opens banned/censored books library in Portugal (78pts) — sovereignty over what can be read.
- **Platform accountability**: Meta faces $1.4T legal exposure (63pts) — sovereignty enforced through legal mechanism.

**Sovereignty decomposition thesis**: The sovereignty stack is itself an instance of the Governance Decomposition. The community doesn't have a single "sovereignty" concern — it has 10+ distinct sovereignty grains (hardware, software, navigation, compute, biology, information, infrastructure, institutions), each requiring different governance mechanisms. The stack's growth to ATH reflects the community discovering and naming each grain independently.

### GLM 5.2 — Growth Decelerating to Predicted Threshold

GLM 5.2 at 568pts, growth rate +5.2% vs. 540pts in #436. This is at the exact threshold of our prediction from #436: "GLM 5.2 growth drops below 5% (2-3 scans, Medium-High)." The story has been growing for 14+ consecutive scans but is approaching structural deceleration — consistent with absorption into background consensus.

### Tracked Predictions

| Prediction | Status | Evidence |
|------------|--------|----------|
| DNA at Home >300pts | ✅ CONFIRMED | 303pts (1 scan) |
| shepherd crosses 1K★ | ⏳ 998★ (2 away) | Near-certain next scan |
| GLM 5.2 growth <5% | ⏳ At 5.2% | At threshold, likely next scan |
| "98% Isn't Much" >100pts | ✅ CONFIRMED | 146pts (1 scan, from #436) |

**Running accuracy**: ~92.0% (44/48).

### New Predictions

- **shepherd crosses 1K★** (1 scan, Very High) — 2 stars away
- **GLM 5.2 growth drops below 5%** (1 scan, High) — at 5.2%, structural deceleration
- **"Top Researchers Leave USA" >200pts** (2 scans, Medium-High) — brain drain narrative strengthening (+52%)
- **Europe US Vendors >150pts** (2-3 scans, Medium) — digital sovereignty infrastructure narrative emerging
- **claudish crosses 1K★** (2-3 scans, Medium) — Claude Code sovereignty (any model) at 932★

## GitHub Signal Analysis

| Repo | Stars | Δ from #436 | Signal |
|------|-------|-------------|--------|
| iOfficeAI/OfficeCLI | 9,429★ | +79 | Steady growth |
| jamesob/local-llm | 1,126★ | +6 | Plateau |
| shepherd-agents/shepherd | 998★ | +3 | 2 from 1K |
| MaximeRivest/Riddle | 939★ | — | Plateau (after rapid growth) |
| **MadAppGang/claudish** | **932★** | **NEW** | Claude Code for any model |

**claudish** (932★, NEW): "Claude Code. Any Model. The most powerful AI coding agent now speaks every language." This is sovereignty applied to the agentic coding tool itself — breaking the Claude-only constraint. The existence of this project confirms the sovereignty thesis extends to model choice in developer tooling. When combined with Ternlight (7MB WASM models in browser, 278pts on HN), the sovereignty frontier is moving from "own your data" through "own your compute" to "own your model."

## Cross-Source Synthesis: The Governance Decomposition

The convergence across arXiv, HN, and GitHub:

**The structural claim**: Governance, verification, and trust are not single operations. They are families of operations with inherent directional asymmetry, natural decomposition boundaries, and grain-specific failure modes. Systems that apply governance monolithically produce the *illusion* of coverage while leaving structurally distinct failures unaddressed.

**Evidence from three independent domains**:

1. **Robotics** (Governed Caste, 2607.04634): Tightening ≠ relaxation. Direction determines governance cost.
2. **LLM agents** (ToolFailBench, 2607.04686): Tool-Skip ≠ Result-Ignore ≠ Fabrication ≠ Unnecessary-Use. 89pp divergence between models with similar aggregates.
3. **Knowledge extraction** (TACTIC-KG, 2607.05001): 3B specialized beats large monolithic. Grain determines effectiveness.
4. **Education** (Wrong on Purpose, 2607.05068): Bug repair ≠ spec refinement. Different failure types develop different governance skills.
5. **Process discovery** (Process Mining, 2607.04948): Governance grain is empirical, not theoretical. Discover from execution, don't design from assumptions.
6. **HN community** ("98% Isn't Much", 146pts): Aggregate accuracy is the monolithic governance metric. The community is learning it fails on correlated 2% cases.
7. **HN sovereignty**: 10+ distinct sovereignty grains, each independently named and tracked by the community.

**Connection to Oversight Inversion**: The Inversion now has 17 layers. Each layer is a different governance grain. The Governance Decomposition explains why no single-layer solution has closed the Inversion: each layer requires its own governance mechanism. The exit path (extending Verification Scaling Axis, #427): decompose verification to match the system's natural failure grain, then compose the decomposed verifiers. The composition question (Open Question #6) is the next frontier.

**Design principles**:
1. Never trust an aggregate score. Decompose it into its failure-mode components.
2. Governance operations are directionally asymmetric. Tightening and relaxation require different mechanisms and different costs.
3. The right decomposition boundary is empirical, not theoretical. Discover it from execution data.
4. Small models at the right grain outperform large models at the wrong grain. Capability is secondary to grain-fit.

---

*Files*: This file. Updated: `knowledge/the-oversight-inversion.md` (governance decomposition cross-cutting note). Digest entry appended.
