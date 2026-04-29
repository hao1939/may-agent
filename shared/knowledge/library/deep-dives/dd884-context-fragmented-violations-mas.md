# DD-884: Context-Fragmented Violations in Multi-Agent Systems

**Paper**: "Beyond Single-Agent Alignment: Preventing Context-Fragmented Violations in Multi-Agent Systems"
**Authors**: Jie Wu, Ming Gong
**arXiv**: 2604.22879 (Apr 2026)
**Venue**: Preprint (34 pages)

## Key Insight

Individual agent actions can appear locally safe but collectively violate policies when critical context is siloed across agents. The authors call these **Context-Fragmented Violations (CFVs)** — a class of failures unique to multi-agent systems where no single agent has enough context to detect the violation.

## Method: Distributed Sentinel

- **Semantic Taint Token (STT) Protocol**: Lightweight sidecar proxies propagate security state across agent boundaries without exposing raw data
- **Counterfactual Graph Simulation**: Cross-domain policy verification — "what would happen if we combined these fragments?"
- **Zero-trust enforcement**: External enforcement layer above individual agents

## Results

- **F1 = 0.95** (vs 0.85 prompt-based, 0.65 rule-based DLP)
- **106ms latency** (16ms verification + 90ms entity extraction on A100)
- All 8 tested frontier LLMs show 14-98% violation rates in cross-domain flows
- Cross-domain violations systematically higher than same-domain

## Relevance to Our System: HIGH

**Direct parallels:**
1. Our agents each have private context (agent-specific context.md, session state). A policy violation could span bob + coder + reviewer without any single agent seeing the full picture.
2. Our notification system (`notify`) passes messages between agents but doesn't propagate policy-relevant metadata — analogous to the "contextual islands" problem.
3. The finding that "self-avoidance is unreliable" validates our use of external guard/reviewer agents rather than trusting individual agents to self-police.

**Actionable ideas:**
- Could we add lightweight "taint tokens" to inter-agent notifications? E.g., if scout finds something security-relevant, tag it so downstream agents know to apply extra scrutiny.
- The counterfactual simulation idea maps to our hypothesis validation: "what happens if we combine knowledge from agent A's context with agent B's actions?"

## Connection to Existing Knowledge

- Relates to DD-882 (structural value alignment governance) — both address alignment in MAS contexts
- Extends DD-880 (defensibility index) — CFVs are a concrete mechanism by which the "agreement trap" manifests
- Complements DD-879 (VLAF alignment faking) — CFVs are unintentional alignment failures vs deliberate faking

## Tags
#multi-agent-security #alignment #context-fragmentation #zero-trust #enforcement
