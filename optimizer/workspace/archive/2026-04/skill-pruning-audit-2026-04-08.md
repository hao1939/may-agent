# Skill Pruning Audit: Coach & Evaluator — 2026-04-08

**Author**: Optimizer  
**Triggered by**: KE-025 (Instruction Overhead Paradox), Knowledge Application Audit  
**Goal**: Identify which skill files to prune from Coach and Evaluator to reduce context overhead per KE-025

---

## Executive Summary

Coach has **20 skill files totaling 94KB** — the highest of any agent (average is 3-6 files / 8-21KB). Evaluator has **13 skill files totaling 33KB** — second highest. Per KE-025, this instruction overhead likely *decreases* task completion and *increases* inference cost. 

This audit identifies **16 Coach files** and **7 Evaluator files** for removal, which would reduce Coach skills from 94KB → ~15KB (84% reduction) and Evaluator skills from 33KB → ~22KB (33% reduction).

---

## Methodology

1. **Content analysis**: Read every skill file, understood its purpose
2. **Usage analysis**: Queried `sessions` and `evaluations` tables for skill name references in tasks/outcomes  
3. **Overlap detection**: Diffed duplicate pairs (SKILL.md vs standalone .md)
4. **Infrastructure dependency**: Checked if referenced tools/data sources actually exist
5. **Reference patterns**: Checked whether SOUL.md, heartbeat.md, or workflows reference the skill

---

## Coach Skills Analysis (20 files, 94KB)

### Convention Library (7 files, 43KB) — PRUNE 6, KEEP 1

| File | Size | Usage | Recommendation |
|------|------|-------|----------------|
| `agent-conventions/SKILL.md` | 8.4KB | Index file referencing sub-files | **PRUNE** — sub-files do the work |
| `agent-conventions/behavior.md` | 6.5KB | Convention codes (B1-B7) | **PRUNE** — reference material, not behavioral |
| `agent-conventions/coordination.md` | 3.8KB | Convention codes (C1-C40) | **PRUNE** — reference material |
| `agent-conventions/knowledge-mgmt.md` | 3.6KB | Convention codes (K1-K5) | **PRUNE** — reference material |
| `agent-conventions/model-specific.md` | 10KB | Model-specific tips (Gemini, Kimi, etc.) | **PRUNE** — 10KB of model lookup data, Coach doesn't choose models |
| `agent-conventions/operational.md` | 7KB | Convention codes (O1-O14) | **PRUNE** — reference material |
| `agent-conventions/structure.md` | 4KB | Convention codes (S1-S8) | **KEEP** — structure conventions relevant to growth-cycle |

**Rationale**: The convention library is a reference document, not a behavioral skill. Coach doesn't need 43KB of convention codes loaded into every session. The `convention-review` workflow explicitly reads `docs/agent-convention.md` from the filesystem when needed — the skill copies are redundant. Keep `structure.md` only because growth-cycle depends on agent structure patterns.

**UPDATE**: Actually, `structure.md` is also reference material. The growth-cycle workflow reads agent files directly. **PRUNE ALL 7**.

### Convention Exercises (4 files, 15KB) — PRUNE ALL

| File | Size | Usage | Recommendation |
|------|------|-------|----------------|
| `convention-exercises/SKILL.md` | 1.6KB | Exercise index | **PRUNE** |
| `convention-exercises/b1-read-before-write.md` | 4.2KB | Exercise template | **PRUNE** |
| `convention-exercises/b7-project-relative-paths.md` | 4.5KB | Exercise template | **PRUNE** |
| `convention-exercises/k1-no-reread-autoloaded.md` | 5KB | Exercise template | **PRUNE** |

**Rationale**: 28 sessions mentioned "exercise" in task text, but **0 outcomes reference convention exercises**. The exercises are templates the growth-cycle could use, but the growth-cycle workflow constructs its own gym-based exercises. These are unused.

### Red Team (2 files, 9KB) — PRUNE 1, KEEP 1

| File | Size | Usage | Recommendation |
|------|------|-------|----------------|
| `red-team.md` | 4.7KB | Original skill (L3 Kinetic Defense protocol) | **PRUNE** — superseded |
| `red-team/SKILL.md` | 4.3KB | Refactored version with categories | **KEEP** — used in 2 sessions, active |

**Rationale**: Two versions of the same skill. The `SKILL.md` version is more structured. Only 2 sessions ever used red-team, so the skill itself is marginal — but security testing has value. Keep one copy.

### Training & Meta-Coaching (5 files, 21KB) — PRUNE 4, KEEP 1

| File | Size | Usage | Recommendation |
|------|------|-------|----------------|
| `growth-cycle.md` | 3.6KB | Describes growth cycle methodology | **PRUNE** — the `growth-cycle` *workflow* enforces this already |
| `reactive-lesson.md` | 5.3KB | How to create reactive lessons from failures | **PRUNE** — 0 sessions reference it; concept absorbed into growth-cycle workflow |
| `micro-reward.md` | 4.5KB | Shaping agent behavior with micro-rewards | **PRUNE** — 1 session reference; theoretical, never produced results |
| `transient-skill.md` | 2.6KB | Temporary skills for experiments | **PRUNE** — 0 sessions reference it |
| `consolidate-memory.md` | 4.5KB | Memory consolidation procedure | **KEEP** — 5 session references; actionable, used in workspace hygiene |

**Rationale**: `growth-cycle.md` is a text description of what the `growth-cycle` workflow already enforces mechanically — KE-007/KE-009 says workflow enforcement beats text. `reactive-lesson`, `micro-reward`, and `transient-skill` are Coach methodologies that see near-zero usage.

### Utility Skills (2 files, 6KB) — KEEP BOTH

| File | Size | Usage | Recommendation |
|------|------|-------|----------------|
| `verify-after-edit.md` | 3.1KB | Verify file edits | **KEEP** — proven skill, used across 8+ agents |
| `log-error.md` | 2.8KB | Error logging procedure | **KEEP** — 0 sessions reference, but small and operationally useful |

---

### Coach Pruning Summary

| Category | Files | Before | After | Savings |
|----------|-------|--------|-------|---------|
| Convention library | 7→0 | 43KB | 0 | 43KB |
| Convention exercises | 4→0 | 15KB | 0 | 15KB |
| Red team duplicate | 1→0 | 5KB | 0 | 5KB |
| Training/meta | 4→1 | 18KB | 5KB | 13KB |
| Utility | 0→0 | 6KB | 6KB | 0 |
| **TOTAL** | **16 removed** | **94KB** | **18KB** | **76KB (81%)** |

Remaining Coach skills (4 files, ~18KB):
1. `red-team/SKILL.md` (4.3KB)
2. `consolidate-memory.md` (4.5KB)
3. `verify-after-edit.md` (3.1KB)
4. `log-error.md` (2.8KB)

---

## Evaluator Skills Analysis (13 files, 33KB)

### Duplicate Pairs (3 pairs, 6 extra files) — PRUNE DUPLICATES

| Standalone | SKILL.md | Size diff | Recommendation |
|-----------|----------|-----------|----------------|
| `detect-drift.md` (1.4KB) | `detect-drift/SKILL.md` (1.4KB) | Similar | **PRUNE standalone** — SKILL.md is newer, better structured |
| `manage-backups.md` (2.1KB) | `manage-backups/SKILL.md` (1.3KB) | Different detail level | **PRUNE SKILL.md** — standalone is more complete |
| N/A | `detect-p53-drift/SKILL.md` (1.8KB) | No duplicate | **PRUNE** — entrypoint .cjs is missing (noted as blocked in periodic-tasks.md) |
| N/A | `drift-controller/SKILL.md` (1KB) | No duplicate | **PRUNE** — 1 delegation reference, orchestration logic better in heartbeat |

### Dead/Broken Skills (2 files)

| File | Size | Issue | Recommendation |
|------|------|-------|----------------|
| `detect-p53-drift/SKILL.md` | 1.8KB | .cjs entrypoint missing | **PRUNE** — documented as blocked since April 5 |
| `drift-controller/SKILL.md` | 1KB | Orchestration description only | **PRUNE** — heartbeat.md already has this logic |

### Usage-Based Analysis

| File | Size | Delegations | Recommendation |
|------|------|-------------|----------------|
| `challenge-agent.md` | 3.2KB | 0 | **PRUNE** — never delegated; red-team is Coach's job |
| `delegation-metrics.md` | 640B | 18 | **KEEP** — most-delegated evaluator skill |
| `monitor-session.md` | 10.9KB | 3 | **KEEP** — actively run in heartbeats, critical L2 defense |
| `patrol.md` | 747B | 1 | **KEEP** — run in periodic tasks (degraded but active) |
| `revert-change.md` | 1.5KB | 0 | **PRUNE** — 0 delegations; manage-backups covers restore |
| `score.md` | 5.8KB | N/A | **KEEP** — core scoring methodology |
| `verify-skill.md` | 879B | 1 | **PRUNE** — Coach's responsibility, not Evaluator's |

---

### Evaluator Pruning Summary

| Category | Files | Before | After | Savings |
|----------|-------|--------|-------|---------|
| Duplicate removals | 3→0 | 4.5KB | 0 | 4.5KB |
| Dead/broken | 2→0 | 2.8KB | 0 | 2.8KB |
| Unused/misplaced | 3→0 | 5.6KB | 0 | 5.6KB |
| **TOTAL** | **8 removed** | **33KB** | **20KB** | **13KB (39%)** |

Wait — let me recalculate with the duplicates more carefully:

Remove: `detect-drift.md` (1.4KB), `manage-backups/SKILL.md` (1.3KB), `detect-p53-drift/SKILL.md` (1.8KB), `drift-controller/SKILL.md` (1KB), `challenge-agent.md` (3.2KB), `revert-change.md` (1.5KB), `verify-skill.md` (0.9KB) = **7 files, 11.1KB removed**

Remaining Evaluator skills (6 files, ~22KB):
1. `delegation-metrics.md` (640B) — most delegated  
2. `detect-drift/SKILL.md` (1.4KB) — drift detection methodology  
3. `manage-backups.md` (2.1KB) — backup/restore operations  
4. `monitor-session.md` (10.9KB) — **⚠️ still large, consider trimming**  
5. `patrol.md` (747B) — integrity checks  
6. `score.md` (5.8KB) — core scoring

**Note**: `monitor-session.md` at 10.9KB is documentation for a .cjs script. The evaluator reads the .cjs directly when running it. The .md serves as prompt context explaining what the tool does — consider trimming to essential usage instructions only (estimated reduction to ~3KB).

---

## Infrastructure Issues Found

1. **`ops-receipts.jsonl`**: Only 11 lines, last written 2026-03-14. This means `detect-drift` is analyzing stale/empty data. The entire drift detection pipeline is effectively non-functional.

2. **`compliance-snapshot.json`**: Does not exist. `patrol.cjs` always reports CRITICAL.

3. **`.state/evaluations/`**: Stale since 2026-03-24 (DB is canonical now, but periodic-tasks.md still references these files).

---

## Recommended Pruning Order

### Phase 1: Safe removals (no behavior change expected)
- Remove duplicate .md files where SKILL.md version exists (or vice versa)
- Remove dead skills with missing .cjs entrypoints
- **9 files, ~15KB savings**

### Phase 2: Convention library removal (Coach)
- Remove all 7 convention files + 4 exercise files
- **11 files, ~58KB savings**
- Risk: Low. Convention data is available in `docs/agent-convention.md` when needed.

### Phase 3: Unused methodology skills (Coach)
- Remove `growth-cycle.md`, `reactive-lesson.md`, `micro-reward.md`, `transient-skill.md`
- Remove `challenge-agent.md`, `revert-change.md`, `verify-skill.md` from Evaluator
- **7 files, ~22KB savings**

### Phase 4: Trim oversized skills
- Trim `monitor-session.md` from 10.9KB to ~3KB (usage essentials only)
- **~8KB savings**

### Total potential savings: **~91KB across both agents (72% reduction)**

---

## Expected Impact (per KE-025/DD-537)

- **Task completion**: +5-15% improvement (less instruction debt → more attention on actual task)
- **Inference cost**: -15-25% per session (fewer system prompt tokens)
- **Coach system prompt**: ~94KB → ~15KB of skill content
- **Evaluator system prompt**: ~33KB → ~22KB of skill content

---

## Verification Plan

Before pruning, baseline Coach and Evaluator on 5 recent heartbeat tasks each. After pruning, run same tasks and compare:
1. Task completion rate
2. Ops count (efficiency)
3. Tool call accuracy
4. Heartbeat section coverage (are they still hitting all required checklist items?)

---

## Files to Remove (Full List)

### Coach (16 files):
```
agents/coach/skills/agent-conventions/SKILL.md
agents/coach/skills/agent-conventions/behavior.md
agents/coach/skills/agent-conventions/coordination.md
agents/coach/skills/agent-conventions/knowledge-mgmt.md
agents/coach/skills/agent-conventions/model-specific.md
agents/coach/skills/agent-conventions/operational.md
agents/coach/skills/agent-conventions/structure.md
agents/coach/skills/convention-exercises/SKILL.md
agents/coach/skills/convention-exercises/b1-read-before-write.md
agents/coach/skills/convention-exercises/b7-project-relative-paths.md
agents/coach/skills/convention-exercises/k1-no-reread-autoloaded.md
agents/coach/skills/growth-cycle.md
agents/coach/skills/reactive-lesson.md
agents/coach/skills/micro-reward.md
agents/coach/skills/transient-skill.md
agents/coach/skills/red-team.md
```

### Evaluator (7 files):
```
agents/evaluator/skills/detect-drift.md
agents/evaluator/skills/manage-backups/SKILL.md
agents/evaluator/skills/detect-p53-drift/SKILL.md
agents/evaluator/skills/drift-controller/SKILL.md
agents/evaluator/skills/challenge-agent.md
agents/evaluator/skills/revert-change.md
agents/evaluator/skills/verify-skill.md
```
