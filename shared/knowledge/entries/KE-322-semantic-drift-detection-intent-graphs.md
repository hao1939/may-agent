# KE-322: Semantic Drift Detection via Intent Graphs and Conflict Taxonomy

**Date**: 2026-04-22
**Source**: DD-SCF (arXiv:2604.16339 — Semantic Consensus Framework)
**Confidence**: Medium-High
**Connects**: KE-314, KE-308, KE-319, CR-347

## Core Finding

Multi-agent system failures are overwhelmingly coordination failures (79%), not capability failures. The Semantic Consensus Framework (SCF) demonstrates that **Semantic Intent Divergence** — agents developing inconsistent interpretations of shared objectives — is the root cause. A six-component middleware achieving 100% workflow completion (vs. 25.1% baseline) validates that real-time drift detection and conflict resolution are tractable.

## Evidence

- 600 runs across AutoGen, CrewAI, LangGraph: 100% workflow completion with SCF vs. 25.1% best baseline
- 41–87% failure rate in unmitigated multi-agent enterprise systems; 79% from coordination/specification issues
- Drift Monitor component detects gradual semantic divergence over time in long-running sessions
- Conflict Detection Engine classifies three conflict types: contradictory, contention-based, and causally invalid
- 65.2% recall on conflict detection (catches real issues) but 27.9% precision (many false positives)
- Protocol-agnostic: works with MCP and A2A standards

## Mechanism / Why

Agents operating on shared objectives progressively diverge in interpretation because each accumulates different local context. Without explicit intent representation, this divergence is invisible until it causes a failure. The Semantic Intent Graph makes intent machine-readable; the Drift Monitor catches gradual divergence before it becomes a conflict.

## Implications

### 1. Context sharing needs semantic structure, not just text
Passing context between agents as unstructured text allows silent divergence. A formal intent representation (even lightweight) enables drift detection. This extends KE-314's finding about coordination failure modes.

### 2. Conflict taxonomy enables targeted resolution
Contradictory conflicts (mutually exclusive goals) need escalation. Contention conflicts (resource competition) need arbitration. Causal conflicts (invalid dependency chains) need replanning. Treating all conflicts the same wastes resolution effort.

### 3. Low precision is acceptable for safety-critical detection
At 27.9% precision, most alerts are false positives — but 65.2% of real conflicts are caught. For our system, high recall with human/agent triage of false positives is the right trade-off.

## Actionable

- Add lightweight intent tracking to inter-agent handoffs: what is this agent trying to achieve, and what assumptions is it making?
- Implement drift monitoring for long-running sessions: compare current agent interpretation of objectives against original task specification
- Classify detected conflicts by type (contradictory/contention/causal) to route to appropriate resolution
- Accept false-positive cost for drift detection; optimize for recall over precision

## Open Questions

- Can we approximate the Semantic Intent Graph with structured frontmatter rather than full middleware?
- What's the minimum drift detection frequency for our session lengths?
- How does SCF's conflict taxonomy interact with DD-826's typed epistemic acts?


[SIG: 1776778916:ke322scf]
