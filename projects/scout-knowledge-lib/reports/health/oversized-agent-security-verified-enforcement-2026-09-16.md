# Oversized-note review: verified enforcement

**Reviewed:** 2026-09-16  
**Signal:** `knowledge/agent-security-verified-enforcement.md` at 834 physical lines

## Decision

A split is warranted, but it should not be performed during this maintenance pass.
The note has a clean conceptual boundary and a balanced extraction candidate, but
the candidate block is active uncommitted source work. Moving it now would overlap
that intake and make its pending links and INDEX edits harder to review.

## Recommended boundary

Keep the formal and architecture-oriented catalog in
`agent-security-verified-enforcement.md` through **“Hardware confinement does not
confer signing authority”** (current lines 1–472).

After the active source changes are integrated, extract the six September
implementation-evidence sections at current lines 473–834 into a descriptive
companion such as `agent-security-enforcement-evidence.md`:

- A Signed Verdict Is Not a Replayable Experiment
- A Receipt's Validity Is a Vector, Not a Boolean
- Default-Deny Needs a Coverage Contract, Not Just an Allow-List
- Identity Proven at Mint Is Not Per-Request Possession
- A Formal Policy Proof Is Only as Broad as Its Action Model
- “Defense in Depth” Needs Path-Composition Evidence

This yields an approximately 472-line architecture catalog and a 362-line
implementation-evidence companion. The extracted sections cohere around evidence
quality and runtime path coverage, rather than formal enforcement mechanisms.

## Required preservation checks for the later split

1. Preserve the current `<ai_context>` provenance and divide its summary,
   triggers, and source basis by the actual destination content.
2. Replace the omission point with an inline link to the exact first retained
   heading in the companion, and add reciprocal navigation.
3. Update the six retained digest links that currently target September section
   fragments in the original file; retained snapshots must not be rewritten, so
   use a forwarding heading if any snapshot target cannot be changed.
4. Update the concise INDEX entry only after the files and anchors exist.
5. Resolve the pre-existing repeated `§2.43` headings as part of the same
   navigation review; do not renumber blindly because INDEX entries cite §2.43.

## Evidence

- The committed version is 471 lines; the working version is 834 lines.
- The working diff adds 368 lines and removes 5 in this note, principally the six
  September sections and their preamble provenance.
- Both this note and `knowledge/INDEX.md` are currently modified.
- Inbound references include retained digest snapshots with heading-fragment links
  to the September sections, so a move requires explicit anchor preservation.

No knowledge file was edited in this pass. The health signal is closed by a
bounded split review with a concrete boundary; execution is intentionally deferred
until the active source changes are integrated.
