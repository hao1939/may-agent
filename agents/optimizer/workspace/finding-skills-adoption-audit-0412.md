# Finding: Skills Adoption Audit — Dead Weight vs. Active Levers

**Date**: 2026-04-12
**Mode**: C (Skill & Technique Scouting)
**Hypothesis**: Most shared skills are never referenced in actual session behavior; only skills wired into workflow code or handler code drive adoption.

## Summary

The shared skills library has **58 skill entries** (46 directories + 12 standalone files). Only **~13 are actively deployed** to agent-specific `skills/` dirs and referenced in code or prompts. The remaining ~45 exist as passive reference material that agents never discover (confirming KE-011). The most-deployed skill (`verify-after-edit`, 9 agents) appears to work; the second most-deployed (`read-before-edit`, 5 agents) **still has the worst convention compliance** (C1.1 at 88.6% system-wide, QA at 61.4%), proving deployment ≠ adoption.

## Inventory

### Scale
| Category | Count |
|----------|-------|
| Shared skill directories | 46 |
| Shared standalone skill files | 12 |
| Agent-specific skill files (all agents) | 44 |
| Unique skills deployed to ≥1 agent | ~22 |
| Skills with handler/script code references | 5 |
| Skills referenced in SOUL.md | ~8 |
| Skills referenced in heartbeat.md | ~6 |
| Completely unreferenced standalone skills | 6 |

### LIBRARY.md Status Distribution (gym-tested)
| Status | Count |
|--------|-------|
| 📦 Deployed | 16 |
| ⚪ Untested | 16 |
| ✅ Proven | 12 |
| ❌ Disproven | 7 |
| ⚠️ Deployed (no production lift) | 6 |
| 🧪 Testing | 1 |

**Key ratio**: 16 untested + 7 disproven + 6 no-lift = **29 skills (50%) are dead weight or actively unhelpful.**

## Adoption Mechanism Taxonomy

Skills get to agents through **4 channels**, ranked by effectiveness:

### Channel 1: Code Enforcement (handlers, scripts)
**Skills**: `evaluator-scoring` (evaluation-sync handler), `growth-cycle` (error-log-scanner handler, cron.json), `patterns` (analyze-failures, coaching-feedback, convention-check handlers), `handoff` (run-workflow handler), `deliverable-checklist` (convention-check guards for DELIVERABLES_CHECKLIST.md regex)

**Effectiveness**: HIGH. These are the only skills that reliably change behavior because the code path physically enforces them. The `deliverable-checklist` skill is enforced by a convention-check regex that blocks `finish(success)` without the file — this is the gold standard.

### Channel 2: SOUL.md Inline References
**Skills**: Amy has 6 direct refs (sanitize-content, grep-first-reading, tool-discipline, obstacle-pivot, verification, state-check-before-action). Coach has 13 skill mentions. Evaluator refs deliverable-integrity.

**Effectiveness**: MEDIUM-LOW. SOUL.md is loaded into every session, so agents see these references. But KE-011 shows agents don't follow links to read the referenced skill files — they absorb the one-line instruction in SOUL.md and ignore the detailed protocol. Amy's 6 refs are the best example: she has explicit paths to skill files but the actual behavioral impact comes from the inline instruction text, not the skill file itself.

### Channel 3: Per-Agent skills/ Directory Deployment
**Skills**: verify-after-edit (9 agents), read-before-edit (5 agents), efficient-file-reading (coder), structured-plan-writing (coder), materialize-findings-concise (scout), deliverable-checklist (optimizer), etc.

**Effectiveness**: VARIABLE. The mechanism depends on whether the agent reads its own skills/ dir during sessions. Evidence:
- **verify-after-edit** (9 agents): C1.3 at 93.7% — decent but not 100%. Some agents clearly internalize it.
- **read-before-edit** (5 agents): C1.1 at 88.6% overall, QA at 61.4% despite having the skill deployed. **This is the strongest evidence that deployment ≠ adoption.**
- **efficient-file-reading + structured-plan-writing** (coder): Gym-proven (8/8) but coder only has 6 sessions in 48h so hard to measure production impact.

### Channel 4: Shared skills/ Passive Availability
**Skills**: The other ~33 skill directories that are not deployed to any agent.

**Effectiveness**: ZERO. Per KE-011, 0/29 agents discover available resources. These skills are invisible unless someone manually deploys them.

## Dead Skills (Candidates for Removal)

### Completely Unreferenced (no refs outside skills/ dir itself)
1. **constructive-friction** — 0 refs in code/prompts/heartbeat. Only in old workspace archives.
2. **critical-pause** — 0 active refs. Only in skill-lifecycle and old bob plans.
3. **experiment-before-apply** — 0 active refs. Only in old workspace archives.
4. **extract-directives** — 0 active refs. Referenced only in its own file and old synthesis docs.
5. **synthesis-dpir** — 0 active refs. Only in old archives.
6. **verify-before-finish-micro** — Deployed as `verify-before-finish` to May, but the standalone .md in shared/ is unreferenced.

### Untested + Never Deployed (shared/ dir skills with ⚪ status)
16 skills in LIBRARY.md are marked ⚪ untested — many also have ceiling effects in gym (baseline already passes). These include: check-state, task-adherence, scope-discipline, stale-approach-fixation, search-strategy-escalation, incremental-context-loading, brainstorm-before-build, regression-awareness, prerequisite-detection, pre-finish-reconciliation, wrong-fix-recovery, bug-report-test-coverage.

### Disproven
7 skills marked ❌ in LIBRARY.md: classify-then-act (text), investigate-and-fix (text), grep-first-reading (workflow), and others. These remain in shared/skills/ as reference but are actively harmful if deployed as text injection.

## Key Insight: The 3 Things That Actually Work

From the LIBRARY.md data and convention checks, the adoption story is:

1. **Workflow enforcement** (Channel 1) — Structures the task to force behavior. Strongest results: obstacle-pivot 0→100%, sycophancy-resistance 50→100%. Only works for R>0.5 decision topology.

2. **Skill file injection to agent-specific dirs** (Channel 3) — Works for **tool-choice habits** (efficient-file-reading 6/8→8/8) and **planning quality** (structured-plan-writing 7/8→8/8). Does NOT work for judgment tasks or deep behavioral changes.

3. **Code-level enforcement** (Channel 1) — Convention checks, handlers, guards. The deliverable-checklist guard is proof: optimizer creates the file because `finish(success)` is literally blocked otherwise. No amount of text instructions achieves this reliability.

**What does NOT work**: Text injection in SOUL.md or context.md (0/19+ failures), passive availability in shared dirs (0/29 discovery rate), deploying skills without matching code enforcement.

## Recommendations

### Remove (declutter)
- Archive the 6 completely unreferenced standalone skills to `agents/shared/skills/archive/`
- Mark the 7 disproven skills clearly in README (they already are in LIBRARY.md)

### Stop Investing
- Don't create more text-injection skills without a matching code enforcement mechanism
- Don't deploy skills to agent dirs and expect behavior change without measurement

### Double Down
- **Workflow enforcement** for judgment tasks — the only thing that works for R>0.5
- **Convention-check guards** for behavioral habits — deliverable-checklist model is the template
- **Per-agent skill injection** ONLY when gym-proven AND paired with convention monitoring

### New Opportunity
- Create a `skills-loaded` convention check that verifies agents actually READ their skills/ files during sessions. Without this measurement, we're flying blind on whether Channel 3 works at all.

## Data Sources
- `agents/shared/skills/LIBRARY.md` — skill status registry
- `agents/shared/skills/` directory listing (58 entries)
- `agents/*/skills/` directory listings (44 agent-specific files)
- `agents/*/SOUL.md` — skill references (grep for "skill")
- `agents/*/heartbeat.md` — skill references
- `agents/may/handlers/convention-check.ts` — enforcement code
- `.state/may.db` convention_checks table — C1.1, C1.3, C1.7 pass rates (48h)
- KE-011: Zero-discovery cognitive tunnel (0/29 agents discover available resources)
- KE-023: read-before-edit deployment failure (skill deployed, compliance declining)
