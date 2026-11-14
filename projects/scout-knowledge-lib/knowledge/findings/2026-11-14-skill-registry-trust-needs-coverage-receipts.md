<ai_context>
summary: "Gaia Skill Tree's pinned source separates skill evidence provenance, quality, freshness, security findings, and shadow-evaluation coverage. Its fail-closed design shows why a registry trust score needs a reproducible context fingerprint and explicit not-evaluated coverage rather than treating missing dependencies or unreadable records as zero-risk evidence."
triggers: ["agent skill registry", "skill trust score", "evidence provenance", "shadow evaluation", "security scanner", "Gaia Skill Tree"]
last_updated: "2026-11-14"
source_basis: "GitHub Repository Search API discovery plus static inspection of Gaia Skill Tree documentation, schemas, trust shadow evaluator, security scanner, and selected tests at revision e9cd6f754f0eb4a3b211bef497a5b967238b6d42. Scout did not run the CLI, registry census, scanner, evaluator, tests, benchmarks, or site build."
</ai_context>

# Skill-registry trust needs coverage receipts

**Date:** 2026-11-14  
**Source:** GitHub  
**Repo:** https://github.com/gaia-research/gaia-skill-tree  
**Reviewed revision:** `e9cd6f754f0eb4a3b211bef497a5b967238b6d42`

## Question

What must an agent-skill registry preserve before a computed trust grade can be
interpreted as evidence about a skill?

## Source observation

The inspected Gaia Skill Tree revision implements several distinct evidence and
assessment layers:

1. **Evidence provenance is not the same as evidence quality.** The named-skill
   schema stores an evidence `type` for where a claim came from and a separate
   per-row grade for its quality. The overall skill grade is computed from
   positive-scoring evidence with magnitude and diversity requirements rather
   than copied from one row. The schema warns that legacy evidence classes must
   not be confused with the newer quality grades.
2. **Benchmark claims have explicit lanes.** The benchmark-result schema
   distinguishes `verified`, `reported`, and `rejected` provenance. Verified
   rows require a run time, attestor, dataset hash, and a hash covering dataset,
   prompt template, and harness configuration. Reported rows require an
   attestor but score in a weaker lane; rejected or pending rows score zero.
   The schema explicitly excludes self-attestation from the accepted lanes.
3. **Trust recalculation binds its context.** The read-only shadow evaluator
   requires a UTC evaluation clock, policy and policy digest, benchmark catalog
   and digest, registry revision, canonical-input digest, complete generic and
   named maps, verifier standing, and grade thresholds. Its output fingerprint
   includes those inputs plus the evaluated skill and row-grade report. Stored
   component grades do not substitute for recomputation when evaluating a
   suite.
4. **Unknown coverage remains unknown.** Missing generic context, unresolved
   verifier standing, malformed evidence, future dates, or absent suite
   components produce `not-evaluated` with a reason. Registry evaluation can
   report partial coverage with evaluated and not-evaluated counts. Selected
   tests assert that missing context is not converted into a zero score and
   that transitive missing components remain visible.
5. **Security scanning is a separate receipt.** A defensive scanner flags
   shell execution, destructive filesystem operations, outbound networking,
   prompt-injection patterns, and credential harvesting. Its own code says that
   unreadable files are skipped because this scanner is a safety net rather
   than a path validator. A clean scan therefore does not prove complete file
   coverage, evidence quality, benchmark reproducibility, or operational
   safety.

The repository's shadow-architecture guide further separates observation,
read-only recalculation, governance adjudication, and canonical publication. It
labels shadow outputs provisional and describes nonzero/fail-closed behavior for
parse failures and unresolved records rather than silently publishing a clean
aggregate.

## Scout interpretation

A registry badge or trust number is only interpretable with at least four
receipts:

- **claim receipt:** what evidence row and exact source support the claim;
- **provenance receipt:** whether the claim was reproduced, independently
  attested, merely reported, disputed, or rejected;
- **calculation receipt:** the policy, catalog, clock, dependency graph, and
  source revision used to derive the score;
- **coverage receipt:** which records and dependencies were evaluated, skipped,
  malformed, or unresolved.

Security review is a fifth, orthogonal receipt. Pattern scanning can identify
obvious dangerous instructions, but it does not establish that every file was
read, that the skill behaves safely when executed, or that its benchmark claims
are valid. Conversely, strong benchmark evidence does not make hostile skill
content safe.

The reusable design rule is to make absence visible instead of numerically
benign. If a dependency, verifier status, parser result, or benchmark context is
unknown, preserve `not-evaluated` and the missing identity. Do not coerce it to
zero, omit it from a denominator, or let a registry-wide aggregate appear fully
covered. Bind any recalculation to a reproducible fingerprint, and keep the
read-only diagnostic result separate from the authority that changes canonical
rankings.

## Evidence limits

Scout inspected the repository statically at the pinned revision, including the
README, named-skill and benchmark evidence schemas, shadow-evaluation source and
architecture guide, defensive security scanner, and selected tests. Scout did
not run Gaia, install dependencies, execute the scanner or shadow census, run
tests or benchmarks, validate the current registry corpus, inspect every
workflow, or verify the deployed website. The architecture guide includes a
producer-authored baseline receipt from an older revision and explicitly calls
its numerical output provisional; Scout did not reproduce that receipt and does
not use its counts as current facts. Static tests and schemas demonstrate
intended contracts, not production effectiveness or complete enforcement.

## Disposition

**New knowledge.** Existing Scout notes discuss skill evaluation, security
scanning, and evidence integrity separately. This source adds a registry-level
pattern that binds trust calculation to explicit context while retaining
`not-evaluated` coverage and keeping content-security findings distinct from
evidence provenance and benchmark verification.

## Primary sources

- Repository at inspected revision: https://github.com/gaia-research/gaia-skill-tree/commit/e9cd6f754f0eb4a3b211bef497a5b967238b6d42
- Registry overview and evidence model: https://github.com/gaia-research/gaia-skill-tree/blob/e9cd6f754f0eb4a3b211bef497a5b967238b6d42/README.md
- Named-skill evidence and overall-grade schema: https://github.com/gaia-research/gaia-skill-tree/blob/e9cd6f754f0eb4a3b211bef497a5b967238b6d42/registry/schema/namedSkill.schema.json
- Benchmark-result provenance and reproducibility fields: https://github.com/gaia-research/gaia-skill-tree/blob/e9cd6f754f0eb4a3b211bef497a5b967238b6d42/registry/schema/evidence/benchmark-result.schema.json
- Read-only shadow evaluator and context fingerprinting: https://github.com/gaia-research/gaia-skill-tree/blob/e9cd6f754f0eb4a3b211bef497a5b967238b6d42/src/gaia_cli/shadowEvaluation.py
- Shadow-evaluation architecture and fail-closed coverage: https://github.com/gaia-research/gaia-skill-tree/blob/e9cd6f754f0eb4a3b211bef497a5b967238b6d42/docs/architecture/trust-shadow.md
- Defensive skill-content scanner: https://github.com/gaia-research/gaia-skill-tree/blob/e9cd6f754f0eb4a3b211bef497a5b967238b6d42/src/gaia_cli/securityScanner.py
- Selected shadow-evaluation tests: https://github.com/gaia-research/gaia-skill-tree/blob/e9cd6f754f0eb4a3b211bef497a5b967238b6d42/tests/test_shadow_evaluation.py
- Selected scanner tests: https://github.com/gaia-research/gaia-skill-tree/blob/e9cd6f754f0eb4a3b211bef497a5b967238b6d42/tests/test_security_scanner.py
