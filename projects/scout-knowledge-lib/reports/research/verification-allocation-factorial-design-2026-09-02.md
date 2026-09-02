<ai_context>
summary: "Preregistration-ready design for separating provisional-plan relevance, current temptation, and authenticated supersession state in scarce memory-verification allocation. This is a design artifact, not a completed experiment or causal result."
triggers: ["memory verification allocation", "supersession-aware retrieval", "factorial allocation design", "stale memory", "verification budget"]
last_updated: "2026-09-02"
source_basis: "Scout's checksum-verified review of arXiv 2608.25553v3 and its deposited Experiment C archive, including all 600 P1 episodes and the Cycle 42–44 selection, ordering, and design audits."
</ai_context>

# Separate relevance from freshness before claiming a scheduler

## What is missing

The retained Experiment C result shows that a relevance rule moves scarce
verification toward constraint-bearing memories. Scout's raw-episode audits
also show that selection order closely follows the agent's intended action.
Those observations do not establish that an allocator can prefer current
evidence over stale evidence when relevance pulls the other way.

In the 600 P1 episodes:

- all 300 `agrees`/`withdraws` pairs have byte-identical turn-1 prompts and
  memory blocks;
- supersession is hidden until a selected archive path is returned;
- all episodes share one current-situation text fingerprint,
  `7d4a5d81e70534a64ecd74fd86dc1d534a98fdfeaed743b333a8e3ab59eba0b8`;
- intended action is a model response, not an assigned treatment; and
- separate stochastic calls produce different raw turn-1 responses in all
  300 world pairs.

The archive therefore supports descriptive allocation evidence, not an
independent causal estimate for plan, temptation, or visible freshness.

## Proposed factorial

Use a one-slot allocation task with three independently assigned binary
factors. Keep inherited memory bodies constant across cells.

| Factor               | Level 0                              | Level 1                               | Purpose                                                                            |
| -------------------- | ------------------------------------ | ------------------------------------- | ---------------------------------------------------------------------------------- |
| Provisional plan     | plan names the decoy direction       | plan names the target direction       | Separates prior commitment from the model's endogenous turn-1 intent.              |
| Current temptation   | situation favors the decoy direction | situation favors the target direction | Separates immediate pressure from the declared plan.                               |
| Authenticated status | target path is current               | target path is superseded             | Tests whether visible authoritative freshness changes allocation before retrieval. |

The status cue must be a compact, authenticated lineage manifest supplied by
the archive authority. It must name the latest record for every candidate path
using symmetric wording. It must not reveal the later record's conclusion,
call one path “critical,” or use target-specific instruction text.

Counterbalance two target identities, target/decoy presentation order, and the
mapping between semantic direction and stable memory identifier. This produces
`2 × 2 × 2 × 2 × 2 = 32` prompt cells per model/seed block. With the
six retained model identities and 25 seeds, the confirmatory grid would contain
4,800 one-turn allocation episodes. A smaller smoke gate may validate schema,
serving, and factor isolation, but cannot substitute for the frozen grid.

## Outcomes and estimands

Primary outcome: whether the target path receives the single verification
slot. Score this before any archive record is returned or downstream decision
is requested.

Primary estimand:

`Delta_status = P(select target | target current) - P(select target | target superseded)`

Report it in every plan-by-temptation stratum. The strongest operational test
is the cell where both plan and temptation favor the target: a freshness-aware
allocator should still reduce selection when the authenticated manifest says
that target is superseded.

Secondary estimands:

- plan main effect and plan-by-status interaction;
- temptation main effect and temptation-by-status interaction;
- three-way interaction among plan, temptation, and status;
- target-identity and record-order heterogeneity; and
- malformed, over-budget, abstaining, and non-candidate outputs.

Use the model/run block as the inference unit, keep all factor cells together
when resampling, and report per-model effects beside the pooled equal-model
summary. Freeze practical-effect regions and the bootstrap seed before any
confirmatory call. Do not interpret a status effect as provenance correctness
unless the manifest's issuer and signature verification are independently
enforced.

## Isolation checks

Before the smoke gate, a deterministic verifier must prove:

1. each prompt differs only in registered factor spans plus counterbalancing;
2. memory bodies are byte-identical across all status cells;
3. plan and temptation wording have matched length and structure across
   directions;
4. the status manifest is symmetric across candidates and contains no outcome
   language;
5. every cell/model/seed identity is unique and scheduled exactly once;
6. target identity and record order are balanced within every factor cell; and
7. the scorer reads only the structured allocation answer.

The frozen design, prompt generator, verifier, model listing, seed policy,
schedule, exclusion rules, and empty result manifest must be content-addressed
and externally timestamped before confirmatory calls.

## Offline isolation fixture

Scout commit `957390080c9a77dc2adc88ed91d66c7f5ba86d50` adds the
[deterministic generator and verifier](../../../scout-knowledge-lib.app/scripts/verification-allocation-factorial.ts)
plus [regression tests](../../../scout-knowledge-lib.app/scripts/verification-allocation-factorial.test.ts).
Its deliberately smaller smoke fixture contains one synthetic model identity,
two synthetic seeds, and all 32 factor/counterbalance cells: 64 episodes at
SHA-256
`cd137ac3dcf914adb708dc2f4a798d436732048ed12e9d7fb50a8ee5bbd468fd`.

The verifier reconstructs every prompt, requires one unique episode for every
cell, balances target identity and presentation order within each
plan/temptation/status cell, keeps each memory body byte-stable, checks matched
factor wording and symmetric lineage fields, and gives the scorer only the
one-field structured allocation answer. Regression fixtures prove rejection
of unregistered prompt text, body drift, missing counterbalance cells,
asymmetric or outcome-oriented lineage, and extra scorer fields.

The schedule labels itself `synthetic-design-fixture`, sets
`providerCallsAuthorized` to false, and contains an empty results array. Its
`fixture-only` attestation is not a signature or an authenticated archive
authority. No serving revision, real seed policy, retry/exclusion package,
external timestamp, execution credential, or call/token/cost authority is
present. The fixture therefore closes the mechanical toy-isolation step but
does not unlock a smoke or confirmatory provider run.

## Cycle 47 source-archive compatibility audit

The next seed-first cycle recovered the authoritative `2608.25553v3` data/code
archive again rather than inventing model or seed metadata. The downloaded
61,508,909-byte ZIP matches its published SHA-256
`41ca426998db106d041f85c8eb1fb2f2cfd692615b98160952d32d3877a63138`.
Five preregistration entries also match their internal manifest exactly:

| Entry                       | SHA-256                                                            |
| --------------------------- | ------------------------------------------------------------------ |
| `FROZEN_MODEL_LIST.json`    | `add6ac48796c783835896c11c7fbb9c6639bb9650fdec358bd293e4c2c10cd58` |
| `FROZEN_SEEDS.txt`          | `487b2ab14351bc608a74f6400ef44eb844f46b406917dcd827f0218c10c930c6` |
| `FROZEN_SEED_POLICY.md`     | `b4a4ae10f83a1e14adb1b45701bbe10a0d120015b7b0b53ce8ff47fe5c3e0c63` |
| `SCHEDULE.json`             | `c3b509e7ea33490259a163b93bc6f56f751964045a3c5fb7ff7d3000f7ece974` |
| `FROZEN_EXCLUSION_RULES.md` | `1fc7bd27b43be0cb376f1d2ff3a53b43ecd952cf3ce7615a56de216065698cec` |

Those files resolve six requested aliases: `claude-opus-5`,
`claude-sonnet-5`, `claude-haiku-4-5`, `gpt-5.6-sol`, `gpt-5.6-terra`, and
`gpt-5.6-luna`. Only Haiku resolves to a dated snapshot,
`claude-haiku-4-5-20251001`; Opus and Sonnet explicitly retain undated aliases,
and the three GPT listing lookups record a 403 permission boundary and make no
snapshot claim.

The seed material is also not transferable to Scout's proposed factorial.
It freezes 5,400 `stale-c1` cell seeds over six models, runs 0–24, 18 K/P
cells, and two world states using `mulberry32(FNV-1a(seed))`. Its schedule has
900 tasks per model. Scout's design instead has 32 independently
counterbalanced cells per model/seed and 4,800 episodes. Reusing the source
experiment's cell seeds would silently change their encoded meaning; treating
the 25 run numbers as Scout seeds would invent an unregistered seed policy.

Finally, the bundled `EXTERNAL_REGISTRATION.template.json` still has empty
external URL, identifier, deposit time, artifact hash, local commit, and
manifest hash fields and says `verification_status: "PENDING"`. The archive
does contain an OpenTimestamps proof for a development-registration digest,
but that is not an external timestamp of Scout's proposed schedule. Therefore
the honest result of this audit is a reusable source constraint, not a frozen
Scout execution package. The 64-episode offline fixture remains the only
generated Scout schedule, with provider calls still unauthorized and results
still empty.

## Cycle 48 offline freeze gate

Scout commit `f71b2f185a08061cc67340017a31c643e7d0a9cb` adds a
[fail-closed freeze validator](../../../scout-knowledge-lib.app/scripts/verification-allocation-freeze.ts)
and [seven regressions](../../../scout-knowledge-lib.app/scripts/verification-allocation-freeze.test.ts).
It accepts unknown JSON rather than trusting a TypeScript caller, hashes every
declared artifact's supplied bytes, rejects missing, duplicated, tampered, or
undeclared artifacts, and binds model resolution evidence plus a Scout-specific
seed policy to the schedule's exact model and seed order.

The gate requires 32 cells per model/seed, recomputes the episode count, parses
the byte-bound schedule, preserves empty results and
`providerCallsAuthorized: false`, and invokes the original factorial verifier.
A regression changes a memory body and then updates both schedule hashes; the
freeze still fails because the factorial verifier detects the body drift.

Another regression encodes the observed Cycle 47 incompatibilities: an
undated alias, `stale-c1` seed namespace, 18 cells, 5,400 episodes, and pending
external registration. All are rejected. The validator also requires declared
HTTPS registration metadata, deposited bundle and checksum-manifest hashes,
and a supplied proof artifact when a fixture says registration is verified.

This is deliberately not a network verifier. It proves that supplied bytes and
declared relationships agree, not that a model resolution, external URL,
registration receipt, timestamp proof, signature, or lineage authority is
authentic. Even a structurally valid manifest remains offline execution
preparation and never authorizes provider calls or spending.

## Cycle 49 read-only directory gate

Scout commit `f44c14bd69a601b1ad0a248159906793b19e4c6a` adds a
[read-only directory adapter](../../../scout-knowledge-lib.app/scripts/verification-allocation-freeze-bundle.ts)
and [six regressions](../../../scout-knowledge-lib.app/scripts/verification-allocation-freeze-bundle.test.ts).
The adapter requires an explicit absolute directory rather than choosing a
default execution package. It reads a fixed `freeze-manifest.json`, inventories
all nested files, and rejects a symlinked root, any nested symlink or
non-regular entry, traversal-shaped artifact names, and undeclared bytes before
calling the Cycle 48 manifest gate.

The passing fixture is synthetic and goal-owned. Negative regressions cover a
relative root, `..` traversal, a readable symlink, an undeclared file, and a
manifest that attempts to authorize provider calls. The adapter performs no
network or provider operation. Passing it establishes only local path,
inventory, byte-binding, and schedule consistency; it does not authenticate
provider listings, external registration, timestamp proofs, signatures,
lineage, call cost, or spending authority.

## Go/no-go boundary

This checkpoint authorizes no provider call. Execution requires all of the
following to be explicit and current:

- a reviewed frozen design and deterministic factor-isolation verifier;
- named provider/model revisions and a bounded retry/exclusion policy;
- credential availability in the execution identity without exposing secrets;
- an approved call/token/cost ceiling; and
- a smoke gate whose outputs remain separate from confirmatory results.

If those gates are absent, the correct disposition is “designed, not run,” not
an inferred result from the existing archive. The unrelated mixed-scope
event-chain exploration remains out of scope.

## Provenance and relation to Scout

This design refines the [authority-boundary finding](../../knowledge/findings/2026-08-26-agent-memory-governance-authority-boundaries.md)
and the [seed-first source-lane record](./xhs-seed-first-memory-lanes-2026-09-01.md).
Its primary source is arXiv
[`2608.25553v3`](https://arxiv.org/abs/2608.25553v3); MemGauge
[`2608.30177v1`](https://arxiv.org/abs/2608.30177v1) remains the broader
stage-wise utility/risk anchor. This document adds no independent empirical
replication and does not duplicate either paper as a new source.
