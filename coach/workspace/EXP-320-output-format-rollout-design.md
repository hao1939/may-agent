# EXP-320: Output Format Rollout to Tech-Lead and Amy

## Problem
OUTPUT FORMAT enforcement has proven effective across 3 agents:
- Coach: 0.24 → 0.70 quality (+46pp, though other factors)
- Bob: shallow sessions eliminated, quality 0.35 → 0.67 (+32pp with anti-shallow)
- Optimizer: 0.487 baseline, treatment deployed, awaiting measurement

Only 3/10 active agents have this treatment. Tech-lead and amy are next highest-value targets:
- Both run frequent heartbeat sessions
- Neither has structured output enforcement
- Pattern is proven and low-risk (additive instruction, no removal)

## Hypothesis
Adding OUTPUT FORMAT (GOAL/PLAN/DONE WHEN) to tech-lead/heartbeat.md and amy/heartbeat.md will improve session quality by ≥5pp (conservative, given pattern replication).

## Treatment

### Tech-lead (add to top of heartbeat.md, before existing content):
```markdown
## OUTPUT FORMAT (MANDATORY)
Your FIRST output in this session must be exactly this structure before any tool calls:

GOAL: [one sentence — what you'll accomplish this heartbeat]
PLAN:
1. [specific action]
2. [specific action]
3. [specific action]
DONE WHEN: [verifiable criteria]

Then execute your plan. End with finish() including verification_evidence.
Do NOT skip this. Do NOT make tool calls before outputting this block.
```

### Amy (add after READ-BEFORE-EDIT RULE, before existing content):
Amy's heartbeat is more exploratory/creative, so lighter touch:
```markdown
## OUTPUT FORMAT (MANDATORY)
Your FIRST output must state:

GOAL: [what you'll explore or accomplish]
PLAN:
1. [first action]
2. [second action]
3. [third action]
DONE WHEN: [what counts as done]

Then execute. End with finish().
```

## Baseline
- Tech-lead: No recent JS quality data (evaluator dead since Apr 30)
- Amy: 0.72 (n=51, pre-Apr 30)

## Target
- GOAL/PLAN/DONE WHEN compliance ≥ 80% in heartbeat sessions (manual check)
- Quality ≥ baseline when evaluator resumes

## Control
- No changes to context.md files
- Only heartbeat.md modified

## Measurement
Manual: grep session transcripts for GOAL/PLAN/DONE WHEN presence (can do immediately).
Automated: JS quality comparison when evaluator resumes.

## Predecessors
- EXP-290 (bob anti-shallow): POSITIVE +32pp
- EXP-310 (optimizer OUTPUT FORMAT): DEPLOYED
- EXP-315 (bob OUTPUT FORMAT): DEPLOYED
- Coach-quality M14: OUTPUT FORMAT proven

## Status: DESIGNED — ready for deployment
