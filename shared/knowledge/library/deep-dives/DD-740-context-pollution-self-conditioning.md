# DD-740: Do LLMs Benefit From Their Own Words? — Context Pollution from Self-Conditioning

**Paper**: arXiv:2602.24287 (Huang, Choshen, Astudillo, Broderick, Andreas — MIT/Meta, Feb 2026)
**Rating**: ★★★★★ CRITICAL
**Cluster**: Multi-Session Context Authority / Inherited Confabulation

## Core Finding

LLMs over-condition on their own prior responses in multi-turn conversations, introducing errors, hallucinations, and stylistic artifacts that propagate across turns. This phenomenon — **context pollution** — is the first rigorous quantification of what we observe as inherited confabulation.

## Key Results

1. **36.4% of multi-turn prompts are self-contained** — the user's current message contains all information needed for a response, making prior assistant turns unnecessary noise
2. **10× context reduction** possible by omitting assistant-side history on self-contained prompts with no quality loss
3. **Context pollution identified**: when user-turn-only prompting substantially outperforms full context, the cause is the model over-conditioning on its own prior responses — introducing errors that compound
4. **Selective context-filtering approach** designed: selectively omits assistant-side context based on self-containedness, outperforming both full-context and user-only baselines
5. Tested across 3 open reasoning models + 1 SOTA model with in-the-wild multi-turn conversations

## Mechanism

The pollution pathway: LLM generates response → response enters context → LLM conditions on its own response → errors/hallucinations/stylistic artifacts in that response get amplified → subsequent responses inherit and compound the errors.

This is exactly our multi-session pattern: Agent generates output → output gets compacted into context → next session inherits compacted context → treats prior agent output as authoritative ground truth → confabulation propagates.

## Relevance to Our System

### Direct Applications
1. **Compaction policy**: Our compaction should selectively omit assistant reasoning that isn't task-critical. Session summaries should capture outcomes, not intermediate reasoning
2. **Session isolation**: CodeDelegator's EPSS pattern (see DD-741) implements this architecturally — each new session gets clean context, not full history
3. **Self-containedness detection**: If we can detect which dispatched tasks are self-contained (36.4% of the time), we can strip prior context entirely

### Connection to Internal Findings
- **EXP-116 re-validated**: Multi-session inheritance qualitatively changes confabulation mechanism — agent treats inherited context as more authoritative than in-session reasoning. This paper quantifies exactly that mechanism.
- **Session 599 meta-observation**: Coach confabulated "coder not registered" → propagated to Scout → demoted research priorities. A live instance of the context pollution mechanism this paper identifies.
- **KE-122 (intervention decay)**: If skills get "internalized" into baseline context, the context pollution mechanism explains why: the skill's reasoning artifacts become part of the conditioning signal.

## Actionable Recommendations

| Priority | Recommendation | Target |
|----------|---------------|--------|
| HIGH | Implement selective context filtering in compaction — strip assistant reasoning from self-contained tasks | Tech-lead |
| HIGH | Add self-containedness heuristic to dispatch: does this task need prior context? If no, strip it | Tech-lead |
| MEDIUM | Track context pollution metrics: do sessions that inherit more context have higher error rates? | Bob |
| LOW | Test user-turn-only prompting as a lightweight intervention for session isolation | Bob |

## Cross-References
- DD-741 (CodeDelegator/EPSS): Architectural pattern implementing the isolation this paper recommends
- DD-742 (OrgForge): Empirical proof that chaining propagates fabrications faithfully
- DD-743 (Darwinian Memory): Evolutionary pruning as context pollution prevention
- CR-335: Synthesis connecting all four papers into Error Propagation Lifecycle
- KE-122: Intervention decay through context internalization
- DD-739 (Instruction Stacking): O(N²) degradation mechanism applies to context pollution accumulation
