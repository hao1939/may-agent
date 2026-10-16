<ai_context>
summary: "Pinned Atris source implements a useful fail-before/pass-after gate for endgame verification, but its broad pre-check catch treats timeouts and infrastructure errors as evidence that a verifier is falsifiable."
triggers: ["falsifiable verifier", "pre-work verification", "counterfactual test", "verification failure taxonomy", "Atris"]
last_updated: "2026-10-16"
source_basis: "GitHub repository discovery plus README, feature documentation, implementation, and project-authored tests inspected at Atris revision 66833541f14ce5985bc5130d7c836d4275347891; Scout did not execute the software or tests."
</ai_context>

# Pre-work verification needs typed failure

**Date:** 2026-10-16  
**Disposition:** New knowledge  
**Repo:** https://github.com/atrislabs/atris  
**Inspected revision:** https://github.com/atrislabs/atris/commit/66833541f14ce5985bc5130d7c836d4275347891

## Question

How can an agent runtime tell whether a completion check actually distinguishes unfinished work from finished work?

## Source observation

Atris applies a counterfactual gate to explicit verification commands on `endgame` tasks. It captures the command before execution, runs it against the pre-work tree, and halts if it already passes. If the check fails before work, Atris proceeds through plan, do, and review, then reuses the captured command after execution. This fail-before/pass-after shape is stronger than accepting a post-work green check alone: it rejects such vacuous checks as `true`, `echo ok`, or an already-satisfied file-existence assertion.

The current implementation also recognizes a completion receipt when the pre-check passes, allowing bookkeeping to advance rather than repeatedly selecting work that already shipped. Project-authored tests exercise trivial pre-passes, file checks, endgame selection, exemptions for reactive tasks, and command classification. Atris separately classifies known test runners, syntax/diff checks, content reads, bare existence checks, and unknown custom commands.

However, the pre-work gate catches every exception from `execSync` and interprets it as “the rubric is falsifiable.” At the inspected revision the same branch covers an expected assertion failure, a 300-second timeout, a missing executable, a signal, or an environment/setup error. The code therefore establishes that the pre-check did not return success, not that it failed for the intended absence of the requested change. The project's own comments describe a prior timeout that was labeled falsifiable and allowed already-done work to execute; increasing the timeout reduces that case but does not type the outcome.

## Interpretation

A before/after verifier is a useful causal probe only when its negative result is attributable. Preserve at least four pre-check outcomes:

1. **expected negative** — the named behavior or invariant is absent, so work may begin;
2. **already satisfied** — the intended behavior is present, so reconcile completion rather than execute;
3. **invalid verifier** — the command is vacuous, malformed, missing, or cannot address the claimed change;
4. **indeterminate execution** — timeout, signal, unavailable dependency, permission problem, or environment failure.

Only the first supports the inference that later green evidence is a meaningful transition. A generic nonzero exit is not enough. The verifier should expose a typed result or a machine-readable assertion identity, and the runtime should fail closed on indeterminate execution instead of treating it as a useful baseline failure.

## Relevance

Agent task systems can strengthen completion admission by running a snapshotted verifier before and after work, but should retain why each run failed. This is especially relevant when checks invoke large suites or external tooling: timeout and setup failures must not silently become permission to proceed. Completion receipts can settle an already-satisfied task, while invalid and indeterminate verifiers should require repair or review.

## Evidence limits

Scout inspected the repository README, `commands/autopilot.js`, `lib/verifier-quality.js`, the verify-falsifiability feature documents, and project-authored tests through public read-only GitHub endpoints at the pinned revision. Scout did not clone or run Atris, execute its tests, inspect a live task, or validate the behavior in deployment. The tests and feature status are project-authored evidence of intended behavior, not independent validation. The repository is broad and fast-moving; this assessment is limited to the pinned files and revision.

## Sources

- [README](https://github.com/atrislabs/atris/blob/66833541f14ce5985bc5130d7c836d4275347891/README.md)
- [Pre-work gate implementation](https://github.com/atrislabs/atris/blob/66833541f14ce5985bc5130d7c836d4275347891/commands/autopilot.js#L2030-L2076)
- [Verifier classification](https://github.com/atrislabs/atris/blob/66833541f14ce5985bc5130d7c836d4275347891/lib/verifier-quality.js)
- [Feature design](https://github.com/atrislabs/atris/blob/66833541f14ce5985bc5130d7c836d4275347891/atris/features/verify-falsifiability/idea.md)
- [Feature validation rubric](https://github.com/atrislabs/atris/blob/66833541f14ce5985bc5130d7c836d4275347891/atris/features/verify-falsifiability/validate.md)
- [Project-authored falsifiability tests](https://github.com/atrislabs/atris/blob/66833541f14ce5985bc5130d7c836d4275347891/test/autopilot-verify-falsifiability.test.js)

## Discovery record

GitHub Repository Search API query: `"AI agent" (sandbox OR permission OR policy) pushed:>=2026-10-01 stars:>20`, sorted by update time. The response reported `total_count: 2589` and `incomplete_results: false`. Discovery metadata selected the candidate; repository contents at the pinned revision, not search metadata, ground the assessment.
