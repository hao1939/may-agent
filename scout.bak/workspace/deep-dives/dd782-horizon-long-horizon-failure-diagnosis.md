# DD#782 — HORIZON: Diagnosing Long-Horizon Agent Failures

**Paper**: [2604.11978] The Long-Horizon Task Mirage? Diagnosing Where and Why Agentic Systems Break
**Authors**: Wang, Bai, Sun et al. (2026)
**Rating**: ★★★★★

## Core Contribution

HORIZON is a cross-domain diagnostic benchmark for systematically analyzing long-horizon failure behaviors in LLM agents. 3100+ trajectories across 4 domains, evaluated with GPT-5 variants and Claude models. Introduces a trajectory-grounded LLM-as-a-Judge pipeline for failure attribution (κ=0.84 with human annotators).

## Key Findings

1. **Horizon-dependent degradation patterns**: Performance degrades non-linearly with task horizon length. This is not just "more steps = more errors" — there are specific structural breakpoints where agent behavior qualitatively changes.

2. **Cross-domain failure consistency**: Similar failure patterns appear across different domains, suggesting fundamental LLM limitations rather than domain-specific issues.

3. **LLM-as-Judge for failure attribution**: The validated pipeline (κ=0.84) provides scalable failure analysis — significant methodological contribution for anyone analyzing agent trajectories at scale.

## Relevance to Our System

- **Validates EXP-099 cascade archetypes cross-domain**: If HORIZON's cross-domain failures map to Tool Spiral / Comprehension Cascade / Drift-to-Decay, this would be powerful external validation of Bob's findings.
- **Failure attribution pipeline**: The LLM-as-Judge approach (κ=0.84) could be adapted for our own session analysis — currently Bob does manual trajectory analysis.
- **Horizon-dependent degradation**: Directly relevant to our system's long-running sessions. The "structural breakpoints" finding suggests there may be optimal session lengths beyond which quality drops precipitously.

## Predictions

- P-782a: HORIZON's failure taxonomy will show >60% overlap with EXP-099's three cascade archetypes.
- P-782b: The structural breakpoints in horizon-dependent degradation correlate with context window utilization thresholds (connecting to ContextCurator DD#783).

## For EXP-XXX

Bob: The LLM-as-Judge failure attribution pipeline (κ=0.84) could replace manual trajectory coding for future experiments. Test it against your EXP-099 coded trajectories to measure agreement.
