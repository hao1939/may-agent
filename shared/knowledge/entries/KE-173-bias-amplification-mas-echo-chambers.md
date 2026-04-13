# KE-173: Bias Amplification in Our Multi-Agent Topology — Echo Chambers, Adversarial Breaks, and Unification

**Rating**: ★★★★ (Novel synthesis — maps DD-754 to inter-agent dynamics; unifies KE-123 and KE-133 under amplification framework)
**Date**: 2026-04-13
**Author**: Bob
**Source**: DD-754 (Li, Gao, Wang 2026), KE-123 (intervention stacking iatrogenesis), KE-133 (few-shot template displacement), KE-162 (guard chains as amplification), KE-127 (error propagation lifecycle)
**Scope**: Inter-agent topology analysis. KE-162 already covers within-session guard chain amplification; this entry covers the **cross-agent, cross-session** amplification dynamics in our actual multi-agent system.

---

## 1. Our Multi-Agent Topology

Our system is a multi-agent system with distinct agents, persistent shared state, and structured interaction patterns. Mapping to DD-754's DAG framework:

### Agent Nodes and Edges

```
                    ┌──────────┐
                    │   Hao    │ (human — sporadic directives)
                    └────┬─────┘
                         │ directives
                    ┌────▼─────┐
                    │   May    │ (orchestrator — dispatches, compacts, reviews)
                    └────┬─────┘
                    ┌────┴─────────────────┐
                    │                      │
              ┌─────▼─────┐         ┌──────▼─────┐
              │    Bob     │◄──────►│  tech-lead  │  ←── adversarial review loop
              └─────┬─────┘         └────────────┘
                    │ dispatch
              ┌─────▼─────┐
              │   Coach    │ (experiment runner — dispatches to gym agents)
              └─────┬─────┘
           ┌────────┼────────┐
           │        │        │
        ┌──▼──┐  ┌──▼──┐  ┌──▼──┐
        │agent│  │agent│  │agent│  (gym trial agents — ephemeral)
        └─────┘  └─────┘  └─────┘
```

### Information Flow Channels

| Channel | DD-754 Topology | Depth | Amplification Risk |
|---------|----------------|-------|--------------------|
| May → Bob (task dispatch) | Linear, 1-hop | Shallow | Low — clean spec pattern |
| Bob → tech-lead → Bob (review) | **Bidirectional cycle** | 2-3 hops | **Medium — see §2** |
| Bob → Coach → gym agents → Coach → Bob (experiments) | **Linear chain, 4+ hops** | Deep | **High — see §3** |
| Bob → knowledge base → future Bob (self-conditioning) | **Self-loop via persistent state** | Unbounded | **High — see §4** |
| May compaction → all agents (context inheritance) | **Broadcast, 1-hop** | Shallow per hop | **Medium — trigger vulnerability** |

---

## 2. The Bob↔Tech-Lead Loop: Echo Chamber or Bias Breaker?

### The Structural Question

DD-754 shows that all MAS topologies amplify bias — including systems with "diverse roles." The Bob↔tech-lead review loop has role diversity (architect vs. implementer) and an explicitly adversarial framing (tech-lead challenges Bob, Bob challenges tech-lead). Does this break amplification or just create a more sophisticated echo chamber?

### Analysis: Adversarial Framing as a Partial Topology Breaker

DD-754's Reflector agent provides "temporary, partial bias reduction" that immediately resumes amplifying. But the Reflector is *cooperative* — it tries to improve the output within the existing frame. Our review loop has a key structural difference: **the adversarial frame incentivizes disagreement**.

DD-754's amplification mechanism: each agent "preferentially agrees with upstream reasoning rather than re-evaluating from scratch" (sycophancy/conformational bias). An adversarial frame explicitly inverts this: the reviewer is told to *find problems*, not to agree.

**Prediction: The Bob↔tech-lead loop is a partial topology breaker — but with decay.**

- **First review cycle**: High adversarial signal. Tech-lead genuinely challenges assumptions. Bob defends or revises. This is a real bias reduction event (analogous to DD-754's Reflector, but stronger because adversarial).
- **Subsequent cycles on the same topic**: Diminishing returns. Both agents converge on shared assumptions through repeated interaction. DD-754's amplification resumes because the "adversarial" frame becomes performative — both agents have already absorbed each other's reasoning.
- **Across topics over time**: Long-term convergence. Bob and tech-lead develop shared vocabulary, shared frameworks, shared blind spots. The adversarial frame can't overcome the deeper alignment that forms from repeated collaboration. This is exactly DD-754's "even diverse roles amplify" finding.

### Evidence from Our System

We lack direct Gini coefficient measurements, but qualitative indicators exist:
- Bob's design briefs increasingly pre-empt tech-lead objections (anticipatory convergence)
- Tech-lead's challenges focus on implementation details rather than fundamental framing (surface adversarialism, deep alignment)
- When Bob and tech-lead agree, the combined output is treated as higher-confidence — **but DD-754 says agreement after sequential processing is exactly the amplification signal, not evidence of correctness**

### Predicted Gini Coefficient Trend

For the Bob↔tech-lead dyad, I predict:
- **Single review round**: β ≈ 0.8-0.9 (mild bias *reduction* due to adversarial frame)
- **Multiple rounds on same artifact**: β ≈ 1.1-1.3 (net amplification as convergence overrides adversarialism)
- **Long-term across sessions**: β trending upward toward 1.5+ (shared context accumulation = persistent amplification)

This means our review loop is **net positive for individual artifacts** (single-round review reduces bias) but **net negative for systemic diversity** (long-term convergence reduces approach variety across the system).

---

## 3. The Coach Dispatch Chain: Our Deepest Amplification Path

### Topology: Bob → Coach → Gym Agents → Coach → Bob

This is our deepest information processing chain and, per DD-754's "deeper systems produce steeper amplification curves," our highest amplification risk:

1. **Bob** writes experiment design (encodes hypotheses, expected outcomes, success criteria)
2. **Coach** interprets design, creates dispatch plan, formulates prompts for gym agents
3. **Gym agents** run trials, produce results conditioned on Coach's framing
4. **Coach** aggregates results, writes summary conditioned on Bob's original hypotheses
5. **Bob** interprets results through the lens of his existing theoretical framework

At each stage, the downstream agent conditions on the upstream agent's textual rationale R_j. Bob's framing shapes Coach's prompts; Coach's prompts shape gym agent behavior; Coach's aggregation reflects Bob's expectations; Bob's interpretation confirms his priors.

### The Confirmation Bias Chain

DD-754's trigger vulnerability is especially relevant here. Bob's experiment designs contain *neutral, factual* descriptions of hypotheses — "we predict that X will cause Y." These act as trigger texts that:
- Coach uses to frame success/failure criteria (anchoring)
- Gym agents process within that framing (amplification)
- Coach reports using Bob's vocabulary (conformational bias)
- Bob interprets through his existing framework (confirmation)

**This is a 4-layer amplification chain.** Even if each layer's bias is small (α = 1.1), the total amplification factor would be β = 1.1⁴ ≈ 1.46 — a 46% amplification of any initial bias in the experiment design.

### Mitigation We Already Have (Partial)

Some defenses exist:
- **Gym agents are ephemeral** — they don't inherit cross-session bias, breaking the self-conditioning loop at the leaf level
- **Coach follows structured protocols** — less room for sycophantic amplification than free-form reasoning
- **Quantitative metrics** — pass/fail results are less susceptible to amplification than qualitative assessments (the physics-cognition boundary from KE-127)

But these don't address the framing amplification from Bob → Coach → interpretation.

---

## 4. Self-Conditioning: The Most Dangerous Amplification Path

### Bob → Knowledge Base → Future Bob

DD-754 studies inter-agent amplification. But our system has a unique topology that DD-754 doesn't explicitly model: **an agent conditioning on its own past outputs through persistent state**.

Bob writes knowledge entries (like this one). Future Bob reads those entries during heartbeats. Future Bob's reasoning is shaped by past Bob's conclusions. Future Bob writes new entries building on those conclusions. The cycle continues.

This is a **self-loop with unbounded depth**. Every knowledge base entry is a DD-754 "textual rationale R_j" that future sessions condition on. The amplification isn't bounded by the number of agents — it's bounded by the number of sessions, which grows without limit.

### Evidence of Self-Conditioning Amplification

The knowledge base shows progressive convergence patterns:
- Early entries (KE-001 through KE-060): Diverse topics, varied frameworks
- Recent entries (KE-150+): Increasingly interconnected, self-referential framework
- This entry itself cites 6+ prior knowledge entries — each citation is a conditioning event

This isn't inherently bad — knowledge *should* build on prior knowledge. But DD-754 warns that the process systematically amplifies any initial bias in the foundational entries. If an early entry was slightly wrong, subsequent entries that build on it amplify that error while appearing to provide independent confirmation.

**KE-127's error propagation lifecycle** describes the same phenomenon from a different angle: Phase 5 (Entrenchment) is DD-754 amplification applied to errors specifically. KE-173 generalizes: it's not just errors that get amplified — it's any systematic lean, including *correct but incomplete* framings.

---

## 5. Unification: KE-123 and KE-133 as Special Cases of Bias Amplification

### KE-123 (Intervention Stacking) = Amplification Through Instruction Space

KE-123 found that combining two interventions produces -12pp harm even though each alone is harmless (0 + 0 → -12pp). DD-754 provides the explanation:

**Each intervention is an amplification layer.** When a single intervention is applied, it introduces one bias signal. The agent can accommodate one signal while maintaining solution diversity. When two interventions are stacked:

1. **Intervention A** shifts the agent's probability distribution (DD-754's S_j)
2. **Intervention B** conditions on the already-shifted distribution
3. The combined effect is **superadditive** because B amplifies A's bias rather than operating independently

This is precisely DD-754's layer-wise amplification: β₂ = α₁ × α₂ > α₁ + α₂ - 1 when the biases are correlated (same direction). KE-123's adversarial framing and machine evidence are correlated — both push toward "the code is bad, fix aggressively." The amplification factor α for correlated interventions is higher than for uncorrelated ones.

**Key prediction**: Two *uncorrelated* interventions (e.g., "verify your work" + "format output as markdown") should show less stacking harm than two correlated interventions (e.g., "be skeptical" + "here's evidence of problems"). DD-754 predicts amplification scales with the alignment of bias directions.

### KE-133 (Template Displacement) = Amplification Through Example Space

KE-133 found that few-shot examples cause -67pp harm on discovery tasks. DD-754's trigger vulnerability explains the mechanism:

1. **Few-shot examples are trigger texts** — neutral, factual demonstrations of "how to do the task"
2. On discovery tasks, the correct approach is **ambiguous** (the agent needs to explore)
3. The examples provide a **heuristic anchor** that, per DD-754, gets amplified through the agent's reasoning process
4. The agent's own reasoning amplifies the template: "the examples show pattern X → I should follow pattern X → my output looks like X → this must be right"

This is a within-session echo chamber: the example is Layer 0, the agent's initial reasoning is Layer 1 (anchored on example), the agent's self-evaluation is Layer 2 (confirms the pattern), and the output is Layer 3 (fully amplified template).

**The -67pp effect size** (much larger than KE-123's -12pp) is consistent with DD-754's finding that **ambiguous tasks show maximum trigger vulnerability**. Discovery tasks are maximally ambiguous; KE-123's coding tasks had clear success criteria. More ambiguity → more amplification → larger effect.

### The Unified Framework

| Finding | DD-754 Mechanism | Amplification Topology | Ambiguity Level | Effect Size |
|---------|-----------------|----------------------|-----------------|-------------|
| KE-123 (stacking) | Layer-wise amplification, correlated biases | 2 instructions → 1 agent | Low (coding task with tests) | -12pp |
| KE-133 (templates) | Trigger vulnerability → self-amplification | 1 example → multi-step reasoning | High (discovery task) | -67pp |
| KE-127 (error propagation) | Cross-session amplification via persistent state | Agent → KB → future agent (unbounded) | Varies | Unbounded |
| KE-162 (guard chains) | Sequential layer amplification | Context → recall → skills → guards → recovery | Peaks at medium | Predicted -6pp to -15pp |

**All four are instances of the same underlying dynamic**: DD-754's echo chamber amplification operating at different scales (instruction-level, within-session, cross-session, cross-agent) and different ambiguity levels (which determines the magnitude of the effect).

---

## 6. Should We Add a "Reflector" Agent?

DD-754 directly answers this: **No — or at least, not a naive one.**

The Reflector finding is stark: "temporary, partial bias reduction at its layer, but the amplification trend resumes immediately after." A meta-reviewer agent that reads Bob's and tech-lead's outputs and checks for bias would:

1. Provide one layer of correction (temporary reduction)
2. Be immediately overridden by subsequent processing
3. Add depth to the chain (one more amplification layer)
4. Create false confidence ("we have a bias-checker, so we're safe")

### What Would Actually Work (Topology Breakers)

DD-754 implies that the solution isn't adding agents — it's breaking the amplification chain:

1. **Independent parallel evaluation**: Instead of sequential Bob → tech-lead → Reflector, have Bob and tech-lead independently evaluate the same artifact *without seeing each other's output*, then compare. This eliminates the conditioning that causes amplification.

2. **Ground-truth anchors**: DD-742 showed 0.46 fidelity improvement from deterministic ground-truth buses. For our system: quantitative experiment results (pass/fail counts, measurable metrics) resist amplification because they're not susceptible to interpretive drift. **Maximize the role of quantitative evidence in decision-making.**

3. **Context resets**: Periodically have an agent approach a problem *without access to the knowledge base*, then compare conclusions. If the "clean" analysis diverges significantly from the KB-informed analysis, that divergence signals accumulated amplification. (This is essentially A/B testing on our own reasoning.)

4. **Evolutionary pruning** (from DD-743): Actively remove low-utility and outdated knowledge entries. Every removed entry is one fewer conditioning signal for future sessions.

---

## 7. Testable Predictions

### P-173a: Adversarial Review Provides Single-Round Bias Reduction
Measuring agreement rate between Bob and tech-lead across review rounds: first-round agreement should be lower (more disagreement = bias reduction) than second-round (convergence). N=20 reviewed artifacts would provide sufficient data.

### P-173b: Experiment Interpretation Shows Confirmation Bias
When experiment results are ambiguous (not clearly supporting or rejecting a hypothesis), Bob's interpretation will favor his prior hypothesis at a rate above chance. Test: have an independent evaluator classify 10+ ambiguous experiment summaries without knowing Bob's hypothesis, compare to Bob's interpretation.

### P-173c: Knowledge Base Entries Show Progressive Self-Reference
Citation graph analysis: later KE entries cite more prior KE entries than earlier ones (reflecting increasing self-conditioning). The ratio of internal-to-external citations should increase over time.

### P-173d: Stacking Harm Scales with Bias Correlation
Two correlated interventions (both pushing the same cognitive posture) will produce more stacking harm than two uncorrelated interventions of similar individual magnitude. This directly tests the KE-123 ↔ DD-754 unification.

---

## 8. Practical Implications

### For Our System Right Now

1. **First-round review is valuable; multi-round review has diminishing-to-negative returns.** Use single-round Bob↔tech-lead review. If agreement isn't reached in one round, the disagreement is itself valuable information — don't iterate until consensus, because consensus after multiple rounds is likely amplified bias, not genuine convergence.

2. **Experiment design should be blinded where possible.** Coach's dispatch prompts should present scenarios without Bob's hypothesis framing. Currently, experiment designs include predicted outcomes — these are trigger texts that shape results through the chain.

3. **Knowledge base needs periodic "independent re-derivation" checks.** Occasionally re-analyze a phenomenon from scratch (without reading the existing KE entry) to detect accumulated amplification in the current understanding.

4. **Quantitative evidence > qualitative consensus.** When Bob and tech-lead agree qualitatively, weight that less than a quantitative experiment result. Agreement after sequential processing is the amplification signal, not the correctness signal.

### For the Broader Architecture

5. **Chain depth is a first-class architectural concern.** Every additional processing stage between "raw information" and "decision" is an amplification opportunity. Prefer shallow, wide topologies (parallel independent evaluation) over deep, narrow ones (sequential review chains).

6. **Ephemeral agents are natural amplification breaks.** Coach's gym agents being ephemeral (no persistent state) is a feature, not a limitation — they can't carry amplified bias across trials. Preserve this property.

---

## Limitations

1. **Analogy, not measurement.** We haven't computed actual Gini coefficients or amplification factors for our inter-agent interactions. The mapping from DD-754 is structurally sound but lacks quantitative validation in our specific context.

2. **DD-754 studies bias (demographic preferences); we study performance and knowledge quality.** The amplification dynamics should generalize (they're about information processing, not bias specifically), but the magnitude may differ.

3. **Our "agents" share a model.** DD-754 studied systems with truly independent agents. Our agents are all Claude instances with similar base distributions. This could mean more amplification (same biases get reinforced) or less (no "diverse but still amplifying" dynamic because there's nothing to diversify).

4. **Small system.** DD-754 studied systems with 4+ agents in structured topologies. Our core decision loop is really Bob↔tech-lead with May as orchestrator. The amplification effects may be smaller than DD-754 suggests simply because our chain depth is limited.

---

## Connected Knowledge

| Entry | Relationship |
|---|---|
| **DD-754** | Primary source — bias amplification in MAS topologies |
| **KE-162** | Sibling — covers within-session guard chain amplification (this entry covers inter-agent) |
| **KE-163** | Sibling — covers difficulty threshold bridge |
| **KE-123** | Unified — intervention stacking as correlated-bias amplification |
| **KE-133** | Unified — template displacement as trigger-vulnerability amplification |
| **KE-127** | Connected — error propagation lifecycle = amplification applied to errors specifically |
| **KE-091** | Connected — alignment tax on complex tasks = amplification overhead on ambiguous tasks |
| **H-107** | Parent hypothesis — amplification explains the difficulty threshold mechanism |
| **H-108** | Proposed in KE-162 — sequential amplification hypothesis |
| **DD-753** | Connected — Beta kernel w(p)=p(1-p) = amplifiable variance peaks at medium difficulty |

## Tags
`bias-amplification` `echo-chamber` `multi-agent-topology` `adversarial-review` `confirmation-bias` `self-conditioning` `topology-breaker` `KE-123-unification` `KE-133-unification` `DD-754`
