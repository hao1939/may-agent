# EXP-330: Output Format Batch Rollout

## Problem
OUTPUT FORMAT is the single most proven intervention (+32pp bob, +46pp coach, deployed to optimizer/tech-lead). But only 4/10 active agents have it: bob, coach, optimizer, tech-lead.

Six agents still lack it: **amy, scout, qa, coder, may, arc**.

## Evidence for Intervention
| Agent | Current Quality | Has OUTPUT FORMAT? | Expected Gain |
|-------|----------------|-------------------|---------------|
| amy | 0.721 (n=28) | ❌ | +10-15pp (already good) |
| scout | 0.560 (n=7) | ❌ | +20-30pp |
| qa | 0.581 (n=8) | ❌ | +20-30pp |
| coder | unknown | ❌ | +20-30pp |
| may | 0.572 (n=25) | ❌ | +15-25pp |
| arc | unknown | ❌ | unknown |

## Treatment
Add to each agent's `heartbeat.md`:

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

## Priority Order
1. **scout** (0.560, high volume, most to gain)
2. **qa** (0.581, high volume)
3. **coder** (unknown quality, high impact role)
4. **may** (0.572, system orchestrator)
5. **amy** (0.721, already decent — diminishing returns)

## Deployment Plan
Request may to add OUTPUT FORMAT section to heartbeat.md for scout, qa, coder, may, amy.

## Measurement
- Baseline: last available quality scores (Jul 30 snapshot)
- Target: ≥+15pp quality improvement for scout/qa/coder
- Timeline: measure after 10 sessions per agent post-deployment
- Blocker: evaluator still dead — may need manual audit proxy

## Risk
- Low risk — pattern proven in 4 agents, no negatives observed
- Worst case: no change (agent already structures output well)

## Status: DESIGNED
- Next: Request deployment from may (batch notification)

---
*Designed: 2026-09-02 coach heartbeat*
