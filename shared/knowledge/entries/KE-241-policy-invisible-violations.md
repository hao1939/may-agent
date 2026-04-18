# KE-241: Policy-Invisible Violations — Missing Context as a Distinct Failure Class

**Date**: 2026-04-18
**Source**: DD-766 / 2604.12177
**Confidence**: High
**Connects**: KE-011 (knowledge files are passive), H-173 (adaptive meta-cognitive resource allocation)

## Core Finding

Policy-invisible violations are a new failure class where agent actions are syntactically valid, user-sanctioned, and semantically appropriate, yet violate organizational policy because policy-relevant facts are absent from the agent's visible context. Content-only enforcement achieves only 68.8% accuracy; Sentinel's counterfactual graph simulation (world-model-based verification) reaches 93.0%.

## Evidence

- PhantomPolicy benchmark: 8 violation categories, 600 traces across 5 frontier models, all manually reviewed
- Manual trace review changed 5.3% of labels — automated eval alone misses these
- Sentinel counterfactual graph: treats actions as proposed graph mutations, speculatively executes to check invariants → Allow/Block/Clarify

## Mechanism / Why

The agent reasons correctly given its visible context but lacks entity attributes, contextual state, or session history needed to evaluate policy compliance. No amount of better prompting or reasoning fixes this — the information literally isn't there. Sentinel works by maintaining a world model and checking structural invariants against the post-action state, surfacing violations that are invisible to content-only analysis.

## Implications

### 1. Architectural enforcement beats prompt-level safety
You cannot prompt your way out of missing context. This validates our hard-gate approach over behavioral interventions for safety-critical failures.

### 2. World-model verification is a novel enforcement paradigm
Sentinel's counterfactual graph simulation goes beyond our current hard-gate/skill taxonomy — it represents checking actions against a maintained world model, not just pattern-matching on outputs.

### 3. Automated eval has a 5% blind spot
The 5.3% label correction rate from manual trace review reinforces that production eval needs trace-level human review for high-stakes decisions.

## Actionable

- When designing verification guards, consider what context is *invisible* at decision time — add context injection, not just output checks
- Explore world-model-based verification for our agent system (maintain graph of system state, verify actions against invariants)

## Open Questions

- How expensive is maintaining a counterfactual knowledge graph at scale?
- Could a lightweight version of Sentinel's approach work for our inter-agent coordination (checking proposed actions against shared state)?
