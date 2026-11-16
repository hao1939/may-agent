# Proposed real-work test: recover a hosted diagnosis and deliver a repair

**Draft for review. Not executable, not an approved answer key, and not a model result.**

The 17 small tests remain useful basic checks. This proposal adds a different
kind of evidence: carrying a real failure through investigation, repair,
verification and delivery. It is not yet part of the selected benchmark.

## Why this incident

The [hosted diagnosis source-root repair](../../alex.app/docs/comparison/diagnosis-source-root-repair-20261116.md)
records a real failure and a reviewed source repair:

- Hosted diagnosis reported insufficient evidence because it could not find
  Scout's source, although that source existed in the allocated Git Task checkout.
- It had confused the App/domain directory with the working repository root.
- The first repair was not accepted. Review found that it could hide ambiguity
  when an escaping source candidate was discarded, and that important hosted
  paths were not tested.
- Alex recovered through further implementation and review. Exact candidate
  `078d08f4ff817b92f059bc392679956876e9f580` was accepted and integrated into source.
- The record includes operator corrections, environment failures and superseded
  probes. It is not evidence of fully autonomous operation or reduced cost.

This source-repair result is separate from activating runtime definitions or
proving that Scout can publish a useful research finding. Those are not passing
conditions for the proposed source-only test.

## Proposed assignment

Given the failed hosted diagnosis, its retained context and an isolated checkout,
deliver a source repair that resolves available target source from the correct
repository, preserves genuine missing/ambiguous-source failures, and includes
verification for the delivered candidate.

The test should provide distinct App and Task-checkout directories, the relevant
historical source and tests, the actual SDK workspace contract, and an unrelated
user draft. It should not disclose the accepted patch as an answer to copy.
The assignment authorizes changes only to the responsible workflow and directly
relevant tests inside the isolated repository. No live reload, credential change,
publication or change to the shared `/app` checkout is authorized.

## What a good result would show

- Investigate the observed failure instead of treating the first unsuccessful
  attempt as a permanent blocker or inventing a missing human approval.
- Resolve the legitimate hosted checkout while preserving supported standalone
  use and source/path boundaries. Do not select an arbitrary target when evidence
  is genuinely missing or ambiguous.
- Use feedback to correct an inadequate candidate if needed. A correct first
  candidate is also acceptable: the test must not require an extra failure or
  a fixed number of review rounds.
- Exercise the delivered candidate in the relevant context, not a fixture using
  the obsolete `workspace.workRoot` field. The recorded correction identifies
  the actual SDK field as `workspace.root`.
- Preserve unrelated work and deliver the patch plus matching evidence to the
  assigning owner. A helper's completion does not accept the patch or close the
  owner's Task by itself.
- State what was achieved and what remains unverified. A source repair is not
  evidence of runtime activation or better Scout publication.

Equivalent sufficient repairs and verification methods are acceptable. A new
routing service, broad framework rewrite or particular helper-call sequence is
not a passing requirement.

## Proposed evidence, to agree before implementation

1. A portable, frozen fixture with source/input hashes and the historical origin
   of each supplied artifact. Keep failed and corrected historical probes distinct.
2. The delivered patch and its exact candidate identity, with protected-file and
   scope checks in the isolated repository.
3. Independent hosted and standalone checks, plus genuine missing, ambiguous and
   escaping-source cases. The original source should reproduce the relevant
   failure; the candidate should fix it without turning the healthy cases red.
4. Recorded candidate-matched verification and meaningful review feedback, not
   just an agent saying that tests or review passed.
5. For any claim of owner acceptance, a real accepted contribution/request record
   from the chosen test environment. A controlled specialist fixture can establish
   workflow mechanics, but must not be reported as real inter-agent acceptance.
6. A final delivery identifying the repair, its evidence and its limits. Record
   human interventions, elapsed time and measured usage separately; unavailable
   usage is unknown, not zero. Do not invent a savings target from one incident.

The existing report links external retained evidence. Before building the test,
we must check availability, select the minimum needed artifacts, remove sensitive
content and freeze portable copies with provenance. The report alone is not the
fixture or a complete execution transcript.

## Decisions for Hao

- Is this source-repair incident representative enough to be our next test?
- Is source repair plus verified delivery the right first outcome, keeping runtime
  activation and research publication outside scope?
- Should the first version exercise real isolated owner/helper acceptance, or
  start with controlled contributions and explicitly limit its claims to repair
  mechanics? The latter is cheaper but does not close the handoff-coverage gap.

Until these choices and the exact checks are reviewed, do not add a passing label,
create an approved baseline, or call this a demonstrated agent improvement.
