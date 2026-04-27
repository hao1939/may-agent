# Skill Quality Scorecard — 2026-06-28

## Summary
- **190 skill files** across 12 agents + shared (81 in shared alone)
- **~15 unique skills** deployed to production agents
- **3 skills** have gym experiment evidence
- **12 skills** have NO measurement at all

## Tier 1: Gym-Tested (evidence exists)

| Skill | Agent(s) | Experiment | Result | Status |
|-------|----------|------------|--------|--------|
| verify-after-edit | coder, bob, may, qa, scout | EXP-164 (f1-only arm) | 10/10 = 100% | ✅ PROVEN |
| establish-working-directory | amy | EXP-amy-path-confusion | 0.69→0.86 quality | ✅ PROVEN |
| second-look-verification | coder | EXP-044 (sycophants) | 8/10 = 80% | ✅ PROVEN |

## Tier 2: Tested but Inconclusive

| Skill | Agent(s) | Experiment | Result | Status |
|-------|----------|------------|--------|--------|
| convention-compliance | coder | WAVE2-VALIDATION | 7/15 = 47% | ❌ Below threshold |
| Data Flow Audit (discovery) | — | EXP-195, EXP-198 | 0% | ❌ REJECTED |

## Tier 3: Deployed but NEVER Measured

| Skill | Agent(s) | Deployed Since | Risk |
|-------|----------|---------------|------|
| read-before-edit | bob, may, qa, scout, tech-lead | Unknown | HIGH — universal claim, no proof |
| closing-the-loop | ALL agents | Unknown | MEDIUM — structural prompt |
| reading-metrics | ALL agents | Unknown | LOW — procedural |
| escalation | ALL agents | Unknown | LOW — rarely triggered |
| evidence-over-narrative | bob, scout, tech-lead, coach, optimizer | Unknown | HIGH — judgment skill |
| verify-before-finish | bob, may, qa, scout | Unknown | HIGH — critical gate |
| knowledge-base-navigation | bob | Unknown | MEDIUM |
| diagnosis-before-action | coder | Unknown | HIGH — recognition skill |
| search-governance | scout | Unknown | MEDIUM |
| materialize-findings-concise | scout | Unknown | MEDIUM |
| security-awareness-when-editing | tech-lead | Unknown | LOW — rarely triggered |
| post-delivery-readback-verification | tech-lead | Unknown | HIGH — never tested |

## Priority Action: Test Top 3 Unmeasured Skills

1. **verify-before-finish** — Deployed to 4 agents, claims to prevent ghost deliverables. Scenario exists: `verify-before-finish`. Run 10 trials baseline vs with-skill.
2. **read-before-edit** — Deployed to 5 agents. Scenario exists: `read-before-edit`. Run 10 trials.
3. **evidence-over-narrative** — Deployed to 5 agents. No scenario exists. Need to design one.

## The 81 "Shared" Skills Problem

Most of `agents/shared/` contains lab experiments, templates (SKILL.md), and README files. 
Actual unique shared skills ≈ 10. The rest is experimental debris that should be cleaned up.

## Next Steps
- [ ] EXP-248: verify-before-finish effectiveness (10 baseline + 10 treatment)
- [ ] EXP-249: read-before-edit effectiveness (10 baseline + 10 treatment)
- [ ] Clean up shared/skills — archive non-skill files
