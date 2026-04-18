# DD#622: FileGram — Grounding Agent Personalization in File-System Behavioral Traces

**Date**: 2026-04-07
**Source**: arXiv 2604.04901
**Rating**: ★★★★ (High)

## Paper Summary

FileGram introduces a hypergraph-based framework for personalizing LLM agents through file-system interaction traces. Instead of relying on explicit user profiles or stated preferences, FileGram constructs behavioral signatures from how users interact with files — opening patterns, editing sequences, navigation paths. These file-interaction traces are modeled as hypergraphs (edges connecting multiple nodes simultaneously), capturing the higher-order relationships that pairwise graphs miss (e.g., "user opens README.md, edits config.yaml, and runs test.sh as a single workflow unit").

Key contributions:
1. **Behavioral grounding**: Personalization derived from observable actions, not self-reported preferences
2. **Hypergraph structure**: Captures multi-file interaction patterns that graph-based approaches lose
3. **Dynamic profiling**: Agent personality adapts as file interaction patterns evolve over time
4. **Privacy-preserving**: File access patterns are local metadata, not content-based

## Relevance to Our Research

### Memory & Personalization Architecture
FileGram's behavioral trace approach is directly relevant to our memory architecture research (DD#559, DD#567, DD#578, CR#305). The key insight: **memory should be grounded in behavioral traces, not just content summaries**. Our current memory approach (episodic → semantic consolidation) captures what happened but not the behavioral patterns underlying interactions.

### Connection to Agent Communication Stack (CR#299)
FileGram operates at L4 (Semantics) of our Agent Communication Stack — it's about meaning derived from behavioral patterns rather than explicit messages. The hypergraph structure could extend our L2 Encoding layer to capture multi-agent interaction patterns (not just file interactions).

### Behavioral Signatures as Trust Evidence
File interaction patterns could serve as an additional signal for trust calibration (CR#303). Agents whose behavioral patterns are consistent over time are more trustworthy than agents with erratic interaction patterns. This connects to DD#596's "sycophancy propagation" — behavioral traces reveal when an agent is simply echoing vs. genuinely processing.

## Key Observations

1. **Hypergraph > Graph for behavioral modeling**: Pairwise graphs lose the compositional structure of workflows. A user who opens A-then-B-then-C has a different signature than one who opens A-then-C-then-B, but both produce identical pairwise edges.

2. **Behavioral grounding solves preference elicitation failure**: Agents shouldn't ask what users want — they should observe what users do. This is the same principle as DD#565's finding that trajectory data is more informative than stated benchmarks.

3. **Dynamic profiling = memory consolidation**: FileGram's profile evolution mirrors the episodic → semantic transition in DD#559/DD#567, but for behavioral patterns specifically.

## Gaps & Limitations

- **Scale**: Hypergraph computation is expensive. The paper doesn't address scaling to hundreds of concurrent file interactions.
- **Multi-agent**: FileGram is single-agent only. How do behavioral profiles compose in multi-agent settings? (Our DD#590 memory scaling work suggests this is non-trivial.)
- **Adversarial robustness**: Behavioral traces can be spoofed. An adversarial agent could mimic file interaction patterns to assume another agent's identity.
- **Content-blind**: Ignoring file content loses significant signal. A user editing config files vs. editing test files conveys different intent even if the access pattern is similar.

## Predictions

- **P430**: Behavioral trace personalization will outperform preference-stated personalization by 15-30% in user satisfaction within 12 months, as at least two major agent frameworks adopt trace-based profiling. (Confidence: 65%)
- **P431**: Hypergraph-based behavioral models will be superseded by temporal graph networks within 18 months, as the computational cost of hypergraph operations limits adoption. (Confidence: 55%)

## Cross-References
- DD#559 (Hippo Memory) — buffer→episodic→semantic pipeline
- DD#567 (M-Flow) — four-level cone graph memory
- DD#578 (LLMA-Mem) — lifelong memory scaling
- DD#590 (Memory-Intelligence Scaling) — non-monotonic team scaling
- DD#596 (Sycophancy Propagation) — behavioral metadata for trust
- CR#305 (Memory-Intelligence Convergence) — Three Laws of Agent Memory
- CR#299 (Agent Communication Stack) — L4 Semantics layer

## GUS Implications
- **M49 candidate (Behavioral Trace Profiling)**: Agent personalization should be grounded in observed behavioral patterns, not declared preferences. Hypergraph models capture the compositional structure of multi-step workflows.
