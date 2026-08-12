---
title: "HN — MCP OAuth Scoreboards Need Versioned Evidence"
source: hn
date: 2026-08-07
last_updated: 2026-08-07
type: finding
tags: [hn, mcp, oauth, agent-security, conformance, reproducibility]
relevance: high
---

# HN — MCP OAuth Scoreboards Need Versioned Evidence

## Summary

A Show HN submission titled “I scanned 30 production MCP servers' OAuth – only 1 earned an A” points to Authgent, an open-source MCP OAuth conformance scanner. The useful signal is not the headline count: that count was **not reproducible from the live registry when checked**. The registry API then exposed eight scanned servers, with three B and five C grades and no A.

The stronger finding is methodological. MCP authorization posture can be tested from public discovery metadata, but a live grade is a changing observation, not a durable fact. Security registries should preserve the target URL, observation time, scanner revision, rubric/spec version, raw metadata or its digest, findings, and score calculation for every published result.

## Primary sources

- **HN:** https://news.ycombinator.com/item?id=49204939
- **Repo:** https://github.com/authgent/authgent
- **Live registry:** https://authgent.dev/registry/
- **Registry API:** https://authgent-demo.dhruvagnihotri.com/api/registry
- **Methodology:** https://github.com/authgent/authgent/blob/main/docs/methodology.md
- **Calibration:** https://github.com/authgent/authgent/blob/main/docs/calibration.md

## Source-grounded evidence

The repository documents ten checks covering public MCP/OAuth surfaces, including protected-resource and authorization-server metadata, S256-versus-`plain` PKCE, RFC 8707 resource indicators, implicit grant advertisement, and duplicate client IDs from dynamic registration. Its grading method starts at 100 and subtracts penalties only for findings classified as `spec_required`; advisory checks remain visible without changing the letter grade.

The methodology also provides useful reproducibility mechanics:

- stable check IDs such as `MCP-PRM-001` and `MCP-PKCE-001`
- JSON CLI output for preserving finding-level evidence
- a published score-to-grade mapping
- synthetic known-good and known-bad calibration cases
- a documented 14-day disclosure process
- the claim that the CLI, hosted scanner, and GitHub Action share one scanner implementation

At retrieval, however, the live API returned `total: 8`, `scanned: 8`, and grade counts of three B and five C. That does not match the HN title's “30” and “only 1 earned an A.” This may simply reflect a changing registry, disclosure windows, or a different historical scan set; the available live response cannot determine which.

A second drift signal appears inside the project's own public materials: the calibration page's worked examples include Stripe, Notion, and the Authgent demo, while the live eight-row registry did not include Stripe or the demo. The calibration page describes Notion as D/55, while the live API reported Notion as C/70. Those can both have been valid observations under different metadata or rubric versions, but readers cannot reconcile them without an immutable snapshot identifier.

## Interpretation

Agent-tool authorization scanners sit at the intersection of three moving inputs:

1. **target state** — vendors change discovery metadata and authorization behavior
2. **spec state** — MCP and OAuth requirements evolve
3. **scanner state** — checks, severities, tiers, and grade boundaries change

A current badge collapses all three into one letter. That is convenient for triage but weak as audit evidence. A defensible registry entry should therefore be an append-only observation record with at least:

```text
target URL
observed-at time
scanner commit or release
rubric/spec version
raw response digest (and redacted snapshot where safe)
check IDs + severities + required/advisory tier
score calculation
supersedes / superseded-by links
```

This separates “the server is currently B” from “scanner revision X observed metadata digest Y and calculated B under rubric Z.” The latter can be independently replayed and remains meaningful after the badge changes.

## Calibration

This is a **self-published tool and live-data signal with minimal HN validation**: the HN item had 2 points and no discussion in the retrieved item record. Scout did not independently probe all target authorization endpoints or reproduce the scanner's test suite. The live API discrepancy invalidates reuse of the headline count as a current ecosystem statistic; it supports only the need for versioned, snapshot-backed claims.
