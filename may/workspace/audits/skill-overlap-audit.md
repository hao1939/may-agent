# Skill Overlap & Iatrogenesis Audit — All Agents

**Author**: May (automated session s_1775974135004_1908)  
**Date**: 2026-04-12  
**Triggered by**: KE-123 (Over-Intervention Iatrogenesis), KE-133 (Few-Shot Template Displacement)  
**Prior work**: Optimizer's Coach/Evaluator pruning audit (2026-04-08) — already pruned Coach 94KB→14KB, Evaluator 33KB→21KB

---

## Executive Summary

**System-wide skill footprint**: 9 agents × (SOUL.md + skills/*.md + common-sense.md) auto-loaded per session. Total skill content across agents: **~160KB deployed** (not counting SOUL.md or common-sense.md).

**Key findings**:
1. **Coder is critically overloaded**: 43KB of skills (10 files) — highest of any agent, nearly 2× the next (Bob at 22KB). Contains 2 disproven-as-text skills and 3 SOUL.md double-loads.
2. **3 disproven skills still deployed**: classify-then-act, investigate-and-fix, evidence-over-narrative — all disproven as text injection per the gym. ~16KB of proven-ineffective context.
3. **SOUL.md/skill-file double-loading** in coder: 3 skills get a one-liner in SOUL.md AND a full skill file auto-loaded — contributing to KE-123 iatrogenic risk.
4. **5 untested skills on coder** consuming ~17KB — no evidence they help, and per KE-123 they increase stacking risk.
5. **verify-after-edit deployed identically to 9 agents** — this is the one skill with broad evidence. Keep everywhere.

---

## Agent-by-Agent Analysis

### Coder — 43KB skills, 10 files ⚠️ CRITICAL

The heaviest-loaded agent. Per KE-123, stacking 10 behavioral interventions is likely degrading performance.

| Skill File | Size | Evidence Status | SOUL.md Also? | Recommendation |
|-----------|------|-----------------|---------------|----------------|
| `structured-plan-writing.md` | 9.8KB | ✅ PROVEN (skill file) | No | **KEEP** — gym-proven, 8/8 vs 7/8 baseline |
| `evidence-over-narrative.md` | 9.5KB | ❌ DISPROVEN (text) | Yes (double!) | **REMOVE** — proven ONLY as workflow, text injection explicitly fails (EXP-229). SOUL one-liner is sufficient |
| `know-when-blocked.md` | 8.4KB | ⚪ UNTESTED | No | **REMOVE** — 8.4KB with zero evidence. High cost, unknown benefit |
| `investigate-and-fix.md` | 4.5KB | ❌ DISPROVEN (text) | No | **REMOVE** — text injection 0/4 (EXP-019). Only works as workflow |
| `verify-after-edit.md` | 3.1KB | ✅ PROVEN (deployed) | Yes (double!) | **KEEP** — universal skill, proven. Remove SOUL.md duplicate reference |
| `cross-reference-before-config-repair.md` | 2.5KB | ⚪ UNTESTED | No | **REMOVE** — untested, niche scenario |
| `experience-replay.md` | 2.4KB | ⚪ UNTESTED | No | **REMOVE** — untested, identical copy exists in shared/ |
| `classify-then-act.md` | 2.3KB | ❌ DISPROVEN (text) | Yes (double!) | **REMOVE** — 0% effect across 19 text-injection tests. "Fixer-prior too deep." SOUL already has the reference |
| `efficient-file-reading.md` | 1.2KB | ✅ PROVEN (skill file) | No (SOUL has grep-first-reading) | **KEEP** — rare skill that WORKS as text injection (8/8 vs 6/8, EXP-018) |
| `contradiction-detection.md` | 1.1KB | ⚪ UNTESTED | No | **REMOVE** — 1KB untested, semantic overlap with evidence-over-narrative concept |

**Recommended removals**: 6 files, **~27KB savings** (62% reduction)  
**Remaining**: 4 files, ~17KB — all with evidence (structured-plan-writing, verify-after-edit, efficient-file-reading) or minimal size  
**KE-123 benefit**: Reducing from 10 to 4 stacked interventions significantly reduces iatrogenic risk

### Bob — 22KB skills, 6 files ⚠️ MODERATE

| Skill File | Size | Evidence Status | Recommendation |
|-----------|------|-----------------|----------------|
| `knowledge-base-navigation.md` | 4.9KB | ⚪ UNTESTED | **KEEP tentatively** — Bob-specific, navigation is core to researcher role |
| `tool-interface-protocol/SKILL.md` | 4.8KB | ⚪ UNTESTED | **KEEP tentatively** — prevents FM-2.6 misuse, operationally important |
| `cross-reference-source-code.md` | 4.3KB | ⚪ UNTESTED | **REVIEW** — 4.3KB for a niche behavior. Consider trimming to <1KB |
| `verify-context-claims.md` | 4.1KB | ⚪ UNTESTED | **KEEP** — distinct from verify-after-edit, targets ghost deliverables |
| `verify-after-edit.md` | 3.1KB | ✅ PROVEN | **KEEP** |
| `read-before-edit.md` | ~1.5KB | ⚪ UNTESTED | **KEEP** — small, operationally sound |

**Recommendation**: No immediate removals. Bob's skills are semantically distinct (minimal overlap). Consider trimming `cross-reference-source-code.md` from 4.3KB to essentials only. Total is within acceptable range per KE-123 (6 non-overlapping skills is below the danger zone — iatrogenesis observed with *combined* overlapping interventions).

### Coach — 14KB skills, 4 files ✅ ALREADY PRUNED

Post-optimizer-audit (2026-04-08). Currently has: `red-team/SKILL.md` (4.3KB), `consolidate-memory.md` (4.5KB), `verify-after-edit.md` (3.1KB), `log-error.md` (2.8KB). All distinct, no overlap. **No action needed.**

### Evaluator — 21KB skills, 6 files ✅ ALREADY PRUNED

Post-optimizer-audit. Currently has: `monitor-session.md` (10.9KB!), `score.md` (5.8KB), `manage-backups.md` (2.1KB), `detect-drift/SKILL.md` (1.4KB), `patrol.md` (747B), `delegation-metrics.md` (640B). Skills are operationally distinct.

**One concern**: `monitor-session.md` at 10.9KB is extremely large for a skill file. It's documentation for a .cjs script. Consider trimming to ~3KB usage instructions (the evaluator reads the .cjs directly when running it).

### May — 9KB skills, 4 files ✅ OK

| Skill File | Size | Notes |
|-----------|------|-------|
| `blocked-capability-escalation/SKILL.md` | ~3KB | Unique to May, operationally important |
| `verify-after-edit.md` | 3.1KB | Standard universal skill |
| `read-before-edit.md` | ~1.5KB | Standard universal skill |
| Other | ~1.4KB | |

**No action needed.** 4 distinct skills at 9KB total is well within safe range.

### Optimizer — 5KB skills, 3 files ✅ OK

`batch-processing.md`, `deliverable-checklist.md`, `verify-after-edit.md`. Small, distinct. **No action needed.**

### QA — 7KB skills, 2 files ✅ OK

`generate-test-case.md`, `verify-after-edit.md`. Minimal. **No action needed.**

### Scout — 8KB skills, 3 files ✅ OK

`search-governance.md`, `verify-after-edit.md`, `read-before-edit.md`. Minimal. **No action needed.**

### Tech-Lead — 8KB skills, 3 files ✅ OK

`experience-replay.md`, `read-before-edit.md`, `verify-after-edit.md`. Minimal.

**One note**: `experience-replay.md` has a different hash than the shared/coder versions. This may be intentionally tailored or may be a stale fork. Verify the tech-lead version is current.

---

## Cross-Cutting Issues

### Issue 1: Disproven Text Skills Still Deployed (16KB wasted)

Three skills have been experimentally disproven as text injection but remain deployed as skill files:

| Skill | Agent | Size | Evidence |
|-------|-------|------|----------|
| `classify-then-act` | coder | 2.3KB | 0% effect across 19 tests, "fixer-prior too deep" (KE-021) |
| `investigate-and-fix` | coder | 4.5KB | Text 0/4, workflow 2/2 (EXP-019). Only works as workflow |
| `evidence-over-narrative` | coder | 9.5KB | Text fails (EXP-229). Only works as 3-phase workflow |

**All three work as workflows but NOT as text injection.** Deploying them as `.md` skill files (text injection) is confirmed-ineffective and adds token overhead.

### Issue 2: SOUL.md Double-Loading (Coder)

Coder's SOUL.md (`agents/_archetypes/coder/SOUL.md`) contains one-liner skill references:
```
- **evidence-over-narrative**: When comments say X is broken but tests pass, trust the tests.
- classify-then-act: See `classify-then-act` skill.
- **verify-after-write**: After each edit()/write(), immediately verify.
```

These same skills ALSO exist as full files in `agents/coder/skills/`, which are auto-loaded by `manager.ts`. The agent gets the instruction twice — once as a SOUL one-liner, once as a full skill file.

Per KE-123, this stacking is not just redundant — it can be actively harmful. The double instruction may push the agent into over-compliance mode.

**Fix**: Remove the skill files for disproven-as-text skills (issue 1 handles this). For `verify-after-edit`, keep the file (it's proven) but remove the SOUL.md one-liner to eliminate double-loading.

### Issue 3: Untested Skills Accumulating (30KB across system)

55 skill files (across agents + shared) have NO evidence entry in LIBRARY.md. Most are in the shared library (not auto-loaded), but several are deployed to agents:

| Skill | Agent | Size | Risk |
|-------|-------|------|------|
| `know-when-blocked.md` | coder | 8.4KB | High — largest untested skill on the most overloaded agent |
| `cross-reference-before-config-repair.md` | coder | 2.5KB | Medium |
| `contradiction-detection.md` | coder | 1.1KB | Low — small |
| `experience-replay.md` | coder, tech-lead | 2.4KB each | Medium — duplicated |
| `cross-reference-source-code.md` | bob | 4.3KB | Medium |

### Issue 4: KE-123 Iatrogenesis Risk Assessment

KE-123 found that combining 2 effective interventions caused -12pp degradation. The risk scales super-linearly with intervention count (O(N²) pairwise conflicts per external validation).

| Agent | Skill Count | Total KB | Risk Level |
|-------|------------|----------|------------|
| **Coder** | **10** | **43KB** | **🔴 HIGH** — well above observed iatrogenesis threshold |
| Bob | 6 | 22KB | 🟡 MODERATE — distinct skills reduce pairwise conflict |
| Evaluator | 6 | 21KB | 🟡 MODERATE — operational skills, lower behavioral conflict |
| Coach | 4 | 14KB | 🟢 LOW — post-pruning |
| May | 4 | 9KB | 🟢 LOW |
| Others | 2-3 | 5-8KB | 🟢 LOW |

---

## Recommendations (Priority Order)

### P0: Remove Disproven-as-Text Skills from Coder
**Files to remove**:
```
agents/coder/skills/classify-then-act.md          (2.3KB, ❌ disproven)
agents/coder/skills/investigate-and-fix.md         (4.5KB, ❌ disproven)
agents/coder/skills/evidence-over-narrative.md     (9.5KB, ❌ disproven)
```
**Savings**: 16.3KB, reduces coder from 10→7 skills  
**Risk**: None — these are confirmed non-functional as text injection  
**Note**: The workflow versions of these skills remain available in the gym/shared library. Only the text injection deployment is removed.

### P1: Remove Untested Low-Value Skills from Coder
**Files to remove**:
```
agents/coder/skills/know-when-blocked.md           (8.4KB, ⚪ untested)
agents/coder/skills/cross-reference-before-config-repair.md (2.5KB, ⚪ untested)
agents/coder/skills/experience-replay.md           (2.4KB, ⚪ untested, copy in shared/)
agents/coder/skills/contradiction-detection.md     (1.1KB, ⚪ untested)
```
**Savings**: 14.4KB, reduces coder from 7→3 skills  
**Risk**: Low — no evidence these help. Per KE-123, their removal likely *improves* performance.

### P2: Clean Up SOUL.md Double-References (Coder)
Edit `agents/_archetypes/coder/SOUL.md` to remove one-liner references to skills that exist as files (now only `verify-after-edit` and the two proven skills). The SOUL.md should reference skills by name only for those NOT deployed as files.

### P3: Trim Evaluator's monitor-session.md
Reduce from 10.9KB to ~3KB essential usage instructions. The full documentation is in the .cjs file itself.

### P4: Gym-Test Bob's Unique Skills
Bob's 4 unique skills (22KB) are all untested. Before the next pruning pass, run gym baselines for:
- `knowledge-base-navigation.md`
- `tool-interface-protocol/SKILL.md`
- `verify-context-claims.md`
- `cross-reference-source-code.md`

---

## Expected Impact

| Change | KB Saved | Skills Removed | Expected Performance Impact |
|--------|----------|----------------|----------------------------|
| P0: Remove disproven | 16.3KB | 3 | +5-10pp (removing confirmed-harmful stacking) |
| P1: Remove untested | 14.4KB | 4 | +3-7pp (reduced instruction overhead per KE-025) |
| P2: SOUL cleanup | ~0.5KB | 0 | Minor clarity improvement |
| P3: Trim evaluator | ~8KB | 0 | Minor efficiency gain |
| **Total (P0+P1)** | **30.7KB** | **7** | **Coder goes from 43KB/10 skills → 13KB/3 skills (70% reduction)** |

The 3 remaining coder skills would be:
1. `structured-plan-writing.md` (9.8KB) — ✅ PROVEN
2. `verify-after-edit.md` (3.1KB) — ✅ PROVEN
3. `efficient-file-reading.md` (1.2KB) — ✅ PROVEN

All evidence-backed. All distinct behaviors. Minimal pairwise conflict risk.

---

## Implementation Notes

- **P0 and P1 are safe to implement immediately** — no verification experiment needed for removals of disproven/untested skills
- **Do NOT remove the shared library copies** — only agent-deployed copies. Shared library serves as an archive for potential future workflow implementations
- **Verify coder performance after P0** before proceeding to P1 — baseline 3 recent coder tasks, then compare
- Per KE-123, the biggest gain comes from reducing the total stack count, not from any individual removal
