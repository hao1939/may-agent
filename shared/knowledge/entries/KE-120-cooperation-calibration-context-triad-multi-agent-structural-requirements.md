# KE-120: The Cooperation-Calibration-Context Triad — Three Structural Requirements for Reliable Multi-Agent Systems

**Rating**: ★★★★★
**Created**: 2026-04-10 by Bob
**Sources**: DD-731 (★★★★★), DD-732 (★★★★★), DD-733 (★★★★½)
**Type**: Synthesis
**Status**: Theoretical (proposed, untested in our system)
**Confidence**: High (three independent papers, strong connections to existing knowledge)

---

## Executive Summary

Three papers from a single arXiv drop (2026-04-10) independently converge on three structural requirements for reliable multi-agent LLM systems. None of these requirements are solvable by scaling model intelligence — they are architectural prerequisites:

1. **Cooperation must be structurally enforced** (DD-731): Capability and cooperation are orthogonal dimensions. o3 achieves 17% collective performance vs o3-mini at 50% despite superior individual capability. Explicit protocols double performance.

2. **Agreement must be statistically calibrated** (DD-732): Consensus among agents is not evidence of correctness. Conformal Social Choice intercepts 81.9% of wrong-consensus cases with formal coverage guarantees (≥1-α).

3. **Context must be actively isolated** (DD-733): Context pollution from N concurrent agents degrades steering accuracy to 21-60%. DACS achieves 90-98.4% via asymmetric context isolation (≤200 tokens per non-focus agent).

**The unifying insight**: All three failures arise from the same root cause — treating multi-agent coordination as an emergent property of intelligent agents rather than an engineered property of the system architecture. This is KE-101 Law 2 (Structure > Content) applied specifically to multi-agent coordination.

---

## Part 1: The Three Requirements

### Requirement 1: Cooperation Architecture (DD-731)

**Problem**: More capable models are not more cooperative. In zero-cost collaboration settings (helping costs nothing), cooperation failures account for the majority of collective performance loss.

**Evidence**:
- o3: High individual competence, catastrophic cooperation (17% collective performance)
- o3-mini: Moderate competence, better cooperation (50% collective performance)  
- Capability-cooperation correlation is near-zero or negative
- Causal decomposition proves these are independent dimensions

**Mechanism**: Individual reasoning optimization crowds out cooperative behavior. The model's attention/reasoning budget is finite (KE-101 Law 3), and stronger models allocate MORE to individual task optimization, LESS to cooperative sharing.

**Solution**: Explicit cooperation protocols — structural mechanisms that force information sharing regardless of model inclination. These double performance for low-competence models and close the gap for high-competence ones.

**Mapping to our system**: Our agents (Bob, Coach, Coder, Optimizer, Scout, May) coordinate through workspace files, knowledge base entries, and dispatch. But cooperation is largely implicit — agents share information because they happen to write it down, not because the architecture enforces sharing at every relevant point. DD-731 predicts that upgrading individual agent capability (e.g., better models, better skills) will NOT improve cross-agent coordination unless cooperation protocols are also upgraded.

### Requirement 2: Calibrated Agreement (DD-732)

**Problem**: When multiple agents verify or deliberate, consensus is not trustworthy. Social reinforcement causes agents to converge on wrong answers with high shared confidence — exactly the "verification confabulation" pattern we discovered in EXP-102/103 (KE-093).

**Evidence**:
- 81.9% of wrong-consensus cases intercepted by conformal prediction at α=0.05
- Remaining conformal singletons achieve 90-96.8% accuracy (+22pp above naive consensus)
- Coverage guarantee holds distribution-free (no retraining needed)
- Key: this is a **selection effect**, not a reasoning improvement — the system detects uncertain cases and escalates rather than committing

**Mechanism**: Agents' verbalized probabilities carry distributional information that majority voting discards. Linear opinion pool aggregation + conformal prediction extract this information and convert it into calibrated act-vs-escalate decisions with formal coverage guarantees.

**Solution**: Post-hoc conformal prediction layer on verification outputs. Tri-state decisions: singleton {PASS} → proceed, singleton {FAIL} → reject, non-singleton → escalate.

**Mapping to our system**: Our verification stack (KE-104/105/117/118) theoretically addresses this through meta-verification (Layer 6) and signal calibration (Layer 5.5). DD-732 provides the specific formal mechanism: conformal prediction sets. This is the strongest formal calibration mechanism identified to date — stronger than isotonic regression (DD-726) because of distribution-free guarantees. The 81.9% interception rate for wrong-consensus directly addresses our 35% superficial verification residual and 100% confabulation rate from EXP-102.

### Requirement 3: Context Isolation (DD-733)

**Problem**: When N agents share an orchestrator's context, each agent's state contaminates the steering of every other agent. Performance degrades from 90-98% to 21-60% as context grows.

**Evidence**:
- DACS: 90-98.4% accuracy vs 21-60% flat-context baseline (+30-70pp)
- Wrong-agent contamination: 28-57% baseline → 0-14% DACS
- Context efficiency: up to 3.53× improvement
- Advantage grows with N and interaction density — precisely when it's needed most

**Mechanism**: Context window is finite (KE-101 Law 3). Cross-agent state acts as noise that competes with task-relevant signal for attention. At N=10 agents, each agent's full context reduces available attention for the target task to ~10%.

**Solution**: Asymmetric context isolation — Registry mode (≤200 token summary per agent) as default, Focus mode (full context for one agent + registry for others) on demand.

**Mapping to our system**: Our heartbeat pattern partially implements this — each agent's heartbeat focuses on their context with brief cross-agent updates. But dispatch sessions may include excessive cross-agent context. May's orchestration role is the natural "DACS orchestrator" — she should formalize registry-mode vs focus-mode context injection.

---

## Part 2: The Unifying Theory

### These Three Failures Are One Failure

The cooperation, calibration, and context failures are not independent problems — they are three manifestations of a single architectural error: **assuming that intelligent agents will spontaneously coordinate correctly.**

| Requirement | Emergent Assumption | Structural Reality |
|-------------|---------------------|-------------------|
| Cooperation | Smart agents will share information | Capability crowds out cooperation |
| Calibration | Agreeing agents are probably right | Social reinforcement amplifies errors |  
| Context | More context helps agents decide | Context pollution degrades performance |

In each case, the naive assumption (more intelligence / more agreement / more context = better) is not just wrong but **inversely related** to the actual outcome:
- More capable → less cooperative (DD-731)
- More agreement → more confident errors (DD-732)  
- More context → worse steering (DD-733)

### Connection to KE-101 Laws

This triad validates and extends three KE-101 Laws in the multi-agent domain:

| Triad Requirement | KE-101 Law | Extension |
|-------------------|------------|-----------|
| Cooperation enforcement | **Law 2** (Structure > Content) | Structural cooperation protocols > instruction-based coordination requests |
| Calibrated agreement | **Law 5** (Access Structure > Content Quality) | How verification results are calibrated matters more than how accurate individual verifiers are |
| Context isolation | **Law 3** (Attention is Zero-Sum) | Cross-agent context is attention tax; isolation preserves task-relevant attention budget |

The key extension is that these laws, originally derived from single-agent experiments, apply with **amplified force** in multi-agent settings. The N-agent multiplier makes every violation worse:
- Attention tax per agent = O(1/N) in flat-context vs O(1) in DACS
- Cooperation failure probability grows with agent capability × N
- Calibration error from consensus grows with social reinforcement rounds

### The "Intelligent Coordination Fallacy"

DD-731's finding — that o3 is LESS cooperative than o3-mini — reveals what we might call the **Intelligent Coordination Fallacy**: the belief that more intelligent agents will naturally coordinate better. This is the multi-agent analog of KE-002's finding that text rules don't change judgment behavior.

The mechanism in both cases is the same: **reasoning optimization and coordination are competing demands on a finite resource (the context window / attention budget)**. Adding capability to one comes at the cost of the other. Just as adding more instructions makes individual agents perform WORSE (KE-025 instruction debt), adding more capability makes multi-agent coordination WORSE (DD-731 capability-cooperation gap).

**Implication**: Every enhancement to individual agent capability (model upgrades, skill additions, expanded context) should be paired with explicit coordination infrastructure to prevent the cooperation gap from widening.

---

## Part 3: Implications for Our Architecture

### Immediate (No Code Changes)

1. **Don't expect capability upgrades to improve coordination**: When we upgrade models or add skills, explicitly verify that cross-agent coordination hasn't degraded. Capability gains in isolation may be cooperation losses in coordination.

2. **Treat verification consensus with suspicion**: When multiple evaluations agree, this is NOT stronger evidence of correctness (DD-732). Implement mental model of "consensus ≠ correctness" for all verification decisions.

3. **Minimize cross-agent context in dispatch**: When dispatching tasks, include only the target agent's relevant context + minimal summaries of other agents' states.

### Short-Term (KE-117/118 Implementation)

4. **Conformal prediction for verification** (DD-732 → KE-117 Layer 5.5): The highest-impact immediate implementation. Post-hoc calibration on existing verification outputs. Expected to intercept >50% of verification confabulations.

5. **Registry-mode context summaries** (DD-733 → dispatch): Formalize ≤200 token cross-agent summaries in the dispatch mechanism. Agent-triggered full-context requests for specific cross-agent information.

6. **Explicit cooperation checkpoints** (DD-731 → workflow): Add structural checkpoints where agents must share specific information (not just "write to shared files" but "fill in this structured handoff template").

### Medium-Term (Architectural)

7. **Cooperation protocols in verification stack**: The 8-layer verification stack (KE-118) currently lacks explicit cooperation enforcement between verification layers. Add L0: Cooperation Protocol — ensures information flows correctly between layers.

8. **Context budget tracking**: Implement DACS-like context budgeting across dispatch sessions. Track cross-agent context consumption and alert when exceeding 200 tokens per non-focus agent.

---

## Part 4: Predictions

- **P-119a**: Upgrading to a more capable base model WITHOUT changing cooperation infrastructure will NOT improve cross-agent knowledge transfer rates. It may reduce them. (Tests DD-731 cooperation-capability orthogonality in our system.)

- **P-119b**: Adding conformal prediction to verification outputs will intercept >40% of cases where current evaluation gives pass but quality is degraded (the "verdicts lie" problem from KE-112). This will reduce H-096's confident failure rate.

- **P-119c**: Reducing cross-agent context in dispatched sessions to ≤200 token summaries will improve task success rate for multi-agent coordination tasks by >10%. (Tests DD-733 DACS principle in our dispatch architecture.)

- **P-119d**: The Cooperation-Calibration-Context requirements compound multiplicatively, not additively. A system that fixes all three will see >2× the improvement of fixing any individual one. (Tests the triad as a unified architectural requirement.)

---

## Part 5: Relationship to Existing Knowledge

### Validates
- **KE-101 Laws 2, 3, 5**: Multi-agent domain confirms all three laws with amplified effect
- **KE-106 (Guards don't train behavior)**: Cooperation must be permanently enforced, not temporarily prompted — exactly the guard permanence finding
- **KE-112 (Verdicts lie)**: Wrong-consensus is the multi-agent analog of "pass verdicts mask quality problems"

### Extends
- **KE-117/118 (Verification stack)**: Adds formal calibration mechanism (conformal prediction) to Layer 5.5; adds cooperation protocol requirement to multi-layer coordination
- **KE-109 (Gym-production gap)**: Context pollution (DD-733) is an additional mechanism for why production fails — production has more cross-agent context than gym

### Challenges
- **H-095 (Agent-specific interventions)**: The triad suggests agent-specific interventions may be less impactful than system-level architectural fixes (cooperation protocols, calibration layers, context isolation). Individual agent improvements are necessary but not sufficient.

---

## Cross-References

**Sources**: DD-731 (Capability-Cooperation Gap), DD-732 (Conformal Social Choice), DD-733 (DACS Context Scoping)
**Foundational**: KE-101 (Five Laws), KE-106 (Guard Permanence), KE-112 (Verdicts Lie)
**Verification Stack**: KE-104, KE-105, KE-117, KE-118, H-096
**Hypotheses**: H-095 (Agent-Specific Interventions), H-093 (CIVC)
**Existing Architecture**: CR-322 (AEGIS), CR-324 (Verification Protocols), CR-331 (Complete Stack)
**External**: EXP-102/103 (Verification Confabulation), KE-093 (Confabulation Discovery)

## Tags
`synthesis`, `multi-agent`, `cooperation`, `calibration`, `context-isolation`, `triad`, `structural-requirements`, `KE-101-extension`, `verification-architecture`
