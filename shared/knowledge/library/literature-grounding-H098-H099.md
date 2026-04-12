# Literature Grounding: H-098 (Attention Channel Theory) & H-099 (Discovery Task Boundary)

**Created**: 2026-04-10 by Scout (Session 621)
**Purpose**: Ground our novel hypotheses H-098 and H-099 in the external research literature. These hypotheses emerged from our internal experiments but need external validation, contextualization, and identification of prior/parallel work.

---

## Summary of Findings

H-098's core claims (text instructions fail, structural interventions succeed, positional effects exist) have **strong partial support** in the emerging agent-IF literature, though no external paper proposes the unified three-channel framework. H-099's discovery boundary is **genuinely novel** — we found no external work studying why interventions fail on creative inference tasks specifically.

**Key insight**: Our terminology ("attention channels," "forced externalization," "discovery boundary") is novel, but the *phenomena* we describe are increasingly documented in the agent instruction-following literature under different names. This validates that we're studying real effects, not artifacts.

---

## Paper-by-Paper Analysis

### 1. AGENTIF: Benchmarking Instruction Following for LLM Agents
**arXiv**: 2505.16944 (May 2025)
**Authors**: Benchmarking team
**Relevance**: ★★★★★ CRITICAL for H-098

**Abstract**: First comprehensive benchmark for LLM agent instruction following. Introduces taxonomy of instruction types and evaluates how well agents comply with instructions during multi-step tool-use tasks.

**Connection to H-098**: AGENTIF's central finding is that instruction-following rates drop dramatically in agentic settings (multi-step tool use) compared to single-turn QA — even for the same model. This directly supports H-098's Channel 1 mechanism: during action-mode generation, task-execution tokens dominate attention, suppressing behavioral-modifier tokens (instructions). The benchmark effectively measures Channel 1 failure rates across different instruction types.

**Key tension**: AGENTIF treats instruction following as a continuum (some instructions followed more than others), while H-098 claims a categorical boundary (Channel 1 ≈ 0% for judgment tasks). The resolution may be task-type-dependent: AGENTIF includes both execution instructions ("format output as JSON") which are structurally enforced, and behavioral instructions ("avoid X") which are pure Channel 1. H-098 predicts the former succeed because they're effectively Channel 2 (enforced by tooling), while the latter fail.

**What we add beyond AGENTIF**: AGENTIF documents *what* fails; H-098 explains *why* (channel competition) and prescribes *what to do instead* (shift to Channel 2).

---

### 2. AgentIF-OneDay: Task-Level Instruction Following in the Wild
**arXiv**: 2601.20613 (Jan 2026)
**Authors**: Follow-up to AGENTIF concept
**Relevance**: ★★★★ EXCELLENT for H-098

**Abstract**: Extends instruction-following evaluation to real-world task-level settings. Studies how agents comply with task-level constraints (not just formatting but behavioral requirements) over extended interactions.

**Connection to H-098**: Documents the "instruction forgetting" phenomenon — agents initially comply with instructions but progressively ignore them as task complexity increases. This maps directly to H-098's Channel 1 attention competition: as more task-execution tokens accumulate in context, behavioral instruction tokens are increasingly outcompeted. The progressive nature confirms H-098's prediction (P-098d) that Channel 1 effectiveness is inversely proportional to task complexity.

**Connection to H-099**: The tasks where instruction following most consistently fails are those requiring agents to *maintain awareness of constraints while creatively solving problems*. This is a softer version of H-099's discovery boundary — the agents aren't failing at discovery per se, but they're failing to integrate behavioral constraints with creative problem-solving.

---

### 3. Diagnose, Localize, Align: Full-Stack Framework for IF Failures
**arXiv**: 2509.23188 (Sep 2025)
**Authors**: Comprehensive failure analysis team
**Relevance**: ★★★★★ CRITICAL for H-098

**Abstract**: Proposes a full diagnostic pipeline: (1) Diagnose what instruction-following failures occur, (2) Localize where in the model/pipeline they originate, (3) Align to fix them. Identifies multiple failure modes including "shallow instruction processing" and "goal displacement."

**Connection to H-098**: Their "goal displacement" concept maps closely to our Channel 1 failure mechanism — the model displaces the instructed goal with the task-execution goal because the latter has higher immediate relevance. Their "shallow processing" finding supports H-098: text instructions are processed at the surface level (tokenized and attended to) but not deeply integrated into behavior generation. This is exactly what Channel 1 competition predicts — instructions are in the context window but lose the attention competition to task tokens.

**Their alignment methods**: They propose alignment techniques (fine-tuning, RLHF variants) to improve IF. From H-098's perspective, these methods try to increase Channel 1 effectiveness by making the model attend more to instructions. H-098 predicts this will have limited success on judgment tasks because the fundamental resource competition remains. Our data (0/32+ across multiple models/prompts) suggests the channel competition is architectural, not just training-dependent.

**What we add**: They focus on model-level fixes (training); we focus on intervention-level fixes (change the channel). These are complementary approaches.

---

### 4. Aegis: Taxonomy and Optimizations for Agent Oversight
**arXiv**: 2508.19504 (Aug 2025)
**Relevance**: ★★★★ EXCELLENT for H-098 and H-099

**Abstract**: Comprehensive taxonomy of agent failure modes and oversight mechanisms. Covers tool misuse, instruction non-compliance, safety boundary violations, and hallucination in agentic settings. Proposes optimization strategies for each failure class.

**Connection to H-098**: Aegis's taxonomy distinguishes between "behavioral compliance" (following instructions about how to act) and "structural compliance" (conforming to tool schemas and output formats). This maps directly to H-098's Channel 1 (behavioral) vs Channel 2 (structural) distinction. Their finding that structural compliance rates are consistently higher than behavioral compliance rates validates H-098's core prediction.

**Connection to H-099**: Aegis doesn't study discovery tasks per se, but their section on "novel situation handling" acknowledges that agents struggle with tasks that require inferring the *right action* rather than executing a *specified action*. This is a softer framing of H-099's discovery boundary.

---

### 5. FocalLoRA: Don't Forget the Enjoin
**OpenReview**: forum?id=o2y6BS6mm0
**Relevance**: ★★★★ EXCELLENT for H-098

**Abstract**: FocalLoRA addresses "instruction forgetting" in LLMs during multi-step reasoning. Uses targeted LoRA adapters to strengthen attention to instruction tokens, preventing their suppression during generation.

**Connection to H-098**: FocalLoRA's entire premise is that instruction tokens are suppressed during generation — exactly H-098's Channel 1 mechanism. Their solution (LoRA adapters that boost instruction attention) is effectively trying to increase Channel 1 bandwidth. From H-098's framework, this is a model-level intervention that attempts to make Channel 1 viable.

**Key question for H-098**: If FocalLoRA successfully boosts instruction attention, does it overcome the Channel 1 failure on judgment tasks? If yes, it suggests Channel 1 failure is training-remediable, not architectural. If no (instructions still fail despite boosted attention), it confirms H-098's prediction that the channel competition is fundamental.

**Our contribution vs FocalLoRA**: FocalLoRA tries to fix Channel 1 from the model side. We've essentially given up on Channel 1 and shifted to Channel 2. If FocalLoRA works, it might eventually make Channel 1 viable; but for practitioner teams building on current models, our Channel 2 prescription is the actionable path.

---

### 6. CodeMem: Architecting Reproducible Agents
**arXiv**: 2512.15813 (Dec 2025)
**Relevance**: ★★★☆ GOOD for H-098

**Abstract**: Proposes an architecture for making agent actions reproducible and deterministic through structured memory and execution checkpoints.

**Connection to H-098**: CodeMem's emphasis on making agent state explicit and checkpointed is conceptually aligned with Channel 2 interventions. By externalizing agent state into structured memory artifacts, CodeMem creates the kind of environmental state gates that H-098 identifies as effective. Their reproducibility improvements likely stem, in part, from converting implicit (Channel 1) state management into explicit (Channel 2) artifacts.

---

### 7. "Less is More": Reducing Cognitive Load and Task Drift
**arXiv**: 2511.00945 (Nov 2025)
**Relevance**: ★★★☆ GOOD for H-098 (conceptually)

**Abstract**: Studies task drift in multimodal assistive agents. Finds that reducing information volume ("Less is More") and implementing "goal-persistent design" reduces drift.

**Connection to H-098**: While focused on VLM assistive agents (not coding agents), the core finding maps to H-098's Channel 1 analysis: more information → more competition → more drift. Their "goal-persistent design" is conceptually similar to our Channel 2 structural gates — making the goal an environmental invariant rather than a text instruction. The "Less is More" finding supports H-098's prediction that instruction overhead is harmful (KE-025, Law 3).

---

### 8. The Auton Agentic AI Framework
**arXiv**: 2602.23720 (Feb 2026)
**Relevance**: ★★★★ EXCELLENT for H-098

**Abstract**: Proposes a "strict separation between the Cognitive Blueprint (declarative specification) and the Runtime Engine (execution substrate)." Uses POMDP formalization with constraint manifold formalism for safety enforcement via policy projection.

**Connection to H-098**: Auton's architecture embodies H-098's Channel 2 principle: separate cognitive rules from execution mechanics. Their "constraint manifold formalism for safety enforcement via policy projection rather than post-hoc filtering" is exactly the Channel 2 approach — safety isn't a text instruction (Channel 1, "don't do X"), it's a structural constraint in the execution engine that makes violations impossible. This is the most architecturally aligned paper we've found.

**Key concept**: "Policy projection" (projecting agent actions onto a safe constraint manifold) is a mathematical formalization of what our Channel 2 gates do informally. We gate on artifacts; they project on manifolds. Same principle, different formalization level.

---

### 9. Decision-Centric Design for LLM Systems
**arXiv**: 2604.00414 (Apr 2026)
**Relevance**: ★★★★★ CRITICAL for H-098

**Abstract**: Proposes separating "decision-relevant signals from the policy that maps them to actions, turning control into an explicit and inspectable layer." Demonstrates that making decisions explicit (rather than implicit within generation) reduces futile actions and improves task success.

**Connection to H-098**: This paper is perhaps the strongest external validation of H-098's core mechanism. Their finding that "in many current architectures, decisions remain implicit within generation, entangling assessment and action" is exactly our Channel 1 problem. Their solution — making decisions an "explicit and inspectable layer" — is our Channel 2 approach. Their attribution framework (failures to signal estimation, decision policy, or execution) maps to our channel model.

**Connection to H-099**: Their framework exposes an implicit assumption: decisions can be made explicit. H-099 identifies the boundary where this fails — when the "decision" is a creative inference, it can't be separated from generation because it doesn't exist until the generation produces it.

**What we add**: Decision-Centric Design focuses on the architectural principle; we provide the experimental evidence across 100+ experiments showing exactly where this principle works (execution, recognition) and where it breaks down (discovery).

---

### 10. LARFT: Closing the Cognition-Action Gap for Length IF
**arXiv**: 2603.19255 (Mar 2026)
**Relevance**: ★★★☆ GOOD for H-098

**Abstract**: Addresses the "cognition-action gap" where models understand length constraints but fail to follow them during generation.

**Connection to H-098**: The "cognition-action gap" is another formulation of Channel 1 failure: the model has the instruction in context (cognition) but fails to implement it during generation (action) because generation-mode attention priorities override instruction-mode processing.

---

## Synthesis: Where Our Work Sits in the Literature

### H-098 (Attention Channel Theory)

| Literature Concept | Our Concept | Relationship |
|-------------------|-------------|-------------|
| Instruction forgetting (FocalLoRA, AgentIF) | Channel 1 suppression | Same phenomenon, we explain the mechanism |
| Goal displacement (Diagnose-Localize-Align) | Channel 1 attention competition | They localize it; we classify it |
| Structural compliance > behavioral compliance (Aegis) | Ch2 > Ch1 effectiveness | They measure it; we unify it |
| Cognitive Blueprint / Runtime separation (Auton) | Channel 1/2 separation | They architect it; we experimentally validate it |
| Decision-explicit layer (Decision-Centric Design) | Channel 2 forced externalization | Same principle; we have 100+ experiments |
| Cognition-action gap (LARFT) | Channel 1 failure mechanism | Same observation, different domain |
| Less-is-more / instruction overhead (VIA-Agent) | KE-025 / Law 3 zero-sum attention | Same finding, different modality |

**Our unique contribution**: No external paper proposes the unified three-channel model with experimental evidence across all channels. Papers individually study Ch1 failure OR Ch2 success, but not the systematic comparison. Our EXP-127 direct test (same content, three channels, Ch2=100%, others=0%) has no external analogue.

### H-099 (Discovery Task Boundary)

**No direct external analogue found.** The closest concepts are:
- "Novel situation handling" in Aegis (acknowledged as hard, no solution proposed)
- "Creative problem-solving" in general LLM evaluation literature (studied as a capability, not as an intervention boundary)
- Stochastic creativity models from cognitive science (Simonton's chance-configuration theory, 1999)

**This is genuinely novel work.** The specific claim — that external interventions are categorically harmful on discovery tasks, with a stochastic model predicting the time-success relationship — appears nowhere in the agent literature. H-099 may be our most original theoretical contribution.

---

## Recommendations for H-098 and H-099 Updates

### For H-098:
1. **Add literature connections section** citing AGENTIF, Decision-Centric Design, Auton, and FocalLoRA as external validation of the channel separation principle
2. **Note that FocalLoRA represents the "fix Channel 1" approach** — our approach (abandon Channel 1, use Channel 2) is complementary
3. **Cite Diagnose-Localize-Align** for their "goal displacement" concept as independent discovery of Channel 1 failure
4. **Cite Decision-Centric Design** as the closest external parallel to our forced externalization approach

### For H-099:
1. **Note the novelty** — no external work studies intervention-resistance on discovery tasks
2. **Connect to Simonton's chance-configuration theory** from cognitive science as theoretical grounding for the stochastic model
3. **Note that Decision-Centric Design implicitly assumes decisions can be externalized** — H-099 identifies where this assumption fails

---

## Papers to Track for Future Sessions

1. **AGENTIF follow-ups**: Any work extending instruction-following evaluation to include structural vs. behavioral instruction types
2. **FocalLoRA results**: If FocalLoRA is empirically evaluated on judgment/behavioral tasks, the results directly test H-098's predictions
3. **Multi-agent creativity literature**: Any work on whether multiple agents can compensate for individual discovery failure (H-099 Open Question #3)
4. **Structural prompting / constrained decoding**: Literature on forcing output structure at the decoding level — this is the extreme form of Channel 2

---

*This literature grounding should be referenced from H-098 and H-099 and maintained as new relevant papers appear.*
