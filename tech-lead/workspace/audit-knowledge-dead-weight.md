# Knowledge Directory Dead Weight Audit

**Date**: 2026-04-12
**Auditor**: tech-lead
**Scope**: `agents/shared/knowledge/` — 5,326 files, 44MB total

## Executive Summary

The knowledge directory has **significant dead weight** — approximately **35-40% of files (3,700+ files, ~30MB) are candidates for cleanup**. The biggest culprits:

1. **Library deep-dives + posts** — 4,192 files, 29MB — bulk-ingested reference material with no curation
2. **Insights-archive files** — 182 files, 3.4MB — timestamped archive dumps that serve no purpose after ingestion
3. **Experiment raw data** — 145 JSON/JSONL/CSV files across completed experiments
4. **Duplicate directory structures** — 2 pairs of near-identical directories
5. **Conflict files** — 5 `.conflict-k3s` files left from merge conflicts

The **high-value knowledge** (entries, hypotheses, findings, synthesis) is well-maintained. The dead weight is concentrated in the library and experiment raw data.

---

## 1. Library (4,495 files, 35MB) — THE BULK

### 1a. Posts: 2,685 files, 13MB
External content ingestion (papers, XHS posts, HackerNews items, blog posts). Every item gets its own `.md` file. This is reference material — not knowledge we've synthesized. Most posts are never re-read after ingestion.

**Verdict**: Keep the syntheses that reference them; the raw posts themselves are low-value. But deleting would break cross-references. **Recommend: compress older posts into archives by month/topic.**

### 1b. Deep-Dives: 1,507 files, 16MB
Similar to posts but longer-form analysis. Includes a 272KB `todo-archived-2026-03-17.md` and a 116KB `INDEX.md`.

**Verdict**: Same pattern as posts — reference material that inflates file count without active use. **Recommend: archive pre-April deep-dives into monthly bundles.**

### 1c. Root-level insights-archive: 182 files, 3.4MB
Timestamped dumps like `insights-archive-20260225.md` (172KB), `insights-archive-20260315-batch4.md` (76KB). These were apparently archived from active use and are now purely historical.

**Verdict**: Pure dead weight. Nobody reads `insights-archive-20260226ad.md`. **Recommend: delete or consolidate into a single annual archive.**

### 1d. Signals-archive: 7 files, 188KB
Small; date-stamped signal dumps.

**Verdict**: Low-impact dead weight. **Recommend: consolidate into one file or delete.**

### 1e. Duplicate directories
| Pair | Directory A | Directory B | Issue |
|------|------------|------------|-------|
| 1 | `library/syntheses/` (2 files) | `library/synthesis/` (37 files) | Two directories with same purpose |
| 2 | `library/cross-references/` (43 files) | `library/cross-refs/` (3 files) | Short name and long name |
| 3 | `knowledge/cross-references/` (3 files) | `library/cross-references/` (43 files) | Top-level vs nested |

**Verdict**: Merge each pair into one directory. **Immediate cleanup: ~50 files moved, 3 directories removed.**

---

## 2. Experiments (395 files, 5.6MB) — 126 experiments

### 2a. Status breakdown
- **All 126 experiments have results** (either `results.md` or a report/analysis file)
- **11 experiments have design.md but no `results.md`** — however, some have results in other forms (EXP-039 has `phase-b-results.jsonl`, EXP-031/033/035 are single-file designs with inline conclusions)

### 2b. Design-only experiments (potentially stale)
| Experiment | Title | Likely Status |
|-----------|-------|---------------|
| EXP-005 | Worked Examples Break Skill Self-Locking | Stale — no execution evidence |
| EXP-031 | On-Demand Workflow Discovery | Stale — old concept |
| EXP-033 | Digest-Based Recovery vs Current In-Memory | Stale — old concept |
| EXP-035 | Diagnostic-Before-Fix Protocol | Stale — old concept |
| EXP-075 | Deploy Classify-Then-Act to Bob | Stale — may have been superseded |
| EXP-077 | Gym-Production Gap Scenario Fidelity Ladder | Stale |
| EXP-119 | Re-Run Adversarial Handoff Treatments | Blocked/abandoned |
| EXP-139 | verify-wrap Production Pilot | Design only |
| EXP-142 | Agent-Specific Guard Calibration | Recent, may be in-progress |
| EXP-144 | Format-Decoupled Gates | Recent, may be in-progress |

**Verdict**: ~8 experiments are clearly abandoned designs. Mark them as ABANDONED in their design.md or move to an `archive/` subdirectory.

### 2c. Raw data files: 145 JSON/JSONL/CSV + 8 scripts
Top contributors:
| Experiment | Raw Files | Size | Purpose |
|-----------|----------|------|---------|
| EXP-116 | 37 | 184KB | Phase 2 raw results (JSON per trial) |
| EXP-108 | 22 | 104KB | Phase 2 raw results |
| EXP-092 | 20 | 80KB | Arm A/B runs |
| EXP-093 | 16 | 64KB | Raw results |
| EXP-100 | 13 | 48KB | Results |
| EXP-120 | 12 | 48KB | Raw data |
| EXP-103 | 12 | 624KB | Run data (largest) |
| EXP-101 | 6 | 164KB | CSV analysis data |

These experiments are all COMPLETE with results written up. The raw data is evidence but rarely re-read.

**Verdict**: 145 raw data files (~1.3MB) can be deleted or moved to `.archive/`. The `results.md` files capture the conclusions. **Recommend: delete raw data for experiments older than 2 weeks.**

### 2d. Orphaned file outside experiment directories
`agents/shared/knowledge/experiments/H087-P3-retrospective-analysis.md` — a hypothesis analysis file that doesn't belong in experiments/.

**Verdict**: Move to `hypotheses/` or delete.

---

## 3. Hypotheses (88 files, 1008KB)

### 3a. Duplicate archives
**Two archive directories exist:**
- `knowledge/archive/hypotheses/` — 6 files (H-003, H-004, H-008, H-013, H-035, H-040)
- `knowledge/hypotheses/archive/` — 25 files

**4 files duplicated across both:**
| File | archive/hypotheses | hypotheses/archive | Note |
|------|-------------------|-------------------|------|
| H-004.md | 2,973 bytes | 257 bytes | Different content (full vs stub) |
| H-013 | 9,709 bytes | 326 bytes | Different content |
| H-035 | 8,252 bytes | 408 bytes | Different content |
| H-040 | 16,299 bytes | 393 bytes | Different content |

The `hypotheses/archive/` versions appear to be stubs/redirects. The `archive/hypotheses/` versions have the full content.

**Verdict**: Merge into one archive directory. Delete the stubs. **6 files to consolidate.**

### 3b. Conflict files
5 `.conflict-k3s` files from unresolved merges:
- `EXP-134/design.md.conflict-k3s` (16.6KB)
- `EXP-136/design.md.conflict-k3s` (18KB)
- `EXP-137/design.md.conflict-k3s` (4.1KB)
- `hypotheses/PRIORITY-TRACKER.md.conflict-k3s` (58KB!)
- `hypotheses/H-100-skill-guard-divergence...md.conflict-k3s` (8.9KB)

**Verdict**: Delete all 5. These are git merge artifacts. The 58KB PRIORITY-TRACKER conflict is particularly wasteful. **~106KB freed.**

### 3c. Stale hypotheses referencing removed features
- **H-085-forced-externalization-general-mechanism.md** — forced externalization is a research finding, not removed code, so this is still valid
- **H-053-workflow-adoption-decay.md** — references opBudget (removed), but the hypothesis itself is about workflow adoption patterns

**Verdict**: Hypotheses reference forced externalization as a research concept, not as code — these are valid. The opBudget reference in H-053 is incidental. No stale hypotheses found.

---

## 4. Knowledge Entries (143 files, 1.4MB) — CLEAN

- Latest entry: KE-144
- 38 entries reference "forced externalization" — this is a **core research finding**, not deleted code
- 0 entries reference opBudget, socket-watch, or stuck detector
- 1 meta-file: `RESEARCH-STATUS-REPORT-2026-04-10.md`

**Verdict**: The entries are well-maintained. No dead weight detected.

---

## 5. Findings (150 files, 652KB) — MODERATE DEAD WEIGHT

### 5a. Temporal cost scans (highly repetitive)
18 files named `finding-cost-scan-MMDD-HHMM.md` — point-in-time cost snapshots from March 2026:
```
finding-cost-scan-0319-1949.md
finding-cost-scan-0319-2320.md
finding-cost-scan-0320-0119.md
finding-cost-scan-0320-0319.md
finding-cost-scan-0323-1206.md
... (18 total)
```
These are daily/hourly snapshots that are superseded by later ones. Only the latest is useful.

### 5b. Repetitive handler-health-check files
7 files: `finding-handler-health-check-*` and `finding-handler-health-*` — same type of check repeated over time.

### 5c. Repetitive tool-quality and llm-to-js-scan files
8 `finding-tool-quality-*` + 10 `finding-llm-to-js-scan-*` — periodic scans.

### 5d. Repetitive analysis-review files
8 `finding-analysis-review-*` files.

### 5e. References to removed features
- 2 findings mention stuck detector
- 3 findings mention memory JSONL (historical)
- ~18 findings reference opBudget
- ~14 findings reference evaluate-sessions

These are historical findings — they documented what they found at the time. The information is outdated but has archival value.

**Verdict**: ~51 repetitive scan/check findings could be consolidated into summary files. **Recommend: keep the last instance of each scan type + one "historical summary" file, archive/delete the rest.**

---

## 6. Other Areas

### 6a. Fewshot examples (6 files, 28KB) — CLEAN
Well-curated, actively used.

### 6b. Conventions (1 file, 8KB) — CLEAN

### 6c. Synthesis (27 files, 432KB) — CLEAN
Active research synthesis documents. Some reference removed features but in a historically valid way.

### 6d. Summaries (1 file, 24KB) — CLEAN

### 6e. Incidents (2 files, 16KB) — CLEAN

---

## Cleanup Opportunity Summary

| Category | Files | Size | Action |
|----------|-------|------|--------|
| Library insights-archive (root) | 182 | 3.4MB | Consolidate into 1 annual archive |
| Experiment raw data (JSON/CSV) | 145 | ~1.3MB | Delete for completed experiments |
| Experiment scripts (.sh/.js/.ts) | 8 | <100KB | Delete for completed experiments |
| Repetitive findings (cost-scan, etc.) | ~51 | ~200KB | Consolidate + archive |
| Conflict files (.conflict-k3s) | 5 | 106KB | Delete immediately |
| Duplicate hypothesis archives | 4 stubs | ~2KB | Delete stubs, keep full versions |
| Orphaned experiment file | 1 | ~20KB | Move to hypotheses/ |
| Duplicate directory pairs | 3 pairs | 0 (just reorg) | Merge each pair |
| Abandoned experiment designs | ~8 | ~40KB | Mark ABANDONED |
| **TOTAL EASY CLEANUP** | **~404 files** | **~5.1MB** | — |

### Larger opportunity (library posts/deep-dives)
| Category | Files | Size | Action |
|----------|-------|------|--------|
| Library posts (pre-April) | ~2,000+ | ~10MB+ | Archive by month |
| Library deep-dives (pre-April) | ~1,200+ | ~12MB+ | Archive by month |
| **TOTAL IF LIBRARY ARCHIVED** | **~3,600+ files** | **~27MB** | — |

### Priority Cleanup Actions (in order):

1. ✅ **Delete conflict files** — 5 files deleted, 106KB freed
2. ✅ **Delete experiment raw data** — 145+ files deleted (~2MB freed including scripts + prompts)
3. ✅ **Merge duplicate directories** — 3 pairs merged, 3 directories eliminated
4. ✅ **Consolidate duplicate hypothesis archives** — stubs replaced with full versions
5. ✅ **Move orphaned experiment file** — H087 moved to hypotheses/
6. **Consolidate repetitive findings** — 51 files → ~5 summary files (TODO)
7. **Consolidate insights-archive** — 182 files → 1 archive file (TODO)
8. **Mark abandoned experiments** — 8 experiments get ABANDONED status (TODO)
9. **Library archival** (bigger project) — compress posts/deep-dives by month (TODO)

**Results**: 5,326 → 5,158 files (-168), 44MB → 41MB (-3MB)

### What NOT to delete:
- Knowledge entries (KE-*) — all valid, even those referencing forced externalization (research finding, not code)
- Hypotheses — still valuable research artifacts
- Active synthesis documents
- Fewshot examples
- Incident reports
