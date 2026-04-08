# DD#642 — TRACE: LLM Trust Allocation Across Conflicting Software Artifacts

**Source**: arXiv:2604.03447 (cs.SE, cs.AI, April 7 2026)
**Authors**: Ulfat, Sabit, Hossain
**Rating**: ★★★★

## Core Idea

TRACE (Trust Reasoning over Artifacts for Calibrated Evaluation) reveals how LLMs allocate trust when code, documentation, and tests disagree. Using 22,339 trust traces from 7 models on 456 Java bundles with blind perturbations, it exposes a systematic blind spot: models are far better at auditing natural-language specs than detecting subtle code-level drift.

## Key Findings

1. **Asymmetric sensitivity**: Documentation bugs induce much larger quality penalties than implementation faults (0.152-0.253 vs 0.049-0.123 gap between heavy and subtle perturbations)
2. **Blind spot**: When only implementation drifts but documentation stays plausible, detection drops 7-42 percentage points
3. **Documentation bugs detected well** (67-94%), but **code drift with intact docs** systematically missed
4. **Confidence poorly calibrated** for 6 of 7 models
5. **LLMs trust natural language over code** — a fundamental bias

## Why This Matters (GStack Relevance)

This has direct implications for agent harnesses that need to decide which artifact to trust:
- **CR#307 (Decoction Architecture)**: Trust allocation determines what gets decocted. If agents systematically over-trust docs over code, decoction will inherit that bias.
- **DD#621 (Tool Illusion)**: Tools mediate artifact access. If the trust allocation is biased, tools amplify the bias.
- **CR#309 (Agent Capability Boundary)**: "Perception failure surface" — agents perceive docs better than code.
- **Law 33 (Observation Quality)**: Concretizes the observation quality issue — agents don't observe code drift.

## Critical Insight: Documentation as Attack Surface

If LLMs over-trust natural language specs, an adversary (or simply stale docs) can lead an agent to ignore actual code behavior. This is the "plausible documentation" attack on agent systems.

## Tags
`trust-reasoning` `artifact-trust` `code-documentation-conflict` `calibration` `agent-perception` `bias`
