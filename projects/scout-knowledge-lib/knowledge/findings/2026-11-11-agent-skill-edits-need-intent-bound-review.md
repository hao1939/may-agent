<ai_context>
summary: "Pinned Argus source treats agent-authored skill changes as reviewable effects tied to the originating intent and run, while preserving human decisions, stale-state refusal, and apply-attempt receipts. Its useful pattern is intent-bound skill governance, not proof that model-generated evidence labels or proposals are correct."
triggers: ["Argus", "Hermes agent", "skill edit review", "intent-bound review", "self-editing agents", "skill provenance", "stale decision", "apply receipt"]
last_updated: "2026-11-11"
source_basis: "Static inspection of albertodvp/argus README, complete repository tree, data-model and Hermes-learning-loop documentation, derivation and apply source, and selected producer-authored tests at commit bf0b6a3b7ecf978590605ad166956229c39e238d. Scout did not run the package, tests, Hermes, models, dashboard, or apply paths."
</ai_context>

# Agent skill edits need intent-bound review and stale-state refusal

**Date:** 2026-11-11  
**Disposition:** new knowledge  
**Question:** How can a self-editing agent make learned skill changes reviewable without treating a session log or a human click as sufficient evidence?  
**Repo:** https://github.com/albertodvp/argus  
**Reviewed version:** commit [`bf0b6a3b7ecf978590605ad166956229c39e238d`](https://github.com/albertodvp/argus/commit/bf0b6a3b7ecf978590605ad166956229c39e238d)  
**Coverage:** repository metadata; complete non-truncated 104-entry tree; `README.md`; `docs/data-model.md`; `docs/hermes-learning-loop.md`; `docs/intents.md`; `argus/derive.py`; `argus/apply.py`; `argus/store.py`; and selected edit-review, proposal-apply, and rollback tests. Scout did not execute the code.

## Source observation

Argus is a Hermes plugin that reviews what an agent learns into reusable skills. The useful implementation signal is not merely its dashboard or human approval step. The pinned source separates five records that are often collapsed in self-editing systems:

1. **Originating work:** turns are grouped into an *intent*—one expected result that may span corrections, sessions, or repeated runs—rather than treating each chat session as the learning unit.
2. **Skill mutation:** the Hermes skill ledger retains before/after content, actor, action, and limited session evidence for each edit.
3. **Derived review:** Argus links an edit back to a run that still exists in `state.db` and labels the edit as `observed-failure`, `observed-success`, `user-correction`, or `speculative`. If the run is unavailable, the source records `no-run` and judges only what was learned from the diff instead of pretending the missing trajectory supports the change. Human edits and rollback entries are excluded from this model review.
4. **Human decision:** keep/reject decisions on edits and accept/dismiss decisions on proposals are stored separately. A proposal decision keeps a snapshot of the rule and diff shown to the person.
5. **Effect attempt:** applying a decision is another operation with its own `applied`, `staged`, `refused`, `failed`, or `unknown` record. Rollback is refused if a newer ledger entry or an out-of-ledger edit changed the target. Proposal apply is refused if derivation changed the accepted diff, the skill changed so the patch context is stale, the skill is read-only or locked, or an equivalent write is already pending.

The repository also derives proposed rules only after recurrence: documentation says proposals require evidence from at least two intents or an error observed at least five times. Applying an accepted proposal goes through Hermes' own skill-management path rather than directly editing the file, so an enabled write-approval mechanism can stage the change for a second approval.

Selected producer-authored tests encode important negative cases. They expect no run-grounded evidence label for an edit whose messages are gone, no effect without the current matching decision, no second rollback, and refusal when a proposal changed after the human saw it or a skill file no longer matches the edit's after-state. These tests are evidence of intended behavior, not proof that the implementation passes or covers every path.

## Interpretation

A self-editing agent needs a governance chain that binds learning to **why the agent was acting**, not just where the edit appeared:

- the intent identifies the expected result;
- the run supplies observable success, failure, correction, or interruption evidence;
- the edit records the candidate behavior change;
- the decision records exactly what a reviewer accepted or rejected; and
- the apply receipt records whether that decision still matched current state when an effect was attempted.

This makes two distinct failures visible. First, an edit can lack evidence even when its prose sounds sensible. Second, an accepted edit can become unsafe to apply because the target or proposal changed after review. Human approval is therefore not a timeless capability: it should be bound to the reviewed candidate revision and consumed only against compatible current state.

The intent layer also supports a better review denominator than session counts. One goal may need several corrected sessions, while one session may contain several deliverables. Reviewing skill changes against durable intent/run identities can distinguish repeated evidence for one goal from support across genuinely different goals. That distinction matters when deciding whether a learned rule is reusable.

For agent platforms, the transferable pattern is an **intent-bound skill-change ledger** with explicit missing-evidence states, immutable decision snapshots, optimistic stale-state checks, and separate apply attempts. Proposed cross-task rules should cite the contributing intents; rejected or refused changes should remain queryable instead of disappearing from the learning history.

## Comparison with existing Scout knowledge

[Failed skill patches should update a repair state, not restart reflection](./2026-09-15-structured-skill-repair-state.md) covers structured diagnosis, candidate patches, and retest outcomes during repair. Argus adds a different boundary: review of edits the running agent already made, including whether the originating run exists and whether a later human decision is still applicable to current files.

[XHS: Self-Evolving Agent Discussion Narrows to the Control Surface](../2026-08-06-xhs-self-evolving-agent-control-surface.md) establishes that self-improvement needs independent evaluation and admission gates. Argus provides a concrete local record shape for that control surface, but its evidence and proposal judgments are still produced by a model and are not independent correctness proofs.

[Mined operating rules need separate admission and execution gates](./2026-11-09-precedent-mined-rules-gated-enforcement.md) separates evidence extraction, rule admission, start authorization, and in-progress checks for operational policy. Argus is a distinct subject focused on skill-file evolution: it binds review to the originating intent and refuses stale rollback or proposal effects after intervening changes.

## Possible application to May

May's durable Tasks already distinguish an outcome from individual sessions and attempts. A related investigation could test whether reusable agent-definition, skill, or knowledge edits can cite the exact Task/attempt evidence that motivated them, preserve the reviewed candidate bytes or revision, and refuse publication when the candidate or target changed after approval. The source supports investigating this record shape; it does not establish that Argus should be adopted or that its Hermes-specific integration fits May.

## Limitations

This was static source inspection. Scout did not install Argus, run its tests, connect Hermes, invoke a model, inspect a live `state.db` or skill ledger, exercise write approval, apply or roll back a real skill, verify concurrency, or reproduce the README's showcase and cost figures.

Argus depends on Hermes internals that its own documentation describes as undocumented: `state.db`, the curator ledger, `rollback_entry`, and `skill_manage`. Compatibility checks can fail closed on missing database columns, but that does not make the integration stable. The ledger does not directly distinguish a background review from the curator; Argus infers this from whether the referenced session has messages, so deleted or incomplete history can change attribution.

The evidence labels, intent grouping, outcome judgments, and proposals rely partly on model output. A label such as `observed-success` is a review result, not a causal demonstration that the edit produced success. Recurrence across intents does not establish generalization, security, or non-regression. The system explicitly does not model whether a skill change helped, and before/after counts are descriptive only. Human decision identity is recorded but the inspected material does not establish authenticated reviewer identity, complete mediation of every skill-write path, or production security.

The public repository Search API responses used for discovery returned `incomplete_results: false`, but that describes only the bounded queries, not exhaustive GitHub coverage.
