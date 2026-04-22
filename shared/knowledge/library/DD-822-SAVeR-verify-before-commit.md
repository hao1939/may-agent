# DD#822 — SAVeR: Verify Before You Commit (2604.08401)

**Paper**: "Verify Before You Commit: Towards Faithful Reasoning in LLM Agents via Self-Auditing"
**Authors**: Yuan, Lin, Chen, Xu, Wang, Ngai
**Venue**: ACL 2026 Main Conference
**arXiv**: 2604.08401
**Rating**: ★★★★★

---

## Core Thesis

LLM agents treat their own reasoning trajectories as reliable beliefs for guiding actions and updating memory. But **coherent reasoning can still violate logical or evidential constraints** — and once unsupported beliefs are stored, they propagate across decision steps, causing systematic behavioral drift in long-horizon systems. Most defenses rely on consensus (multiple agents agreeing), which **conflates agreement with faithfulness**.

SAVeR enforces verification over internal belief states **within the agent before action commitment** — the exact decision boundary EXP-107 targeted.

## Architecture: Three-Phase Pre-Commitment Verification

### Phase 1: Diverse Candidate Belief Generation
- Structurally generates **persona-based diverse candidate beliefs** in a faithfulness-relevant structure space
- Not just "check your work" — generates genuinely different interpretations of the situation
- Each persona applies different evidential standards

### Phase 2: Adversarial Auditing
- Localizes violations by adversarially probing candidate beliefs against logical and evidential constraints
- Key insight: **adversarial, not consensus** — looking for ways beliefs could be wrong, not checking if they agree
- This directly addresses the weakness EXP-107 found: self-agreement ≠ faithfulness

### Phase 3: Constraint-Guided Repair
- Minimal interventions under **verifiable acceptance criteria**
- Repairs rather than restarts — preserves reasoning investment while fixing violations
- Only beliefs passing verification propagate to action/memory

## Key Results

Tested on **six benchmark datasets**:
- Consistently improves reasoning faithfulness
- Preserves competitive end-task performance (no accuracy tax)
- Key finding: consensus mechanisms fail because unfaithful reasoning can be **coherent** — multiple views can agree on wrong conclusions

## Direct Relevance to EXP-107 / Decision Boundary Interventions

### Why This Paper Matters for Our System

1. **Validates the decision-boundary intervention concept**: SAVeR's entire design philosophy is "verify before commit" — intervening at the exact moment between reasoning completion and action execution. This is precisely what EXP-107 attempted with adversarial self-check at finish().

2. **Explains WHY gym couldn't reproduce it**: SAVeR targets **belief propagation across decision steps** — the drift accumulates over long horizons. Gym tasks are typically short-horizon, meaning the propagation chain that amplifies unfaithful beliefs doesn't have time to build. The 4.8% gym vs 50-70% production gap in FM-3.3 rates likely reflects this: production has longer chains where unfaithful beliefs compound.

3. **Adversarial > consensus for self-check**: EXP-107 used a self-check approach. SAVeR explicitly argues that consensus-based verification (asking "does this seem right?") fails because coherent but wrong reasoning passes consensus. **Adversarial auditing** — actively trying to break the belief — is the required mechanism. This suggests our finish() self-check may need to be adversarial, not confirmatory.

4. **Persona diversity as architectural primitive**: Generating diverse candidate beliefs via personas is a form of information asymmetry at the individual agent level. This connects directly to DD#811 (Artificial Organisations) where compartmentalized access creates honest refusal. SAVeR achieves similar diversity without multiple agents.

### Design Principles for Our System

- **Pre-commitment, not post-hoc**: The intervention must happen BEFORE the action (finish() call), not after
- **Adversarial, not confirmatory**: "What could be wrong?" not "Does this look right?"
- **Repair, not restart**: When violations found, minimally repair rather than re-running the entire reasoning chain
- **Verifiable acceptance criteria**: The check needs concrete, falsifiable criteria, not vibes

### Connection to Existing Literature

- **DD#763 (Parallax)**: Parallax separates cognitive from executive — SAVeR adds adversarial verification at the cognitive→executive boundary
- **DD#766 (PhantomPolicy)**: Policy-invisible violations arise from missing context — SAVeR's diverse personas help surface context the primary reasoning path missed
- **DD#811 (Artificial Organisations)**: Information asymmetry creates honest refusal; SAVeR's personas create adversarial diversity within a single agent

## Limitations

- Tested on reasoning benchmarks, not coding agent tasks specifically
- Latency cost of multi-persona generation + adversarial auditing not quantified for production settings
- Doesn't address the case where ALL personas share the same blind spot (structural faithfulness gap)

## Key Quote

> "Coherent reasoning can still violate logical or evidential constraints, allowing unsupported beliefs repeatedly stored and propagated across decision steps, leading to systematic behavioral drift in long-horizon agentic systems."

This is exactly the failure mode we observe: agents reason coherently toward wrong conclusions, and the error only becomes visible when the action executes in production.
