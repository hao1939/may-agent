# Skill Library

Single source of truth for all skills. Two processes feed this:

**Process 1 — Discovery & Evaluation** (Coach owns)
```
Find skill → Try in gym → Record results here
```

**Process 2 — Deployment** (Coach owns)  
```
Check library → Pick proven skill → Add to agent's context/prompts → Monitor
```

## Skill Registry

Each skill has ONE status:
- **✅ proven** — gym-tested, evidence shows it works. Ready to deploy.
- **🧪 testing** — currently being evaluated in gym. DO NOT deploy yet.
- **❌ disproven** — gym-tested, evidence shows it doesn't help (or hurts). DO NOT deploy.
- **⚪ untested** — exists but never gym-tested. DO NOT deploy.
- **📦 deployed** — proven AND actively used by agents. Track which agents.

| Skill | Status | Works When | Fails When | Deployed To | Gym Evidence |
|-------|--------|------------|------------|-------------|--------------|
| grep-first-reading | ⚪ untested | | | | needs gym test |
| evidence-over-narrative | ⚪ untested | | | | needs gym test |
| check-state | ⚪ untested | | | | needs gym test |
| task-adherence | ⚪ untested | | | | needs gym test |
| verify-before-finish | ⚪ untested | | | | needs gym test |
| classify-then-act | ⚪ untested | | | | needs gym test |
| scope-discipline | ⚪ untested | | | | needs gym test |
| tool-discipline | ⚪ untested | | | | needs gym test |
| obstacle-pivot | ⚪ untested | | | | needs gym test |
| investigate-and-fix | ⚪ untested | | | | needs gym test |

> **Note**: Only the top 10 most-referenced skills listed above. Full inventory in the skills/ subdirectories.
> Coach: when you test a skill, fill in "Works When" and "Fails When" — these are the most valuable columns.

## How to Evaluate a Skill

1. **Pick a skill** from the untested list above
2. **Find or create a gym scenario** that exercises it
3. **Run baseline** (without skill in prompt): `bash test/gym/run-gym.sh <scenario> --agent <agent>`
4. **Run with skill** (inject skill into prompt): same scenario, skill added
5. **Compare scores** — did quality/efficiency improve?
6. **Record conditions**:
   - "Works When": what task types, what agent roles, what conditions make this skill helpful
   - "Fails When": what conditions make it useless or harmful (adds noise, confuses agent, etc.)
7. **Update this table** with status + evidence link

## Gym Results Archive

Store results in `agents/coach/workspace/skill-gym-results/` with naming: `<skill-name>-<date>.md`

Each result file should contain:
```markdown
# Gym Result: <skill-name>
Date: YYYY-MM-DD
Scenario: <scenario-name>
Agent: <agent-name>

## Baseline (without skill)
- Score: X
- Key observations: ...

## With Skill
- Score: Y  
- Key observations: ...

## Verdict: proven / disproven / inconclusive
- Works when: ...
- Fails when: ...
```
