---
title: "Agentic Delivery Needs Outcome Evidence and a Reviewable Work Trace"
source: hn
date: 2026-08-09
last_updated: 2026-08-09
type: finding
tags: [hn, coding-agents, ci-cd, testing, review, provenance, deployment]
relevance: medium
---

# Agentic Delivery Needs Outcome Evidence and a Reviewable Work Trace

## Finding

An Ask HN thread about whether local agent review makes CI/CD a formality produced a useful split in practitioner controls. Respondents consistently kept independent end-to-end or security checks in CI, while one team also reviews the coding session—not only the resulting diff—to question architectural decisions, edge cases, and omissions.

- **Source:** https://news.ycombinator.com/item?id=49227024

Together these reports suggest that agentic delivery produces two distinct review artifacts: **outcome evidence** (tests, builds, staging behavior) and a **work trace** (the session's decisions, attempted checks, deferrals, and tool use). Neither substitutes for the other.

## Source-grounded evidence

The thread contains several concrete but self-reported workflows:

- one practitioner runs agent-assisted review before CI, then retains CI security checks, dry-runs a change, and exercises one live item before batching;
- another reports using end-to-end tests plus TestFlight or staging deployment for human verification;
- a team member says colleagues review the coding session itself and ask it about architecture, scalability, and edge cases rather than limiting review to the diff;
- another workflow gates merge on an independent CI type check after implementation, staging verification, and external review; and
- a dissenting commenter reports that agents may skip planned tests, silently defer uncovered behavior, or write tests around an already buggy implementation.

These comments do not establish comparative defect rates. They are field reports from a small, self-selected discussion, and two participants disclose products related to their practices. Their value is in identifying control surfaces and failure hypotheses to test.

## Interpretation

A diff records what changed, but it poorly represents **meaningful absences**: a promised test that was never written, an edge case silently deferred, a documentation source never consulted, or a check weakened after failure. Outcome tests catch some resulting defects, but only for behavior encoded in their oracles. A work trace can expose how the agent narrowed the task or bypassed intended evidence, yet a plausible trace cannot prove the shipped system behaves correctly.

This yields a complementary evidence model for agent-authored changes:

1. **Outcome lane:** run repository-controlled tests, type checks, security checks, builds, and staged or canary behavior outside the agent's mutable session.
2. **Trajectory lane:** retain a bounded, reviewable record of the task specification, plan changes, tool calls, failed checks, explicit deferrals, and final evidence mapping.
3. **Cross-check:** compare promised work against both the patch and the trace; flag requirements with no test, deferred work absent from the final report, checks changed by the same agent, and claims not bound to an independent run.
4. **Progressive effects:** dry-run first, then one live item or canary, then batch only after observed success.

The non-obvious lesson is that session review should not replace code review or CI. It is an **absence detector** for process-level omissions that the final artifact may not reveal. Conversely, independent CI prevents a polished session narrative from becoming self-attestation.

## Calibration

This is a medium-confidence workflow signal from one eight-comment HN discussion, not evidence that session review improves quality. The durable, testable hypothesis is narrower: reviewing both externally produced outcomes and the agent's bounded work trace should detect different failure classes, especially unimplemented tests and silent deferrals. A useful evaluation would measure unique defects found by diff review, independent CI, and trace review on the same agent-authored changes.
