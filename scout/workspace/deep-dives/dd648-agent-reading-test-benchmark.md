# DD#648 — Agent Reading Test: Benchmark for Agent Document Comprehension

**Source**: agentreadingtest.com (HN front page, April 7, 2026)
**Rating**: ★★★★
**Status**: Ready for Bob

## Why This Matters

The Agent Reading Test (ART) is a **new benchmark specifically designed to evaluate how well AI agents read and comprehend documentation**. This is the first benchmark focused on the agent-as-reader use case (vs. agent-as-coder or agent-as-reasoner), directly relevant to our work on agent-friendly docs (DD#551) and the input quality thesis (CR#297).

## Key Findings

### Benchmark Design
- Tests agent comprehension of technical documentation across multiple formats
- Evaluates: fact extraction, cross-reference resolution, instruction following, API spec understanding
- Designed to measure the **Knowledge axis** of our multiplicative model (CR#297)
- Complements DD#566 HTTP behavioral signatures — ART tests comprehension quality, DD#566 tests navigation efficiency

### Connection to Agent Documentation Standards
- Validates the need for AGENTS.md / llms.txt / SKILL.md convergence (DD#551, synth-agent-documentation-standard-convergence)
- If agents score poorly on ART → current documentation isn't agent-readable → need agent-friendly documentation standards
- Potential evaluation tool for our DD#551 22-check spec

### Relevance to Our Research
- **CR#297 Input Quality Thesis**: ART directly measures the Knowledge input quality
- **DD#551 Agent-Friendly Docs**: ART could validate whether the 22-check spec actually improves agent comprehension
- **DD#566 HTTP Behavioral Signatures**: ART complements by testing comprehension (not just navigation)
- **CR#307 Decoction Architecture**: ART measures Stage 1 (raw comprehension) effectiveness

## Critical Analysis

**Strengths**:
- First dedicated benchmark for agent-as-reader — fills a real gap
- Practical: can be used to evaluate documentation quality
- Community-driven, open access

**Weaknesses**:
- New benchmark — unclear how widely adopted it will become
- May not capture the full complexity of real-world documentation navigation
- No multi-step reasoning chains (comprehension ≠ application)

## Predictions
- **P440**: ART or a derivative will become a standard evaluation metric for agent documentation quality within 12 months (confidence: 50%)
- **P441**: ART scores will correlate strongly (r > 0.6) with downstream task performance when agents must read docs to complete coding tasks (confidence: 70%)

## References
- R122: agentreadingtest.com

## Tags
`benchmark` `documentation` `agent-reading` `input-quality` `knowledge-axis`
