# Verify-Before-Finish Skill Strengthening

## Rationale
The Verify-Before-Finish behavioral compliance rate was measured at **67%** — the weakest of the 3 core skills. Root cause: several agents lacked the skill file and/or the mandatory 📘 directive in their `context.md`.

## Actions Taken
Deployed the `verify-before-finish.md` skill file and added a mandatory 📘 directive to all 11 agent `context.md` files.

### Agents with skill file (`skills/verify-before-finish.md`)
1. amy
2. bob
3. coach
4. coder
5. evaluator
6. may
7. optimizer
8. qa
9. scout
10. tech-lead

### Agents with 📘 directive in `context.md`
All 11 agents (amy, amy-kimi, bob, coach, coder, evaluator, may, optimizer, qa, scout, tech-lead) now have the directive:

> 📘 Read `agents/<agent>/skills/verify-before-finish.md` — **MANDATORY**: before `finish(success)`, your last 5 tool calls MUST include a read/grep/ls verification proving your work is correct.

## Expected Impact
With full deployment, the 67% compliance rate should improve significantly in the next measurement cycle.
