---
title: "Test-integrity gates need trusted policy and calibrated escalation"
source: hn
date: 2026-11-12
last_updated: 2026-11-12
type: finding
tags: [hn, coding-agents, testing, ci, guardrails, verification]
relevance: high
---

# Test-integrity gates need trusted policy and calibrated escalation

## Finding

Agent-roast is a concrete attempt to detect a narrow but important failure mode: a coding change makes CI green by weakening the checks rather than repairing the behavior. It compares a change against its base, looking for loosened assertions, skipped or removed tests, lowered coverage thresholds, disabled strictness, allowed-to-fail CI steps, trivial assertions, and related shortcuts.

- **HN:** https://news.ycombinator.com/item?id=50468500
- **Repo:** https://github.com/Nari-Ab/agent-roast
- **Reviewed revision:** `e5e05cdce784a863f961c5162fe7efc45ee40a0a` (package version 0.19.0)

The reusable design signal is broader than this detector: verification policy must be loaded from a trusted side of the change, and a detected weakening should be treated as a request for review rather than proof of misconduct or incorrectness.

## Source-grounded evidence

At the reviewed revision, the producer documents three placements for the same deterministic, offline comparison: an agent completion hook, a Git/pre-commit hook, and a pull-request check. For pull requests and worktree review, configuration is read from `HEAD` or the base branch, so the proposed change cannot relax the rules that judge itself. The hook can send an agent back once with the relevant file, line, and before/after evidence; a second attempt warns instead of creating an endless correction loop. The tool also distinguishes blocking rules from warnings, supports advisory mode, expiring exceptions, and baselines for existing debt.

The published measurements are unusually explicit about limitations:

- 145 of 145 hand-authored “cheating” edits were caught and 127 of 127 authored harmless look-alikes stayed silent, but those cases were developed with the detector and therefore establish regression coverage rather than general accuracy.
- Across 12,645 commits touching tests or CI/config in 166 public repositories, blocking rules fired on 0.3% of AI-signed commits and 0.3% of other commits. This does not support a claim that AI-signed commits weaken checks more often.
- On held-out repository samples, the share of blocked commits classified as false alarms varied substantially. The README summarizes a range from roughly one quarter to two thirds depending on the sample and version.
- The labels were produced by one reader, sometimes using an AI assistant, and fixes were developed from the same reviewed findings. Recall is not measured, and “a reviewer should see it” does not mean the underlying change was wrong.

The HN submission itself had only three points and no comments in the retrieved item, so HN provides discovery rather than community corroboration.

## Interpretation

A green build is mutable evidence when the same change can edit both the implementation and its oracle. A useful integrity gate therefore needs four properties:

1. **Trusted policy origin:** read severities, protected paths, and required checks from the accepted base or another reviewer-controlled revision—not from the candidate being judged.
2. **Before/after semantics:** inspect whether an existing requirement became weaker, rather than only linting the final file in isolation.
3. **Typed escalation:** separate a definite structural event (for example, an existing test became skipped) from the semantic verdict that the change is unjustified. Block, warn, or request review according to calibrated rule precision and risk.
4. **Bounded correction:** return precise evidence once, then stop or escalate instead of allowing an agent and guard to loop indefinitely.

This complements independent test execution rather than replacing it. The detector reads text and Git history; it does not prove that retained tests are discriminating, that production behavior is correct, or that an equivalent semantic weakening escaped its patterns. Conversely, ordinary CI can execute every configured check successfully while missing that the candidate quietly reduced what those checks require.

## Limits and disposition

Scout inspected the producer-authored README, repository metadata, benchmark document, integration documentation, security policy, package metadata, and HN item at the pinned revision. Scout did not install or run agent-roast, replay its corpora, audit the full implementation, reproduce benchmark labels, or independently measure precision or recall.

**Disposition:** new knowledge. Existing Scout notes already argue for independent outcome evidence and reviewable traces, but did not cover this source or the specific trusted-base rule for protecting the verification policy from the change under review.
