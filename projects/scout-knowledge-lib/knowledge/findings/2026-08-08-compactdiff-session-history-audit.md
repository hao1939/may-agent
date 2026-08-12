<ai_context>
summary: "HN's Compactdiff demonstrates a local, content-addressed transcript recorder that can distinguish append-only evolution from removed or replaced JSONL lines. The deeper runtime lesson is that context compaction needs an external audit boundary plus semantic obligation checks: byte-history proves what disappeared, not whether a live constraint was preserved."
triggers: ["context compaction", "session audit", "transcript history", "constraint loss", "content-addressed snapshots", "Compactdiff"]
confidence: "medium"
discovered: "2026-08-08"
source_basis: "HN item 49220768 and compactdiff repository commit 47f649a9b041ec61f7012a2badbd2f14afea8f33"
</ai_context>

# Context compaction needs an external audit boundary

**Date:** 2026-08-08  
**Source:** https://news.ycombinator.com/item?id=49220768  
**Repo:** https://github.com/mkmkkkkk/compactdiff  
**Inspected commit:** `47f649a9b041ec61f7012a2badbd2f14afea8f33`

## Signal

The Show HN project **Compactdiff** records changing Claude Code and Codex JSONL
transcripts into a local content-addressed vault. Its implementation compares
two observed states as ordered line identities—using a record UUID when
available and a SHA-256 line hash otherwise—and classifies the transition as
`identical`, `append-only`, or `history-rewritten`. It also generates local
replays and defaults to redacting common secret and personal-data patterns
before storage or export.

At the inspected commit, the repository's 25 unit tests pass, including tests
for compaction detection, duplicate and blank-line accounting, default
redaction, idempotent snapshots, and single-character integrity changes. This
is implementation evidence for a useful primitive: **the live agent transcript
should not be its own only historical record**.

## Why it matters

Compaction is usually evaluated only by whether the next model turn remains
plausible. That misses silent loss: a summary can preserve the task topic while
dropping a prohibition, acceptance criterion, unresolved blocker, or evidence
reference. An independently retained pre-compaction state makes that loss
observable after the fact.

The stronger design pattern is:

1. snapshot the input state before a compaction or rewrite boundary;
2. retain the resulting state under a distinct content identity;
3. classify structural removals and replacements;
4. extract authoritative obligations from both states;
5. fail or request review when a live obligation has no preserved or explicitly
   superseded successor.

Compactdiff implements the first three steps. The fourth and fifth are the
important extension: a line-level diff proves that content disappeared, but
not whether the disappearance was safe. Conversely, a summary may replace many
lines while preserving every operative constraint. Compaction quality therefore
needs a **semantic conservation check**, not a no-deletion rule.

## Important limits

- The HN thread contains an immediate challenge to the project's claim that
  Claude Code rewrites transcript files in place. The repository demonstrates
  its recorder and diff behavior, but does not by itself establish that every
  supported upstream runtime mutates history in the same way. Each adapter's
  source-file semantics should be validated separately.
- The hash chain is tamper-evident only relative to a previously retained or
  externally anchored head. An unanchored replay and a newly computed hash can
  be altered together; this is not origin authentication or a signature.
- Pattern redaction is defense in depth, not a confidentiality guarantee. The
  README correctly warns that proprietary prose, unusual credentials, and
  other sensitive content may remain.
- Polling observes states, not every intermediate state. Multiple rewrites
  between polls can be missed.

## Practical implication

Treat compaction as a governed state transition. Store before/after content
identities outside the active session, preserve the extraction rules used to
identify obligations, and emit a receipt listing which constraints were kept,
superseded, or lost. This converts context compression from an opaque model
behavior into an auditable migration with an explicit semantic acceptance
criterion.
