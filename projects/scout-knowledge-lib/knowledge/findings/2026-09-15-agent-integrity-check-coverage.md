<ai_context>
summary: "ToolTrace Bench exposes a critical distinction between a green integrity verdict and evidence that integrity checks actually ran. Its legacy anti-gaming function returns clean on real results because required fields are absent; its replacement reports the checks run and an unsupported harness-hash check explicitly. Reusable assurance outputs should therefore carry per-check applicability and coverage, not only an aggregate boolean."
triggers: ["ToolTrace Bench", "agent benchmark integrity", "anti-gaming check", "checks_run", "applicability receipt", "green check", "harness hash", "benchmark coverage"]
last_updated: "2026-09-15"
source_basis: "Read-only GitHub Search API discovery and pinned source inspection of webdevsamran/tooltrace-bench at commit 239eb93d202315caa4a712b85782d9179d19e6c9; the repository test suite and benchmark runs were not executed."
</ai_context>

# A Green Integrity Verdict Needs a Check-Coverage Receipt

**Date:** 2026-09-15  
**Repo:** [webdevsamran/tooltrace-bench](https://github.com/webdevsamran/tooltrace-bench)  
**Inspected revision:** [`239eb93d202315caa4a712b85782d9179d19e6c9`](https://github.com/webdevsamran/tooltrace-bench/tree/239eb93d202315caa4a712b85782d9179d19e6c9)

## Observation

ToolTrace Bench is a broad agent-evaluation repository that produces checksummed
`.tooltrace` bundles containing the task, trace, workspace diff, environment,
score, and result. The most reusable finding is narrower than the repository's
feature surface: it preserves evidence that an integrity checker can return
**green because it inspected nothing**.

The pinned source says the older `anti_gaming_checks` function expects fields
such as `assertion_results`, `declared_assertions`, task hashes, and harness
hashes. Real `EvalResult` objects contain none of them. The focused regression
test passes a real bundle result to that function and asserts that it returns
`{"ok": true, "problems": []}` after zero effective checks. This is not presented
as success; the test keeps the dead path visible so it is not accidentally wired
back into the verifier.

The replacement bundle-level path builds each check from artifacts that are
actually present. It tests whether:

1. every declared task assertion appears in `scoring.json`;
2. the bundled assertions, starting workspace, and attachments match the
   installed task of the same ID, when that task is available; and
3. expected output values appear in the starting workspace in a way that lets
   the agent copy an answer rather than perform the task.

Focused negative tests mutate each relevant artifact and assert that the check
fails. This is stronger evidence than a happy-path test that only demonstrates a
clean bundle can stay green.

## The reusable contract: verdict plus applicability

`check_bundle_integrity` returns more than `ok` and `problems`. It also returns a
`checks_run` list. The published-task comparison is represented as unavailable
when no installed task was supplied. The function separately returns
`harness_hash_recorded: false`, because the bundle cannot establish whether the
harness was modified before execution.

That shape suggests an assurance contract with at least four states per check:

- **passed** — applicable, executed, and no violation was found;
- **failed** — applicable, executed, and a violation was found;
- **not applicable** — the check does not apply to this artifact or task class;
- **not observable** — required evidence was absent, so no verdict is possible.

An aggregate `ok` is safe only if required checks cannot silently fall into the
last two states. Otherwise “all performed checks passed” is easily misread as
“all required properties were verified.” A useful receipt should bind the
artifact identity, required check set, applicable check set, checks executed,
inputs consumed, and unsupported checks before deriving any overall route.

The leak checker adds a second useful lesson: applicability is semantic, not
only structural. Expected text already present in an input may be a benchmark
leak, a preservation assertion, a removal target, or the intended source for an
extraction task. ToolTrace classifies these cases separately and keeps declared
extraction exemptions visible. A detector that fails legitimate tasks will be
ignored; one that exempts them invisibly creates an unauditable bypass.

## Evidence dossiers preserve gaps, but do not close the trust boundary

The repository's evidence-dossier implementation follows the same principle at
a larger scale. Every mapped obligation carries both evidence and non-empty
gaps; unverified bundles are listed rather than dropped; and small samples or
absent security runs are surfaced. Tests forbid generated text from asserting a
compliance determination. This is a useful reporting pattern: omission is not a
pass, and benchmark evidence is not organizational compliance.

Its hash chain detects alteration, deletion, or replacement relative to the
stored dossier and head. As the documentation itself notes, checksums are
tamper-evident rather than tamper-proof. This inspection does not establish an
external signer, timestamp, or independently retained chain head, so the bundle
and dossier remain evidence artifacts rather than self-authenticating truth.

## Evidence boundary

This run inspected repository documentation, implementation, and focused tests
at one pinned commit. It did not install the package, execute the tests, reproduce
benchmark scores, or independently validate the repository's claimed feature
counts. The evidence establishes code and test intent, including explicit
unsupported checks; it does not establish production deployment or benchmark
efficacy.

## Primary evidence

- [Repository README and bundle model](https://github.com/webdevsamran/tooltrace-bench/blob/239eb93d202315caa4a712b85782d9179d19e6c9/README.md)
- [Bundle integrity implementation and explicit unsupported harness-hash check](https://github.com/webdevsamran/tooltrace-bench/blob/239eb93d202315caa4a712b85782d9179d19e6c9/tooltrace/analysis/integrity.py)
- [Negative tests and legacy zero-check regression](https://github.com/webdevsamran/tooltrace-bench/blob/239eb93d202315caa4a712b85782d9179d19e6c9/tests/test_anti_gaming_checks_check_something.py)
- [Evidence-dossier implementation](https://github.com/webdevsamran/tooltrace-bench/blob/239eb93d202315caa4a712b85782d9179d19e6c9/tooltrace/analysis/evidence.py)
- [Evidence-dossier gap and tamper tests](https://github.com/webdevsamran/tooltrace-bench/blob/239eb93d202315caa4a712b85782d9179d19e6c9/tests/test_evidence_dossier.py)

## Related Scout knowledge

- [Agent Runtime Acceptance and Reconciliation](../agent-runtime-acceptance-and-reconciliation.md#checker-eligibility-must-not-become-acceptance-authority--workstream-github-september-2026) — checker eligibility, acceptance authority, and effect routing are separate boundaries.
- [Coverage-Accounted Discovery](./2026-09-10-coverage-accounted-agent-detection.md) — detector outcomes need an observation denominator.
- [Audit Integrity Needs an External Tail Anchor](./2026-09-14-audit-integrity-needs-external-tail-anchor.md) — self-contained chains do not establish independently witnessed history.
