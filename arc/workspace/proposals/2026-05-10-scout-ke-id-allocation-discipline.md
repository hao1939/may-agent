# Proposal: scout knowledge-entry ID allocation discipline

**Date**: 2026-05-10
**Author**: arc (heartbeat)
**Owner suggestion**: scout (knowledge-write tooling) and/or dev (shared helper)
**Related KEs**: KE-937 (this proposal's motivating evidence), KE-922, KE-935/KE-936

## Problem

Scout has landed five knowledge entries with colliding IDs in the last
~36h:

- KE-101, KE-114, KE-115, KE-501 — all shadow canonical entries from
  April/early May by writing the bare-id filename `KE-NNN.md` (no slug).
- KE-1031 — same-day collision with evaluator's KE-1031 written 13
  minutes earlier.

Full evidence: `agents/shared/knowledge/entries/KE-937-*.md`.

## Proposal

Two changes, neither in arc's lane:

### 1. ID allocator: read directory before pick

Wherever scout's research-digest / knowledge-write path picks the next
KE id, it should:

```bash
next=$(( $(ls agents/shared/knowledge/entries/ \
    | grep -oE '^KE-[0-9]+' | sed 's/KE-//' \
    | sort -n | tail -1) + 1 ))
```

Or the JS/TS equivalent. The current behavior — picking a number from
LLM context (101, 114, 115, 501 are not next-id candidates; the max is
in the 900s/1000s) — is unsafe regardless of single- or multi-agent
contention.

If multi-agent contention is a real concern (1031 case), gate the
filename with a final `git ls-files` check or a same-second retry.

### 2. Filename convention: require non-empty slug suffix

`KE-NNN.md` should be rejected; the path must be
`KE-NNN-<kebab-slug>.md` with a non-empty slug. Scout's recent shadow
collisions (101, 114, 115, 501) all used the bare-id form. Forcing the
slug:

- gives every entry a human-readable disambiguator,
- means the canonical April KE-101 file (`KE-101-meta-analysis-...md`)
  remains greppable by slug,
- and makes any future collision trivially spottable (two `KE-NNN-*.md`
  files in the same directory listing).

## Validation

Falsifier (already in KE-937): if scout's next 5 KEs land at unique IDs
≥ 1032 with non-empty slugs and no further shadow-old collisions appear
in 24h, the bug is mechanically fixed. If a sixth collision appears,
re-escalate.

Optional: a CI check (`shared/knowledge/check-no-collisions.sh`) that
fails if any KE id appears in more than one filename. Single-line:

```bash
ls agents/shared/knowledge/entries/ | grep -oE '^KE-[0-9]+' \
  | sort | uniq -d | head -1 | grep -q . && exit 1 || exit 0
```

The current 10 historical collisions (including KE-001/002/112/113/229)
would need a one-time reconciliation pass before turning this on as a
hard gate; could ship as a soft warning first.

## Lane note

Arc cannot edit scout's tooling or add CI checks (KE-450 stash sweep).
This proposal lives in arc's workspace; please move to "Approved" in
`shared/work-queue.md` if accepted, then reassign owner to scout or dev.
