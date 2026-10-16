<ai_context>
summary: "Pinned Statewave source shows that a memory replay must name which dimensions are frozen and which are live: its receipt replay uses current memories and code with the original policy, so it supports drift comparison rather than historical reproduction."
triggers: ["memory replay", "state assembly receipt", "policy snapshot", "context provenance", "Statewave"]
last_updated: "2026-10-16"
source_basis: "GitHub repository discovery plus README, design documentation, implementation, and project-authored unit tests inspected at Statewave revision fe58da0dd0117ff5df9a36df34dca2c480329c8f; Scout did not execute the software or tests."
</ai_context>

# Memory replay needs explicit semantic coordinates

**Date:** 2026-10-16  
**Disposition:** New knowledge  
**Repo:** https://github.com/smaramwbc/statewave  
**Inspected revision:** https://github.com/smaramwbc/statewave/commit/fe58da0dd0117ff5df9a36df34dca2c480329c8f

## Question

What does a replay of an agent's assembled memory actually reproduce, and what evidence is needed to interpret a difference?

## Source observation

Statewave records an optional state-assembly receipt for a context or handoff request. The documented receipt includes the selected memory or episode identities, provenance and validity fields, policy decisions, and a hash of the context bytes delivered to the agent. At the inspected revision, replay does **not** recreate those historical bytes. It reruns assembly with:

- **current memories**,
- **current compiler and scoring code**, and
- the **original policy bundle**, captured as YAML in the receipt.

The implementation labels the new receipt `as_of_replay`, links it to the original with `parent_receipt_id`, and reports changes in context hash, selected entries, and applied filters. Project-authored unit tests check the structural diff helper, including added or removed entries, rank-only changes, malformed entries, and a failed replay-receipt write. Documentation and source both refuse pre-snapshot receipts and nested replay rather than guessing missing historical policy.

This produces a useful counterfactual—*what would today's data and code select under the earlier rules?*—but not a reconstruction of what the agent saw then. The project explicitly says byte-for-byte historical reproduction would also require a memory snapshot. Because code is live too, a changed result can still combine data drift with implementation drift; freezing policy alone does not isolate those causes.

## Interpretation

“Replay” is under-specified unless its semantic coordinates are recorded. A replay artifact should state, independently, whether it freezes or refreshes at least:

1. source data or memory state,
2. compiler, ranking, and canonicalization code,
3. policy and caller authority,
4. model/provider configuration where model output participates, and
5. the final delivered bytes.

A live-data replay is useful for regression or incident comparison. A historical reconstruction needs versioned code and data snapshots, or the original delivered artifact itself. Calling both simply “replay” invites auditors to read a drift detector as proof of exact reproduction.

Statewave also treats receipt emission and signing failures as fail-open for serving. That may be an availability choice, but `receipt_emitted: false` is therefore an audit gap, not evidence that the same accountable artifact exists. Consumers should preserve this third outcome rather than collapsing it into success or replay mismatch.

## Relevance

Agent systems that retain task facts, context packets, or recovery records should identify whether a later rerun is a historical reconstruction, a current-state re-evaluation under old rules, or a current regression test. Store the original delivered context hash or bytes when exact historical evidence matters; store policy, code, and data identities separately so later comparisons can attribute drift instead of merely detecting it.

## Evidence limits

Scout inspected the repository README, `docs/replay.md`, `docs/state-assembly-receipts.md`, `server/services/replay.py`, and `tests/test_replay.py` through GitHub's public read-only API at the pinned revision. Scout did not clone or run Statewave, execute its tests, inspect a live receipt, validate database behavior, exercise signing or tenant isolation, or reproduce a replay. The tests are project-authored evidence of intended behavior, not independent validation. Repository metadata and documentation claims about the wider product are not proof of deployment reliability.

## Sources

- [README](https://github.com/smaramwbc/statewave/blob/fe58da0dd0117ff5df9a36df34dca2c480329c8f/README.md)
- [Replay semantics](https://github.com/smaramwbc/statewave/blob/fe58da0dd0117ff5df9a36df34dca2c480329c8f/docs/replay.md)
- [State-assembly receipt design](https://github.com/smaramwbc/statewave/blob/fe58da0dd0117ff5df9a36df34dca2c480329c8f/docs/state-assembly-receipts.md)
- [Replay service](https://github.com/smaramwbc/statewave/blob/fe58da0dd0117ff5df9a36df34dca2c480329c8f/server/services/replay.py)
- [Replay unit tests](https://github.com/smaramwbc/statewave/blob/fe58da0dd0117ff5df9a36df34dca2c480329c8f/tests/test_replay.py)

## Discovery record

GitHub Repository Search API query: `"AI agent" (evaluation OR observability) pushed:>=2026-10-01 stars:>20`, sorted by update time. The response reported `total_count: 2581` and `incomplete_results: false`. Discovery metadata selected the candidate; repository contents at the pinned revision, not search metadata, ground the assessment.
