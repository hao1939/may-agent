<ai_context>
summary: "Sediment implements a useful evidence architecture for coding agents: append immutable observations, compute policy-dependent attribution and evaluation as reproducible derivations, and exclude poisoned evidence through a revisioned append-only quarantine log rather than rewriting history. This keeps policy upgrades replayable and makes each derived artifact's fact-visibility boundary explicit."
triggers: ["agent evidence store", "immutable facts", "recomputable derivation", "evaluation provenance", "quarantine revision", "coding agent telemetry", "Sediment"]
last_updated: "2026-09-22"
source_basis: "Static inspection of sediment-ai/sediment at commit 6d8c56dbe19dad1ebda36d0408a76d4e33410a05: README, architecture explanation, ADRs 0001/0015/0020/0026, PostgreSQL schema, and project-authored store/provenance/bounded-read tests. Tests and deployment were not run."
</ai_context>

# Immutable Agent Evidence, Recomputable Interpretation

Date: 2026-09-22  
Repo: https://github.com/sediment-ai/sediment  
Reviewed revision: [`6d8c56dbe19dad1ebda36d0408a76d4e33410a05`](https://github.com/sediment-ai/sediment/commit/6d8c56dbe19dad1ebda36d0408a76d4e33410a05)  
Coverage: static inspection of the README, architecture explanation, ADRs 0001, 0015, 0020, and 0026, PostgreSQL schema, and selected project-authored tests; no local execution

## Signal

Sediment is a self-hosted evidence store for coding-agent activity. Its useful
architectural contribution is not merely collecting traces. It divides data
into two authority classes:

- **Facts** are captured observations such as inference calls, developer
  decisions, edit observations, pushes, and CI outcomes. They are appended and
  retained rather than enriched with a later interpretation.
- **Derivations** are policy-versioned functions over those facts, producing
  attribution, edit-retention judgments, rollouts, reports, and training
  exports. Derived state is not written back as if it were an observation.

This separation addresses a recurring agent-evaluation failure: an early
matcher or threshold can otherwise permanently erase near-misses or turn an
uncertain relationship into historical truth. Retaining the observations lets a
new attribution policy rescore old evidence, while a derived bundle can pin the
policy and source visibility used for a particular result.

The repository also treats correction as a visibility decision rather than a
history rewrite. ADR 0001 specifies an append-only quarantine log consulted by
derivation-facing reads. At the reviewed revision, a project-authored PostgreSQL
test checks that quarantining a decision increments the quarantine revision,
hides it from ordinary reads and counts, preserves it for audit reads, and then
records a separate release action that makes it visible again. The derivation
`Provenance` object includes both `policy_version` and `quarantine_revision`,
with an optional policy digest.

## Reusable pattern

For agent traces that may later support evaluation, context retrieval, or
training:

1. Store the observed event and its source identity without attaching a mutable
   quality verdict.
2. Derive attribution, acceptance, reward, and dataset eligibility under an
   explicit policy version.
3. Pin every published analysis to both the policy identity and the evidence
   visibility revision. A policy hash without a quarantine revision does not
   fully identify the input population.
4. When evidence is forged, leaked, or mistranslated, append a quarantine action
   and exclude it from ordinary derivations; preserve the original fact and the
   corrective action for audit.
5. Refuse oversize derivations rather than silently truncating the population.
   Sediment's bounded-execution ADR explicitly distinguishes bounded decoded
   lifetime from incomplete evidence and requires capacity failures to remain
   failures.

The non-obvious implication is that **immutability alone is insufficient**.
Without revisioned visibility, a rerun cannot explain why an unchanged policy
produced a different result after evidence was quarantined or released.
Conversely, storing only derived labels prevents improved policies from being
applied consistently to history. Reproducible agent evaluation needs both an
immutable observation plane and a versioned interpretation plane.

## Evidence boundary

This is repository-authored design, implementation, and test evidence, not an
independent production assessment. Scout did not run the PostgreSQL suite,
deploy the service, measure resource bounds, inspect operational data, or verify
that every derivation path consults quarantine correctly. The project-authored
tests substantiate intended behavior at the pinned revision but do not prove
production reliability, privacy, or unbiased attribution quality.

## Pinned sources

- [Repository README](https://github.com/sediment-ai/sediment/blob/6d8c56dbe19dad1ebda36d0408a76d4e33410a05/README.md)
- [How Sediment works](https://github.com/sediment-ai/sediment/blob/6d8c56dbe19dad1ebda36d0408a76d4e33410a05/docs/explanation/how-sediment-works.md)
- [ADR 0001: persist facts; derive everything else](https://github.com/sediment-ai/sediment/blob/6d8c56dbe19dad1ebda36d0408a76d4e33410a05/docs/adr/0001-facts-not-derived-state.md)
- [ADR 0020: bounded derivation execution](https://github.com/sediment-ai/sediment/blob/6d8c56dbe19dad1ebda36d0408a76d4e33410a05/docs/adr/0020-bounded-derivation-execution.md)
- [Quarantine behavior test](https://github.com/sediment-ai/sediment/blob/6d8c56dbe19dad1ebda36d0408a76d4e33410a05/packages/core/tests/test_store.py#L1472-L1510)
- [Derivation provenance contract test](https://github.com/sediment-ai/sediment/blob/6d8c56dbe19dad1ebda36d0408a76d4e33410a05/packages/derive/tests/test_provenance.py)
