<ai_context>
summary: "Preregistration-ready design and deterministic smoke analyzer for separating provisional-plan relevance, current temptation, and authenticated supersession state in scarce memory-verification allocation. This is design/tooling evidence, not a completed model experiment or causal result."
triggers: ["memory verification allocation", "supersession-aware retrieval", "factorial allocation design", "stale memory", "verification budget"]
last_updated: "2026-09-03"
source_basis: "Scout's checksum-verified review of arXiv 2608.25553v3 and its deposited Experiment C archive, including all 600 P1 episodes, all 5,400 Experiment C completion-manifest entries and usage records, and the Cycle 42–44 selection, ordering, and design audits; plus deterministic synthetic controls through Cycle 106, including policy-evidence unit/applicability binding 5364acc811249d991829d4b43edb6a69b0246eb2 and verified-freeze scope composition 3bf5698900e7963ed81d45b2fa0427829603b77f."
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

## Cycle 96 matched uniform-drift sensitivity

Seed reconciliation `7e129894260daf75bd1eb54de6b9bccdc480d0b2`
preceded this analysis and recorded a material login-to-profile shell
transition without an attributable saved item. The local accepted-ref check
at `2026-09-02T23:07:59.654Z–23:07:59.658Z` found all six tracked refs present
and unchanged. GitHub, arXiv, and Reddit therefore made zero public requests.

Exact local source `b652c60a22972619be0212c8f88e23262eeccc1a` applies the
same downward perturbation to each of the six frozen correct-direction
marginals while leaving the already-passing wrong-direction bounds unchanged.
For the identity-robust `[171,171,171,172,172,172]` vector, the worst marginal
sum is `5.400042315780292`. Its largest passing per-model downward drift is
therefore `(5.400042315780292 - 5.4) / 6`, or
`0.000007052630048557755` probability (`0.0007052630048557755` percentage
points). The matched equal-172 sum gives an exact fixture-derived buffer of
`0.0006254995932550855` probability (`0.06254995932550855` percentage
points), `88.69026008006738` times larger. The displayed equal-allocation sum
is rounded to 15 decimal places; the buffer pins the underlying fixture value.

Both six-identity designs pass the frozen 80% aggregate lower-bound target at
their exact buffers and fail when their respective buffer is increased by
`1e-12`; their retained aggregate wrong-direction upper bounds remain below
1%. The focused regression passes with 65 assertions, and TypeScript and
focused formatting pass.

This supports equal 172 as the materially more drift-tolerant choice despite
its extra three blocks and 96 episodes, and contradicts treating the declared-
grid minimum's tiny cost saving as operationally robust. The calculation is a
matched deterministic sensitivity analysis, not an observed drift estimate,
confidence interval, provider result, or claim that real drift is uniform or
always adverse. Confidence is high for the frozen algebra and boundary tests;
low for real marginals, dependence, provider behavior, costs, and the size or
shape of actual drift. The next ranked question is to map the Pareto frontier
between identity-robust episode cost and uniform-drift reserve over the
retained grid, avoiding an arbitrary reserve threshold.

## Cycle 97 local cost-reserve frontier

Seed reconciliation `b0b184795f35cb7bc5a7a3fb593d70a067d0d8e4`
preceded this analysis and recorded a material profile-to-login shell
transition without an attributable saved item. The post-seed accepted-ref
check at `2026-09-02T23:16:03.519Z–23:16:03.523Z` found all six tracked refs
unchanged; GitHub, arXiv, and Reddit made zero public requests.

Exact local `53cebd440a55eb786b2084d566875f1003d56835` evaluates all seven
identity-robust mixtures of the already-frozen 171- and 172-block marginals.
Totals 1,026–1,028 fail. The passing 1,029-, 1,030-, 1,031-, and 1,032-block
designs require 32,928, 32,960, 32,992, and 33,024 episodes and tolerate
uniform per-model downward drift of `0.000007052630048557755`,
`0.00005600144131830594`, `0.00010495025258775807`, and
`0.0006254995932550855`, respectively.

The first two extra blocks above the minimum each buy about `0.00004894881127`
additional probability per model. The final extra block, which eliminates the
last 171-block placement and therefore its worse moderate-process gap, buys
about `0.00052054934067`. This supports the equal-172 endpoint over either
intermediate mixture when the 96-episode maximum premium is affordable. It
does not prove that another 64–256 vector cannot dominate a local point.
Confidence is high for the exact seven-point slice and low for the remaining
grid, real marginals, drift shape, dependence, providers, and operational
cost. The next ranked work is the complete retained-grid Pareto search.

## Cycle 98 complete retained-grid frontier

Seed reconciliation `468376aaf0f1ae3a4f9b446cb267ca92c08e252b`
preceded the search and retained the saved-target login wall with only body-
byte drift. Added and changed IDs remain unknown, removals are `[]`, and all
132 durable seeds remain unavailable. The post-seed accepted-ref check at
`2026-09-02T23:55:59.924Z–23:55:59.929Z` found all six tracked refs unchanged;
GitHub, arXiv, and Reddit made zero public requests.

The [exact frontier verifier](../../../scout-knowledge-lib.app/scripts/verification-allocation-robust-frontier.ts)
at `6fd185a54b4fa386d92ceba26b187a3a7963a6fe` regenerates every count from 64
through 256 in four interleaved local workers. All 193 rows retain the frozen
null gate; dense-null at 71 is again worst at `0.008554538502693238`. The
canonical row representation has SHA-256
`6fac7f99c1159798c211016ad2ec0cbd464c7c95ae56cf324a6000028dd38252`.

For every attainable six-model total, the verifier maximizes strong-process
marginal sum under each observed strong-minus-moderate gap threshold, then
recomputes the selected allocation in sorted count order. The stable result
representation has SHA-256
`383a699f69ef92bdc1f5edd0941d03ba4e411cdfe22adf2f4b4e07257c2b8fff`.
Two complete runs reproduced the row evidence; the stabilized final run binds
this result hash to the reviewed source.

The first passing point remains 1,029 blocks at
`[171,171,171,172,172,172]`: 32,928 episodes, worst correct marginal sum
`5.400042315780292`, per-model uniform drift reserve
`0.000007052630048557755`, and aggregate wrong-direction upper bound
`4.778429753042595e-9`. The globally optimal results at totals 1,030–1,032 are
exactly the Cycle 97 mixtures, so no other retained-grid vector dominates a
local point at the same or lower cost.

Every integer total from 1,029 through 1,536 strictly increases the best
reserve. All 508 passing totals are therefore nondominated. At the declared
grid endpoint, `[256,256,256,256,256,256]` costs 49,152 episodes and raises the
per-model reserve to `0.044820541675075244`; its aggregate wrong-direction
upper bound is `1.3405852452814177e-10`.

This resolves the complete-grid dominance question but contradicts choosing a
single design from optimization alone: cost and reserve improve together at
every passing total. The calculation remains exact synthetic sensitivity, not
a real drift estimate, confidence interval, provider result, or operating-
cost judgment. Confidence is high for coverage, repeated row hashes, stable
arithmetic, and the dynamic program; low for real marginals, dependence, drift
shape, provider behavior, and the missing policy preference. The next ranked
question is to require an independently justified reserve target or episode
ceiling before selecting a frontier point, rejecting an implicit post-hoc
choice.

## Cycle 99 explicit operating-policy boundary

Seed reconciliation `6151fc3398f1f8f25f2c9dd4bd4e9b49d8d437fa`
preceded this work. It recorded a saved-shell login-to-profile transition but
still exposed zero attributable items: added and changed IDs remain unknown,
removals are `[]`, and all 132 durable seeds remain unavailable. The local-only
accepted-result inventory at
`2026-09-03T00:12:55.252Z–00:12:55.258Z` found all six refs unchanged. GitHub,
arXiv, and Reddit therefore made zero public requests.

Exact local `7a4c7ce5b934692271e418c64f0bba140126f4be` adds a
schema-checked selector to the complete frontier verifier. It accepts exactly
one of two caller policies: the minimum uniform-drift reserve to satisfy or the
maximum episode count not to exceed. Each policy must carry a nonempty evidence
reference. Missing, conflicting, malformed, structurally inconsistent, and
unattainable input returns no selection. A reserve target selects the cheapest
qualifying point; an episode ceiling selects the strongest point within the
ceiling. The emitted SHA-256 binds the exact caller policy, while its evidence
status remains `caller-supplied-unverified`.

The exact full-grid rerun reproduced row SHA-256
`6fac7f99c1159798c211016ad2ec0cbd464c7c95ae56cf324a6000028dd38252` and
result SHA-256
`383a699f69ef92bdc1f5edd0941d03ba4e411cdfe22adf2f4b4e07257c2b8fff`.
Without a policy, the real 508-point frontier returned `selected: null` and
`exactly one explicit frontier policy with evidence is required`. Focused
coverage passes 4 tests and 9 assertions, including a malformed episode-count
control, both selection bases, empty evidence, conflicting bases, and an
unattainable target.

This prevents optimization output from silently becoming an operating
decision. It does not establish that a referenced reserve, budget, cost, or
drift estimate is independent, current, affordable, or valid. Confidence is
high for fail-closed parsing, deterministic selection, full-grid compatibility,
and exact local hashes; low for every real-policy input and provider transfer.
The next ranked question is whether a minimal provenance manifest can bind the
caller policy to a named owner, decision revision, observation time, and
independent evidence status without pretending to validate its substantive
judgment.

## Cycle 100 policy-provenance binding

Seed reconciliation `3f01ee4ae6eb2ae8f8220781045dfb2a26fca2ed`
preceded this work. The saved profile shell retained the same semantic access
fingerprint and zero attributable items; only its byte length and body hash
changed. Added and changed IDs remain unknown, removals are `[]`, and all 132
durable seeds remain unavailable. The local-only accepted-result inventory at
`2026-09-03T00:38:49.086Z–00:38:49.089Z` found all six refs unchanged. GitHub,
arXiv, and Reddit made zero public requests.

Exact local `6eab5e9bd76022e0b65aa26d43019e49a8348644` requires a
policy-provenance manifest before selecting a frontier point. The manifest
binds the exact policy SHA-256 and evidence reference to a nonempty decision
owner, decision revision, exact UTC observation time, and one of two honest
independent-evidence states: `not-provided` or `provided-unverified`. A
provided state requires its own reference. Mismatched hashes or references,
malformed timestamps, unbound fields, missing evidence, and contradictory
status/reference combinations fail closed. The selector hashes the accepted
manifest separately and still labels the entire binding
`caller-supplied-unverified`.

The real 508-point synthetic control used reserve target `0.0006`, policy
SHA-256 `ab3e639387e21f092303d992b215daf4f67cf79289c8ddfc1a92eef20615373d`,
and manifest SHA-256
`f7b8f28bde41941b5ae48ee2874940a30555cf76a7d1259281519eb9405afed8`.
It selected the cheapest qualifying point: equal 172 sampling, 1,032 blocks,
33,024 episodes, and reserve `0.0006254995932553816`. Established row and
result hashes remained
`6fac7f99c1159798c211016ad2ec0cbd464c7c95ae56cf324a6000028dd38252` and
`383a699f69ef92bdc1f5edd0941d03ba4e411cdfe22adf2f4b4e07257c2b8fff`.
Focused validation passes 7 tests and 20 assertions.

This proves structural provenance binding, not that the synthetic reserve is a
good operating target or that any named owner, revision, timestamp, or
independent evidence is authentic. Confidence is high for exact binding,
failure controls, selection, and hashes; low for real policies and provider
transfer. The next ranked question is to byte-bind the referenced decision
record itself through the existing descriptor-safe local evidence path, while
continuing to distinguish integrity from authority and independent validation.

## Cycle 101 decision-record byte binding

Seed reconciliation `bd8463ccc7410bb2b78f8c197d0a7c905021573c`
preceded this work. The saved profile shell retained its semantic access class,
login wall, and zero attributable items; only its response length and body hash
changed. Added and changed IDs remain unknown, removals are `[]`, and all 132
durable seeds remain unavailable. A local-only check at
`2026-09-03T01:00:40.647Z` found the six accepted source commits present and
their standing equivalents contained in the current branch. GitHub, arXiv, and
Reddit made zero public requests.

Exact local `882bee03a86d34c1d58b03bc8c1457ebd230a88f` closes the gap
between a manifest claim and the bytes it names. The frontier CLI now requires
one explicit absolute evidence root with the policy and manifest. It pins that
root and every nested directory with file descriptors, rejects traversal,
relative or symbolic-link roots, linked directories and files, non-regular
files, and byte mismatches, and reads and hashes the final file through the
same descriptor. A mismatch clears the selected frontier point and fails
closed. The shared primitive also replaces the duplicate no-follow reader in
the existing execution-freeze bundle.

The full 193-row control byte-bound the 1,022-byte local decision record at
SHA-256 `346915ecdda9e8c2e946abdaa174d3e2da4ed1692657d90fdbbe76f39701e996`.
Its 0.0006 reserve policy hash is
`3a32f5d299c75a11f9e494b29a9abdbfc0682019d6300e4cc2defc139cd22a71`;
the expanded manifest hash is
`23a5cba4130aa5df098e71e2dc4d759404db85e83d4fbc8320105cf42cd165ae`.
Only after that byte match did the selector return equal 172 sampling at 1,032
blocks and 33,024 episodes. Established row and result hashes remain
`6fac7f99c1159798c211016ad2ec0cbd464c7c95ae56cf324a6000028dd38252`
and `383a699f69ef92bdc1f5edd0941d03ba4e411cdfe22adf2f4b4e07257c2b8fff`.
Focused validation passes 22 tests and 51 assertions, TypeScript, formatting,
whitespace, and the exhaustive run.

This proves one local file matched its declared hash for one descriptor-safe
read. It does not prove authorship, authority, independence, timestamp
validity, real drift, operating cost, provider behavior, or substantive
correctness. The record content is not yet structurally cross-checked against
the manifest fields it is meant to support. Confidence is high for the local
integrity and failure controls and low for every external or substantive
interpretation. The next ranked question is to require the record's embedded
policy, owner, revision, time, and evidence status to match the manifest before
selection, without promoting that consistency check into authentication.

## Cycle 102 decision-record content binding

Seed reconciliation `a5eccbdabb4c34a30e41b1f7ebd43181ff44e292`
preceded this work. The public Explore view remained readable at 30 notes; the
saved target retained the same profile-class semantic fingerprint, login wall,
102,929-byte length, and zero attributable items. Only its body SHA-256
changed. Added and changed IDs remain unknown, removals are `[]`, and all 132
durable seeds remain unavailable. The local accepted-result check at
`2026-09-03T01:09:51.531Z` found all six accepted source commits present and
all standing equivalents contained. GitHub, arXiv, and Reddit made zero public
requests.

Exact local `bd9cb1f3e525cfbd0ed4e50eade3f449c7da428d` prevents a
hash-matched but contradictory record from selecting a point. After the
descriptor-safe byte check, the binder parses strict UTF-8 JSON and requires
the record's exact schema and field set, decision identity, owner, revision,
UTC time, policy, independent-evidence state and optional reference to match
the policy and manifest. It also requires nonempty rationale and scope-limit
text. A mismatch preserves the useful fact that the bytes matched while
clearing the content status and selected point.

The regression rejects seven separately re-hashed contradictions: decision
identity, owner, revision, time, reserve policy, evidence state, and an extra
unbound claim. A selector-level control separately rejects a byte-matched
revision contradiction. The unchanged 1,022-byte real control still matches
record SHA-256 `346915ecdda9e8c2e946abdaa174d3e2da4ed1692657d90fdbbe76f39701e996`,
policy SHA-256 `3a32f5d299c75a11f9e494b29a9abdbfc0682019d6300e4cc2defc139cd22a71`,
and manifest SHA-256
`23a5cba4130aa5df098e71e2dc4d759404db85e83d4fbc8320105cf42cd165ae`.
It returns both `local-byte-match-unverified` and
`local-content-match-unverified` before selecting the retained equal-172
point. Focused validation passes 10 tests and 32 assertions plus TypeScript,
formatting, and whitespace.

This establishes internal local consistency, not who authored or approved the
record, whether its time or revision is externally genuine, or whether 0.0006
is a defensible real drift reserve. Confidence is high for the declared local
schema and mismatch controls and low for authority, independence, real drift,
cost, provider transfer, and the target's substantive value. The next ranked
question is to audit the retained primary archive for measured drift or cost
evidence that could justify any reserve target or episode ceiling; absent such
evidence, the selection must remain illustrative rather than operational.

## Cycle 103 retained-archive drift and cost audit

Seed reconciliation `5a6b0b2deeeca1c90f64258fbe6f85360bbd737f`
preceded the conclusion. The saved target retained its profile-class semantic
fingerprint, login wall, 102,929-byte length, and zero attributable items; only
its body SHA-256 changed. Added and changed IDs remain unknown, observed
removals are `[]`, and all 132 durable seeds remain unavailable.

Both retained copies of the `2608.25553v3` data/code ZIP are byte-identical at
61,508,909 bytes and SHA-256
`41ca426998db106d041f85c8eb1fb2f2cfd692615b98160952d32d3877a63138`.
The Experiment C completion manifest has SHA-256
`ddacf2b6564b1d64c5d1fed275a3b8876100c81a85394ea471941851d7bd3f82`;
all 5,400 listed episode members reproduce their declared hashes with zero
mismatches.

Those raw records do contain measured operating-volume evidence that the
results report does not aggregate. Summing every `usage` entry yields
15,072,675 input tokens, 7,110,497 output tokens, and 3,019,903 reported
reasoning or thinking tokens across 10,500 completed generation calls. Every
call has one usage record. The first and last call times are
`2026-08-28T02:33:31.643Z` and `06:04:24.019Z`, reproducing the report's
12,652-second wall-clock run and seven recovered transport retries.

This supports using the archive as a historical sizing input, but contradicts
treating episode count as operating cost. Every named model has the same 900
episodes and 1,750 completed calls, yet per-model input volume spans 1,672,953
to 3,935,347 tokens (2.352 times), output volume spans 545,032 to 2,454,367
(4.503 times), and summed call duration spans 7,888,374 to 36,486,282 ms
(4.625 times). The design projected about 14 million input and 7.4 million
output tokens and four hours; the observed totals are 7.66% higher, 3.91%
lower, and 12.14% shorter respectively. The repository explicitly supplies no
prices.

The archive does not supply a measured drift distribution or a reserve target.
Its schedule-position diagnostic is not a repeated-time marginal-drift
estimate; its one mention of model drift is an alternative explanation. In
the analysis, `spend` is the number of memory IDs named, while `C3 cost` is a
decision-outcome diagnostic, neither money nor resource consumption. The
frontier's 96-episode difference is only 0.2907% of equal 172 sampling, but the
archive's episodes use different one- or two-call prompts and therefore cannot
price or time Scout's 32-cell factorial episodes without an explicit transfer
assumption.

Confidence is high for archive identity, manifest coverage, exact usage sums,
and the absence of a registered drift estimate or price table; low for current
provider transfer, monetary cost, throughput transfer, and any real drift
shape. The illustrative 0.0006 record remains non-operational. The next ranked
question is whether the policy evidence schema can distinguish retrieval-count
budgets, measured but non-transferable usage, and a protocol-matched approved
episode ceiling, failing closed when units or applicability are absent.

## Cycle 104 policy-evidence applicability boundary

Seed reconciliation `b54a008a7f10984c94107e619e9b5d6ce5ec2cd6`
preceded this work. The saved shell changed from profile-class to login-class,
but still exposed a login wall and zero attributable items: added and changed
IDs remain unknown, removals are `[]`, and all 132 durable seeds remain
unavailable. The local accepted-result check at
`2026-09-03T01:29:26.379Z–01:29:26.385Z` found all five accepted reviewer refs
unchanged and all nine standing reconciliation commits contained. GitHub,
arXiv, and Reddit made zero public requests.

Exact local `5364acc811249d991829d4b43edb6a69b0246eb2` makes the
policy-evidence contract distinguish the two accepted operating quantities.
A minimum-reserve policy now requires evidence kind
`uniform-marginal-drift-reserve` in `probability-per-model`; an episode-ceiling
policy requires `complete-factorial-episode-ceiling` in
`complete-factorial-episodes`. Both must name a nonempty protocol reference and
model-scope reference. Missing applicability, a wrong policy/unit pair,
retrieval-count units, extra fields, and an explicit `not-established` status
all fail closed. The byte-matched decision record must carry exactly the same
applicability declaration as its manifest.

The retained synthetic decision record is deliberately migrated with
`applicabilityStatus: not-established`. Its 1,434 bytes have SHA-256
`dc3a5143b7706d3e62dfd73c0d135976d4e1165f6664729bd7109e6e24f09092`,
while its policy hash remains
`3a32f5d299c75a11f9e494b29a9abdbfc0682019d6300e4cc2defc139cd22a71`.
A production-shaped local call returns no selection and the exact error
`policy evidence applicability is not established for this protocol and model
scope`. Focused validation passes 11 tests and 37 assertions plus TypeScript,
formatting, and whitespace.

This closes a structural unit-confusion path; it does not prove that a named
protocol or model set matches the evidence. The positive status is explicitly
`protocol-matched-unverified`, so owner, revision, timestamp, applicability,
independence, cost, drift, and provider behavior remain caller-supplied rather
than authenticated. Confidence is high for exact schema rejection and local
failure controls, and low for every real operating-policy claim. The next
ranked question is whether protocol and model-scope references can themselves
be descriptor-safe, byte-bound artifacts whose declared units and identities
are derived rather than accepted as free text.

## Cycle 105 verified-scope composition audit

Seed reconciliation `c48dc033c97f753ea094129e070748c4e4feadac`
preceded this audit. The saved shell remained login-class with zero attributable
items; only its body hash changed. Added and changed IDs remain unknown,
removals are `[]`, and all 132 durable seeds remain unavailable. The local
accepted-result check at `2026-09-03T01:38:26.110Z–01:38:26.181Z` found the
five accepted reviewer refs unchanged and all nine standing reconciliation
commits contained. GitHub, arXiv, and Reddit made zero public requests.

The existing freeze path already supplies most of the required scope evidence.
Exact source `f71b2f185a08061cc67340017a31c643e7d0a9cb` requires immutable
requested-to-resolved model mappings with bound resolution artifacts, a
`scout.verification-allocation-schedule/v1` schedule with exactly 32 cells per
model/seed, exact schedule/model identity agreement, and episode count derived
as models times seeds times 32. Exact source
`882bee03a8ae5957e3fdad1c8f63d8f6418f3e17` inventories an explicit bundle
through pinned no-follow descriptors and rejects linked, undeclared, malformed,
or mismatched bytes. Focused validation passes 18 tests and 46 assertions plus
TypeScript.

That evidence also contradicts adding separate protocol and model-scope
manifests. They would duplicate facts already cross-checked by the freeze gate
and create another disagreement surface. The actual composition gap is
smaller: `FreezeVerificationResult` returns only counts and discards the exact
resolved model identities and schedule-scope digest that the policy binder
would need. The library retains no real freeze manifest or schedule bundle at
all; the only matching JSON artifact is the explicitly non-applicable synthetic
policy record. Therefore no current policy scope can honestly be promoted from
`protocol-matched-unverified` to byte-bound.

GitHub/local code was selected because this was an implementation-contract
question. arXiv remains high-value and retains MemGauge `2608.30177v1` plus
allocation study `2608.25553v3`; no paper or artifact trigger fired. Reddit
remains RSS-readable/JSON-403 and deferred without quota because there was no
seed-linked claim, content delta, or access change. Confidence is high for the
current interface, descriptor behavior, repository inventory, and focused
controls; low for any unretained real bundle, provider identity, or operating
approval. The next ranked investigation is a single composition adapter that
derives canonical protocol and resolved-model-scope digests from one verified
freeze bundle and requires those digests at the policy binder, without a
second scope-authority format.

## Cycle 106 verified-freeze scope composition

Seed reconciliation `902ecc29796a36b85a36f1425dcb72ba65049101`
preceded this work. The saved shell retained the login-class access fingerprint,
46,672-byte length, login wall, and zero attributable items; only its body hash
changed. Added and changed IDs remain unknown, removals are `[]`, and all 132
durable seeds remain unavailable.

Exact local `3bf5698900e7963ed81d45b2fa0427829603b77f` composes one
verified freeze result into two canonical typed identities. The protocol hash
binds schedule schema and SHA-256, cells per model/seed, seed namespace,
algorithm, policy-artifact SHA-256, seed IDs, and episode count. The model-scope
hash binds requested and resolved IDs, resolution kind, and each resolution-
evidence SHA-256. Failed freeze validation returns no scope. Positive policy
applicability now rejects free-text references and requires an exact matching
`scout.verification-allocation-freeze-policy-scope/v1` object.

The canonical one-model/two-seed toy freeze emits protocol reference
`freeze-protocol-sha256:5626601a5b3e7b904341c813739f2b64c2303ad2136b532cac796b7e4793c12a`
and model reference
`freeze-model-scope-sha256:6195842bbfffe94e640963a13284bc1c0cd87889e2c0d79205fc88e53741df6c`.
An exact repeat is identical. Changing only model-resolution evidence changes
only model scope; changing only seed-policy evidence changes only protocol
scope. A mismatched scope object fails closed. Focused validation passes 27
tests and 90 assertions plus TypeScript, formatting, and whitespace.

This removes free-text scope from the positive policy path without adding a
second manifest format. It still does not authenticate a caller-supplied scope
result or reverify a freeze bundle inside the policy binder. The current CLI
does not accept a freeze-bundle root, so no production-shaped positive policy
can silently bypass the gap; the retained 0.0006 record remains
`not-established`. GitHub/local code was selected; public GitHub, arXiv, and
Reddit made zero requests. The five accepted reviewer refs remained unchanged
and nine standing reconciliation commits remained contained at
`2026-09-03T01:46:01.155Z–01:46:01.227Z`.

Confidence is high for canonical hashing, factor-specific matched controls,
fail-closed composition, and local tests; low for real freeze availability,
provider identity, approval, cost, and drift. The next ranked investigation is
to let the CLI accept one explicit freeze-bundle root, descriptor-safely verify
it, and pass only the derived scope into policy selection, while preserving the
provider-call denial and keeping the non-applicable retained record closed.

## Cycle 107 explicit freeze-bundle selection boundary

Seed reconciliation `ebcbb0589913b6a4bad40d2fad592e35abbdb45d`
preceded this work. The saved target retained its login-class semantic
fingerprint, login wall, 46,672-byte length, and zero attributable items; only
its body SHA changed. Added and changed IDs remain unknown, observed removals
are `[]`, and all 132 durable seeds remain unavailable. GitHub, arXiv, and
Reddit made zero public requests.

Exact local `dcc15ee0f138e14e717c754b98b35a9881411e76` makes the
actual frontier entry point derive scope instead of accepting it from its
caller. A policy-bearing invocation now requires an explicit freeze-bundle root
in addition to the policy JSON, provenance manifest JSON, and evidence root.
The adapter verifies the freeze through the existing pinned no-follow
descriptor path and passes only a successful derived protocol/model scope to
the local-record selector. Failed freeze verification cannot reach the
positive policy path, and no branch authorizes provider calls.

The positive regression combines the canonical one-model/two-seed toy freeze
with a byte- and content-matching decision record. It returns freeze status
`ok`, `providerCallsAuthorized: false`, both derived scope hashes, both local
evidence-match statuses, and the equal-172 point at 1,032 blocks and 33,024
episodes. A relative freeze root returns exact error `bundle root must be an
explicit absolute path` with no selection. A separately valid policy/record
whose model-scope hash differs from the verified freeze returns exact error `a
matching verified freeze policy scope is required for applicability` with no
selection. Focused validation passes 18 tests and 45 assertions plus
TypeScript, formatting, and whitespace.

This proves descriptor-safe local composition for one synthetic fixture. It
does not authenticate the freeze's external registration, model resolution,
owner, revision, timestamp, independent evidence, real drift, cost, or provider
behavior. No real execution freeze is retained, and the illustrative 0.0006
decision record remains `not-established`; this change does not promote it.
Confidence is high for the local success and denial controls and low for every
real operating-policy claim.

The local accepted-result check at
`2026-09-03T01:53:24.485Z–01:53:24.571Z` found all nine standing reconciliation
commits contained and the four accepted self-evolution artifacts byte-identical
to `df80a1da`. Public GitHub retains its four exact named heads, arXiv retains
MemGauge `2608.30177v1` at 15/15 and the allocation study `2608.25553v3` at
14/15, and Reddit remains last known RSS-readable/JSON-403; none had a revision,
artifact, replication, content, access, or readable-seed trigger.

The next ranked investigation is a process-level CLI control using an explicit
goal-owned freeze and decision fixture. It should confirm that the executable's
serialized result preserves freeze verification, local-record evidence,
selection denial, and zero provider authority rather than relying only on an
in-process adapter test.

## Cycle 108 executable-boundary audit

Seed reconciliation `9e2491100e4197bc2cc527e8c02faab6d71da8be`
preceded this audit. The saved target remained a 46,672-byte login shell with
the same semantic access fingerprint and zero attributable items; only its body
SHA changed. Added and changed IDs remain unknown, removals are `[]`, and all
132 durable seeds remain unavailable. GitHub, arXiv, and Reddit made zero
public requests.

The actual frontier executable ran on that exact tip from
`2026-09-03T01:59:00.357Z` through `02:07:28.843Z`. It took 8m28.496s to
regenerate the 193 exact rows and 508 nondominated points. Its 11,363-byte JSON
has SHA-256 `2187ab202f866cc839af2ab78a24f39f92e9d91cacdf6083007d797da3d6a613`.
The established row and result hashes reproduced as
`6fac7f99c1159798c211016ad2ec0cbd464c7c95ae56cf324a6000028dd38252` and
`383a699f69ef92bdc1f5edd0941d03ba4e411cdfe22adf2f4b4e07257c2b8fff`.

The no-argument process returned `freezeVerification: null`, no selected point,
and exact error `exactly one explicit frontier policy with evidence is
required`. It also reproduced the 1,029-block robust minimum and all-256
endpoint. This proves the real executable does not silently choose a frontier
point when its policy inputs are absent.

The process audit does not prove the positive path for a real freeze because no
real freeze is retained. The synthetic in-process regression already proves
valid descriptor-safe composition, invalid-root denial, scope-mismatch denial,
and `providerCallsAuthorized: false`. Repeating the exhaustive executable for
each synthetic control would cost about 8.5 minutes per case, while a hidden
test bypass would weaken the same boundary under test. Confidence is high for
deterministic process regeneration and fail-closed output, and low for real
freeze availability, external registration, model resolution, operating
policy, provider behavior, cost, and drift.

The accepted-result check at
`2026-09-03T02:08:10.128Z–02:08:10.218Z` found all nine standing reconciliation
commits contained and all four accepted self-evolution artifacts byte-identical
to `df80a1da`. No accepted result is known unintegrated.

The next ranked investigation is a byte-bound reusable frontier snapshot that
must reproduce the exact row/result hashes and all 508 points before selection.
It should make positive process controls practical while rejecting missing,
stale, or tampered bytes and must not confer policy or provider authority.

## Cycle 109 byte-bound frontier snapshot

Seed reconciliation `1eac5ae21354e22bbfaebe2fa83bd0b08c781231`
preceded this work. The saved target retained the login-class semantic
fingerprint, 46,672-byte length, login wall, and zero attributable items; only
its body SHA changed. Added and changed IDs remain unknown, removals are `[]`,
and all 132 durable seeds remain unavailable. GitHub, arXiv, and Reddit made
zero public requests.

Exact local `8cf88b8f5ddd437da5e61a8bdf442f99b138d093` adds a
versioned offline frontier snapshot. It records the exact row SHA-256, result
SHA-256, canonical frontier SHA-256, all ordered points, a fixed generator
reference, and `providerCallsAuthorized: false`. The exhaustive generator now
constructs this snapshot and refuses output unless it matches the retained
193-row, 508-point computation identity.

The full candidate run from `2026-09-03T02:13:31.043Z` through
`02:21:41.445Z` took 8m10.407s. It reproduced row hash
`6fac7f99c1159798c211016ad2ec0cbd464c7c95ae56cf324a6000028dd38252`,
result hash `383a699f69ef92bdc1f5edd0941d03ba4e411cdfe22adf2f4b4e07257c2b8fff`,
508 points, and frontier hash
`067201a66252a39d1deb6a6189783137921b6610ac8b2d35acbea38d5b4530ef`.
The 203,712-byte wrapper output has SHA-256
`201b45553a4d4056fcf844d30769dc2eff385176991540f28faef9449da7ad65`.

The extracted 116,578-byte snapshot has outer SHA-256
`8bee6076d46161948059e6eddedb5f448431f1c65ec040146fd812e23aedae76`.
Its explicit descriptor-safe load returned the same three inner hashes, all 508
points, local byte-match status, and provider denial. Focused tests reject an
outer byte mismatch before parsing, an inner point mutation under a stale hash,
a fully re-hashed wrong frontier against the retained computation, malformed
structure, and added provider authority. Eleven tests and 27 assertions pass
with TypeScript, formatting, and whitespace.

This proves repeatable local computation identity and one pinned local byte
read. It does not authenticate the generator revision, author, timestamp,
policy approval, real marginal drift, cost, model identity, external
registration, or provider behavior. No real snapshot or execution freeze is
retained as operating evidence, and the illustrative 0.0006 policy remains
`not-established`. Confidence is high for exact local integrity and failure
controls and low for all substantive transfer.

The local accepted-result check at
`2026-09-03T02:22:58.098Z–02:22:58.188Z` found all nine standing reconciliation
commits contained and all four accepted self-evolution artifacts byte-identical
to `df80a1da`. Nothing accepted is known unintegrated.

The next ranked investigation is a fast CLI mode that requires an explicit
snapshot root, canonical relative artifact name, and expected outer SHA-256.
It must verify the retained computation before passing its frontier to the
existing freeze/decision selector, reject missing or tampered bytes, and never
authorize provider calls.

## Cycle 110 snapshot-backed fast selection

Seed reconciliation `5bd90ec78e8f05c82ec85a19c53f02424cff21ff`
preceded this work. The saved surface retained the same login-class semantic
fingerprint and zero attributable items; only its body SHA changed. Added and
changed IDs remain unknown, removals are `[]`, and all 132 durable seeds remain
unavailable. GitHub, arXiv, and Reddit made zero public requests.

Exact local `cab0d65a17d2de7decd463707335d6b62991764b` adds an
explicit `snapshot` CLI mode. Its ordered inputs name the snapshot root,
canonical relative artifact, expected outer SHA-256, policy JSON, evidence
manifest JSON, evidence root, and freeze root. It descriptor-safely loads the
retained 508-point computation first and returns no freeze result or selection
when that step fails. A positive integration fixture then proves that a valid
snapshot proceeds through freeze scope, local decision byte/content checks,
and the equal-172 selection without authorizing provider calls.

Two actual process controls avoid the 8-minute computation. The valid retained
snapshot loaded in 38 ms; a deliberately relative freeze root then failed at
exact error `bundle root must be an explicit absolute path`, with selection
false and provider authority false. Replacing only the expected outer hash
loaded in 32 ms, failed with `local evidence bytes do not match the declared
SHA-256`, and left freeze and selection unattempted. This distinguishes cache
failure from downstream freeze failure.

The initial success-path diagnostic was 209,109 bytes because it serialized all
508 verified points again. Follow-up `b45d8450a2609fbee79947331d745a56d7d8f52b`
keeps those points internal and emits only snapshot schema, evidence class,
generator reference, three hashes, point count, and provider denial before the
freeze/selection result. The compact 2,070-byte output has SHA-256
`f54c64367939322bf509ede8454e86e5e6a625037638baddd0c3ef41cdb6cff3`,
a 99.01% reduction. Focused validation passes 24 tests and 57 assertions plus
TypeScript, formatting, and whitespace.

This proves fast local integrity composition, ordered short-circuiting, and
compact diagnostics. It does not prove a positive real policy because the
library retains no real freeze or applicable decision. It also does not yet
bind the policy decision record to the exact frontier hash; the executable's
retained expectation supplies a current code-level boundary, not decision
provenance. Confidence is high for local behavior and low for approval, real
drift, cost, model identity, external registration, and provider transfer.

The accepted-result check at
`2026-09-03T02:29:45.729Z–02:29:45.798Z` found all nine standing reconciliation
commits contained and all four self-evolution artifacts byte-identical to
`df80a1da`. Nothing accepted is known unintegrated.

The next ranked investigation is a matched cross-snapshot substitution: hold
the freeze and decision evidence fixed while changing the exact frontier
identity. If the current decision provenance cannot distinguish that
substitution, bind the frontier reference in the smallest schema-backed way
without promoting local integrity into authority.

## Cycle 111 cross-snapshot substitution control

Seed reconciliation `b470c35c6e82557186a41743782437ce0e3e15b8`
preceded this control. The saved surface retained the login-class semantic
fingerprint, login wall, 46,672-byte length, and zero attributable items; only
its body SHA changed. Added and changed IDs remain unknown, removals are `[]`,
and all 132 durable seeds remain unavailable. GitHub, arXiv, and Reddit made
zero public requests.

The matched fixture kept the freeze bundle, policy object, provenance
manifest, local decision bytes, and evidence roots unchanged. It modified one
frontier point's reserve, then recomputed both the frontier hash and outer file
hash so the substitute remained internally consistent. Exact local
`2e3aae4473b370714be579ff7bd81e6a90bfebbd` verifies the current behavior:
the retained expectation rejects the substitute with `frontier snapshot does
not match the expected computation`; freeze verification is never attempted,
no selection is returned, and provider authority remains false.

This supports the code-level snapshot identity as a current-revision boundary
and contradicts adding a decision-record field solely for same-revision
substitution: that path is already closed before policy evidence is evaluated.
Focused validation passes 12 tests and 35 assertions plus TypeScript,
formatting, and whitespace.

The evidence is narrower than a durable provenance conclusion. The snapshot
expectation is supplied by the executable revision, while the policy decision
record does not name it. A future revision that intentionally updates the
expectation could therefore have a different transfer boundary. Confidence is
high for current substitution denial and low for cross-version policy rollover,
real freeze availability, approval, drift, cost, model identity, and provider
behavior.

The accepted-result check at
`2026-09-03T02:34:23.125Z–02:34:23.201Z` found all nine standing reconciliation
commits contained and all four accepted self-evolution artifacts byte-identical
to `df80a1da`. Nothing accepted is known unintegrated.

The next ranked investigation is a version-rollover control that changes only
the expected snapshot identity while holding the old policy evidence fixed. A
schema change is justified only if that old evidence silently authorizes the
new computation.

## Cycle 112 version-rollover control

Seed commit `38d308306a874eb8386c829f8d9fec8c3093a5b6` preceded this
control. Semantic XHS access remained unchanged: public Explore exposed 30
notes, while the saved target was an HTTP-200 login shell with zero attributable
items. Added and changed IDs remain unknown, removals are `[]`, and all 132
durable seeds remain unavailable. GitHub, arXiv, and Reddit made zero public
requests.

The matched pre-fix fixture held the freeze, policy, manifest, decision bytes,
and evidence roots fixed while changing the accepted snapshot from identity
`4176d7766cebc51d2848fa07d870d6727c0c59f5cdd81762d7f095a5a5488471`
to `1b7734c1c00269e96cf21d1d1e3295f360c60623390d7b8948c7fa61c1110fe5`.
The old evidence still selected equal 172 from the new snapshot with policy
hash `fb19ef3…472f0a`, manifest hash `038df2d…8e60aa`, and decision hash
`5a5acf9…0868cd`. Snapshot/freeze verification and selection were true;
provider authority was false.

Exact implementation `418fdb03b92c323058485458e800c489696f66f5` binds a
derived row/result/frontier/count snapshot reference into policy applicability,
the provenance manifest, and the descriptor-safe local decision record.
Snapshot selection supplies the verified reference; a stale reference now
fails closed before selection. A caller that does not use a snapshot remains
compatible and cannot claim a snapshot reference it did not verify.

Focused validation passes 12 tests and 48 assertions, TypeScript, formatting,
and whitespace. The evidence is exact for this fixture but does not authenticate
policy authority, freshness, real drift, cost, models, or providers. The next
ranked control is process-level: use the retained snapshot with a newly bound
decision record, then substitute a stale reference without regenerating the
frontier.

## Cycle 113 retained-snapshot process control

Seed commit `153dfd496168335538d6927c4ea6cb814e8d9f49` preceded this
control. The saved XHS target remained a login shell with zero attributable
items; no public source request was made.

The actual CLI loaded the retained 116,578-byte snapshot at outer SHA
`8bee6076d46161948059e6eddedb5f448431f1c65ec040146fd812e23aedae76`
and derived snapshot reference `frontier-snapshot-sha256:07bdf16be7c4cf46bb04f726ebd80fef9451d301c722df467430a31d791dc8c1`.
A matching local decision selected `[172,172,172,172,172,172]` at 1,032
blocks. Replacing only that reference with 64 zeroes left snapshot and freeze
verification true but returned no selection. Provider authority was false in
both outputs. The one process test passed six assertions in 107 ms and its
temporary external-artifact harness was removed afterward.

This verifies the retained fast path after the Cycle 112 schema change. It
does not validate the synthetic freeze, decision authority, drift threshold,
cost, models, or providers. The next ranked control is whether a direct
freeze-only caller can inject a snapshot reference without having verified a
snapshot; if so, the verified adapter must own scope construction.

## Cycle 114 call-path authority control

Seed commit `a36cdf1cef8d76f004869ab95ac46afe81f274ba` preceded this
control. XHS semantic access remained unchanged, all 132 durable seeds were
unavailable, and no public lane request was made.

Before the fix, the public freeze-only adapter accepted a caller-provided
snapshot reference. When the synthetic local decision repeated the arbitrary
value, freeze verification and selection both succeeded without any snapshot
read. Exact implementation `72e925bff6e7c76c2c97331f5762413926dab5e1`
removes that argument: only the snapshot adapter can derive combined scope, and
only after both snapshot and freeze verification. The matched direct call now
fails closed; snapshot-backed selection and ordinary freeze-only selection
retain their prior behavior.

Focused validation passes 13 tests and 51 assertions, TypeScript, formatting,
and whitespace. This proves call-path containment for the local implementation,
not decision authority or real provider readiness. The next ranked control is
whether compact output explicitly preserves the matched snapshot reference or
requires reopening the decision record to reconstruct that relation.

## Cycle 115 compact-output auditability control

Seed commit `18703e0919e4ba5b4af1510b7aa6808274bf1e05` preceded this
control. XHS semantic access remained unchanged, all 132 durable seeds were
unavailable, and GitHub, arXiv, and Reddit made zero public requests.

The matched pre-fix fixture loaded a byte- and computation-matched snapshot,
verified the freeze and local decision record, selected equal 172, and denied
provider calls. Its compact summary omitted the exact derived snapshot
reference even though it exposed the component hashes and point count. The
failed expectation named
`frontier-snapshot-sha256:4176d7766cebc51d2848fa07d870d6727c0c59f5cdd81762d7f095a5a5488471`.

Exact local `26a29696ce29b23729cf8ab2d32241e7eb9b312a` adds the derived
reference to the compact verified-snapshot object. It does not serialize the
full frontier or change provider authority. Focused validation passes 10 tests
and 31 assertions plus TypeScript, formatting, and whitespace checks. This
supports local result auditability; it does not authenticate policy authority,
snapshot freshness, real drift, cost, models, or providers.

The full candidate gate passes syntax, TypeScript, formatting, 180 tests with
890 assertions, whitespace, and 21 relative links. Read-only health remains at
26 facts and 16 wake signals, runtime `.state` is empty, accepted containment is
9/9 standing ancestors plus 4/4 artifact blobs, and both protected checkout
fingerprints are unchanged.

The next ranked control is process-level: exercise actual CLI serialization
against a snapshot-bound fixture and preserve a stale-reference denial control.

## Cycle 116 retained-snapshot CLI serialization

Seed commit `feaff4a171f3c353070578650f2ca1545cb63924` preceded this
control. XHS semantic access remained unchanged, all 132 durable seeds were
unavailable, and no public lane request was made.

The actual CLI loaded the retained 116,578-byte, 508-point snapshot. Its
matching 3,229-byte JSON exposed exact reference
`frontier-snapshot-sha256:07bdf16be7c4cf46bb04f726ebd80fef9451d301c722df467430a31d791dc8c1`,
reported snapshot and freeze verification true, selected equal 172, omitted the
frontier body, and denied provider calls. A 2,705-byte matched control changed
only the decision/manifest reference to 64 zeroes; snapshot and freeze remained
verified, selection returned false with null data and the exact scope-mismatch
error, and provider calls remained denied. The bounded process ran from
`2026-09-03T03:12:54.566Z` through `03:12:54.723Z`; its temporary synthetic
freeze, evidence, and harness were removed.

This supports actual serialized-output auditability and stale-reference denial,
not policy authority, snapshot freshness, real drift, cost, models, or
providers. The next ranked control is whether the compact success output makes
the matched protocol and model scope equally explicit.

## Cycle 117 freeze-scope output contract

Seed commit `27f0c6ce51fa9c9f9764730e741ef2682aced8c5` preceded this
control. XHS semantic access remained unchanged; the login shell changed by one
byte but exposed no attributable item, all 132 seeds remained unavailable, and
no public lane request was made.

The existing compact success object preserved the exact derived protocol and
model-scope references under its verified freeze result. Exact test-only commit
`8345ba5311f167cf2097ba36edf17121b0edeb43` locks both object and
serialized-JSON visibility while retaining the no-frontier assertion. Focused
validation passes 10 tests and 34 assertions plus TypeScript, formatting, and
whitespace.

No production field was added because the behavior was already supported. This
proves local output structure, not external registration authenticity, policy
authority, real drift, cost, models, or providers. The next ranked control is
whether the freeze's `verified` registration label overstates a purely local
byte-binding check for an arbitrary unreachable HTTPS target.

## Cycle 118 registration-evidence qualification

Seed commit `6ad703e586b6b3d73eeab977530796814ed3d616` preceded this
control. XHS semantic access remained unchanged; the saved login shell returned
to 46,672 bytes with a new body hash, exposed no attributable item, and left all
132 seeds unavailable. No public lane request was made.

The pre-fix fixture pointed at reserved, unreachable
`https://example.invalid/scout-freeze/fixture`, declared registration status
`verified`, and returned overall success from local structural and byte checks.
No external URL, timestamp service, signature authority, model, or provider was
contacted. Exact local `5e5281c55433e119b78368b0053594858671c5a5`
adds result field `externalRegistrationEvidenceStatus`: successful local
bindings are `local-byte-match-unverified`, while failed bundle paths expose an
empty status. Provider authority remains false.

Focused validation passes 22 tests and 79 assertions plus TypeScript,
formatting, and whitespace. This corrects result semantics without promoting
the declaration. The next ranked control is cross-registration substitution:
hold protocol/model/snapshot/decision evidence fixed, change only registration
identity, and see whether the same policy scope remains applicable.

## Cycle 119 cross-registration substitution

Seed commit `c5a55a42f3db767d07ffb6d7fc34fb21caef7f2d` preceded this
control. XHS semantic access remained unchanged, all 132 durable seeds remained
unavailable, and no public lane request was made.

Matched controls held every protocol, model, seed, artifact byte, frontier,
policy, manifest, and local decision field fixed while changing only the
reserved registration URL, identifier, and deposit timestamp. Both results
remained `local-byte-match-unverified`, their derived protocol/model scopes were
identical, and the old decision still selected equal 172 with provider authority
false. Exact test-only commit
`28a3164bbbcf68cf8b1477d71b25aaf9725d4a46` preserves the direct and
end-to-end results.

Focused validation passes 23 tests and 98 assertions plus TypeScript,
formatting, and whitespace. The conclusion is qualified: unverified deposit
metadata is provenance, not policy applicability, so no production scope field
was added. The next ranked control changes registered execution-bundle bytes
instead; unlike metadata, executable content may affect what the decision
actually authorizes.

## Cycle 120 execution-bundle substitution

Seed commit `3404c2dedc790459ed9ca2cfcfe3cbd0bf89ad60` preceded this
control. XHS semantic access and byte length remained unchanged, all 132
durable seeds remained unavailable, and no public lane request was made.

The pre-fix matched freeze-only control changed only `bundle.zip` bytes and
the corresponding artifact and registration digests. The freeze still verified
locally, protocol/model scope remained exactly
`5626601a5b3e7b904341c813739f2b64c2303ad2136b532cac796b7e4793c12a` /
`2c43a39dcf1489eee08ccc8cc037dc866e4136cdd6c701af8129c14c0363f1d7`,
and old local decision `5a5acf9a38d31f39df6c8e1ad5405e4517332ddba5edc555d46e66c64d0868cd`
still selected equal 172. This contradicted the expected meaning of a frozen
execution protocol; provider authority remained false.

Exact repair `74ca45c79e5437918ee70df4b472025a3555ee86` incorporates the
locally verified registered artifact name and digest into protocol-scope
derivation. The persistent regression strengthens the control through the
snapshot adapter: snapshot, schedule, model, seed, frontier, policy, and local
decision record
`e720e0dcbcac4fdc1d946c83e16f400f9bb99698ef7e0bc009de7a9f632aafe8`
remain fixed. The baseline selects equal 172; the substituted bundle passes
local freeze and snapshot verification but the old decision is rejected for a
combined-scope mismatch. Changing only unverified registration identity still
preserves scope and selection.

Focused validation passes 17 tests and 80 assertions plus TypeScript,
formatting, and whitespace. This proves local factor separation and stale-
decision denial, not external registration, executable authenticity, policy
authority, real execution, drift, prices, model behavior, or provider
readiness. The next ranked control checks whether the opaque checksum-manifest
artifact actually binds the execution bundle it purports to describe.

## Cycle 121 checksum-manifest coherence

Seed commit `62c465ca99139affdd5d74c5a60b39815caa78ed` preceded this
control. XHS semantic access and byte length remained unchanged, all 132
durable seeds remained unavailable, and no public lane request was made.

The prior accepted fixture paired bundle SHA-256
`fd01710b5ef211e073b7dda564f30925cca256e4ff9b7ea7bd2fd49e672ecdae`
with opaque checksum-manifest bytes whose unrelated SHA-256 was
`46a3429c1b6283935a142b86bff9d077229d06e2a41ac441f092487115698c88`.
Both declarations were locally byte-consistent, so the freeze passed even
though the checksum artifact did not name or digest the bundle.

Exact repair `fff100583e82a8fa9aea4ebb133f5c01e9451e69` requires exactly one
standard SHA-256 entry whose filename and digest equal the registered artifact
binding. Opaque text and a zero-digest contradiction now fail with
`external registration checksum manifest does not bind its artifact` and no
registration-evidence status. A coherent replacement manifest still allows
the Cycle 120 bundle-substitution control to reach the intended stale-policy
denial.

Focused validation passes 26 tests and 102 assertions plus TypeScript,
formatting, and whitespace. The result proves a local checksum relationship,
not timestamp-proof validity, external deposit, authorship, policy authority,
real execution, drift, prices, model behavior, or provider readiness. The next
ranked control changes the registered artifact name while preserving identical
bytes and all other decision inputs to test executable entry-point identity.

## Cycle 122 same-byte artifact aliasing

Seed commit `eac393d7d8f7369474d05531e0d50952a92379e6` preceded this
control. XHS semantic access remained unchanged; the saved login shell changed
by two bytes and body hash but exposed no attributable item. All 132 durable
seeds remained unavailable, and no public lane request was made.

The snapshot-bound control retained exact bundle SHA-256
`fd01710b5ef211e073b7dda564f30925cca256e4ff9b7ea7bd2fd49e672ecdae`
and changed only its registered filename from `bundle.zip` to
`aliased-bundle.zip`, with a coherent checksum-manifest update. Schedule,
models, seeds, frontier, snapshot, policy, and local decision evidence stayed
fixed. Baseline selection returned equal 172. The alias still passed local
snapshot/freeze checks, but protocol scope changed while model scope did not,
so the old decision failed the combined-scope match. Provider authority stayed
false.

Exact test-only `1170e6698775771778409518445a044df30a7879` records the
result. No production edit was needed because the Cycle 120 scope derivation
already binds artifact name and digest. Focused validation passes 9 tests and
44 assertions plus TypeScript, formatting, and whitespace. This proves a local
entry-point identity distinction, not external registration, timestamp-proof
validity, policy authority, real execution, drift, prices, model behavior, or
provider readiness. The next ranked control isolates timestamp-proof bytes
from executable policy scope.

## Cycle 123 timestamp-proof separation

Seed commit `75507eabeff67dc47c1c4f01095184bf1a05be5f` preceded this
control. XHS semantic access remained unchanged; the saved login shell changed
by two bytes and body hash but exposed no attributable item. All 132 durable
seeds remained unavailable, and no public lane request was made.

Exact test-only commit
`5df12fad1c66c2dddea5b7cd3d2ee1fd28f494a5` changed only the
`MANIFEST.sha256.ots` bytes and the corresponding local artifact digest. The
proof SHA-256 changed from
`90b8453eb4ad5b97194fa6168b3c151f992a8d9b358ec122d084d61b21e3f994`
to `97296f89af73fbd23ebf1f10fb872a949ab1b0073ee7525c4a02bf0fb79e133e`.
Execution artifact identity, checksum manifest, schedule, models, seeds,
frontier, snapshot, policy, and decision evidence remained fixed.

Both paths selected equal 172 and returned exact decision SHA-256
`e720e0dcbcac4fdc1d946c83e16f400f9bb99698ef7e0bc009de7a9f632aafe8`.
Protocol and model scopes stayed equal, both local registrations remained
`local-byte-match-unverified`, and provider authority remained false. Focused
validation passes 10 tests and 49 assertions plus source formatting.

This supports local factor separation: opaque timestamp-proof bytes do not
change the execution policy. It does not validate either proof, bind it
semantically to the checksum manifest, authenticate an external timestamp,
identify an owner, or prove a deposit. The next ranked control tests the
proof-to-manifest coherence boundary while preserving the explicit unverified
evidence class.

## Cycle 124 proof-presence disclosure

Seed commit `9dda9c28ba1f13f536a1fa33b57feb7937485e92` preceded this
control. XHS semantic access and byte length were unchanged, all 132 durable
seeds remained unavailable, and no public lane request was made.

The matched fixture replaced `MANIFEST.sha256.ots` with literal
`not an OpenTimestamps proof` and updated only its declared local SHA-256. The
pre-fix verifier returned `ok: true`, registration status
`local-byte-match-unverified`, and provider authority false without a
proof-specific result. The regression therefore failed one of 11 tests because
the expected qualification was absent.

Exact local `a358ee349934b6702c6d21efde69a401e73cfe1c` adds a separate
`timestampProofEvidenceStatus`. Locally digest-matched bytes return
`local-byte-presence-unverified`; bundle load failures return an empty value.
The verifier still does not parse OpenTimestamps, bind the proof semantically
to `MANIFEST.sha256`, contact a calendar, or authenticate the declared deposit.
Three focused suites pass 29 tests and 115 assertions plus TypeScript, source
formatting, and whitespace.

This resolves the output ambiguity without promoting local evidence. The next
ranked control tests whether the registration status itself is correctly gated
by earlier artifact integrity errors rather than only registration-specific
checks.

## Cycle 125 registration-status gating

Seed commit `8882edfb1167e4554a554beeb6466a439db50514` preceded this
control. XHS semantic access and byte length remained unchanged, all 132
durable seeds remained unavailable, and no public lane request was made.

The matched invalid fixture preserved registration metadata and its coherent
checksum relation while tampering `schedule.json`, omitting `seed-policy.md`,
and adding `undeclared.txt`. Before repair, the verifier returned `ok: false`
with the expected integrity errors but still emitted
`externalRegistrationEvidenceStatus: local-byte-match-unverified`. The
regression failed one of 11 tests on that exact received value.

Exact local `c0377631e478404018913bf346f2e2e3046242c4` now emits the
positive registration status only when the complete freeze has no errors. The
invalid fixture returns an empty status; valid local fixtures retain the
explicitly unverified status. Three focused suites pass 29 tests and 116
assertions plus TypeScript, source formatting, and whitespace.

This removes a contradictory positive label without authenticating external
registration. The next ranked control maps overall validity, registration
evidence, and proof-byte presence across proof-specific and unrelated
integrity failures before any further schema decision.

## Cycle 126 evidence-status matrix

Seed commit `3fcff78042c06b2ec5e21ba09c5a4fb6070d7890` preceded exact
test-only commit `441064d354314ad28a95a5b8dde3730ec1a3a0c3`. Five matched cases
now pin the result contract:

- a valid local bundle reports overall validity, locally matched unverified
  registration, and locally present unverified proof bytes;
- an unrelated schedule mismatch clears overall validity and registration but
  preserves the independent proof-byte presence fact; and
- proof digest mismatch, missing proof bytes, or undeclared proof bytes clear
  both proof and registration statuses.

Provider authority remains false throughout. Focused validation passes 12
tests and 61 assertions plus TypeScript and source formatting. No production
change was needed after Cycle 125's complete-error gate.

This proves local status composition, not proof validity or target identity.
The next ranked control asks whether the schema identifies the checksum
manifest as the proof target before any cryptographic verification is added.

## Cycle 127 proof-target identity

Seed commit `d473e5a04f4da1bd9a535f92d15264d9f2355d09` preceded the
matched control. XHS semantic access and byte length remained unchanged, all
132 durable seeds remained unavailable, and no public lane request was made.

A locally valid freeze declared `schedule.json` and its digest as the detached
proof target. Before repair, the verifier ignored those target fields and
returned `ok: true`; the new expectation yielded 12 passing tests and one
failure across the 13-test focused suite.

Exact local `c190ba8e2af7c821c419c7b8717c6329c2afe9d6` adds required
`proofTargetArtifact` and `proofTargetSha256` bindings. They must equal the
registered checksum manifest artifact and digest. The schedule-target control
now fails with a stable proof-target error and no registration status. Three
focused suites pass 31 tests and 129 assertions plus TypeScript, formatting,
and whitespace.

This proves declared target identity only. It does not parse the proof or
authenticate a timestamp. The next ranked investigation inspects retained
proof bytes and the available local verifier/tool boundary before any parser
or stronger evidence status is proposed.

## Cycle 128 retained proof and verifier boundary

Seed commit `259eedf1a3938fdc442283912609d30e918b0d45` preceded this
read-only audit. The retained source is
`/tmp/g-c1b31972-arxiv-2608.25553/paper2-data-and-code-v3.zip`, one of two
locally retained copies previously shown byte-identical. From
`2026-09-03T04:27:56.908Z–04:27:58.028Z`, the 61,508,909-byte ZIP passed
`unzip -tqq` and reproduced published SHA-256
`41ca426998db106d041f85c8eb1fb2f2cfd692615b98160952d32d3877a63138`.

The Experiment C proof chain has two distinct local targets:

| Target | Target bytes / SHA-256 | Proof bytes / SHA-256 | Direct byte observation |
| ------ | --------------------- | -------------------- | ----------------------- |
| `preregistration/MANIFEST.sha256` | 12,987 / `cb6e7c8d6b897a1afb605a52d4fc49a5067d41540f5089286e56060c0dab6225` | 945 / `5d0097b0c1324a441ba74ead2c0ac5b70a70cf44543d4feec7c86d4e5a45a4fe` | OpenTimestamps magic header; target digest bytes after the header/tag prefix; four public calendar strings |
| `preregistration/DEV_REGISTRATION.sha256` | 86 / `c9893d8da0f7fcc07d549e97b2cac57bb69a5410528ce14ea6c4403304b55dba` | 595 / `e171588711ae1c7e152d02bcc52312b7d4e93776e90b5f3035b09521cabad568` | OpenTimestamps magic header; target digest bytes after the header/tag prefix; four public calendar strings |

The 86-byte development target contains the SHA-256 and filename of the
5,696-byte `DEV_REGISTRATION.md`; that Markdown member reproduces SHA-256
`3f24266a249956ce656e470952fec20087ecb3904f8e06db8906afd6189f589e`.
This is a development-call registration and is not a proof of Scout's proposed
schedule. The manifest proof concerns Experiment C's 103-entry source package,
not a real Scout freeze.

The current execution identity is UID 1000 (`hao`) in the goal-owned worktree.
It has no `ots` or `opentimestamps` executable and no Python
`opentimestamps`/`opentimestamps_client` module. An exact
`ots info <retained-proof>` attempt fails locally with
`/bin/bash: ots: command not found`. No tracked Scout file is an `.ots` proof
and no Scout dependency supplies a verifier. The source freeze script requires
an external `ots` client to stamp a manifest, while the source runner's runtime
gate only checks that the named proof exists and is non-empty. Source
`EXTERNAL_REGISTRATION.json` says `VERIFIED` and records an OSF download-back
match; the source results report repeats that label. These are source claims,
not an independent result produced by this worker.

Magic bytes, an embedded matching digest, calendar strings, and a source label
do not establish proof syntax, calendar receipt, Bitcoin inclusion, deposit
authority, authorship, or temporal ordering. The existing Scout status
`local-byte-presence-unverified` is therefore the strongest supported state and
no production change is warranted. The next bounded question is whether a
future external-verifier result can be byte- and target-bound without trusting
a free-form caller status or conflating cryptographic time evidence with
provider/deposit authority.

## Cycle 129 caller-claim injection denial

Seed commit `debf7ad7dbec3b246c53a2748476c152cbc7532c` preceded this
matched control. A valid local freeze retained identical artifact, schedule,
model, seed, checksum-manifest, proof-target, and proof bytes. The only changes
were caller-supplied top-level fields
`timestampVerificationStatus: "verified"` and `providerAuthority: true`, plus
external-registration field
`verifierResult: "Bitcoin timestamp verified"`. Before repair,
`verifyExecutionFreezeManifest` returned `ok: true`. Its own evidence outputs
remained explicitly unverified and provider-denied, but accepting a v1 manifest
that carries unsupported authority claims left two interpretations in the same
object.

Exact repair `821a085b7db863364040c30bb7ee1189f44f391c` rejects unknown keys
at the top-level v1 manifest and external-registration boundaries. The control
now reports both stable unsupported-field errors, clears registration evidence,
retains the independently true `local-byte-presence-unverified` proof fact, and
keeps `providerCallsAuthorized: false`. The same verifier is used by direct,
descriptor-safe bundle, and frontier-selection paths, so the focused three-
suite gate exercises all current consumers: 32 tests and 135 assertions pass,
along with TypeScript, focused formatting, and whitespace.

This denies the tested in-band free-form claims; it does not establish a
positive verification protocol. No positive status should be added until a
primary, versioned verifier-output grammar and verifier identity can be bound
to exact proof bytes, target bytes, and output bytes without conflating
cryptographic time evidence with deposit, author, provider, call, or spending
authority.

## Cycle 130 retained verifier-output contract audit

Seed commit `81568ada62d9894b828bf4ba1d1463ec63be16d4` preceded this
read-only audit. The retained source archive has one status adapter that goes
beyond checking proof presence: open-model extension
`scripts/ots_status.py`. The file is 2,922 bytes with SHA-256
`9050d588bdd1c1cd56a0092461dbe25a1bea2dbb4712890d53a8ddc3dcc49795`.
It discovers an unversioned `ots` path, applies `ots upgrade` to copied proof
bytes, then runs `ots info`. It ignores both commands' exit status and stderr
and extracts block heights and calendar URLs from human-readable stdout with
regular expressions. Its own comment says a second block-height form was
added after the first regex missed actual client output.

The resulting 1,143-byte `OTS_STATUS.json` has SHA-256
`0b75f2e66b0c69b7ee8cecdef7042c7f5d0854de80b4a38ccdb161fc8027b722`.
It records source-claimed block numbers, proof paths, and clocks, but no client
identity/version, input proof hash, target hash, upgraded-copy hash, raw stdout
or digest, command exit status, stderr, or verifier identity. The archive's
lock files contain no OpenTimestamps client dependency. This JSON is therefore
a source-generated summary, not a primary, versioned, byte-bound verifier
receipt.

No safe positive receipt schema follows from the retained evidence. A future
contract needs a primary stable output grammar, pinned verifier identity, exact
proof/target/output bindings, explicit command success, and a separate account
of what the cryptographic result does not authorize. Until then Scout retains
only `local-byte-presence-unverified`; no production change is made in this
cycle. The next local control asks whether Cycle 129's v1 unknown-field denial
should extend to nested freeze objects without breaking valid current inputs.

## Cycle 131 nested freeze-manifest exactness

Seed commit `af72a983468257fe20d89382705ede23dc2714de` preceded the
matched control. One valid manifest kept all values and bytes fixed while
adding an undeclared `label` to an artifact, `modelAuthority` to a model,
`randomnessAuthority` to seed policy, and `providerAuthority` to schedule
metadata. Before repair the verifier returned `ok: true`, proving Cycle 129's
top-level and external-registration exactness did not cover the four remaining
nested object types.

Exact repair `2b537f86648e16b52296ff6bbc1e54f9d51597da` reuses the v1
allowlist helper for artifacts, models, seed policy, and schedule metadata. The
control now returns all four stable unsupported-field errors. Registration
evidence clears; local proof-byte presence remains separately and explicitly
unverified; provider authority remains false. Current valid fixtures retain
their prior results.

The focused direct-freeze, descriptor-safe bundle, and frontier-adapter gate
passes 33 tests and 143 assertions plus TypeScript, source formatting, and
whitespace. This closes unknown-field ambiguity across the complete freeze
manifest schema, but not across the independently parsed schedule JSON. The
next local control tests exact top-level and episode object shapes there.

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
