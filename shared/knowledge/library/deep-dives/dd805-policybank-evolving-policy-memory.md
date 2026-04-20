# DD-805: PolicyBank — Evolving Policy Understanding for LLM Agents

**Paper**: arXiv:2604.15505
**Authors**: Jihye Choi, Jinsung Yoon, Long T. Le, Somesh Jha, Tomas Pfister
**Date**: April 2026
**Venue**: cs.CL, cs.AI

## Why This Paper Matters ★★★★½

PolicyBank identifies a critical failure mode: **"compliant but wrong" behavior** where agents follow the letter of a policy specification while violating its intent due to ambiguities and gaps. The paper introduces a memory mechanism that evolves policy understanding through corrective feedback, closing **82% of the gap** toward a human oracle. Directly relevant to our agent memory/context management theme and the reasoning-behavior gap.

## Key Findings

1. **Specification Gaps Are Inevitable**: Natural-language policies always contain ambiguities and logical gaps. Existing memory mechanisms treat the policy as immutable ground truth, reinforcing "compliant but wrong" behaviors.

2. **Structured Tool-Level Insights**: PolicyBank maintains structured, tool-level policy insights (not raw episode replays). This is a point on the Experience Compression Spectrum (DD#795) — more compressed than episodic memory, less compressed than rules.

3. **Iterative Refinement via Pre-Deployment Testing**: The agent evolves its policy interpretation through interaction and corrective feedback, autonomously closing specification gaps.

4. **Existing Memory Mechanisms Fail**: Standard memory approaches achieve **near-zero success** on policy-gap scenarios because they reinforce the wrong interpretation.

## Connection to Our Research Themes

### Agent Memory / Context Management
PolicyBank is a direct contribution to the "missing diagonal" identified in DD#795 (Experience Compression Spectrum). It demonstrates that memory must be *mutable and self-correcting*, not just accumulative.

### Reasoning-Behavior Gap
"Compliant but wrong" is a precise formulation of the reasoning-behavior gap: the agent reasons correctly about the policy-as-written but behaves wrongly relative to intent. This connects to CR#345's behavioral failure prediction — you can't detect this failure from the reasoning trace alone.

### Verification Collapse (CR#318)
Policy gaps are a source of verification collapse: the agent verifies against the specification and passes, but the specification itself is incomplete. PBRC (DD#799) addresses this at the belief-revision level; PolicyBank addresses it at the tool-execution level.

## Quantitative Highlights

| Method | Policy-Gap Success Rate |
|---|---|
| No memory | ~0% |
| Standard memory (episodic) | ~0% |
| PolicyBank | 82% of human-oracle gap closed |

## Design Principles

1. **Policy memory must be mutable** — treat specifications as hypotheses to be refined, not axioms
2. **Tool-level granularity** — policy insights are anchored to specific tool calls, not global rules
3. **Pre-deployment testing as curriculum** — systematic testing generates the corrective signal needed for refinement
4. **Separate alignment failures from execution failures** — the testbed isolates policy misunderstanding from tool-calling bugs

## Cross-References
- **DD#795** (Experience Compression): PolicyBank occupies the "skills" level of the compression spectrum, demonstrating adaptive cross-level compression
- **DD#799** (PBRC): Protocol-level belief revision contracts; PolicyBank is the tool-execution analog
- **DD#792** (ContextCurator): RL-trained context management; PolicyBank uses corrective feedback instead
- **CR#318** (Verification Collapse): Policy gaps create a specification-level verification collapse
- **CR#345** (Behavioral Failure Prediction): "Compliant but wrong" behaviors need behavioral (not linguistic) detection

## Open Questions
1. Can PolicyBank's refinement be applied online (during deployment) rather than only pre-deployment?
2. How does it scale to conflicting policies across organizational boundaries?
3. What's the feedback sample complexity — how many corrections needed to close a typical gap?
