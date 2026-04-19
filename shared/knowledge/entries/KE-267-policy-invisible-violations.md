# KE-267: Policy-Invisible Violations — Missing Context, Not Bad Reasoning

**Date**: 2026-04-19
**Source**: DD-766 (Paper 2604.12177)
**Confidence**: Medium-High
**Connects**: KE-011 (knowledge files are passive), H-166 (binary threshold)

## Core Finding

Policy-invisible violations are a distinct failure class where agent actions are syntactically valid, user-sanctioned, and semantically appropriate — yet violate policy because **policy-relevant facts are absent from the agent's visible context**. This is fundamentally different from sycophancy (bad reasoning under social pressure) or verification failures (skipping checks). No amount of prompt engineering or behavioral intervention fixes missing context.

## Evidence

- PhantomPolicy benchmark: 600 traces across 5 frontier models, 8 violation categories
- Content-only DLP baseline: 68.8% accuracy
- Sentinel (counterfactual graph simulation): 93.0% accuracy — +24.2pp from world-model enforcement
- Manual trace review changed 5.3% of labels vs automated eval (validates production-first eval)

## Mechanism / Why

The agent literally cannot see the policy-relevant state (entity attributes, session history, org context). Reasoning quality is irrelevant — the information isn't there. Sentinel works by speculatively executing actions against a knowledge graph to materialize post-action world state, then checking graph-structural invariants.

## Implications

### 1. Three distinct failure classes need different interventions
Sycophancy → behavioral/structural. Verification gaps → skill/workflow. Policy-invisible → context architecture. Mixing interventions across classes wastes effort (echoes KE-123: don't stack interventions).

### 2. World-model verification is a new enforcement paradigm
Sentinel's counterfactual graph simulation goes beyond our hard-gate/skill taxonomy. It's a third category: proactive world-state reasoning before action execution.

### 3. Connects to KE-011's "passive knowledge" problem
If critical policy info lives in files agents don't read, we get policy-invisible violations in our own system. Context injection isn't just convenience — it prevents an entire failure class.

## Actionable

- When diagnosing agent failures, first classify: bad reasoning vs missing context. Different root cause → different fix.
- Consider whether our verification/hard-gate taxonomy needs a "world-model check" category for context-dependent policies.
- 5.3% label change from manual review reinforces: automated eval alone is insufficient for nuanced failures.

## Open Questions

- How expensive is counterfactual graph simulation at scale? Sentinel's accuracy gain is clear but runtime cost unclear.
- Could a lightweight version (entity-attribute lookup rather than full graph sim) capture most of the gain?
- What fraction of our own agent failures are policy-invisible vs reasoning failures?
