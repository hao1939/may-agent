# Skill Deployment & Gym Scenario Report

**Date:** 2026-04-27  
**Milestone:** Deploy top 5 skills + Add gym scenario for skill delivery testing

---

## 1. Gym Scenario Created: `skill-delivery-obstacle-pivot`

**Location:** `agents/gym/scenarios/skill-delivery-obstacle-pivot/`

### Scenario Design
- **Purpose:** Tests whether an agent with the `obstacle-pivot` skill correctly pivots when an initial approach fails
- **Setup:** Agent must parse a YAML config file with a deliberate syntax error (tab on line 5)
- **Expected behavior WITH skill:** Agent classifies the obstacle, selects alternative approach (grep/sed, fix file, manual parse), extracts data successfully
- **Expected behavior WITHOUT skill:** Agent retries same YAML parse or gives up

### Files Created
| File | Purpose |
|------|---------|
| `scenario.json` | Metadata: categories=skill-verification,recovery; tier=standard; timeout=5min |
| `task.md` | Task prompt: read broken YAML, write db config summary |
| `context.md` | Injected context: obstacle-pivot skill summary |
| `environment/config.yaml` | Broken YAML file (tab char on line 5) |
| `success_criteria.js` | Scorer: checks output exists, correct data extracted, pivot behavior |

### Success Criteria
1. `output_created` — Agent produces `output/db-config-summary.txt`
2. `correct_data` — Output contains host (db.example.com), port (5432), dbname (production_db)
3. `pivot_behavior` — Agent used a different approach after initial failure (heuristic)

---

## 2. Skill Deployment Status

### obstacle-pivot → All agents (already deployed)
Bob's `context.md` already references skills including obstacle-pivot via the SCBA skill reference. The skill is in the shared skills library at `agents/shared/skills/obstacle-pivot/SKILL.md` and is available to all agents.

**Deployment method:** Shared skills are available to all agents via the `agents/shared/skills/` directory. No per-agent config change needed — agents reference skills from the shared library.

### Baseline Data (from existing gym results)

| Metric | Value | Source |
|--------|-------|--------|
| `help-blocked-agent` scenario | 0/5 pass | `.state/gym/results/baseline-analysis.md` |
| Other scenarios | 5/5 pass | Same baseline (criteria-only mode) |

**Important caveat:** The baseline was run in "criteria-only" mode (evaluating task text against regex patterns), NOT actual agent execution. Real before/after measurement requires:
1. Running the scenario with the gym runner: `bash test/gym/run-gym.sh skill-delivery-obstacle-pivot --agent coder`
2. Comparing transcripts with and without the injected skill context
3. This requires a live agent session (beyond worker scope)

---

## 3. Top 5 Skills — Deployment Readiness

| Skill | Location | Deployed To | Gym Scenario Available |
|-------|----------|-------------|----------------------|
| obstacle-pivot | `shared/skills/obstacle-pivot/` | All (shared) | ✅ `skill-delivery-obstacle-pivot` (NEW) |
| state-check-before-action | `shared/skills/state-check-before-action/` | All (shared), bob (explicit) | ❌ No dedicated scenario |
| verification | `shared/skills/verification/` | All (shared) | ❌ No dedicated scenario |
| plan-once-amend | `shared/skills/plan-once-amend/` | All (shared) | ❌ No dedicated scenario |
| know-when-blocked | `shared/skills/know-when-blocked/` | All (shared) | ❌ No dedicated scenario |

---

## 4. How to Run the New Scenario

```bash
# Run against coder agent
bash test/gym/run-gym.sh skill-delivery-obstacle-pivot --agent coder

# Run without skill context (baseline) — remove injected_context from scenario.json
# Run with skill context (treatment) — keep injected_context

# Compare scores to measure skill impact
```

---

## 5. Metrics Update

After running the scenario:
- **workflow.pass-rate** stays at 100% (10/10) — unchanged
- **skill.verified-rate** will move from 0% to 20% (1/5) once obstacle-pivot is tested and passes
