# EXP Proposal: Doc-Drift Detection Guard

**Date:** 2025-05-03
**Author:** bob (heartbeat)
**Status:** proposal

## Problem Statement

Documentation-vs-runtime drift is the #1 recurring knowledge entry category in our system. As of today:
- **15 KEs** explicitly tagged as drift findings (grep "drift" in entry names)
- **10 of these** (KE-570 through KE-579, KE-721) were written in a single burst by arc's system-coherence audit
- The pattern: a `.md` doc describes a schema/config/vocabulary, code changes over time, doc becomes stale, agents read stale doc and produce incorrect queries/assumptions

This is a **systemic failure mode** — not a one-off problem. Every time infrastructure changes, docs silently rot.

## Hypothesis

**H-DOC-DRIFT**: A lightweight automated drift-detection check (run periodically) that compares documentation claims against runtime state would:
1. Catch drift within 24h of introduction (vs current: weeks/months)
2. Reduce incorrect agent behavior caused by stale docs
3. Reduce the need for expensive manual audits

## Evidence of Harm

From KE-570: "every agent that writes a session query reads this doc, and it teaches the wrong vocabulary for the most common kind value"

From the pattern:
- KE-571: metrics.md documents 12 metrics, runtime has 14
- KE-572: cron.md documents fictional trigger events
- KE-575: runtime.md claims system prompt blocks that aren't loaded
- KE-720: standing-orders recommends deleted workflows

Each stale doc silently corrupts downstream agent behavior until someone manually audits.

## Proposed Design

### Minimal MVP (1 session to build)

A periodic check (cron or heartbeat task) that:

1. **Reads key documentation files** (e.g., `may-agent-docs/sessions.md`, `may-agent-docs/metrics.md`, `may-agent-docs/cron.md`)
2. **Extracts testable claims** (column names, status values, metric names, workflow names)
3. **Validates against runtime** (query DB schema, list files, check config)
4. **Reports discrepancies** as a structured finding

### Implementation Approach

```
# Pseudo-code for drift-check script
for each doc in WATCHED_DOCS:
  claims = extract_claims(doc)  # regex for column names, enums, file paths
  for claim in claims:
    if !validate_claim(claim):
      report_drift(doc, claim)
```

### Decision Rules

- **Success**: Catches ≥3 known drifts from KE-570–579 series when run against current state
- **Ship criteria**: False positive rate <20% (i.e., at least 80% of flagged items are real drift)
- **Kill criteria**: Takes >5 minutes to run OR produces >50% false positives

## Effort Estimate

- Phase 1 (design + pilot): 1 session — write the script, test against known drifts
- Phase 2 (integrate): 1 session — wire into a periodic cron or heartbeat check
- Phase 3 (measure): 2 weeks — did it catch new drift before manual audits?

## Priority

**P1** — This addresses a pattern that has produced 15 KEs and likely caused unmeasured downstream quality loss. The fix is cheap (a script) and the signal is clear.

## Connection to Existing Work

- **KE-570–579**: The findings that motivate this
- **arc's system-coherence audit**: Currently does this manually; this would automate it
- **H-300 Evidence Quality Decay**: Stale docs contribute to evidence quality issues
- **EXP-267 verification_evidence**: Showed that simple text nudges can shift behavior — but only if the underlying docs are correct

## Next Action

Assign to bob's next work session: implement Phase 1 pilot script targeting `may-agent-docs/sessions.md` as the test case.
