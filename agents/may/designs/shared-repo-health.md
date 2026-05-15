# Design: `agents/shared/` — Backfill & Lifecycle

**Author**: May
**Date**: 2026-04-02 (v2 — revised per Hao feedback)
**Status**: Proposal for Hao's review

---

## Goal

Two things:

1. **Backfill**: We have valuable knowledge scattered across agent-local directories that should be in `shared/`. Get it there.
2. **Lifecycle**: As `shared/` grows, keep it healthy with simple rules for archival and staleness.

No layout changes. No restructuring.

---

## Part 1: Backfill (High Priority)

We have ~1,500 knowledge artifacts trapped in agent-local directories where other agents can't access them. This is the highest-value work — making use of what we already have.

### Backfill Source A: Scout Deep-Dives & Cross-References (820 files, 11MB)

Scout's SOUL says to write to `shared/knowledge/library/deep-dives/`. But the bulk of Scout's research is stuck in `scout/workspace/archive/2026-03/`:

| Type | In scout/workspace/archive | In shared/knowledge/library/deep-dives | Overlap |
|------|---------------------------|---------------------------------------|---------|
| Deep-dives (`deep-dive-*`, `dd-*`) | 310 | 13 | 1 |
| Cross-references (`cr-*`, `cross-ref-*`) | 150 | 0 | 0 |
| Grand syntheses (`GRAND-UNIFIED-*`) | 8 | 0 | 0 |
| Other research (survey, weekly-capstone, etc.) | ~352 | 62 | ~1 |

These are real research: paper analyses, cross-reference syntheses, capstone reports. Example:
- `dd-234-lm-teams-distributed-systems.md` — arXiv paper analysis on multi-agent architectures
- `cr-145-ecosystem-defense-framework.md` — cross-synthesis rated ★★★★★
- `GRAND-UNIFIED-SYNTHESIS-v3.1-delta.md` — major synthesis document

**Action**: Copy all research files from `scout/workspace/archive/` to `shared/knowledge/library/deep-dives/`. One-time backfill. Keep existing `deep-dives/` contents.

```bash
cp agents/scout/workspace/archive/2026-03/deep-dive-*.md agents/shared/knowledge/library/deep-dives/
cp agents/scout/workspace/archive/2026-03/dd-*.md agents/shared/knowledge/library/deep-dives/
cp agents/scout/workspace/archive/2026-03/cr-*.md agents/shared/knowledge/library/deep-dives/
cp agents/scout/workspace/archive/2026-03/cross-ref-*.md agents/shared/knowledge/library/deep-dives/
cp agents/scout/workspace/archive/2026-03/GRAND-UNIFIED-*.md agents/shared/knowledge/library/deep-dives/
cp agents/scout/workspace/archive/2026-03/weekly-capstone-*.md agents/shared/knowledge/library/deep-dives/
cp agents/scout/workspace/archive/2026-03/survey-*.md agents/shared/knowledge/library/deep-dives/
cp agents/scout/workspace/archive/2026-03/synthesis-*.md agents/shared/knowledge/library/deep-dives/
# Also copy any other .md research files (excluding config/temp files)
```

**Pipeline fix**: Ensure Scout's heartbeat writes directly to `shared/` going forward so this doesn't re-accumulate.

### Backfill Source B: Bob's Research Archives (332 files, 1.5MB)

Bob has 332 synthesis documents in `bob/knowledge/library/archives/`. These are NOT personal notes — they're paper analyses and research syntheses:

- `2026-03-14-agent-cgroup.md` — "Synthesis: AgentCgroup & The OS Bottleneck" (arXiv:2602.09345)
- `2026-03-15-*` — 97 files from a single day of research synthesis
- `2026-05-19-*` — 19 more recent synthesis docs

Only 9 of these 332 files have the same name as anything in shared/. The rest is unique knowledge.

**Action**: Copy to `shared/knowledge/library/deep-dives/` (these are effectively the same thing as Scout's deep-dives — paper analyses and research syntheses).

```bash
cp agents/bob/knowledge/library/archives/*.md agents/shared/knowledge/library/deep-dives/
```

### Backfill Source C: Amy-Kimi's Insights Archives (198 files, ~4.4MB)

Amy-Kimi has ~198 files unique to her local `knowledge/library/` that aren't in shared/. Primarily:
- 154 `insights-archive-*` files — historical insight compilations
- 24 `insights-archive-kimi-*` — Kimi-specific insight compilations
- 7 `signals-archive-*` — signal compilations
- 4 `journal-archive-*` — journal entries

These are curated synthesis — not raw data. They represent Amy-Kimi's processed understanding over months of research.

**Action**: Copy to `shared/knowledge/library/` (maintaining filenames):

```bash
cp agents/amy-kimi/knowledge/library/insights-archive-*.md agents/shared/knowledge/library/
cp agents/amy-kimi/knowledge/library/signals-archive-*.md agents/shared/knowledge/library/
cp agents/amy-kimi/knowledge/library/journal-archive-*.md agents/shared/knowledge/library/
cp agents/amy-kimi/knowledge/library/amy-journal.md agents/shared/knowledge/library/
```

### Backfill Source D: Optimizer Findings (40 files)

Optimizer has 40 `finding-*.md` files in its workspace — operational findings about bugs, cost issues, and system behavior. Examples:
- `finding-socket-reload-0327-1403.md` — "resolved 40+ hour Bob outage"
- `finding-circuit-breaker-gap-0327-0906.md` — architecture gap
- `finding-cost-scan-*.md` — multiple cost analyses

These are operational knowledge that should be accessible system-wide.

**Action**: Copy to `shared/knowledge/findings/` (new subdirectory):

```bash
mkdir -p agents/shared/knowledge/findings
cp agents/optimizer/workspace/finding-*.md agents/shared/knowledge/findings/
```

### Backfill Summary

| Source | Files | Size | Destination |
|--------|-------|------|-------------|
| Scout archive deep-dives & cross-refs | ~460 | ~9MB | `shared/knowledge/library/deep-dives/` |
| Scout archive other research | ~360 | ~2MB | `shared/knowledge/library/deep-dives/` |
| Bob research archives | 332 | 1.5MB | `shared/knowledge/library/deep-dives/` |
| Amy-Kimi insights/signals/journal archives | ~198 | 4.4MB | `shared/knowledge/library/` |
| Optimizer findings | 40 | ~200KB | `shared/knowledge/findings/` |

**Total backfill: ~1,390 files, ~17MB of knowledge currently invisible to the system.**

### What NOT to Backfill

- **Amy-Kimi's local post copies** (2,464 files) — byte-for-byte identical to `shared/`. Can be deleted after backfill to save 12MB.
- **Agent-specific working files** (coaching.md, strategies.md, personal journals) — these are legitimately local.
- **Optimizer cost scans** — these overlap with findings but are more ephemeral; the findings already capture the important bits.

---

## Part 2: Lifecycle Rules (Keep It Healthy Going Forward)

The repo is the archive — git handles history. No "archive" subdirectories. Instead, lifecycle means: **delete stale content** (git preserves it) and **keep indexes readable**.

### Rule 1: Hypothesis Hygiene (Monthly Check)

21 hypotheses with inconsistent status labels (`untested` vs `Proposed` vs `Active`). Some proposed months ago with no experiment.

**Rule**: Hypotheses with no file changes for 30+ days → mark as `stale` in the file header. If stale for 60+ days, delete the file (git preserves it). This keeps the hypothesis directory showing only active work.

### Rule 2: Bulletin Trim

Bulletin.md grows until someone manually trims it.

**Rule**: When bulletin.md > 100 lines, delete entries older than 7 days. They're in git if anyone needs them.

### Rule 3: Delete Stale Duplicates

After backfill, agent-local copies of shared/ content are waste.

**Rule**: Delete local copies after backfill. If an agent needs the content, it reads from shared/. If shared/ content is later deleted, git has it.

### Lifecycle Summary

| Rule | What | When | Action |
|------|------|------|--------|
| Hypothesis hygiene | Stale >30 days | Monthly | Mark stale, delete at 60 days |
| Bulletin trim | >100 lines | As needed | Delete old entries |
| Delete duplicates | After backfill | Once | Delete agent-local copies |

---

## Part 3: One-Time Cleanup (After Backfill)

### A. Delete Amy-Kimi Local Post Duplicates

2,464 files byte-for-byte identical to `shared/knowledge/library/posts/`. Amy-Kimi's SOUL already points to shared/ as canonical. Git preserves history.

**Saves**: 12MB, 2,464 files of pure waste.

### B. Delete Scout Local Archive

After backfilling to shared/, the local archive is redundant. Delete it — git preserves history.

### C. Delete Bob Local Archives

Same — after backfill to shared/, the local copies are redundant.

---

## Execution Plan

**Phase 1 — Backfill** (can start immediately):
1. Scout deep-dives + cross-refs + other research → shared/ (~820 files)
2. Bob research archives → shared/ (~332 files)
3. Amy-Kimi insights archives → shared/ (~198 files)
4. Optimizer findings → shared/ (~40 files)
5. Verify no filename collisions; resolve any conflicts

**Phase 2 — Cleanup**:
6. Delete amy-kimi local post copies (-2,464 files, -12MB)
7. Delete scout local archive (-820 files, -11MB)
8. Delete bob local archives (-332 files, -1.5MB)

**Phase 3 — Lifecycle** (implement in May's periodic tasks):
9. Monthly hypothesis hygiene check
10. Bulletin trim when needed

---

## Decision Points for Hao

1. **Approve backfill scope?** ~1,390 files from 4 agents into shared/. Biggest piece is Scout's 820 research files.

2. **Backfill destination**: Put everything research-related into `deep-dives/`? Or create separate dirs for cross-refs, syntheses, findings?

3. **Delete local copies after backfill?** Amy-Kimi posts (2,464), Scout archive (820), Bob archives (332). Git preserves everything.

4. **Start phase 1 now?** The backfill is safe (additive only, no deletions) and high-value.
