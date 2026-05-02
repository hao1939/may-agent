# Deployment Brief: Obstacle Persistence Skill

**Author**: Bob | **Date**: 2025-05-02 | **Priority**: P1

## Problem
Obstacle-handling failures are 12.5% of all eval issues (5/40). The skill file `agents/shared/skills/obstacle-persistence.md` was written but **never wired into any agent's prompt injection**. It's a dead artifact.

## Current State
- ✅ Skill file exists: `agents/shared/skills/obstacle-persistence.md`
- ✅ EXP-299 designed: 20+20 gym trials on cascading-fix-trap-v2
- ❌ Skill NOT loaded by any handler (grep confirms zero references in .ts/.js)
- ❌ No gym baseline run yet

## What Needs to Happen

### Option A: Immediate Production Deploy (skip experiment)
Inject the skill into `agents/shared/skills/` loading path (if one exists) or add to agent SOUL/context files directly. Measure via eval trend.

**Pros**: Instant coverage, zero gym cost
**Cons**: No controlled measurement, can't attribute changes

### Option B: Run EXP-299 First (recommended)
1. **Tech-lead**: Wire skill loading for gym runs (treatment arm gets obstacle-persistence.md in context)
2. **Bob/Coach**: Run 20 control + 20 treatment on cascading-fix-trap-v2
3. If ≥40% reduction in OBSTACLE_PIVOT: deploy to production

**Cost**: ~$20, 2-3 sessions
**Timeline**: Could complete in 1 day

### Option C: Hybrid — Deploy + Measure Naturally
Deploy now to production. Track OBSTACLE_PIVOT rate in evals over next week. Compare to the 12.5% baseline from this audit.

**Pros**: No gym cost, real-world signal
**Cons**: Confounded by other changes, slower signal

## Recommendation
**Option C** — deploy immediately. The skill is low-risk (capped at 2-3 retries), addresses a known 12.5% failure mode, and we have a clear baseline to compare against. The gym experiment can validate later if needed.

## Deployment Steps
1. Add to agent prompt loading (needs tech-lead to identify injection point)
2. OR: Add reference in each agent's SOUL.md under "Skills" section
3. Monitor eval OBSTACLE_PIVOT rate for 1 week

## Evidence Base
- Eval audit: 5 OBSTACLE_PIVOT issues out of 40 total (12.5%)
- Skill already peer-reviewed and formatted
- Similar verification skill deployment (EXP-229) showed 15-20% reduction in target failure mode
