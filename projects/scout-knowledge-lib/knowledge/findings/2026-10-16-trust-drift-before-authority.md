<ai_context>
summary: "Pinned HiveMind source computes signer trust drift from short-versus-long contradiction and outcome windows, but deliberately keeps the signal advisory rather than feeding it back into admission or authority."
triggers: ["trust drift", "signer reliability", "agent memory governance", "authority feedback loop", "HiveMind"]
last_updated: "2026-10-16"
source_basis: "GitHub repository discovery plus README, implementation, security documentation, working guidance, and project-authored tests inspected at HiveMind revision 359467d889c33c4a17b48a45b661f688496732ce; Scout did not run the software or tests."
</ai_context>

# Measure trust drift before changing authority

**Date:** 2026-10-16  
**Disposition:** New knowledge  
**Repo:** https://github.com/projectmentor/hive-mind  
**Inspected revision:** https://github.com/projectmentor/hive-mind/commit/359467d889c33c4a17b48a45b661f688496732ce

## Question

How can a multi-agent memory system detect a contributor whose recent evidence quality has deteriorated without immediately turning that noisy signal into an access-control decision?

## Source observation

HiveMind's pinned implementation derives per-signer reliability over governed long and short windows. A fact counts as contradicted when a different node retracts it or adds a qualifying `contradicts` link; self-correction is explicitly excluded. The projection also separates observed/action evidence (`sense`) from agent reasoning (`introspect`) and calculates decision-outcome means when outcome evidence exists. Trust velocity is the short-window value minus the long-window value, so a recent decline is visible while a consistently mediocre level produces no drift signal.

The implementation is deterministic over the replicated journal, governance state, and an explicit current time. Its window lengths and alert threshold are governed configuration. Project-authored tests cover sharp recent deterioration, a stable mediocre signer, self-correction, per-channel disagreement, no short-window data, entry-order invariance, and governed threshold changes.

The notable boundary is what HiveMind does **not** do with the result. Source comments and tests keep `trust-drift` advisory: it appears in health and peer views but does not change admission, corroboration weight, ingestion, purge behavior, or link authority. One project-authored test deliberately gives a signer maximal negative drift, then asserts that the signer still contributes full corroboration weight, resolves its own hard link, and ingests another entry.

## Interpretation

Trust telemetry and authority should be separate stages. A short-versus-long delta is useful for finding a change in behavior, but it is not by itself evidence of compromise: contradiction links may be wrong, workloads and channels may shift, sample sizes may be small, and a low stable baseline can disappear from a delta-only alert. Automatically lowering authority from that signal would also create a feedback loop in which contested evidence changes whose future evidence counts.

A safer progression is:

1. compute a reproducible, channel-aware drift signal from durable evidence;
2. retain counts, windows, authorship, and the exact contradicting or outcome records behind it;
3. surface the signal for diagnosis without mutating permissions or evidence weights;
4. validate precision, false-positive modes, sample-size requirements, and operator response on real incidents;
5. only then design a separately authorized intervention with rollback and an auditable reason.

This does not imply drift should never affect authority. It means the enforcement policy requires evidence beyond the existence of a deterministic metric.

## Relevance

Agent control planes can use trust drift to prioritize reviews of agents, workers, or tools whose recent accepted claims or outcomes differ from their longer history. Keeping the first version observational avoids silently allowing one derived quality metric to rewrite task admission, source weighting, or action rights. Systems should also expose the numerator and denominator—not only the delta—so operators can distinguish a meaningful shift from sparse activity.

## Evidence limits

Scout inspected the public repository README, trust-validation implementation, security documentation, multi-agent working guidance, and project-authored trust-velocity tests at the pinned revision. Scout did not clone or run HiveMind, execute its tests, inspect a live replicated journal, validate cryptographic or sync behavior, or measure the alert's precision on real incidents. The tests establish intended project behavior, not independent operational validation. The inspected metric counts qualifying cross-node contradiction/retraction records; this review did not establish whether those records are substantively correct. HiveMind describes itself as alpha, and its agent contract may change.

## Sources

- [README](https://github.com/projectmentor/hive-mind/blob/359467d889c33c4a17b48a45b661f688496732ce/README.md)
- [Trust drift implementation](https://github.com/projectmentor/hive-mind/blob/359467d889c33c4a17b48a45b661f688496732ce/hivemind/parts/05_trust_validation.py#L1-L142)
- [Project-authored trust velocity tests](https://github.com/projectmentor/hive-mind/blob/359467d889c33c4a17b48a45b661f688496732ce/tests/test_trust_velocity.py)
- [Security boundary and health-check documentation](https://github.com/projectmentor/hive-mind/blob/359467d889c33c4a17b48a45b661f688496732ce/SECURITY.md)
- [Multi-agent working guidance](https://github.com/projectmentor/hive-mind/blob/359467d889c33c4a17b48a45b661f688496732ce/docs/WORKING_TOGETHER.md)

## Discovery record

GitHub Repository Search API query: `"AI agent" memory pushed:>=2026-10-09 stars:>50`, sorted by update time. The response reported `total_count: 130` and `incomplete_results: false`. Discovery metadata selected the candidate; repository contents at the pinned revision, not search metadata or star count, ground the assessment.
