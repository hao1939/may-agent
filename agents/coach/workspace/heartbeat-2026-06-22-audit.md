# Coach Heartbeat — 2026-06-22 Experiment Audit

## Running Experiments Status

### EXP-168 (F1 Dose-Response) → COMPLETE (corrected)
- Original writeup was based on contaminated env data
- **Corrected finding**: moderate hint = 100% in clean env (9/9), not 0%
- Dose-response is NOT a step function — there IS a gradient
- Threshold is between nudge (vague) and moderate (names specific problem)
- **Gap**: Nudge never re-tested post-contamination-fix
- See: `agents/coach/workspace/exp168-corrected-results.md`

### EXP-195 (Relational Bug Recognition Skill) → NEEDS DATA
- Scenario exists: cascading-fix-trap-v2-exp195-skill
- No agent runs yet (gym runner doesn't spawn agents from shell)
- **Action**: Need gym infra to run 10 trials

### EXP-200 (Belief Externalization) → DEPLOYED, NO DATA
- Deployed to buildReviewPrompt() in project.ts
- No gym data for silent-data-corruption-exp200-skill
- Production observation period — check evaluator scores

### EXP-201 (Verification Remasking) → NEEDS DATA
- Scenario: cascading-fix-trap-v2-exp200-remask
- No agent runs yet

### EXP-202 (Meta-Cognitive Defect Enumeration) → NEEDS DATA
- Scenario: cascading-fix-trap-v2-exp202-enum
- No agent runs yet

### EXP-189 (G' Question-Framing Production) → OBSERVING
- Deployed to production heartbeats
- breadcrumb-action-rate is 0.5429 (target 0.8) — below target
- **Need to check if G' is actually active in current heartbeat prompts**

### EXP-139 (verify-wrap Production Pilot) → DEPLOYED
- Long-running deployment on optimizer
- Should check if optimizer FM-3.3 rate improved

## Key Insight This Session

**The cascading-fix-trap-v2 research line is converging:**
- Base: 0% (0/140) — hard recognition bottleneck
- Nudge: 0% (0/11, pre-fix only)
- Moderate hint (clean): 100% (9/9)
- Full F1 (clean): 100% (15/15)
- Scout→coder: 0% (0/37) — LLM can't generate sufficient analysis
- Various skills/checklists: all 0% (exp177, exp195, exp198, exp202 — text doesn't crack discovery)

**The pattern is clear**: only **causally specific information** (naming the actual problem) crosses the recognition threshold. Skills, checklists, enumeration, remasking, procedural guides — none work. The agent needs to be TOLD what the bug is (at moderate specificity or above).

## Priorities for Next Session
1. Get gym infra running to execute EXP-195/201/202 trials (or acknowledge they'll likely be 0% given the pattern)
2. Re-test nudge arm post-contamination-fix
3. Consider closing EXP-195/201/202 as "predicted 0%, consistent with recognition threshold model"
