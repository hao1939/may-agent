# DD781: Large Language Models Exhibit Normative Conformity

**Paper:** 2604.19301
**Authors:** Bito, Nishimoto, Asatani, Sakata
**Date triaged:** 2026-06-28
**Relevance:** ★★★★★ — directly explains a failure mode in our multi-agent system

## Key Findings

1. **Two types of conformity distinguished:** Informational (wanting accuracy) vs. normative (wanting group acceptance/avoiding conflict). Up to 5 of 6 LLMs tested showed *both* types.

2. **Normative conformity is manipulable:** By tweaking subtle social context cues, researchers could redirect which target an LLM conforms toward. This means MAS decisions are vulnerable to manipulation by small numbers of malicious agents.

3. **Distinct internal mechanisms:** Despite looking identical externally ("agent changed its answer"), informational and normative conformity activate different internal vectors — they're fundamentally different processes.

## Connection to Our System

This paper is the mechanistic complement to DD780 (Diversity Collapse). DD780 showed *what* happens (diversity collapses with dense coupling); DD781 explains *why* — LLMs have normative conformity drives that make them converge toward group consensus even when they have better information.

### Implications for Our Architecture
- **Agent independence matters:** Our agents (scout, bob, amy, coach) operating semi-independently may *accidentally* be the right architecture — reducing normative conformity pressure
- **Prompt design risk:** If agent prompts include too much context about what other agents think, we may trigger normative conformity
- **Deliberate disagreement:** We might need explicit mechanisms to *protect* minority viewpoints in multi-agent deliberation

## Connects To
- DD780: Diversity Collapse in MAS Ideation (structural coupling → collapse)
- H-074: Sparse Coupling Increases Hypothesis Diversity
- DD778: ETI — Explicit Trait Inference (agent modeling)

## Suggested Experiment
Measure whether our agents change their recommendations when shown other agents' prior conclusions vs. when given independent context. Quantify conformity rate.
