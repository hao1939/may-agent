<ai_context>
summary: "Preregistration-ready design and deterministic smoke analyzer for separating provisional-plan relevance, current temptation, and authenticated supersession state in scarce memory-verification allocation. This is design/tooling evidence, not a completed model experiment or causal result."
triggers: ["memory verification allocation", "supersession-aware retrieval", "factorial allocation design", "stale memory", "verification budget"]
last_updated: "2026-09-03"
source_basis: "Scout's checksum-verified review of arXiv 2608.25553v3 and its deposited Experiment C archive, including all 600 P1 episodes and the Cycle 42–44 selection, ordering, and design audits; plus deterministic synthetic controls through Cycle 95, including exact local robust-minimum regression b638788e80b563c5745274fa5b82c036743d4406."
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

## Cycle 67 deterministic analysis controls

Exact local commit `e8ce4879dfe649377051801927aa145df514640f`
adds a strict analyzer for the existing 64-episode toy schedule without
changing its SHA-256
`cd137ac3dcf914adb708dc2f4a798d436732048ed12e9d7fb50a8ee5bbd468fd`.
It requires one outcome for every known episode, fails closed on missing,
duplicate, or unknown episode identities, keeps malformed answers in the
scheduled denominator, reports them separately, and computes the declared
current-minus-superseded target-selection contrast in each of the four
plan-by-temptation strata.

Three deterministic controls prove that the analyzer distinguishes the
registered factors. A plan-only control has current/superseded target rates
`0/0`, `0/0`, `1/1`, and `1/1`; a temptation-only control has `0/0`, `1/1`,
`0/0`, and `1/1`. Both therefore have status contrast zero in every stratum.
An authority-aware oracle selects the target only when its manifest record is
current, producing `1/0` and status contrast `+1` in all four strata. Each
status cell contains eight scheduled episodes. A malformed control output
produces seven target selections across eight scheduled attempts, rate
`0.875`, with one invalid answer rather than silently changing the denominator.

Focused validation passes nine tests with 32 assertions, TypeScript, and
formatting. These are synthetic policy controls, not sampled model behavior,
an authenticated lineage authority, or evidence that a deployed allocator
follows freshness. The analyzer also does not implement the model-block
bootstrap required for confirmatory inference. Provider calls remain
unauthorized and the schedule's results array remains empty.

## Cycle 68 result binding and model blocks

Exact local commit `3aaba3f61478ba2ee8493fbb668139ba0b1c8599`
adds a strict result-bundle envelope for the synthetic analyzer. The envelope
names its schema and evidence class, carries the SHA-256 of one exact schedule,
and receives its own SHA-256 after structural validation. It rejects an
unmatched schedule digest, malformed outcome envelopes, missing or duplicate
outcomes, unknown episode identities, and schedules with empty, duplicated, or
undeclared model and seed blocks. These checks bind analysis to the scheduled
episode population; they do not authenticate who generated a bundle or when.

The matched synthetic control contains the same two seeds and complete 32-cell
counterbalance for each of two declared models. An authority policy produces
`Delta_status = +1` in all four plan-by-temptation strata, while an inverse
policy produces `-1` in the same strata. Per-model analysis preserves both
effects; the equal-model mean is `0` in every stratum. This is supporting
evidence that a pooled null can conceal complete model disagreement and that
model blocks must be reported before aggregation. It is simultaneously
contradictory evidence against treating the equal-model zero as evidence that
status has no effect. The exact 128-episode schedule SHA-256 is
`19d0356964f181fb05cb426e6045cc72c4e000f2ba8d8a8591253ecb6cb1e4ec`;
the matched result-bundle SHA-256 is
`aca705e7cf2b3e47ccd0a6cfcbbeabf967b6e48556b563f992957e330c69a513`.

Focused validation passes 11 tests with 43 assertions, TypeScript, formatting,
and whitespace checks. Confidence is high for the deterministic schema and
aggregation behavior exercised by these fixtures, but low for any claim about
real model behavior. There is still no bootstrap, interval, practical-effect
decision rule, authenticated generator, timestamped real result bundle, or
provider execution. The next bounded analysis question is whether a frozen
block-resampling rule can preserve the declared model/run inference unit and
surface this heterogeneity without making provider calls.

## Cycle 69 frozen model/run block resampling

Exact local commit `6a22b25107c1e77b79b4b55e6a0057ce7ee9b424`
implements the next deterministic gate. Its schema fixes 1,024 resamples,
2.5% and 97.5% empirical quantiles, equal weights for the named model set, and
SHA-256 seed
`b33363aee6fc701c2006d91356525e4a5abbd4386129fc4b90e9c78569e086b3`.
The exact specification SHA-256 is
`81c7bca2fec86527dc75cbdc8c5b90a69638821f83944509e173b52bc826b8e0`.
Malformed, episode-level, unfrozen-seed, non-finite-quantile, and out-of-bound
resample specifications fail closed.

The resampler first scores every complete model/seed run block, then samples
those blocks with replacement within each named model. All 32 factorial cells
for a run remain together. Model estimates and percentile intervals are
reported before the equal-model summary; the named model set itself is not
resampled, so the interval is conditional on those models and cannot support
generalization to an unseen model population.

Two matched controls make the boundary visible. On the exact Cycle 68 schedule
and result bundle, the authority model stays `[+1,+1]`, the inverse model stays
`[-1,-1]`, and the equal-model interval is `[0,0]` in all four strata while an
explicit direction-conflict flag remains true. On a one-model schedule with
one authority run and one inverse run, the point estimate is zero and the
run-block interval is `[-1,+1]` throughout. The latter schedule and bundle
SHA-256 values are
`6ba3977f6d4d069a2896b453eea5ddf5dd15142db73acba05c5ead91bc4019c4`
and `8006bbdecf38c3f66312d73d576c8f559654e781d94d28a7049faae2ed36d1dd`.

This supports the mechanical claim that whole-run resampling can expose
within-model uncertainty without splitting registered factors. It also
contradicts treating a narrow aggregate interval as evidence of homogeneous
behavior: the aggregate `[0,0]` is compatible with maximally opposed named
models. Confidence is high for deterministic execution and fail-closed input
handling, but low for interval coverage, practical significance, or real-model
behavior. Two synthetic runs cannot calibrate a percentile interval, and no
provider call, authenticated producer, external timestamp, or cost authority
exists. The next bounded question is to freeze and test a practical-effect
decision rule that refuses a pooled conclusion when named-model directions
conflict.

## Cycle 70 practical-effect decision gate

Exact local commit `96b5762c675d8710438bdf5aae75cd132d7f708c`
adds a content-addressed decision layer above the schedule-bound block
bootstrap. The synthetic policy fixes a practical-delta threshold of `0.10`,
percentile intervals, unanimous named-model decisions, and an inconclusive
conflict disposition. Its exact SHA-256 is
`378f8988ddcef4d1905a4cf24ce67a069521db8f0281468c442b11d66531f0aa`.
Non-finite or boundary thresholds and policies that pool or ignore conflict
fail closed.

On the exact 128-episode schedule, result bundle, and bootstrap specification
from Cycles 68–69, the aggregate interval `[0,0]` falls wholly inside the toy
negligible region. The authority model is nevertheless positive and the
inverse model negative. The gate therefore returns **inconclusive** in all four
plan-by-temptation strata with reason “named-model point estimates have
opposing directions.” Matched unanimous authority models return positive in
all four strata; matched plan-only models return negligible throughout.

This supports the mechanical claim that a pooled interval cannot override
named-model disagreement under the frozen policy. It contradicts promoting the
same aggregate `[0,0]` to a negligible-behavior conclusion. Confidence is high
for deterministic classification and provenance binding, but low for the
substantive `0.10` threshold or frequentist operating characteristics: the
threshold is a synthetic fixture value, the percentile intervals remain
uncalibrated, and no model response was sampled. The next bounded question is
to test false-conclusion behavior under known synthetic run-generating
processes and establish a defensible minimum run-block gate before any provider
execution.

## Cycle 71 exact null calibration

Exact local commit `4cce1a0da52ead9f520337eb89442d4ddc0edcaf` replaces the
earlier finite preview with a content-addressed calibration oracle. Specification
SHA-256 `6ac043cd0cab150dae665af183045dfc076cb9dfd007f1f2f5900eb8d40ffcc2`
predeclares the same `0.10` practical threshold, 2.5%/97.5% percentile rule, a
1% false-direction tolerance, a candidate minimum of 64 complete run blocks,
and verification through every integer count from 64 through 96. Three matched
zero-mean run processes use effects `-1/0/+1`: balanced probabilities
`0.25/0.50/0.25`, dense `0.50/0/0.50`, and sparse `0.10/0.80/0.10`.
Asymmetric, malformed, duplicated, or incomplete specifications fail closed.

For every possible observed negative/zero/positive count, the oracle enumerates
the exact multinomial sampling probability and the exact conditional
nonparametric percentile-bootstrap distribution. It therefore has zero Monte
Carlo standard error. The earlier 25-run preview is contradicted as a safe 1%
gate: exact false-direction probabilities are 1.3211% for the balanced null and
1.4633% for the dense null. Dense-null risk remains 1.3283% at 48 blocks.
At 64 blocks the exact rates are 0.2308% balanced, 0.8147% dense, and 0.0176%
sparse. Across every integer count from 64 through 96, the worst cases are
0.2703% at 69 for balanced, 0.8772% at 78 for dense, and 0.0250% at 69 for
sparse. All remain below the predeclared 1% tolerance.

Focused validation passes 19 tests with 86 assertions. The full Scout gate
passes syntax bundling, TypeScript, source formatting, and 128 tests with 403
assertions; whitespace and all 22 relative links pass. Read-only health remains
bounded at 33 facts and 16 wake signals, and runtime state is empty.

This supports 64 as a **bounded candidate minimum for the declared exact null
family through 96 blocks**, not as a universal provider-run gate. The existing
1,024-resample implementation is a separate finite approximation and is not
calibrated by this exact oracle; other effect supports, dependence, drift,
nonzero alternatives, power, real model behavior, and counts above 96 remain
unknown. Confidence is high for the enumerated probabilities and low for
transfer outside the frozen family. The next decision-relevant question is
whether the finite 1,024-resample implementation agrees with the oracle on the
boundary compositions that determine the 1% result; until then, provider
execution remains unauthorized.

## Cycle 72 finite-resampler permutation repair

Seed reconciliation `c756182c62c41ee0a88ed2f7513ebf5709f63d63` preceded this
work. Boundary fixture `84f0b189a69c54eafecfc2e93e571c901c6028c6` then instantiated
one named model with 64 complete dense-null run blocks. Exact enumeration says
21 negative/43 positive blocks are positive, 22/42 and 42/22 are inconclusive,
and 43/21 is negative under the `0.10` rule.

The first matched placement check exposed a finite-resampler defect. At 21/43,
grouping negative blocks produced interval `[0.125, 0.5625]` and decision
positive, while spreading the identical multiset produced
`[0.09375, 0.5625]` and inconclusive. The symmetric 43/21 case changed from
`[-0.5625, -0.125]` and negative when grouped to
`[-0.5625, -0.09375]` and inconclusive when spread. Block order is not an
inference unit, so these were contradictory outputs for the same evidence.

Exact repair `6cac8790071f1688c00595082ef2902fee795420` lexicographically
canonicalizes each model's run-effect vectors before deterministic block draws.
The regression now exercises front, back, and evenly spread placements at all
four boundary compositions. Every placement returns the same four-stratum
intervals and the exact-oracle positive/inconclusive/inconclusive/negative
decisions. Focused validation passes 20 tests with 134 assertions; the full
Scout gate passes syntax, TypeScript, formatting, and 129 tests with 451
assertions.

This establishes permutation invariance for the exercised dense-null boundary
and removes one implementation artifact. It does not calibrate the finite
1,024-resample false-direction rate over every possible composition, other
null families, model identifiers, nonzero alternatives, or real providers.
Confidence is high for the reproduced defect and regression, moderate for the
64-block dense boundary, and low for statistical transfer. The next ranked
question is to enumerate the canonical finite-resample decisions over all
64-block compositions and compare its operating rates with the exact oracle.

## Cycle 73 complete finite-versus-exact comparison

Seed reconciliation `1eb84e065046b80a1201a236f265cf9cb05f8482` preceded this
analysis. Exact local commit `8667408cd28d224e6cab1eb2a2dc2b405b0af337`
then enumerates all 2,145 negative/zero/positive compositions at the frozen
64-block candidate and compares the canonical 1,024-resample decision with the
Cycle 71 exact conditional oracle. The comparison specification SHA-256 is
`83926b57b4561a0dd39e238ddf2ee010ade6818fdc38d2d6123bf0c19ab30de8`;
it binds calibration specification
`6ac043cd0cab150dae665af183045dfc076cb9dfd007f1f2f5900eb8d40ffcc2`,
bootstrap specification
`81c7bca2fec86527dc75cbdc8c5b90a69638821f83944509e173b52bc826b8e0`,
and model ID `calibration-model`.

The finite and exact decisions differ on 26 compositions. The first mismatch
has counts `1/49/14`: exact is inconclusive while finite is positive. Under the
balanced null, exact false-direction probability is
`0.002307919821710335`, finite is `0.003173180319440574`, and mismatch
probability is `0.000867460474092118`. Under the dense null, both
false-direction probabilities are `0.008146902228698577` and mismatch
probability is zero. Under the sparse null, exact false-direction probability
is `0.0001755936794143284`, finite is `0.00025673753238608036`, and
mismatch probability is `0.0005090313721621996`.

This supports the narrower claim that the frozen finite implementation remains
below the declared 1% false-direction tolerance for all three declared nulls at
64 blocks. The 26 mismatches contradict treating that implementation as the
exact oracle, even after the Cycle 72 permutation repair. Confidence is high
for the exhaustive composition enumeration and exact null integration, but
low outside the fixed block count, effect support, null families, resampling
seed, and model identifier. Dependence, drift, alternatives, power, real-model
behavior, and provider execution remain untested. The next ranked question is
whether changing the model identifier or resampling seed materially changes
the finite operating rates or the 1% decision.

## Cycle 74 model-ID and resampling-seed sensitivity

Seed reconciliation `9ac993e73cb94829360f43e404d26502aa5c8706` preceded this
matched-control analysis. Exact local regression commit
`59268cc62629ebcf3cf274835d259b3b158ac2d6` holds the 64-block
calibration, 1,024-resample count, quantiles, effect support, and three null
processes fixed while crossing model IDs `calibration-model`,
`calibration-model-b`, and `calibration-model-c` with three frozen seeds:
`b33363aee6fc701c2006d91356525e4a5abbd4386129fc4b90e9c78569e086b3`,
`182d0240d5d1ff20be112d03fe169ed9397ad7a0cb562da4c96e348d79f9978e`,
and `505328b996766057fca7496772a6b69b68badbfb41d5e72185c6b3a506e04932`.

Across the nine deterministic controls, decision-mismatch counts range from 10
to 32 of 2,145 compositions. Finite false-direction rates range from
`0.0018220732433059704` to `0.003173180319440574` for balanced,
`0.00368996427654005` to `0.008146902228698577` for dense, and
`0.00013702289768857516` to `0.00025673753238608036` for sparse.
Every value remains below the frozen 1% tolerance. Sparse-null total decision
disagreement nevertheless reaches `0.022723637739035525`; these disagreements
include non-direction classifications and therefore can exceed the much
smaller false-direction rate.

This supports stability of the bounded 1% go/no-go conclusion across the nine
declared salts. It contradicts any claim that 1,024 deterministic draws make
all practical classifications salt-invariant. Confidence is high for these
nine replayable controls and low for unsampled identifiers, seeds, dependence,
alternatives, or real-model responses. The next ranked question is whether a
frozen resample-count ladder reduces the worst observed classification
sensitivity enough to justify the added computation, while retaining the
exact oracle as the calibration authority.

## Cycle 75 frozen resample-count ladder

Seed reconciliation `0c313b7160c8061569db48e3bef2c903b8fb8fdc` preceded this
matched ladder. Exact local regression commit
`bbbcd6e7418293e0e5427bfd1b47f4a6a0114757` holds the worst Cycle 74
sparse-disagreement salt fixed at model ID `calibration-model` and seed
`505328b996766057fca7496772a6b69b68badbfb41d5e72185c6b3a506e04932`,
then compares 1,024, 4,096, and 16,384 draws. Their comparison SHA-256 values
are respectively
`4a0dfbd13f6be113b1aae96cdeaed339b36022173beb3925b947e09dd15a0fb6`,
`69ff21c62db4b08b56ba3303a4eb34cab65ea7e6de5282d7f5e95eec09d39e2a`,
and `5a4cee68a880cb2d6a7c20934c114d30d4fb7b76adddd4a1adc443ebab94274d`.

Composition mismatch counts fall from 18 to 11 to 3. Sparse-null decision
disagreement falls from `0.022723637739035525` to
`0.00002061050403066235` to `0.000000013726857835043323`. Every finite
false-direction rate remains below 1%. Convergence is not uniform or monotone:
balanced disagreement is `0.00023599279460173557` at 4,096 but
`0.0003965403610030345` at 16,384, while dense false-direction probability is
`0.005918433252619305` at 4,096 and returns to the exact
`0.008146902228698577` at 16,384.

This supports more draws as a strong reduction for the selected sparse
disagreement and total composition count. It contradicts a blanket claim that
each intermediate operating metric approaches the oracle monotonically.
Confidence is high for this fixed salt and low for other salts, an optimal
draw count, real effects, or provider behavior. The next ranked question is to
classify the three residual 16,384-draw mismatch compositions and determine
whether any are directional errors or only boundary-label differences.

## Cycle 76 residual mismatch classification

Seed reconciliation `15e5a7cf86e7eeaabc9508038e354d2565f549fa` preceded this
classification. Exact local commit
`433ac5165384e04f901bb62f3118b2a0c4aa18dc` extends each null-process result
with finite-directional/exact-nondirectional, exact-directional/finite-
nondirectional, and remaining mismatch probabilities, and verifies that the
three categories sum to total mismatch probability.

At the exact Cycle 75 16,384-draw comparison SHA-256
`5a4cee68a880cb2d6a7c20934c114d30d4fb7b76adddd4a1adc443ebab94274d`,
all three residual compositions are directional errors by the finite rule. The
`6/36/22` and `8/31/25` negative/zero/positive counts change from exact
inconclusive to finite positive; `25/31/8` changes from exact inconclusive to
finite negative. No residual is an exact-directional call lost by the finite
rule or a remaining non-directional/opposed mismatch. Their combined
finite-only directional probability is `0.0003965403610030345` under the
balanced null, zero under dense, and `0.000000013726857835043323` under sparse.

This supports the 1% operating bound because the residual directional risk is
already included in the reported finite false-direction rates. It contradicts
treating the finite interval as authoritative for individual boundary
compositions, even at 16,384 draws. Confidence is high for the exhaustive
frozen classification and low for other salts, supports, dependence, or real
models. The next ranked question is to freeze a mismatch-aware disposition that
keeps finite-only directional boundary cases inconclusive while preserving
directions supported by the exact declared trinomial oracle.

## Cycle 77 exact-oracle authority disposition

Seed reconciliation `2a40cbe28b8625df5a550bb3650281f6d154fa55` preceded this
change. Exact local commit `09f33e3831a0be56140c0255f7c9b78141e5e99b`
makes the comparison output name `exact-trinomial-oracle` as its decision
authority and `diagnostic-comparison-only` as the finite result's role. Each
process now exposes an authoritative false-direction probability copied from
the exact enumeration and computes tolerance pass/fail from that value, never
from the finite approximation. Invalid comparisons return neither authority
nor disposition.

All three declared 64-block nulls pass the authoritative 1% tolerance. The
finite rates and mismatch categories remain visible because they are useful
implementation diagnostics, including the Cycle 76 finite-only directional
cases, but they cannot silently replace the exact decision. This resolves the
declared trinomial calibration ambiguity without claiming an exact method for
continuous effects or real provider outputs. Confidence is high for the
schema-backed disposition and low for transfer beyond its frozen support. The
next ranked question is to use exact enumeration to measure correct-direction
power and wrong-direction risk under predeclared symmetric nonzero alternatives
at the 64-block candidate.

## Cycle 78 exact nonzero-alternative power

Seed reconciliation `2dff87dc8315eb0b62c96408a9fd3bf13913eff2` preceded this
analysis. Exact local commit `311d68216b49cb664ec0019c3259e00f9246bfda`
adds a separate fail-closed alternative-calibration schema rather than
weakening the symmetric-null contract. It requires positive/negative mirror
pairs whose expected effects exceed the `0.10` practical threshold, fixes 64
blocks, declares 80% minimum correct-direction power and 1% maximum
wrong-direction probability, and exactly enumerates positive, negative,
negligible, and inconclusive outcomes. Specification SHA-256 is
`22df2188523708cbe52f28ea0dbbacf30563adf2a1447a57175d04e28008f887`.

The moderate pair has expected effects ±0.15. Exact correct-direction power is
`0.08407170601489997`; wrong-direction probability is
`0.0000018579349140504212`, and about 91.59% remains inconclusive. The strong
pair has expected effects ±0.30. Correct-direction power is
`0.5975522317286325`; wrong-direction probability is
`0.0000000002298192502702488`, and about 40.24% remains inconclusive. Mirror
pairs agree to floating-point tolerance and every four-way probability sum is
one. All processes pass the 1% wrong-direction tolerance, but none passes the
declared 80% power target.

This directly contradicts treating the 64-block null-safety candidate as a
generally adequate execution size. It supports only low wrong-direction risk
for the declared alternatives, not sufficient sensitivity. Confidence is high
for exact enumeration of these four synthetic processes and low for the
substantive choice of alternatives, dependence, continuous effects, drift, or
real models. The next ranked question is to find the minimum exact run count
that reaches 80% for the ±0.30 pair and determine whether the ±0.15 pair can
reach it within a bounded 256-block search.

## Cycle 79 exact bounded power search

Seed reconciliation `afe03387668faa46e48c4adb3f65290cf5366687` preceded this
search. Exact local commit `e19f5cb72a1916268c894da1366ba5373ba81aa3`
adds a separate fail-closed, content-addressed power-search schema while
preserving Cycle 78's single-count contract. It scans every integer run count
from 64 through 256, records first crossings and observed maxima, and makes no
monotonicity assumption. Search specification SHA-256 is
`bffe0129348403b1e6059a24889b9d823763423aa0cb9433c72751cfbc1023cb`.
The exhaustive run covered all 193 counts at
`2026-09-02T19:34:13.476Z–19:41:38.298Z` with zero Monte Carlo error.

The ±0.30 pair is below the synthetic 80% target at 104 blocks: positive-side
correct, wrong, negligible, and inconclusive probabilities are respectively
`0.7973065499459407`, `4.981433348942849e-14`,
`1.815042056657329e-14`, and `0.20269345005412967`. It first crosses at 105
blocks, where the same four probabilities are `0.8045178323414782`,
`4.462239207721462e-14`, `9.878447314110688e-15`, and
`0.1954821676586286`. The mirrored negative process agrees to floating-point
tolerance.

The ±0.15 pair never reaches 80% anywhere in the bounded search. Its largest
conservative mirror-pair power is only `0.20370063408471942` at 249 blocks;
the positive process there has wrong, negligible, and inconclusive
probabilities `1.6918725993772752e-13`, `0.0006700234221932275`, and
`0.7956293424930317`. At the 256-block endpoint, correct, wrong, negligible,
and inconclusive probabilities are `0.19986471777037063`,
`7.831916288574057e-14`, `0.0008245605443736368`, and
`0.7993107216856294`. The moderate power maximum occurring before the endpoint
is direct contradictory evidence against inferring bounded results from a
single endpoint or assuming monotone power.

This supports 105 as the first exact crossing only for the declared strong
synthetic pair. It contradicts using 64 blocks as a universal gate and shows
that even quadrupling to 256 does not make the moderate pair adequately
sensitive under this rule. Confidence is high for the exhaustive discrete
search and low for the synthetic 80% target, operational affordability,
continuous effects, dependence, provider drift, alternative interval rules,
or real-model transfer. The next ranked question is whether 105 complete model
run blocks are operationally acceptable; if not, the design needs a different
estimand or interval rule rather than a weaker claim about 64 blocks.

## Cycle 80 operational sizing boundary

Seed reconciliation `7adec24b78b0f1bc5c43d048955ce30d63c3ae01` preceded this
analysis. The existing inference implementation resamples complete seed blocks
**within each named model** and applies a unanimous named-model decision before
the equal-model aggregate can decide. The Cycle 79 count is therefore a
per-model calibration input, not a pooled six-model total.

The retained design has six models, 25 seeds per model, and 32 episodes per
model/seed block: 150 blocks and 4,800 episodes. Exact 25-block matched-control
specification SHA-256
`a15de1f8e8899632f30bdb6ddd143b1c3637038213acac37cbf54379f55a122b`
shows only `0.30605391271020227` correct-direction power for the ±0.30 pair and
`0.0691999011766968` for ±0.15. Wrong-direction probabilities remain below 1%,
but Cycle 71 separately shows balanced and dense null false-direction rates of
1.3211% and 1.4633% at 25 blocks. Thus the original 4,800-episode grid fails
both the declared null-safety and power criteria under the synthetic families.

Supplying the Cycle 79 strong-effect crossing to every named model would
require 105 seeds per model, 630 complete blocks, and 20,160 episodes—4.2 times
the retained grid. Even this is not an 80%-powered six-model unanimous gate.
Under the additional illustrative assumptions that all six models share the
same process and decide independently, per-model power
`0.8045178323414782` yields only
`0.2711527720864071` probability that all six decide correctly. Those
assumptions are not established, so this product is a warning against pooled
interpretation, not a calibrated multi-model result. At 256 blocks per model,
the ±0.15 pair still fails while the grid would reach 49,152 episodes, 10.24
times the retained plan.

The current design is therefore not operationally justified as a confirmatory
unanimous six-model run. No call, token, cost ceiling, frozen current model set,
or execution credential closes that gap. Confidence is high for schedule
arithmetic, the 25-block exact control, and the within-model code path; low for
cross-model independence, real effect distributions, affordability, or
provider behavior. The next ranked question is to freeze a multi-model power
contract that separates per-model and unanimous-gate power, then compare a
directional estimand with the current “exceeds 0.10” practical estimand under
the same exact false-direction discipline.

## Cycle 81 dependence-honest unanimous power

Seed reconciliation `439a49247138fd38c145d99ffdeea1f99be352e2` preceded this
change. Exact local commit `aca937e3f66661e0ccee5aed434cfbe7c309cf64`
adds a fail-closed unanimous named-model power contract at specification
SHA-256
`438cb3dc3964a76de7927ffa43eea7423fa6ae1dc025e66eefe8d40a186827ff`.
It binds the exact 105-block per-model calibration SHA-256
`6cf0c60769fc8d0691fac797a4439eaae5b728a6826824f055e1d708a0c96bbc`,
six named models, an 80% unanimous target, and one explicit dependence
treatment: Fréchet bounds under unknown dependence, with an independence
product labeled as illustration rather than authority.

For the strong positive process, per-model correct-direction power is
`0.8045178323414782`. Unknown-dependence unanimous power is therefore bounded
by `[0, 0.8045178323414782]`; the independence illustration is
`0.2711527720864071`. Per-model wrong-direction probability is
`4.462239207721462e-14`, giving unanimous wrong-direction bounds
`[0, 4.462239207721462e-14]` and an independence illustration of
`7.894362904086226e-81`. The negative mirror agrees to floating-point
tolerance. For the moderate positive process, per-model correct-direction
power is `0.11132478415415377`, unanimous bounds are
`[0, 0.11132478415415377]`, and the independence illustration is only
`0.0000019034925024798922`.

To guarantee 80% unanimous power across six equal-marginal models without a
dependence assumption, per-model power must reach at least
`0.9666666666666667`. Under independence it would need at least
`0.9634924839989961`, but independence is not evidence-backed here. Neither
declared process passes either target at 105 blocks. A deterministic matched
control with per-model power one reaches lower bound, upper bound, and
independence illustration one, proving the pass path; malformed model counts,
dependence policies, targets, and nested calibrations fail closed.

This makes the Cycle 80 warning executable and contradicts promoting the
single-model 105-block crossing to multi-model confirmation. Confidence is
high for the exact per-model input and sharp equal-marginal Fréchet bounds;
low for equal real-model marginals, any cross-model dependence structure,
aggregate-interval support, provider behavior, or final-gate power. The next
ranked question is to compare a directional estimand (`effect > 0`) with the
current practical-exceedance estimand (`effect > 0.10`) under matched exact
null and alternative controls, without weakening either claim after seeing
the result.

## Cycle 82 matched estimand comparison

Seed reconciliation `0f0812d89908e1f0e4451b3cbd9ccc527e0e4e85` preceded this
change. Exact local commit `ee0d64bf3821fd9b65980cdb9fc33b0dad87cd1d`
adds a fail-closed, exact comparison at specification SHA-256
`c4f6c80564d7e83c2b99024a7d9ac0f84e98fdb0fc1aeb22bd00fb77b8adf24c`.
It freezes the same 105 run blocks, 2.5%/97.5% percentile interval, three
symmetric nulls, two mirror-paired alternatives, 80% power target, and 1%
false-direction limit for both estimands. Only the decision threshold changes:
zero for a directional claim and `0.10` for practical exceedance. Null and
alternative process IDs must be disjoint, and malformed or asymmetric inputs
fail closed.

The directional claim improves alternative power but fails the matched null
contract. Its exact false-direction probabilities are 4.4935% balanced,
5.0442% dense, and 4.2680% sparse, all above 1%. The practical-exceedance
claim yields 0.0815%, 0.3221%, and 0.0024%, respectively, so all three pass.
At the same time, strong-process correct-direction power rises from 80.45% for
practical exceedance to 98.46% for direction alone, and moderate-process power
rises from 11.13% to 53.44%. The moderate directional claim therefore remains
below the 80% target even while accepting too much null-direction risk.

This supports keeping the two questions separate and contradicts treating a
directional estimand as a cost-free substitute for the practical claim. The
calculation has zero Monte Carlo error. Confidence is high for the exact
frozen trinomial controls and low for continuous effects, other interval
rules, model dependence, provider behavior, and real factorial results. A next
comparison must predeclare a stricter directional interval calibration against
all three nulls before measuring retained alternative power; it must not tune
the interval after selecting the most favorable alternative.

## Cycle 83 null-first directional interval calibration

Seed reconciliation `c4cf683ab8d867ac9ba802e2a745b0e5ef9c6356` preceded this
change. Exact local commit `0320840b91d0c598b7f829b45cb991411291f9a0`
separates interval selection from power measurement. Null-only specification
SHA-256 `1d8633f0591d9e4a1cd7c2fdc919a9546a26edf27a9761ab3ce113ab815b2ba8`
freezes 105 blocks, the same three symmetric nulls, the 1% false-direction
limit, and lower-tail candidates `0.025`, `0.01`, `0.005`, and `0.0025` in
least-to-most-strict order. Alternative outcomes are absent from this schema.

The first three candidates fail at least one null. At `0.005`/`0.995`, the
balanced and sparse risks pass at `0.009568589909137726` and
`0.009521856408058721`, but dense risk remains `0.010817905625820424` and
fails. The selected `0.0025`/`0.9975` interval yields exact false-direction
probabilities `0.004746432583487716` balanced,
`0.006016081515250353` dense, and `0.004673936662618542` sparse. All pass the
frozen limit with zero Monte Carlo error.

Only after reproducing that null selection, power specification SHA-256
`b5715c37201d532faf4067286232fe390e959b98b76651958b3a0cb3a693bef9`
binds the null-specification hash, selected quantiles, run count, and disjoint
alternative process IDs. Strong-process correct-direction power is
`0.9066218357309971`; moderate-process power is `0.2298628645622084`.
Wrong-direction probability is `1.3853047321045116e-12` strong and
`4.6912051074282143e-7` moderate. The negative mirrors agree to
floating-point tolerance. Reordered candidates, altered binding fields, and
cross-class null/alternative process-ID collisions fail closed.

This qualifies the Cycle 82 result: a directional estimand can meet the frozen
null-risk contract when its interval is made stricter, and it retains more
strong-process power than the 95% practical-exceedance rule (90.66% versus
80.45%). It is not a general shortcut. The stricter interval loses much of the
95% directional rule's power (98.46% strong and 53.44% moderate), and moderate
power remains only 22.99%, below the 80% target. Confidence is high for the
exact frozen grid and synthetic processes, and low for grid optimality,
continuous effects, cross-model dependence, affordability, provider behavior,
and real models. The next ranked question is the exact run-block count needed
for the strong pair to reach the 96.67% per-model power required by Cycle 81's
dependence-honest six-model lower bound, and whether the moderate pair reaches
that target through 256 blocks.

## Cycle 84 dependence-honest block-count search

Seed reconciliation `ab77e3b1d3dc4b287ffa135b0d6a47c4534be2ad` preceded this
work. The executable authority remains source commit
`0320840b91d0c598b7f829b45cb991411291f9a0`; no provider was called. The first
exact pass used null-range specification SHA-256
`95a08e5dd2e6a8115c3576698a8209c061f822952845b95b117e1dc9bb18397a`
to test the selected `0.0025`/`0.9975` interval at every integer count from 105
through 256 before inspecting power. All counts preserve the 1% contract. The
worst balanced null is `0.004834055102652536` at 145 blocks, the worst dense
null is `0.007584811775432895` at 111, and the worst sparse null is
`0.004991530412381129` at 164.

Only after that range passed, power-search specification SHA-256
`678c170fccf949646fb9f628fd2f094a147c02a05ad8a8728988339473c988d4`
scanned the same 152 integer counts against the Cycle 81 requirement of
`29/30` (96.67%) per-model power. The strong pair is 96.5995% at 132 blocks and
first passes at 133 with 96.6926%. Its maximum through 256 is 99.9878%. The
moderate pair never passes; its maximum is 66.9532% at 256. Maximum observed
wrong-direction probability remains `1.3853047321045128e-12` strong and
`4.6912051074282397e-7` moderate.

Under Cycle 81's equal-marginal, unknown-dependence Fréchet contract, the
strong result at 133 implies a six-model unanimous lower bound of about 80.16%
and therefore clears the synthetic target. It also expands the design to 798
model-run blocks and 25,536 factorial episodes, versus 20,160 at 105 blocks.
This is a mathematical sizing result, not evidence that the execution is
affordable or that real models have equal marginals. Confidence is high for
the complete exact discrete search and low for transfer to continuous effects,
real-model dependence, cost, drift, and provider behavior. The next ranked
question is whether a prespecified non-unanimous six-model aggregation rule can
reduce the 25,536-episode burden while retaining explicit aggregate power and
false-direction bounds; no provider run is justified before that contract and
a cost ceiling exist.

## Cycle 85 conflict-safe strict-majority bound

Seed reconciliation `0e624606b29ab4ce5e2c985745af30f954bbb719` preceded this
change. Exact local source commit
`930fc9e7aa269642291c9687fa46f3f8f22a9547` adds specification SHA-256
`f2263724b736580c776796983ca0df095e06eefd793a3347868f69bf58196dca`.
The specification binds the Cycle 83 null and power hashes, six equal-marginal
models, the smallest strict majority (four), an inconclusive conflict policy,
the 80% aggregate-power target, the 1% aggregate wrong-direction limit, and 32
factorial episodes per model-run block. A threshold of three fails closed
because three positive and three negative models could simultaneously satisfy
it; altered nested calibration binding also fails closed.

No independence assumption is introduced. If `S` of `n` models support one
direction, each with marginal probability `p`, the exact count-moment bounds
are `max(0,(np-(k-1))/(n-k+1)) <= P(S>=k) <= min(1,np/k)`. For the strong
positive process at 105 blocks, per-model power `0.9066218357309971` therefore
gives aggregate power `[0.813243671461994, 1]`. The aggregate wrong-direction
upper bound is `2.0779570981567675e-12`. The negative mirror agrees to
floating-point tolerance. Both pass.

The moderate process remains non-passing: per-model power
`0.2298628645622084` gives aggregate power `[0, 0.3447942968433126]`, while its
wrong-direction upper bound is `7.036807661142322e-7`. The 4-of-6 rule uses
20,160 episodes at 105 blocks per model, 5,376 fewer than the 25,536-episode
133-block unanimous design from Cycle 84, a 21.05% reduction.

This supports a conflict-safe reduction in the strong synthetic design's
burden and contradicts treating majority voting as either independence or a
remedy for weak marginals. Confidence is high for the algebra and bound inputs,
and low for equal real-model marginals, heterogeneous effects, affordability,
provider behavior, and drift. The next ranked question is to search downward
for the first block count at which the selected interval keeps every null below
1% and strong per-model power reaches the 90% required by the 4-of-6 lower
bound; the moderate process must remain reported rather than optimized away.

## Cycle 86 earliest strict-majority operating point

Seed reconciliation `6c5e68c2175c7dba70fb88508d17e82c32c3b6d7` preceded this
work. The exact executable source remains
`930fc9e7aa269642291c9687fa46f3f8f22a9547`; no provider was called. Null-range
specification SHA-256
`3d88ae647a7602f66779c114a577df96d61d4f67226ea9fec59bd1ad16691ca5`
checks every integer count from 64 through 105 under the Cycle 83 interval.
Every count passes 1%. The worst dense risk is 0.8555% at 71 blocks; balanced
and sparse worst cases are 0.5283% and 0.5740% at 64. At the selected 104-block
point, exact risks are 0.4738% balanced, 0.4233% dense, and 0.4675% sparse.

Power-search specification SHA-256
`bbd889086dc4dbeb8c6f6f119a61a3fce71146110a9e3abc325d93edccd7f22f`
checks the same 42 counts without assuming monotonicity. Strong per-model power
is `0.8993227186947798` at 103 blocks and first exceeds 90% at 104 with
`0.9030482059720658`. Under the frozen 4-of-6 count bound, 104 therefore gives
aggregate power `[0.8060964119441317,1]`; its strong wrong-direction upper
bound is about `2.378646314564966e-12`. Moderate per-model power is only
`0.22637721624588303` at 104, giving aggregate power `[0,0.33956582436882455]`.

The selected design contains 19,968 episodes. It saves 192 episodes relative
to Cycle 85's 105-block rule and 5,568 relative to Cycle 84's 133-block
unanimous rule, but still needs 104 blocks per model while the retained plan
has only 25 seeds per model. This supports 104 as the earliest point in the
declared range, not as an affordable or provider-ready design. Confidence is
high for exact discrete enumeration and low for real-model marginals,
heterogeneity, repeated-run independence, cost, drift, and provider behavior.
The next ranked question is to generalize the count bound to a frozen
heterogeneous six-model marginal vector and measure how one or two weaker
models change the 80% guarantee before any execution proposal.

## Cycle 87 asymmetric-boundary correction

Seed reconciliation `405c60e145205ff2a71b283f108ea02d48b03bc1` preceded this
correction. Exact local source commit
`39dfb2d76b6b59b88271096770d83678c1a3c50c` replaces the Cycle 82
all-symmetric practical-null fixture with three retained zero-effect controls
plus a genuinely asymmetric positive practical-boundary null with trinomial
probabilities `[0.2,0.5,0.3]` and expected effect `+0.10`. Comparison
specification SHA-256 is now
`465a3c1041b4dce920f323df04e50276aeac0e1c7f804ed1dbd356d751de1542`.
The schema freezes the 1% false-direction limit, requires at least one
asymmetric practical null, rejects a process outside the practical-null band,
and rejects duplicate IDs both within a class and across the null/alternative
classes.

The correction preserves every previously reported zero-effect probability.
For the directional estimand, balanced/dense/sparse false-direction
probabilities remain `0.04493475270663312`, `0.05044215663997886`, and
`0.04267998231399742`; for practical exceedance they remain
`0.0008153019889196652`, `0.0032209898687990566`, and
`0.000024067259773916887`. Strong correct-direction power remains
`0.9845896004887843` directional versus `0.8045178323414782` practical, and
moderate power remains `0.5344140683113935` versus
`0.11132478415415377`.

The asymmetric boundary changes the conclusion. A `+0.10` process is a
positive process for the zero-threshold directional estimand, so its positive
decision probability `0.289256693611456` is not a false direction; only the
negative probability `0.00027161058571514634` is, and it passes 1%. For the
practical-exceedance estimand the same process is on the null boundary, so its
positive and negative decisions (`0.028051868524189363` and
`0.0000007753540473255935`) are unsupported practical-direction calls. Their
sum `0.028052643878236687` fails 1%.

This qualifies rather than reverses the retained directional-versus-practical
finding. The 95% directional shortcut still fails the three zero-effect
controls, and its stronger interval remains necessary there. Practical
exceedance no longer has a supported blanket claim that every declared null
passes: it passes the three zero-effect controls but fails this exact boundary
control. Confidence is high for the exhaustive discrete probabilities and
their estimand-specific labels, but low for other asymmetric nulls, continuous
effects, boundary conventions, dependence, real models, and provider
behavior. The next bounded investigation remains the already seed-linked
heterogeneous 4-of-6 marginal sensitivity analysis; it must retain this
corrected estimand boundary as contradictory evidence rather than treating a
single rule as uniformly safer.

## Cycle 88 heterogeneous strict-majority sensitivity

Seed reconciliation `eda787b12bed0a4348a5803297f6b178bb876b9a` preceded this
work. Exact local source commit
`e8bd94a4f0210ce7f1a88fc330abf2085fcb71ad` adds specification SHA-256
`10dec5699c1ce2d83502e0fb8d4025d0c1a735e6e8aee242c9528823176654a6`.
It binds six named synthetic model marginals, Cycle 86 null-range SHA
`3d88ae647a7602f66779c114a577df96d61d4f67226ea9fec59bd1ad16691ca5`,
power-search SHA
`bbd889086dc4dbeb8c6f6f119a61a3fce71146110a9e3abc325d93edccd7f22f`,
104 blocks, the conflict-safe 4-of-6 threshold, unknown dependence, 80%
aggregate power, and 1% aggregate wrong-direction risk. Missing, duplicate, or
unknown model identities, invalid probability envelopes, and a non-strict
majority fail closed.

The unknown-dependence count-moment lower bound requires the six correct-
direction marginals to sum to at least `5.4`. Six strong synthetic marginals
sum to `5.418289235832395` and retain the Cycle 86 aggregate lower bound
`0.8060964119441317`. Replacing one named model with the frozen moderate
process lowers the sum to `4.741618246106212` and the aggregate lower bound to
`0.5805394153687372`; replacing two lowers them to `4.064947256380029` and
`0.3549824187933431`. Only the all-strong scenario passes 80%.

All three wrong-direction upper bounds pass 1%: about
`2.378646314564966e-12`, `1.2283981426580603e-7`, and
`2.4567724988529744e-7`. This supports directional safety for this stress
family but contradicts treating the all-strong aggregate-power pass as robust
to even one full moderate-process substitution. “Moderate substitution” is a
synthetic sensitivity control, not an observation of real model
heterogeneity. Confidence is high for the algebra, exact frozen marginals,
identities, and schema checks; low for real-model marginals, dependence,
graded heterogeneity, cost, drift, and provider behavior. The next ranked
question is the minimum weakest-model marginal that preserves the 80% lower
bound when the other five remain at the frozen strong marginal, followed by
graded vectors rather than another full-process substitution.

## Cycle 89 weakest-marginal and graded boundaries

Seed reconciliation `eb4a2fc15292d08ba5d4667dd7db6e19164a9111` preceded this
work. Exact local test commit
`4ecb85ac510a3fb8f656bcb9b290de4f06fa9737` exercises the Cycle 88 analyzer
without changing its schema or source specification. With five models frozen
at correct-direction marginal `0.9030482059720658`, the sixth must be at least
`0.8847589701396714` to reach the required total `5.4`. Exact boundary
specification SHA-256 is
`94ebee148ee1ae7c0b4a905a83efe39efae606df46113bbb58ed159851938ffb`;
it produces lower bound `0.8000000000000002` and passes.

A matched graded vector `[0.88,0.89,0.90,0.91,0.92,0.90]` also sums to `5.4`
and passes at exact SHA-256
`dd37d582b2347f573fadddf0c394a4ff22f0feb7d139b2d1263d3b745c1c30d1`.
Reducing only its weakest component from `0.880` to `0.879` gives total
`5.399000000000001`, lower bound `0.799666666666667`, and a failure at SHA-256
`fd54d04de55d8c9594f8f1116b8bf903ad39b493d27dde05110c1ca85ca5a1e0`.
The wrong-direction marginals are matched across all three controls, so their
4-of-6 upper bound remains `2.378646314564966e-12` and passes 1%.

This supports a precise aggregate budget interpretation: under the declared
unknown-dependence first-moment bound, the sum of named correct-direction
marginals determines the guarantee, not equality of those marginals. It also
contradicts treating the all-strong pass as comfortable—the permitted drop for
one model with the other five frozen is only about 1.83 percentage points.
These graded vectors remain synthetic controls, not observed model behavior.
Confidence is high for the algebra and exact regression hashes, and low for
real marginals, cross-model dependence, continuous effects, drift, cost, and
provider behavior. The next accessible question is the earliest block count
at which five strong-process marginals plus one moderate-process marginal
recover the 80% 4-of-6 guarantee while every frozen null still passes 1%,
without assuming power is monotone.

## Cycle 90 mixed-marginal recovery boundary

Seed reconciliation `bf53cef114c946a2e5ae959379bbffd1354649de` preceded this
work. A one-time exact scan evaluated every integer block count from 64 through
256 under the retained 99.5% directional interval. The immutable power output
has SHA-256
`a69681e4532b513a8ed622ad9c26be8f3b76572c3700f919ae32a0e4ca1d6875`;
the search manifest has SHA-256
`2d60ee8cdeaac072884b596e0dbf7a1e9cf35bad0dc064eaa163d3976cc0bbda`.
The scan did not assume monotonicity and found no later regression after the
first pass.

At 171 blocks, strong correct-direction power is
`0.9931639463253494`, moderate power is `0.43334150555065293`, and the
five-strong/one-moderate marginal sum is `5.399161237177401`. Its sharp
unknown-dependence 4-of-6 lower bound is `0.7997204123924669`, so it fails the
80% target. At 172 blocks, the corresponding powers are
`0.9934576391929564` and `0.43646480159465234`, the sum is
`5.403752997559434`, and the lower bound is `0.801250999186478`, so it passes.
At 256 blocks the lower bound reaches `0.8896410833501275`.

Every declared null passed the frozen 1% false-direction limit throughout the
64–256 scan. The largest observed null risk was the dense null at 71 blocks,
`0.008554538502693238`. Exact null-record SHA-256 values at 71, 171, 172, and
256 blocks are respectively
`e7b35ad29a6226319fa5b191696348f7c0ade414d85e9f6a745d1b35af35b641`,
`486655fa1d6d62ead8a1dfdde7a42e837568257b6535751e39b833ea83c780c4`,
`a0e0d92ee7ae22dad567a1c183b7014427b163364284fb9cf71ae0a9c4d8743e`,
and `cf104d024b1677f5cd413cbf8ee84598baeae30144e63d622a532a70cc21a72c`.
The adjacent and endpoint power-record SHA-256 values are
`32e257c2206d350128bc6a8e24b3421bb9e7b472bebf922410a97f2c20bb55df`,
`b8446c95d53279d73bfb12826cbb64a1ddf49f2ad17cba83297d47478c4c2681`,
and `6bc9a70bdbc9b9a44d1e12f4b8377d86230187a55ff061e18cfd15e99e3529d1`.

Exact test source `c79f2a32042ff1e5433bf15897800fd44dabd178` pins only the
decision-relevant 171/172 edge rather than adding the 12-minute exhaustive
scan to routine validation. Its independently regenerated calibration/power
specification pairs are `486655fa…80c4` / `26f54702…3d5e` at 171 and
`a0e0d92e…743e` / `956ad848…295c` at 172; floating-point accumulation differs
from the saved scan only below the reported precision and gives the same
pass/fail decisions.

This answers the frozen equal-block question but makes the operational burden
worse: 172 blocks for each of six models means 33,024 complete factorial
episodes, 13,056 more than the 104-block all-strong design and far above the
retained 25 seed blocks per model. Confidence is high for exact discrete
enumeration, the adjacent regression, and the sharp first-moment bound; it is
low for identifying a real weaker model in advance, unequal allocation,
cross-model dependence, drift, cost, provider behavior, and transfer from the
synthetic processes. The next ranked question is whether a predeclared unequal
block allocation can meet the same 5.4 marginal budget with fewer total
episodes, without weakening any model's 1% null control.

## Cycle 91 bounded unequal-allocation probe

Seed reconciliation `51f62b0ab5e7a4f6a9093cbdf50573229707ef5b` preceded this
probe. Exact local test source
`1cf95c026d659f6f1c678b8af61231bf5c98c94d` fixes the moderate synthetic
model at the tested 256-block endpoint and compares five strong synthetic
models at 120 versus 121 blocks. This is a named sensitivity allocation; it
does not infer which real model, if any, would be weaker.

At 120 strong blocks, per-model strong power is `0.9452316649448583`; paired
with moderate endpoint power `0.6695324195378379`, the six marginal sum is
`5.395690744262129` and the 4-of-6 lower bound is `0.7985635814207098`.
The 856-block, 27,392-episode design therefore fails. Raising each of the five
strong models to 121 blocks gives strong power `0.9473025370635995`, marginal
sum `5.406045104855835`, and lower bound `0.8020150349519449`. That 861-block,
27,552-episode candidate passes and saves 171 blocks or 5,472 episodes relative
to Cycle 90's equal 172-block design.

The exact 120-, 121-, and 256-block null specification SHA-256 values are
`e75f18903c731197715e52a06ea708f7eacd7f57050ad6e247adc447bfca4666`,
`87e9c39e40e21215807c9bf152fc1119b0a81554c59456cb3d21e24ccb0a683f`,
and `cf104d024b1677f5cd413cbf8ee84598baeae30144e63d622a532a70cc21a72c`.
Their largest declared null risks are respectively `0.004715853666719678`,
`0.006150808149995726`, and `0.004818913568993839`, all below 1%. The passing
candidate's aggregate wrong-direction upper bound is
`1.3423176283386044e-10`.

This supports the decision-relevant claim that equal block counts are not
cost-minimal within the tested synthetic controls. It does not establish a
global optimum: the committed regression pins only the adjacent 120/121 edge
with the moderate model fixed at 256, while the exploratory check covered
strong counts 115–121. It also assumes the weaker identity is known before
allocation and does not price latency, parallelism, retries, or model-specific
calls. Confidence is high for the frozen exact probabilities, null checks,
episode arithmetic, and first-moment bound; low for other allocations,
real-model identification, dependence, drift, cost, and provider behavior.
The next ranked question is an exhaustive, non-monotonic total-block search
over the retained 64–256 grid to determine whether another named allocation
improves on 861 blocks while every selected count retains null control.

## Cycle 92 exhaustive unequal-allocation minimum

Seed reconciliation `80cd9450fc66c13e6a96fc4afddfdeaf8acf7158` preceded this
search. One goal-owned exact process enumerated all 193 run counts from 64
through 256, retained each null and alternative result, and then used dynamic
programming to maximize the five strong-process marginals at every attainable
block total before pairing each state with every moderate-process count. This
covers unequal counts among the five strong models and makes no monotonicity
assumption. All 193 counts passed every frozen null. The exact row table has
SHA-256 `f26c11984cf283978fb8e1b551ab12b7729c6a04a6fce6d62911359d36ae7402`;
the derived result has SHA-256
`d17d44ed7e48c18ec86c6193e74e72f2ce011f901ba56c5b4f30b9d9dceccbcd`.

The minimum passing total is 859 blocks: strong-model counts
`[120,120,121,121,121]` and moderate-model count `256`. Their correct-
direction marginal sum is `5.401903360618353`, giving the sharp 4-of-6 lower
bound `0.800634453539451`; the wrong-direction upper bound is
`1.3424179862500522e-10`. This is 27,488 complete factorial episodes, 64 fewer
than Cycle 91's five-by-121 probe and 5,536 fewer than the equal 172-block
design.

The strongest allocation at every cheaper total occurs at 858 blocks, with
strong counts `[120,120,120,121,121]` and the same 256-block moderate model.
Its marginal sum is `5.399832488499611` and its lower bound is
`0.7999441628332038`, so it fails. The dynamic program retained 961 exact
five-model total states; comparing all of them with all 193 moderate counts
proves no cheaper allocation in the declared grid passes the frozen
first-moment rule. The largest null risk across the grid remains dense-null
`0.008554538502693238` at 71 blocks.

Exact local test source `03e66b1063fa3eeadcbb34c27c6870c7aeeb70c7`
pins the decision-relevant 858/859 edge using the 120-, 121-, and 256-block
calibration and power digests. It deliberately does not add the roughly
24-minute exhaustive search to routine validation.

This resolves the named-grid minimum, but not operational allocation. It
assumes the moderate model is identified in advance and assigns that model the
largest budget. It also treats the five strong models as the same synthetic
process apart from count, and does not model latency, parallelism, retries,
cost tiers, drift, or provider behavior. Confidence is high for exhaustive
grid coverage, digests, the sharp bound, and the adjacent regression; low for
real-model classification and transfer. The next ranked question is a matched
identity-misassignment control: swap the 256-block budget onto a strong model
and place the moderate process at one of the 120/121 counts, then measure how
much of the claimed saving survives.

## Cycle 93 matched identity-misassignment control

Seed reconciliation `fec350593be2cb47486f4d4294bc6aff16f8d312` preceded this
control and recorded a material saved-shell access change without an
attributable saved item. The test keeps Cycle 92's exact 859-block multiset and
27,488-episode cost fixed. It changes only which frozen process class receives
the large budget, so cost cannot explain the comparison.

When a strong process receives 256 blocks and the moderate process receives
120, strong counts are `[120,121,121,121,256]`. Correct-direction marginals sum
to `5.061461251302365` and the sharp 4-of-6 lower bound is
`0.6871537504341217`. With the moderate process at 121, strong counts are
`[120,120,121,121,256]`; the sum is `5.062726969010269` and the lower bound is
`0.6875756563367563`. Both fail the frozen 80% power target. Their aggregate
wrong-direction upper bounds are only `5.369590192734223e-8` and
`5.1284290158212815e-8`, respectively, so both retain the 1% false-direction
discipline.

Exact local source `552532bd9690613ebc5eb8d796f3ab61bd94ccac` binds both
permutations to the same 120-, 121-, and 256-block calibrations as Cycle 92.
The full factorial test file passes 42 tests with 418 assertions; TypeScript
and focused formatting pass. This supports directional safety under the two
identity errors but contradicts treating the 5,536-episode saving as robust to
process misclassification. It does not estimate a classifier, a
misclassification rate, real-model effects, dependence, provider behavior, or
operational cost. Confidence is high for the exact frozen permutations and
low for those transfer questions.

The next ranked question is the bounded identity-invariant control already
available from local evidence: give every model 172 blocks, verify that the
moderate identity cannot change the result, and quantify its robustness
premium over the targeted 859-block allocation before another global search.

## Cycle 94 identity-invariant equal-allocation control

Seed reconciliation `89f0da7644c37f35d228773435df16f27245c425` preceded this
control and reproduced the same profile-class access boundary with zero
attributable items. The regression gives all six named models 172 blocks and
permutes the one moderate process through every identity. Each of the six
scenarios has correct marginal sum `5.403752997559532`, sharp 4-of-6 lower
bound `0.8012509991865105`, and aggregate wrong-direction upper bound about
`4.567335716582027e-9`. Every placement passes the frozen 80% power and 1%
wrong-direction gates.

Exact local source `b4ffa1c522019bb42cb1d52602efa7e563359a3d` binds all six
placements under sensitivity-spec SHA-256
`a7a31b9d54011af60a523b154d25127d2dc0e230ff40f9c5c0509725e8260328`.
The equal design costs 1,032 blocks and 33,024 complete factorial episodes.
That is 173 blocks and 5,536 episodes more than Cycle 92's targeted 859-block
design. The focused identity-invariance test passes with 44 assertions;
TypeScript and focused formatting pass.

This supports equal allocation as an identity-invariant control and
quantifies the price of avoiding the classification assumption. It does not
prove equal 172 is the cheapest robust unequal vector, nor does it establish
real-model effects, a classifier, dependence, provider behavior, or
operational cost. Confidence is high for exact permutation invariance and low
for those transfer questions. The next ranked question is an exhaustive,
non-monotonic search over the retained 64–256 grid for the minimum allocation
whose 4-of-6 lower bound passes for every possible moderate-process identity.

## Cycle 95 exhaustive identity-robust minimum

Seed reconciliation `a8ffbc692bffce0f8143c3475e3cec07e494b63f` preceded this
search and recorded a material profile-to-login shell transition without an
attributable saved item. Four goal-owned local processes enumerated every
64–256 count under the frozen exact null and alternative fixtures. All 193
counts pass the null gate; dense-null at 71 remains worst at
`0.008554538502693238`. The retained row representation has SHA-256
`d1792f60380298c205f32f72c1fb04b1e8b1b457bf1423b0c5e6b2fc1f10a6dc`.

For each attainable six-model total, a dynamic program maximized the sum of
strong-process marginals at every observed strong-minus-moderate gap
threshold. Taking the worst of all six possible moderate identities then
tests the exact robust criterion without assuming monotonicity or a known
process class. The result representation has SHA-256
`a2f55d41dd3086532897ce695e66c1e5d39e3820d3a20a42864922276659b40c`.

The minimum pass is 1,029 blocks with counts
`[171,171,171,172,172,172]`, or 32,928 complete factorial episodes. When the
moderate process receives 171 blocks, the worst correct marginal sum is
`5.400042315780292`, giving lower bound `0.8000141052600972`; when it receives
172, the lower bound is `0.800957306318893`. The worst aggregate wrong-
direction upper bound is `4.778429753042595e-9`.

The strongest cheaper state is 1,028 blocks at
`[171,171,171,171,172,172]`. Its worst correct marginal sum is
`5.399748622912675` and lower bound `0.7999162076375583`, so it fails. Exact
local source `b638788e80b563c5745274fa5b82c036743d4406` pins both adjacent
vectors using the retained 171- and 172-block calibrations. The focused test
passes with 56 assertions; TypeScript and formatting pass.

This proves the identity-robust minimum over the declared grid, but it changes
the operational conclusion: the optimized robust vector saves only three
blocks and 96 episodes versus equal 172 sampling. Its aggregate lower-bound
margin is only `0.0000141052600972`, or 0.00141 percentage points. Confidence
is high for the exact enumeration, dynamic program, edge regression, and
frozen probabilities; low for marginal estimation, drift, real models,
dependence, cost, and providers. The next ranked question is to compute the
uniform downward marginal perturbation that erases this pass and compare its
buffer with equal 172 before treating the 96-episode saving as actionable.

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
