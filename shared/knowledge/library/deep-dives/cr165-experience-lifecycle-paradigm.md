# Cross-Reference Synthesis #165: The Experience Lifecycle — From Raw Interaction to Operational Knowledge

**Date:** 2026-03-16
**Type:** Cross-Reference Synthesis
**Rating:** ★★★★★
**Connected DDs:** DD#327 (Steve-Evolving), DD#316 (Structured Distillation), DD#290 (Planning Framework), DD#292 (iSWE), DD#289 (EducaSim), DD#328 (AgentFuel)

---

## Thesis

Steve-Evolving (DD#327) makes explicit a paradigm that has been implicit across our portfolio: **agent experience has a lifecycle**, progressing through distinct evolutionary stages. This synthesis maps the lifecycle pattern across six papers and identifies the critical bottleneck at each transition.

---

## The Five-Stage Experience Lifecycle

### Stage 1: Raw Interaction → Structured Recording

**The Anchoring Problem:** How do we capture the right signals from agent-environment interaction?

| Paper | Recording Approach | Signal Granularity |
|-------|-------------------|-------------------|
| Steve-Evolving (DD#327) | 13 check types × 11 failure causes + loop detection | Very high — continuous indicators, enumerated causes |
| iSWE (DD#292) | Compiler feedback + test results | Medium — binary per test, structured error messages |
| EducaSim (DD#289) | Conversation logs + student persona state | Medium — tiered memory (foundational + domain) |
| AgentFuel (DD#328) | Temporal query results + functional correctness | Low to medium — end-to-end pass/fail |

**Key insight:** The quality of downstream knowledge distillation is bounded by recording granularity. Steve-Evolving's 13×11 diagnosis space enables targeted guardrails; iSWE's compiler feedback enables specific code fixes; but binary pass/fail (AgentFuel's finding about current agents) prevents meaningful learning.

### Stage 2: Structured Records → Pattern Recognition

**The Attribution Problem:** How do we identify WHY something succeeded or failed?

- **Steve-Evolving:** Fine-grained failure cause enumeration + stagnation detection enables root cause attribution
- **iSWE:** Compiler error messages directly point to code issues, but cross-file root causes are harder
- **DD#290 (Planning Framework):** POMDP formalization helps attribute failures to planning vs execution
- **EducaSim:** Student persona engagement metrics help attribute interaction success/failure

**Critical bottleneck:** Attribution is hardest when the failure mode is **implicit** — the agent appears to be working but is stuck (Steve-Evolving's loop detector), or the plan succeeds step-by-step but the task fails (Steve-Evolving's task-level distillation).

### Stage 3: Patterns → Reusable Knowledge

**The Distillation Problem:** How do we generalize specific experiences into transferable knowledge?

Steve-Evolving's **dual-track distillation** is the most complete implementation:
- **Positive track:** Skill = preconditions + action sequence + verification criteria
- **Negative track:** Guardrail = trigger conditions + forbidden actions + consequences

**The guardrails-over-skills finding** (guardrail ablation drops Diamond SR from 17.1% to 10.1%, while skill ablation only drops to 14.6%) suggests:
→ In complex environments, **constraint knowledge** (what NOT to do) is more valuable than **procedural knowledge** (what TO do)
→ This aligns with safety engineering: hazard avoidance protocols are more critical than optimal procedures

### Stage 4: Knowledge → Planning Constraints

**The Injection Problem:** How do we get distilled knowledge into the agent's decision-making?

- **Steve-Evolving:** Context window injection — skills as demonstrations, guardrails as negative prompts
- **iSWE:** Tool-specific prompts with known patterns
- **DD#290:** Retrieved plan templates guide decomposition
- **AgentFuel's gap:** Current timeseries agents don't inject domain knowledge at all — they rely on generic capabilities

**The visibility ablation** (removing knowledge visibility drops Diamond SR from 17.1% to 3.1%) proves that having knowledge isn't enough — it must be **explicitly visible** to the planner. Implicit knowledge in vector stores is insufficient.

### Stage 5: Constraints → Adaptive Execution → New Interactions

**The Closed-Loop Problem:** How do we ensure continuous improvement?

Only Steve-Evolving fully closes the loop with **local replanning** triggered by cumulative error thresholds. Other systems are open-loop:
- iSWE iterates within a task but doesn't accumulate cross-task knowledge
- DD#290 plans upfront but doesn't replan based on execution feedback
- EducaSim adapts within a conversation but doesn't distill across conversations

---

## The Experience Lifecycle Maturity Model

Based on this analysis, we can classify agent systems by their lifecycle maturity:

| Level | Description | Example |
|-------|-------------|---------|
| L0 — No Memory | Stateless, each task independent | Basic LLM agent |
| L1 — Recording | Stores raw trajectories | JARVIS-1 (raw trajectory retrieval) |
| L2 — Structuring | Organizes records with structured schema | Steve-Evolving Phase 1 |
| L3 — Distilling | Extracts reusable knowledge from records | Steve-Evolving Phase 2, Voyager (skills) |
| L4 — Injecting | Integrates knowledge into planning | Steve-Evolving Phase 3 |
| L5 — Closing Loop | Continuous diagnosis→distillation→replanning | Steve-Evolving (full system) |

Most current agent systems operate at L1-L2. Steve-Evolving achieves L5 in Minecraft. **The research frontier is achieving L5 in general-purpose agent settings.**

---

## Implications for Agent Architecture

### 1. Diagnosis Infrastructure is Foundational
You cannot build L3+ systems without L2-quality recording. This means **investing in diagnosis infrastructure** (fine-grained monitoring, structured error attribution) is a prerequisite for self-evolving agents.

### 2. Negative Knowledge is Undervalued
The guardrails > skills finding suggests current agent designs are biased toward collecting positive examples (demonstrations, skills) while neglecting negative examples (failure modes, constraints). A balanced portfolio of both is essential.

### 3. Knowledge Visibility is Critical
The dramatic ablation drop when knowledge visibility is removed shows that retrieval-augmented generation needs **explicit injection** — not just similarity-based retrieval. The planner must be forced to attend to relevant knowledge.

### 4. Domain Evaluation Gaps Persist
AgentFuel shows that even L1 systems haven't been properly evaluated in domain-specific settings. The evaluation infrastructure is lagging behind the agent architecture research.

---

## Open Questions

1. **Knowledge conflict resolution:** When guardrails from different tasks contradict each other, what conflict resolution mechanism should be used?
2. **Lifecycle across domains:** Steve-Evolving's lifecycle works in Minecraft with well-defined success/failure. How does the lifecycle work in domains with ambiguous outcomes (creative writing, negotiation)?
3. **Multi-agent knowledge sharing:** If multiple agents independently distill knowledge, how do we merge their knowledge bases without contradictions?
4. **Lifecycle efficiency:** What is the minimum number of experiences needed to distill reliable guardrails? Is there a learning curve analog?

---

## Bottom Line

The Experience Lifecycle is emerging as a unifying framework for understanding agent self-improvement. Steve-Evolving provides the most complete implementation (L5), while most current systems operate at L1-L2. The critical transitions are: (1) recording → attribution (requires fine-grained diagnosis), (2) attribution → distillation (requires dual-track positive/negative generalization), and (3) distillation → injection (requires explicit visibility to the planner). The field needs to advance from "accumulating experience" to "evolving knowledge."
