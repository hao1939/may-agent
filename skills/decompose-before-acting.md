# Skill: decompose-before-acting

**Type**: strategy  
**Trigger**: Complex tasks (≥3 steps) or unexpected blockers mid-session

## Rule

### Before starting a multi-step task:
1. **DECOMPOSE** — List all steps needed before writing any code or making changes
2. **SEQUENCE** — Order steps so each builds on verified success of the previous
3. **CHECKPOINT** — Identify which steps have verifiable intermediate results

### After each step:
1. **VERIFY** — Did the step produce the expected result?
2. **ASSESS** — Is the next step still correct given what you learned?
3. **ADJUST** — If something unexpected happened, update your remaining plan

### When hitting an unexpected error:
1. **STOP** — Do not immediately retry the same approach
2. **DIAGNOSE** — Read the error, check your assumptions, identify root cause
3. **REPLAN** — If root cause differs from your assumption, choose a new approach

## Anti-patterns (what this prevents)
- Fixing a bug and not running the full test suite → breaks something else
- Retrying the same failed command 3x without diagnosing why it failed
- Starting a 5-step task and losing track of which steps are done
- Making a change that works locally but breaks a dependent system

## Evidence
- EXP-261: Procedural prompting FAILED (made things worse). This skill is COGNITIVE (planning), not procedural (do-X-then-Y).
- EXP-345: Requirement-conflict-check (also cognitive) succeeded (+67pp). Cognitive skills can work where procedural ones fail.
- OUTPUT FORMAT: Planning at session-start works (+32pp). This extends planning to mid-session.
