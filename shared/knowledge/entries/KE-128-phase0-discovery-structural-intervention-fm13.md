# KE-128: Phase 0 Discovery — Validated Structural Intervention for FM-1.3 (Exhaustive Reading)

**Date**: 2026-04-10
**Source**: EXP-124 (Structural Intervention for FM-1.3, N=3+3)
**Confidence**: ★★★★ (High — deterministic effect, zero variance, but single scenario)
**Connections**: KE-007 (structural enforcement only), KE-034 (forced externalization), KE-006 (skills don't fix tool patterns), KE-126 (soft interventions fail), H-095 (agent-specific interventions), H-085 (forced externalization boundaries), EXP-015 (forced discovery phase works), EXP-095 (text skills = 0% on gym)

---

## Core Finding

**A mandatory Phase 0 directory-discovery step that produces a navigation map (`nav-map.md`) before the main task eliminates exhaustive file reading (FM-1.3 variant) with zero product regression.**

| Metric | Baseline | Treatment | Δ |
|--------|----------|-----------|---|
| Convention pass rate | 80% (4/5) | 100% (6/6) | +20pp |
| `nav-doesnt-read-all-files` | 0/3 (0%) | 3/3 (100%) | **+100pp** |
| Product pass rate | 100% (5/5) | 100% (5/5) | 0pp (no regression) |

## Mechanism

The intervention works through **forced externalization of environmental knowledge**:

1. **Phase 0** forces the agent to list all directories and write a structured `nav-map.md` file listing all files and their purposes
2. **Phase 1** receives the navigation map as injected context — the agent knows exactly which files contain needed information
3. The agent **skips irrelevant files** because the map tells it what's in them — converting "navigate and read everything" to "navigate first, then read selectively"

## Why Text Skills Fail But Structural Enforcement Works

The baseline agent **already has** the correct skill text ("directory-first navigation") and context.md hints ("always ls before reading"). It navigates correctly — passes `nav-uses-ls-or-find-first`, `nav-finds-index-early`, `nav-no-path-guessing-errors`. But it **reads exhaustively** (14-15 of 17 files) because skills teach KNOWLEDGE (what to do) but not CONFIDENCE (what to skip).

Phase 0 changes the agent's **information state** before Phase 1 begins. The agent doesn't need to trust a skill instruction about skipping files — it has a verified map showing what each file contains.

## FM-1.3 Variant Taxonomy

This intervention targets the **exhaustive reading** variant of FM-1.3, not the **path-guessing** variant:

| FM-1.3 Variant | Description | Skill Fixes? | Phase 0 Fixes? |
|----------------|-------------|--------------|----------------|
| **Path-guessing** | Constructs path from memory → ENOENT | ✅ Yes (skill teaches ls-first) | ✅ Yes (map has all paths) |
| **Exhaustive reading** | Reads all files "just in case" | ❌ No (knowing ≠ doing) | ✅ Yes (map enables selective reading) |
| **Tool/finish looping** | Repeats same failing call | ❌ No | ❌ No (different mechanism) |

## Deployment Recommendation

Apply Phase 0 discovery to workflows where the agent navigates unfamiliar directory structures with 10+ files. Overhead: ~5 tool calls (~2 min), saves 5-10 unnecessary reads.

**Trigger heuristic**: Task mentions directories (`knowledge/`, `experiments/`, `library/`, `entries/`) AND involves multi-file navigation.

## Broader Significance

EXP-124 is the **third validated agent-specific structural guard** (after EXP-110 commit guard for Coder, EXP-115 completeness guard for Optimizer). Each targets a different agent's dominant failure mode with a different mechanism but the same principle: structural workflow enforcement > text instructions.

This extends the H-095 evidence chain: 4 universal text interventions failed on Bob's tasks (EXP-117, EXP-120, EXP-121, EXP-122), while this structural intervention achieves +100pp. The pattern is now replicated across 3 agents.

## Predictions

- **P-128a**: Phase 0 discovery will reduce FM-1.3 in production Bob sessions by ≥30% within 14 days of deployment
- **P-128b**: Phase 0 overhead (5 tool calls, 2 min) will NOT cause session timeout increases
- **P-128c**: The intervention will NOT help with FM-1.3 in agents other than Bob (specificity prediction — Bob's FM-1.3 is predominantly exhaustive reading; other agents' FM-1.3 may have different root causes)

## Limitations

- Single scenario tested (knowledge-base-navigation) — needs broader validation
- N=3+3 — small sample but zero variance in both arms
- All trials used Bob with Opus — model-dependent
- Only targets exhaustive-reading variant, not tool/finish looping
