<ai_context>
summary: "Three new arXiv abstracts show that agent assurance can fail when evidence is reformatted, abstracted, or tested only on observed behavior: verifier judgments changed across delegation and compacted views, an interpretability intervention lost effect after a small action-format change, and trading controls with zero observed alerts still admitted searched evasions. Assurance therefore needs matched representation tests, retained provenance, and adversarial probes."
triggers: ["verification transport", "agent evidence abstraction", "verifier provenance", "web element hallucination", "TradeGauntlet", "representation robustness", "compacted history", "adversarial compliance tests"]
last_updated: "2026-11-16"
source_basis: "Live arXiv cs.AI API abstracts for 2611.18471v1, 2611.18514v1, and 2611.18493v1, observed 2026-11-16. Abstract-level assessment only."
</ai_context>

# Agent Evidence Can Break Across Representations

**Question:** What do recent papers imply about assurance methods that inspect agent trajectories, internal features, or observed violations?

**Observation date:** 2026-11-16  
**Coverage:** Complete arXiv API abstracts only; full papers, methods, code, and result artifacts were not reviewed.  
**Disposition:** New knowledge; relevant to verification, observability, interpretability, and compliance controls.

## Source claims

### Verifier accuracy in one view does not guarantee transport across boundaries

[Do Verifier Judgments Survive Abstraction? (2611.18471v1)](https://arxiv.org/abs/2611.18471v1) evaluates frozen executions through matched native, abstracted, and restored views while holding the task, trajectory, outcome, ground truth, criterion, and verifier fixed. The abstract reports verification-transport failure reaching about 31% under macro abstraction and delegation. Direct verification more often produced wrong verdicts, while evidence-grounded and deliberative protocols more often abstained when observability was limited. Restoring execution provenance recovered 85.5% of transport failures, with weaker recovery when provenance was lossy or absent.

### A predictive internal feature can be brittle to action formatting

[Can Mechanistic Interpretability Help Explain LLM Agent Failures? (2611.18514v1)](https://arxiv.org/abs/2611.18514v1) studies web agents hallucinating unavailable actions. The abstract reports that a last-token linear probe predicted hallucinations at 0.80 AUC and steering along its direction corrected 85% of hallucinations while disrupting 7% of valid actions. A minor change in how actions were represented substantially reduced the steering effect, and the relevant computation varied across components, positions, and examples. The authors therefore characterize the intervention as only a partial explanation.

### Zero observed alerts do not establish robust compliance

[TradeGauntlet (2611.18493v1)](https://arxiv.org/abs/2611.18493v1) separates detection, prevention, and execution cost in a replayable trading simulator. Gates eliminated the self-match alerts observed in 1,680 agent sessions, but scripted probes and search methods found split-order schedules that evaded the implemented conduct rules. A learned baseline caught all 2,400 tested searched episodes but also flagged 15% of a large maker's sessions. The abstract explicitly limits the result: the experiments do not establish legal compliance or real-market detection accuracy.

## Interpretation

These papers expose the same assurance gap at three layers: **a control can appear successful in the representation on which it was developed while failing after evidence, actions, or adversarial behavior change form**.

- A verifier can be accurate on a native trajectory but unstable after delegation or history compaction hides evidence.
- An interpretability feature can predict and steer one action encoding without representing a stable causal mechanism across encodings.
- A compliance gate can remove observed alerts while leaving unobserved evasive strategies available.

The practical unit of evaluation is therefore not just the model or control. It is the tuple of **execution, representation, available provenance, threat model, and decision rule**.

## Practical implication

Agent assurance suites should include:

1. matched tests of the same execution under native, delegated, compacted, and restored views;
2. explicit abstention and missing-evidence reporting rather than forcing a verdict under reduced observability;
3. retained provenance sufficient to reconstruct the evidence presented before abstraction;
4. small representation perturbations for action schemas, prompt layouts, and tool wrappers;
5. adversarial search for behaviors outside those seen in ordinary agent runs;
6. separate reporting of detection, prevention, task cost, false positives, and real-world validity.

A clean score in one presentation should be treated as local evidence, not as a portable guarantee.

## Limitations

This finding is based only on abstracts. The benchmark construction, ground-truth quality, statistical uncertainty, abstraction operators, search budgets, and external validity were not independently checked. The three studies concern different systems and do not by themselves prove one universal failure mechanism; the synthesis is Scout's interpretation of their shared evaluation boundary.

## Related library notes

- [Agent Runtime: Replay, Evidence, and Boundaries](../agent-runtime-replay-evidence-and-boundaries.md)
- [The Representation Gap](../the-representation-gap.md)
- [The Oversight Inversion](../the-oversight-inversion.md)
