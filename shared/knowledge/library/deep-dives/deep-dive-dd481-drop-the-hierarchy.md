# Deep-Dive DD#481: Drop the Hierarchy — Self-Organizing LLM Agents

**Paper**: arXiv:2603.28990
**Authors**: Victoria Dochkina
**Submitted**: 2026-03-30, to IEEE Access
**Rating**: ★★★★★ CRITICAL
**GRA Gaps**: Gap 1 (Theoretical Foundations), Gap 3 (Integration/Coordination)

## Core Contribution

The largest systematic study of coordination architecture in multi-agent LLM systems to date: **25,000+ tasks, 8 models, 4–256 agents, 8 coordination protocols**. Discovers the **Endogeneity Paradox**: neither maximal external control nor maximal agent autonomy is optimal. A hybrid protocol (Sequential) with fixed ordering but autonomous role selection outperforms both centralized (+14%) and fully autonomous (+44%) coordination.

## Key Findings

### 1. The Endogeneity Paradox
- **Sequential** (hybrid: fixed order, autonomous roles) >> Coordinator (centralized) >> Broadcast/Shared (fully autonomous)
- Sequential: Q=0.875, Coordinator: Q=0.767, Shared: Q=0.503
- Effect size: Cohen's d=1.86 (p<0.0001) between best and worst protocols
- **WHY it works**: Sequential gives agents *completed outputs* (factual, current) vs. intentions (may change), history (may be stale), or coordinator's plan (may be suboptimal)
- **Critical insight**: Protocol choice (44% quality variation) > Model choice (~14%) for strong models

### 2. Model Capability Threshold
- Self-organization is a **privilege of strong models**
- Claude Sonnet 4.6: free-form > fixed (+3.5%) — autonomy helps
- GLM-5: free-form < fixed (-9.6%) — autonomy HURTS
- Three required capabilities: (1) self-reflection, (2) deep reasoning, (3) instruction following
- Claude: 8.6% voluntary abstention rate; GLM-5: 0.8% — can't self-assess

### 3. Sub-Linear Scaling to 256 Agents
- Quality constant from 64→256 agents (Kruskal-Wallis H=1.84, p=0.61)
- Cost grows only 11.8% for 8x more agents
- At N=256, ~45% of agents self-abstain — endogenous cost optimization
- Specialization grows: 75% unique roles at N=4 → 91% at N=64

### 4. Emergent Properties (Zero-Shot, No Training)
- **Dynamic Role Invention**: 5,006 unique roles from 8 agents across tasks. RSI→0 — agents reinvent specialization per task rather than settling into fixed positions
- **Voluntary Self-Abstention**: 38/60 non-contributors in Sequential withdrew voluntarily (endogenous), vs. 60/60 excluded by coordinator (exogenous). Voluntary abstention correlates with HIGHER quality
- **Spontaneous Hierarchy**: System prefers flat structures. Hierarchy depth grows from 1.0→2.0 for N=4→64. Deeper hierarchies emerge spontaneously for harder tasks (L1: HD=1.22, L4: HD=1.56)

### 5. Open-Source Parity
- DeepSeek v3.2: 95% of Claude's quality at 24x lower cost
- On L4 adversarial tasks, DeepSeek actually trends BETTER (+6.0%, p=0.082)
- Different self-organization strategies: Claude maximizes role diversity (Gini=0.055), DeepSeek maximizes cost efficiency (22.4% idle, 8.5/16 agents active)

### 6. Task Complexity Frontier
- L1→L4 quality drops 37.7% (Cohen's d=22.9)
- L4 adversarial (conflicting stakeholders, incomplete info) is the current frontier: Q≈0.614
- System spontaneously deepens hierarchy for harder tasks without being told to

## Methodology Highlights
- 8 models tested: Claude Sonnet 4.6, GPT-5.4, GPT-4o, GPT-4.1-mini, Gemini-3-flash, GigaChat 2 Max, DeepSeek v3.2, GLM-5
- LLM-as-judge evaluation: 5 dimensions × 4-point scale, independent judge model
- 4 primary protocols: Coordinator, Sequential, Broadcast, Shared
- 4 bio-inspired protocols: Morphogenetic, Clonal, Stigmergic, Ripple (forthcoming)
- Shock resilience tested: random/hub agent removal, model substitution, regulatory shifts
- All within-series comparisons use same judge for internal validity

## Architecture Insight: The Three-Ring Framework
The paper proposes a constitutional framework for governing autonomous multi-agent organizations. The Sequential protocol works because it satisfies a specific information requirement: agents need **realized facts** (completed predecessor outputs), not plans, intentions, or memories.

## Connection to Prior Work

### Confirms DD#479 (Reliability Limits)
DD#479 proved multi-agent ≤ centralized Bayes without new exogenous signals. This paper provides the empirical nuance: the Sequential protocol works precisely because each agent gets *new information* (predecessor output) that constitutes an exogenous signal. The Shared protocol fails because agents only have stale memory — no new signals. **DD#479's theoretical limit is the mechanism behind the Endogeneity Paradox.**

### Confirms DD#480 (Emergent Social Risks)
DD#480 found 15 emergent risk types in LLM collectives. This paper's finding of spontaneous hierarchy formation, role invention, and self-abstention adds to the emergent behavior catalog — but these are *beneficial* emergent properties. **The critical variable is whether emergent behavior has good information flow** (Sequential: yes, Shared: no).

### Confirms CR#268 (Multi-Agent Paradox)
CR#268 synthesized "can't help without new signals + can hurt with emergent risks." This paper resolves the paradox: Sequential protocol provides new signals (predecessor outputs) AND constrains emergent behavior (fixed ordering). **Signal Expansion > Role Expansion** is directly validated — the 5,006 unique roles emerge spontaneously, but what matters is the information flow architecture.

### Confirms CR#267 (Deception ↔ Values)
Self-abstention as a voluntary, beneficial behavior contrasts with DD#477's deceptive equivocation. Both are emergent — but self-abstention requires self-reflection capability that weak models lack. **Model capability threshold determines whether emergent behavior is constructive or destructive.**

## Limitations
1. LLM-as-judge evaluation (though multi-criteria and independent judge model)
2. API models may have been updated during 3-month experiment period
3. Judge model changed between series (GPT-4o → GPT-5.4)
4. Task domain focused on knowledge work (business/tech analysis), not coding or creative tasks
5. Bio-inspired protocols (4 of 8) results deferred to companion paper

## Significance for MAS Research
This is the most comprehensive empirical study of coordination architecture in LLM-based multi-agent systems. It provides:
1. **Actionable design principle**: Sequential > Coordinator > Shared for capable models
2. **Scaling evidence**: Sub-linear cost, stable quality to 256 agents
3. **Model selection criterion**: Capability threshold determines whether to use self-organization or rigid structure
4. **Theoretical bridge**: The information-flow mechanism connecting to DD#479's theoretical limits

**Bottom line**: "Give agents a mission, a protocol, and a capable model — not a pre-assigned role." The Endogeneity Paradox is the single most important empirical finding for MAS architecture design since our tracking began.
