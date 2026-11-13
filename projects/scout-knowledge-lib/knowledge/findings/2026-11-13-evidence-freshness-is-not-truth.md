<ai_context>
summary: "Underpin models claims, premises, and expiring evidence so changed inputs propagate stale or at-risk states, but its own preregistered studies show that freshness is a re-check-routing signal rather than a truth score. A ledger should preserve dependency and freshness receipts while requiring separate semantic or outcome verification for acceptance."
triggers: ["evidence freshness", "claim evidence ledger", "stale claims", "re-check routing", "underpin", "green evidence is not truth"]
last_updated: "2026-11-13"
source_basis: "Static review of NiyazHz/underpin producer-authored documentation, model source, security model, and preregistered experiment reports at pinned revision cd556dc16171a4a6f1d1d15ae27585e493e60729. Scout did not build or run underpin, reproduce the studies, or independently inspect their external raw datasets."
</ai_context>

# Evidence freshness is not truth

**Date:** 2026-11-13  
**Disposition:** New source-grounded implementation and measurement signal  
**Repo:** https://github.com/NiyazHz/underpin  
**Inspected revision:** [`cd556dc16171a4a6f1d1d15ae27585e493e60729`](https://github.com/NiyazHz/underpin/commit/cd556dc16171a4a6f1d1d15ae27585e493e60729)

## Question

What can a claim-evidence ledger safely conclude from fresh, stale, or failed
evidence in a long-running agent workflow?

## What the source implements

Underpin records claims separately from the evidence and premises supporting
them. Evidence can be a command with an expected exit or output, a source with
an extractor and expected value, or a derivation from other claims. Each item
has an expiry rule such as a TTL, a date, or a set of files whose change makes
the evidence stale. Fixed propagation rules then classify claims as verified,
stale or at-risk, unsupported, or refuted/retracted; `why` traces the cause and
`audit` re-runs stale checks.

This produces a useful operational distinction:

- **Green** means the recorded support is present, unexpired, and passing.
- **Amber** means a check should be repeated or a changed premise should be
  reconsidered.
- **Red** means a recorded check failed or a claim was withdrawn.
- None of those states independently establishes semantic truth.

The repository makes that last boundary explicit and reports preregistered
measurements that test it. In a replay over 80 GitHub repositories, 381 facts,
and 120 conclusions, the ledger reportedly flagged all 20 scored conclusions
that flipped after eight weeks, but also flagged 40 conclusions that still held.
That was 35% fewer false alarms than re-checking everything, short of the
preregistered target, and the replay required a GitHub-response snapshot that is
not included in the repository.

A one-session coding case study shows why the type of evidence matters. Re-running
commands whose tests directly checked their claims cleared all false alarms after
neutral changes, while a claim whose text asserted a specific output stayed green
because its evidence checked only exit status. The current model supports explicit
output expectations (`contains`, regex, or same-output hash), narrowing that gap
when the evidence actually encodes what the claim says.

The broadest measurement is also the strongest warning against using freshness as
acceptance authority. The producer reports that 1,410 of 4,924 analyzed SWE-bench
Verified submissions were wrong, while a flag for non-fresh evidence would have
caught only 26% of them. A follow-up analysis over 4,951 submissions found that the
independence tier of the last check added essentially no predictive value once model
and task difficulty were considered (reported cross-validated Brier gain +0.0001).
Those are producer-authored analyses; the repository includes aggregate tables and
scripts, but not the approximately 4.7 GB trajectory dataset by default.

## Reusable design signal

**Use evidence freshness to route re-verification, not to mint correctness.** A
runtime should preserve at least four separate fields:

1. **Support binding:** the exact claim, subject revision, premise set, command or
   source extractor, expected result, and checker identity.
2. **Freshness state:** whether the bound inputs changed, the evidence expired, or
   a premise stopped being green.
3. **Check result:** what was actually re-run or re-fetched and whether the encoded
   expectation still held.
4. **Acceptance evidence:** an independent semantic, outcome, or domain-specific
   verifier sufficient for the consequence at stake.

This separation keeps two failure modes visible. A stale dependency can be a useful
reason to reconsider a conclusion even when the conclusion remains true; conversely,
a fresh passing test can leave the conclusion wrong because the check is incomplete,
self-selected, or aimed at the wrong property. The practical value of a claim ledger
is therefore selective invalidation and explanation: it says **what may need another
look and why**, not whether the final result deserves acceptance.

For durable agent systems, dependency edges and expiry rules should lower confidence
or open review work without automatically reversing a decision. Re-verification
should prefer evidence that directly checks the claim's semantics, including output
or state expectations rather than exit status alone. High-impact acceptance should
still be decided by an authority-bearing verifier bound to the current task,
revision, effects, and domain outcome.

## Security and integrity boundary

The repository's security model is candidly local and cooperative. Its append-only
log is hash-chained, but anyone who can rewrite the project can recompute the chain;
this provides integrity checking, not authenticity. The command allowlist is itself
a writable project file, observations can be forged, and the tool is not a sandbox.
Those limits reinforce the same rule: ledger state is useful provenance, but its
custody and authority must be established separately before it can support a
high-consequence decision.

## Limits

- Scout inspected producer-authored documentation, selected model source, security
  documentation, and experiment reports statically. Scout did not build or run
  underpin, execute its tests, reproduce an audit, or validate its Claude Code
  integration.
- The 80-repository study is a historical replay, not a confirmed live run, and its
  required GitHub API response snapshot is not in the repository.
- The coding result is one self-built project and one agent session with known
  changes; it is a case study, not a population estimate.
- The SWE-bench analyses depend on external trajectories not included by default.
  Scout did not download them, recompute labels, or independently validate the
  reported statistics.
- Claim dependencies are supplied by the recorder. Missing premises, weak
  expectations, forged observations, or compromised project files can make a green
  graph misleading.
- The repository is marked experimental v0.2. Its data format and CLI may change.

## Primary inspected sources

- [Repository overview and measurement summary](https://github.com/NiyazHz/underpin/blob/cd556dc16171a4a6f1d1d15ae27585e493e60729/README.md)
- [Claim, evidence, expiry, and propagation model](https://github.com/NiyazHz/underpin/blob/cd556dc16171a4a6f1d1d15ae27585e493e60729/docs/how-it-works.md)
- [Experiment inventory and reproduction boundaries](https://github.com/NiyazHz/underpin/blob/cd556dc16171a4a6f1d1d15ae27585e493e60729/experiments/README.md)
- [Repository-aging replay results](https://github.com/NiyazHz/underpin/blob/cd556dc16171a4a6f1d1d15ae27585e493e60729/experiments/demo1-research-aging/RESULTS.md)
- [Coding-session case-study results](https://github.com/NiyazHz/underpin/blob/cd556dc16171a4a6f1d1d15ae27585e493e60729/experiments/demo2-coding-session/RESULTS.md)
- [Evidence-independence analysis](https://github.com/NiyazHz/underpin/blob/cd556dc16171a4a6f1d1d15ae27585e493e60729/experiments/phase1c-swebench/RESULTS.md)
- [Evidence object and output-expectation model](https://github.com/NiyazHz/underpin/blob/cd556dc16171a4a6f1d1d15ae27585e493e60729/src/model.rs)
- [Security and integrity boundaries](https://github.com/NiyazHz/underpin/blob/cd556dc16171a4a6f1d1d15ae27585e493e60729/SECURITY.md)

## Discovery record

GitHub Repository Search API query: `"AI agent" created:>2026-11-12`, sorted by
stars descending, 30 results requested. The API returned `total_count: 624` and
`incomplete_results: false`. Repository contents were inspected only after pinning
the revision above.
