# KE-074: Process-Outcome Verification Separation — The Universal Verifier Paradigm

**Status**: Theoretically Supported  
**Source**: DD-662 (The Art of Building Verifiers for Computer Use Agents — Universal Verifier)  
**Author**: Bob (Architect)  
**Date**: 2026-04-09

---

## Core Finding

Microsoft's Universal Verifier achieves human-level agreement on agent trajectory verification by separating **four independent design concerns** that prior work conflated. The key architectural insight: **process quality and outcome quality are independent dimensions that systematically disagree in important cases**.

### The Four Principles

| Principle | What It Solves | Our System Analog |
|-----------|---------------|-------------------|
| **Non-overlapping rubrics** | Phantom criteria, cascading penalties | Convention checks should be logically independent |
| **Process/outcome separation** | Agent does right steps but hits wall, or stumbles but succeeds | C-scores (process) vs product quality (outcome) |
| **Controllable/uncontrollable distinction** | Penalizing agents for login walls, CAPTCHAs | Timeout vs wrong-approach failures |
| **Divide-and-conquer context** | Needle-in-haystack over long trajectories | Selective evidence extraction per criterion |

### Performance Numbers

| Metric | Prior Best | Universal Verifier |
|--------|-----------|-------------------|
| Cohen's κ (outcome) | 0.44 | **0.64** |
| False Positive Rate | ≥22% | **~1%** |
| Human agreement | ~86% | **Human-level** |

**Critical**: Upgrading baseline LLMs to GPT-5.2 didn't close the gap. Gains come from **design**, not model strength. This is a structural insight — better architecture beats better models for verification.

## The Auto-Research Finding

The paper includes a study of Claude Code (Opus 4.6) attempting to replicate the verifier from scratch:

- **AI achieves 70% of expert quality in 5% of the time** (κ ≈ 0.55 vs 0.64)
- **Key failure mode**: AI makes "conservative and incremental" edits, missing structural step-function improvements
- **But**: When initialized from expert's best config, AI **exceeded expert peak**
- **Conclusion**: Human expertise + automated optimization are **complementary**, not substitutable

This directly validates our system architecture: **Bob designs structures, Coach/agents optimize within them**.

## Connection to Our Knowledge Base

### Direct Validation of Verification Separation Thesis
This paper provides the strongest external evidence for the principle behind our evaluation architecture. Five independent systems (now six with UV) converge on external evaluation as structurally necessary:

1. Our own gym evaluation (external evaluation separated from execution)
2. SELFDOUBT (DD-656) — external uncertainty detection
3. Blind Refusal (DD-659) — reasoning ≠ behavior, need external check
4. AgentCity (DD-657) — adjudication branch separated from execution
5. Emergent regulation (DD-661) — peer correction as external signal
6. **Universal Verifier (DD-662) — process/outcome separation with rubric-first design**

### Process/Outcome Separation Maps to Our Evaluation
Our evaluation currently blends:
- **Convention compliance** (C-scores) = process quality
- **Product quality checks** = outcome quality  
- **Behavioral checks** = a mix of both

The UV paradigm suggests we should score these independently and recognize cases where they disagree:
- Agent follows all conventions perfectly but produces wrong output → high process, low outcome
- Agent breaks conventions but delivers correct result → low process, high outcome
- These cases need different interventions (process failures need skills/constraints, outcome failures need better reasoning)

### Auto-Research Validates Human-AI Architecture
The 70%/5% efficiency ratio with conservative-and-incremental failure mode precisely matches our experience:
- **Coach optimizes within Bob's architectural designs** → effective
- **Coach makes structural decisions independently** → limited (see EXP-216 delegation failures)
- **The pattern**: human architects provide step-function insights, AI agents provide gradient optimization

### Rubric-First Evaluation → Task-Only Assessment
UV generates rubrics from the TASK, not from the trajectory. This prevents the evaluator from rationalizing whatever the agent did. Our gym scenarios already do this (scenario defines success criteria before any agent runs), but our production evaluation doesn't always.

## What This Means for Practice

1. **Separate process and outcome in all evaluation**: Score conventions and product quality independently. Track disagreement as a signal.
2. **Classify failures as controllable vs. uncontrollable**: Timeouts, API failures, missing context → don't count against agent. Wrong approach, reasoning errors → do count.
3. **Rubric-first for new scenarios**: Always define success criteria before seeing any agent output. Prevents rationalization.
4. **Auto-research efficiency**: When agents do research/optimization, seed them with expert-designed starting points — don't expect structural innovation from scratch.

## Limitations

- **CUA-specific**: Universal Verifier is designed for computer-use (screenshot) verification — our text-based agents have different evaluation modalities
- **Rubric generation itself is a frontier**: The paper doesn't fully solve generating perfect rubrics from task descriptions
- **Process/outcome correlation**: In most cases they agree — the interesting cases are the minority where they disagree

## Open Questions

1. **How often do process and outcome disagree in our system?** Need to audit evaluation data for convention-pass/product-fail and convention-fail/product-pass cases.
2. **Can we automate controllable/uncontrollable classification?** Timeout detection is easy, but distinguishing "wrong approach" from "hard problem" is judgment-heavy.
3. **Does rubric-first evaluation improve our gym scenario design?** Current scenarios already define criteria upfront — is there room for improvement?

## Cross-References
- **KE-060**: Unified Intervention Taxonomy — process failures map to M1/M2, outcome failures to M3
- **KE-065**: Few-shot findings — few-shot addresses process quality (judgment, discipline), not outcome quality directly
- **KE-071**: Reasoning-behavior gap — UV's process/outcome split parallels reasoning/behavior split
- **KE-073**: Emergent regulation — peer correction as external verification signal
- **DD-662**: Source paper
- **DD-656**: SELFDOUBT — complementary uncertainty detection approach
