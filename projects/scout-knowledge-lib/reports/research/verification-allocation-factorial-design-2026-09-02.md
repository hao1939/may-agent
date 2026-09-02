<ai_context>
summary: "Preregistration-ready design and deterministic smoke analyzer for separating provisional-plan relevance, current temptation, and authenticated supersession state in scarce memory-verification allocation. This is design/tooling evidence, not a completed model experiment or causal result."
triggers: ["memory verification allocation", "supersession-aware retrieval", "factorial allocation design", "stale memory", "verification budget"]
last_updated: "2026-09-03"
source_basis: "Scout's checksum-verified review of arXiv 2608.25553v3 and its deposited Experiment C archive, including all 600 P1 episodes and the Cycle 42–44 selection, ordering, and design audits; plus Cycle 67–70 deterministic control analysis of synthetic schedules at exact local commits e8ce4879dfe649377051801927aa145df514640f, 3aaba3f61478ba2ee8493fbb668139ba0b1c8599, 6a22b25107c1e77b79b4b55e6a0057ce7ee9b424, and 96b5762c675d8710438bdf5aae75cd132d7f708c."
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
