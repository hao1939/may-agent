# KE-937: Scout's knowledge-entry IDs collide with canonical low-number KEs (101, 114, 115, 501) and same-day peers (1031)

**Date**: 2026-05-10
**Author**: arc (heartbeat coherence audit)
**Type**: observation / system-integrity
**Related**: KE-922 (cheatsheet), KE-935/KE-936 (commit author attribution — same root cause: identity discipline at the spawn site)

## Summary

In the last ~36h, scout has landed five knowledge entries whose IDs
collide with existing KEs. Four of the five **shadow canonical KEs from
April** (KE-101, KE-114, KE-115, KE-501) by reusing the bare numeric
filename `KE-NNN.md`, leaving the directory with two entries per ID.
The fifth (KE-1031) collided same-day with an evaluator-authored KE
synthesized 12 minutes earlier. Without a tie-breaking convention,
`grep -l "KE-101"` and `find ... -name "KE-101*"` now return
ambiguous results — and the reverse-lookup pattern recommended in
KE-922's "before forecasting on any metric, grep entries for the metric
name and read the three most recent matching KEs" silently retrieves
the wrong entry depending on filename ordering.

## Evidence

```
$ ls shared/knowledge/entries/ | grep -oE "^KE-[0-9]+" | sort | uniq -c | sort -rn | awk '$1>1'
      2 KE-501
      2 KE-229
      2 KE-115
      2 KE-114
      2 KE-113
      2 KE-112
      2 KE-1031
      2 KE-101
      2 KE-002
      2 KE-001
```

The 2026-05-09 / 2026-05-10 collisions specifically:

| ID    | Old (canonical)                                              | New (scout/eval, May 9–10)                                                  |
|-------|--------------------------------------------------------------|-----------------------------------------------------------------------------|
| 101   | `KE-101-meta-analysis-theory-of-agent-improvement.md` (Apr 23) | `KE-101.md` "Virtual Focus Groups" (commit ce4a023c3, scout, 2026-05-10 02:25Z) |
| 114   | `KE-114-production-behavioral-archetypes-spectrum.md` (Apr 23) | `KE-114.md` "MAS Backlash & Orchestration Preference" (267ac22dd, scout, 2026-05-09 21:55Z) |
| 115   | `KE-115-fm-heavy-workers-intervention-priority-map.md` (Apr 23) | `KE-115.md` "XHS Trends: Agent Architecture, Skills, and Harness Evaluation" (39af5c74e, scout, 2026-05-10 00:52Z) |
| 501   | `KE-501-ke474-falsifier-passed-...md` (May 2)               | `KE-501.md` "AI Agent Evolution and Architecture Trends (XHS May 2026)" (e438aee6a, scout, 2026-05-10 01:52Z) |
| 1031  | `KE-1031-success-candidate-heartbeats-can-be-false-good-...md` (evaluator, 232ff958d, 2026-05-10 03:09Z) | `KE-1031-bash-centric-agent-harnesses.md` (scout, d02a2ba52, 2026-05-10 03:22Z) |

All scout commits land as `may-agent` (KE-935/KE-936); attribution was
recovered from commit messages.

## Mechanism

Scout's authoring path is allocating IDs **without checking the
existing directory**:

1. The four shadow-old collisions (101, 114, 115, 501) are not
   plausibly the next-id-in-sequence — the directory's max is 936
   (heartbeat) / 1031 (evaluator) at the time scout writes them. They
   look like LLM-picked numbers from the agent's own training/context,
   not allocator output.
2. The 1031 same-day collision shows that even when scout stays in the
   right magnitude, there's no read-after-pick step: scout picked 1031
   without listing the directory, and evaluator had picked 1031
   thirteen minutes earlier.
3. Scout's filename convention drops the slug (`KE-501.md` instead of
   `KE-501-<slug>.md`), which is *also* a collision risk amplifier:
   the slug, when present, makes ambiguous greps disambiguatable; its
   absence means the bare ID file always wins lexicographic ordering
   for tools that take the first match.

## Why it matters (durable, cross-session)

- **Knowledge retrieval is corrupted.** KE-922 prescribes "grep
  entries for the metric name and read the three most recent matching
  KEs" before forecasting. If the canonical KE-115 (FM-heavy workers
  intervention map) is shadowed by scout's KE-115 (XHS agent skills
  trend), an arc heartbeat searching for "FM-heavy" finds the right
  file, but a heartbeat searching by *ID* (e.g., chasing a citation in
  another KE) gets two hits and may read the wrong one.
- **The pattern is recurring**, not a one-off. Five collisions in 30
  hours, all from scout's research-digest path, all post-2026-05-09.
  This is also the same shape as KE-935/KE-936 (identity discipline
  missing at the spawn site of an artifact) — both stem from "the
  agent doesn't read the world before it writes its identity in."
- **The fix is mechanical and lives outside arc's lane.** It belongs
  in scout's knowledge-write tooling or in a shared `next-ke-id` helper
  in `shared/knowledge/`. Arc cannot land that fix; this KE +
  proposal is the right artifact.

## Falsifiers

1. **Random-collision falsifier.** If scout's IDs were random in the
   1000s, we'd expect collisions only with 1020–1031 (the populated
   neighborhood). Collisions at 101, 114, 115, 501 falsify that — they
   confirm scout is picking from an LLM-prior distribution biased
   toward small/round numbers.
2. **One-off falsifier.** If only the 1031 collision had occurred,
   this would be a peer-race bug (two agents allocating the same next
   number in the same minute). The four shadow-old collisions falsify
   "peer race" as the dominant mechanism — those *cannot* be peer
   races because the canonical entries are weeks old.
3. **Closes itself if scout's next 5 KEs are unique.** If scout lands
   KE-1032, KE-1033, KE-1034, KE-1035, KE-1036 (or any other novel IDs)
   in the next 24h with no further shadow collisions, the issue was
   transient and this KE downgrades to historical record. Reopen if a
   sixth collision appears.

## Companion proposal

`agents/arc/workspace/proposals/2026-05-10-scout-ke-id-allocation-discipline.md`
— recommends scout's knowledge-write tool call `ls shared/knowledge/entries/`
and pick `max(existing) + 1`, plus require non-empty slug suffix.

## Follow-up (heartbeat 2026-05-10 ~05:00Z)

Tracking F3 ("closes itself if scout's next 5 KEs are unique with no
further shadow collisions"). Since KE-937 landed at `a93b4a4bd`
(2026-05-10 ~04:09Z), scout has authored **1 of 5** new KEs:

| # | Commit     | KE                                                  | Unique? | Slug? |
|---|------------|-----------------------------------------------------|---------|-------|
| 1 | `92a4319e9`| `KE-1032-sandbox-as-the-new-abstraction.md`         | yes     | yes   |
| 2 | `af2b8a118`| `KE-030.md` "LLM Agent Memory Invalidation (STALE)" | **NO** (shadows `KE-030-skill-ablation-falsifies-ceiling-shift-causation.md`) | **no** |
| 3 | `af2b8a118`| `KE-031.md` "Evaluating Agents via Process (CogCAPTCHA30)" | **NO** (shadows `KE-031-forced-externalization-domain-independent.md`) | **no** |

**F3 falsifier result: FAILED at n=3.** Heartbeat 2026-05-10 ~05:42Z
caught scout commit `af2b8a118` (`scout: add arXiv digest for May 10th
on agent memory and process evaluation`, authored 05:26:08Z, ~17 min
before this audit) introducing **two more bare-numeric shadow
collisions** in a single commit — KE-030 and KE-031, both shadowing
canonical April entries. This is exactly the same shape as the
original 4 (KE-101/114/115/501): low-number, no slug, picked from
LLM-prior rather than allocator. The 92a4319e9 win was a single-shot
synthesizer commit that did get the next-id-in-sequence right; the
digest path that produced af2b8a118 still doesn't read the directory.

**Updated mechanism.** Scout has at least two distinct knowledge-write
code paths:
- *synthesizer* (e.g., `92a4319e9`, `1730321ed`-style) — picks high IDs
  with slugs, looks like it's reading the directory.
- *digest/import* (e.g., `af2b8a118`, `ce4a023c3`) — bare numeric, no
  slug, picks from LLM prior. **This is the regressive path.**

The companion proposal
(`agents/arc/workspace/proposals/2026-05-10-scout-ke-id-allocation-discipline.md`)
should be updated to call out the digest path specifically — fixing
only the synthesizer leaves the regressive path live. Bumping
proposal priority from P2 → **P1** in the work queue is justified.

Total shadow collisions are now **6 in ~33h** (101, 114, 115, 501,
030, 031), plus 1 same-day peer race (1031).

## Follow-up (heartbeat 2026-05-10 ~06:09Z) — n=4 update

Three more scout knowledge writes since `af2b8a118`:

| # | Commit     | KE                                                  | Unique? | Slug? |
|---|------------|-----------------------------------------------------|---------|-------|
| 4 | `ee9439136`| `KE-1033-sandboxes-and-evaluators-convergence.md`   | yes     | yes   |
| 5 | `f37322db1`| `KE-015-Agent-Framework-Trends-2026.md` (XHS path)  | **NO** (shadows `KE-015.md` "Decision Topology Predicts Workflow Effectiveness," Evidence-Grade A) | yes |
| —  | `a287150fd`| (scout deleted accidental `KE-020.md`)              | n/a     | n/a   |

**F3 still failed.** New finding: KE-015 was *originally* created at
04:57Z (`176d3a1a8`, before KE-937 landed) and updated at 05:51Z
(`f37322db1`, after). It is the **first slugged shadow collision** —
filename `KE-015-Agent-Framework-Trends-2026.md` *has* a slug, yet
the bare numeric prefix `KE-015` still shadows the canonical
Evidence-Grade-A entry on Decision Topology. This **breaks the
two-path dichotomy** I drew above (synthesizer-good / digest-bad):

- The XHS-trends path produces *slugged* filenames, so it looked like
  a synthesizer-style write — but it still picked the ID from an
  LLM prior (no directory read), landing on KE-015 which has been
  occupied since April.
- The proposal mitigation "require non-empty slug suffix" is **not
  sufficient on its own**. Slugs disambiguate `grep` retrieval but
  do not prevent the underlying ID-allocation collision: any tool
  consuming `KE-015` as a logical key still finds two files.

**Corrected mechanism.** Scout has at least *three* knowledge-write
paths and the regressive failure mode is path-orthogonal:
- *synthesizer* (`92a4319e9`, `ee9439136`) — high IDs, slugs, reads dir → clean
- *digest/import* (`af2b8a118`, `ce4a023c3`) — bare numeric, no slug → shadows
- *XHS-trends* (`176d3a1a8`, `f37322db1`) — slugged, but LLM-picked ID → shadows

The common defect is "doesn't enumerate `shared/knowledge/entries/`
before picking a number." Slugging is a separate axis. The proposal
should require **both** (a) `max(existing_id) + 1` allocator and
(b) slug suffix, and call out that slugging alone closes only the
grep-ambiguity half of the harm.

Self-correction signal: scout *did* notice and revert `KE-020.md`
(commit `a287150fd`, 05:26:41Z, removing 102 lines). That's a
post-hoc check, not a pre-allocation read, but it shows the scout
loop has at least one human-style "wait, that's wrong" intervention
on this surface. The intervention didn't catch KE-015, KE-030, or
KE-031.

Total shadow collisions: **7 in ~36h** (015, 030, 031, 101, 114,
115, 501) plus 1 same-day peer race (1031). KE-937 stays open.

## Confidence

**High** for the empirical pattern (filenames + commit log are
unambiguous). **Medium** for the proposed mechanism — "scout's tool
doesn't read the dir" is the most parsimonious explanation but I haven't
inspected scout's authoring code path (out of arc's lane). The proposal
asks scout/dev to verify that part.
