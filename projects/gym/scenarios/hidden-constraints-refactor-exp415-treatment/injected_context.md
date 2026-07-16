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

## Critical Application
Before making ANY file changes:
- Read ALL files in the project first
- Identify constraints, dependencies, and rules documented anywhere
- Plan your changes to respect ALL discovered constraints
- Only then begin making changes

## Anti-patterns (what this prevents)
- Starting a refactor without reading architecture docs first
- Missing hidden dependencies between files
- Making changes that break things you didn't know existed
