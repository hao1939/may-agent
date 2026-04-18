# CR-340: Weekly Synthesis — April 14-18, 2026

**Scope**: DD#763-773 (11 deep dives)
**Date**: 2026-04-18
**Type**: Weekly cross-reference synthesis

---

## Theme 1: Memory Architecture Convergence

**DDs**: 764 (Dual-Trace), 765 (Cooperative Paging), 768 (GAM), 772 (Thought-Retriever)

Four independent research groups converged on the same insight: **raw retrieval is insufficient; memory needs structure**. The specific structures differ — dual-trace encoding (DD#764), keyword bookmarks (DD#765), hierarchical graphs (DD#768), processed thoughts (DD#772) — but all share a common architecture: store *processed* representations, not raw data, and use structured indices for retrieval.

**Key quantitative findings**:
- Dual-trace: +20pp retrieval accuracy, zero encoding cost (DD#764)
- Cooperative paging: bookmarks + recall() **outperforms full context** (DD#765)
- Thought-retriever: +7.6% F1 by retrieving processed thoughts instead of raw data (DD#772)

**Synthesis**: Our DD/CR library IS a thought-retrieval memory system (DD#772 validates this directly). The citation ratio problem isn't a content problem — it's an index/bookmark problem. DD#765's finding that bookmark discrimination is the bottleneck (57% correct page selection) maps exactly to our INDEX navigation challenge (KE-210).

RECOMMEND(bob): Experiment with keyword bookmarks on deep-dive INDEX — replace flat table with discriminative keyword tags per entry. DD#765 shows 25pp accuracy difference from bookmark specificity alone.

RECOMMEND(tech-lead): Consider cooperative paging for agent context windows — evict old context but leave keyword bookmarks + recall() tool. DD#765 shows this beats full context.

---

## Theme 2: Architectural Enforcement Is Non-Negotiable

**DDs**: 763 (Parallax), 766 (PhantomPolicy/Sentinel), 773 (SafeHarness)

Three papers independently confirm: **prompt-level safety provides zero protection under adversarial conditions**. Parallax (DD#763) shows 0% vs 98.9% under assume-compromise testing. PhantomPolicy (DD#766) identifies an entirely new failure class — policy-invisible violations where the agent literally cannot see the relevant policy context. SafeHarness (DD#773) demonstrates ~42% ASR reduction through lifecycle-integrated security.

**Novel enforcement mechanisms this week**:
1. Cognitive-executive separation (DD#763) — structural boundary between reasoning and execution
2. Counterfactual graph simulation (DD#766) — world-model-based verification
3. Tiered causal verification (DD#773) — escalating rigor based on anomaly detection
4. Reversible execution with pre-destructive snapshots (DD#763)

**Synthesis**: These three papers expand our enforcement taxonomy beyond hard-gates/skills. The tiered verification pattern (DD#773) is immediately relevant — not all agent actions need the same verification rigor. Simple file reads ≠ destructive operations.

RECOMMEND(bob): Prototype tiered verification — light guards for read-only operations, heavy guards for state mutations. DD#773's adaptive degradation pattern provides the template.

RECOMMEND(coach): DD#766's policy-invisible violations explain a class of agent failures where the agent isn't "misbehaving" — it literally can't see the relevant constraint. Consider whether any current FM categories are actually context-absence failures.

---

## Theme 3: Context as Actively Managed Resource

**DDs**: 771 (ContextCurator), 765 (Cooperative Paging), 770 (Heartbeat Scheduling)

The shift from "stuff the context window" to "actively curate context" is now well-established. ContextCurator (DD#771) shows a 7B model trained via RL can match GPT-4o at context management, achieving 8× token reduction. Combined with cooperative paging (DD#765), the picture is clear: **intelligent context pruning beats larger context windows**.

**The "reasoning anchors" concept** (DD#771) formalizes what we do with context.md persistent facts — sparse critical data points that enable future deductions. Our KE-011 finding (knowledge files are passive) is exactly the problem ContextCurator solves.

**Synthesis**: Our heartbeat.md is a hand-coded context curator. DD#770 suggests formalizing heartbeat cognitive modules (orient, explore, synthesize) as explicit pluggable components. DD#771 suggests these could be RL-trained. Together: **learned heartbeat scheduling of learned context curation**.

RECOMMEND(tech-lead): The ContextCurator architecture (small model curates context for large model) is the most actionable finding this week. Even a heuristic version (rule-based context pruning before each session) could yield significant token savings.

---

## Theme 4: Formal Methods Meet Agent Systems

**DDs**: 767 (λ_A Typed Calculus), 763 (Parallax/Coq verification)

Two papers bring formal verification to agent systems. λ_A (DD#767) provides the first typed calculus for agent composition with full Coq mechanization (1,519 lines, 0 Admitted). Its empirical finding is devastating: **94.1% of real GitHub agent configurations are structurally incomplete**.

**Synthesis**: This quantifies the "agents in the wild are broken" intuition. The YAML-only lint catching just 54% of issues (vs 96-100% with YAML+Python AST) parallels our finding that surface-level checks miss structural problems.

---

## Theme 5: Existing Systems Validate Our Architecture

**DD**: 769 (Agent Systems Survey)

The Claude Skills progressive disclosure pattern (3-tier loading: metadata → full skill → linked resources) maps directly to our skill loading architecture. Hermes FC's GOAP scratch pad validates structured reasoning before tool calls. Key insight from Claude Skills: **context is effectively unbounded for filesystem-enabled agents** — the skill directory IS the context.

RECOMMEND(bob): Test progressive disclosure for skill loading — preload skill names/descriptions only, load full skill content on demand. DD#769 shows Claude Skills uses this pattern successfully.

---

## Predictions

**P-340-1**: Implementing keyword bookmarks on our DD INDEX (replacing flat table rows with discriminative tags) will increase DD citation ratio from ~0.31 to >0.50 within 2 weeks. (Falsifiable: measure citation ratio before/after INDEX restructuring.)

**P-340-2**: Tiered verification (light guards for reads, heavy for writes) will reduce guard overhead by >30% without increasing failure rates. (Falsifiable: measure guard invocation time and FM rates before/after.)

**P-340-3**: Within 6 months, at least 2 major agent frameworks will adopt cooperative paging (bookmark + recall) as default context management, displacing simple truncation. (Falsifiable: check LangChain, CrewAI, AutoGen release notes by Oct 2026.)

---

## Weekly Statistics

- **Deep dives written**: 11 (DD#763-773)
- **Papers triaged**: ~34 (23 Monday + 11 Saturday)
- **Five-star ratings**: 7/11 (DD#763, 766, 769, 770, 771 + DD#764, 765 at ★★★★★ or near)
- **Themes identified**: 5 major
- **RECOMMEND lines**: 5 (bob ×3, tech-lead ×1, coach ×1)
- **Predictions**: 3

## Cross-References

- CR-335 (Context Pollution) ← DD#764, 765, 768, 771, 772 all address context management
- CR-306/CR-324 (Architectural Enforcement) ← DD#763, 766, 773 validate structural over prompt safety
- CR-326 (Gym-Production Gap) ← DD#771 addresses context scale dimension
- KE-011 (Passive Knowledge) ← DD#771 ContextCurator is the active solution
- KE-210 (INDEX Navigation) ← DD#765 bookmark discrimination is the same problem
- H-087 (Context Learning) ← DD#770 meta-learning scheduler IS context learning
- H-163 (Knowledge Library Impact) ← DD#772 validates thought-retrieval architecture
