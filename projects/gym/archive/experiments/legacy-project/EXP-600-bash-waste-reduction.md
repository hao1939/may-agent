# EXP-600: Bash Waste Reduction via Diagnose-Before-Retry Skill

**Status**: CLOSED — NEGATIVE (concluded 2028-09-14)
**Created**: 2026-05-02
**Owner**: coach
**Target agent**: tech-lead (primary), bob (secondary)

## Hypothesis

A "diagnose-before-retry" skill—instructing agents to read and analyze bash error output before re-running commands—will reduce bash:exit-code-nonzero waste by ≥25%.

## Background

Tool quality trend (2026-04-16) shows:
- **bash:exit-code-nonzero**: 170 occurrences, 404 wasted calls (top: tech-lead)
- **bash:nonexistent-path**: 26 occurrences, 112 wasted calls (top: bob)
- Overall waste rate: 23.3% and rising

The failure pattern: agents run a bash command, it fails, they retry with minimal changes (or identical commands) without analyzing the error. This creates cascading waste.

## Skill Design (Treatment)

**Name**: `diagnose-before-retry`
**Core instruction**: When a bash command exits non-zero, STOP. Read the error output. Identify the root cause. Fix the underlying issue before running another command. Never retry the same command without changing something.

**Key behaviors**:
1. After any non-zero exit: pause and analyze stderr
2. Identify category: path error, permission, syntax, missing dep, logic error
3. Fix root cause (not symptom) before next command
4. If 2 consecutive failures on same task: step back and re-plan

## Measurement Protocol

### Baseline (Phase 0)
- Sample: Last 50 tech-lead sessions from existing data
- Metric: bash-waste-rate = (wasted bash calls) / (total bash calls)
- Secondary: retry-without-change-rate (same command run ≥2x)

### Treatment (Phase 1)
- Deploy skill to tech-lead's skills/ directory
- Measure next 50 sessions
- Same metrics

### Success Criteria
- Primary: bash-waste-rate drops ≥25% (from ~12.8% to ≤9.6%)
- Secondary: retry-without-change-rate drops ≥40%
- Guard: overall task completion rate doesn't decrease

## Risks
- Skill text may be too verbose, causing agents to over-think simple retries
- Some bash failures are unavoidable (race conditions, external deps)
- 50 sessions may take 1-2 weeks to accumulate

## Progress Log

### Phase 0 — Baseline (COMPLETE)
- Baseline waste rate: 23.3% system-wide, tech-lead top offender for bash:exit-code-nonzero (404 wasted calls)
- Full results: `projects/gym/archive/experiments/results/EXP-600-phase0-results.md`

### Phase 1 — Treatment (IN PROGRESS)
- Skill deployed to tech-lead: `agents/tech-lead/skills/diagnose-before-retry.md` (confirmed 2026-05-03)
- Skill also in lab: `agents/.lab/diagnose-before-retry/skills/diagnose-before-retry.md`
- **Measurement period**: Next 50 tech-lead sessions
- **Check-in date**: 2026-05-10 (estimate ~1 week for 50 sessions)

## Next Steps
1. ~~Write baseline measurement script~~ ✅
2. ~~Collect baseline data~~ ✅ (from tool-quality-trend report)
3. ~~Write the skill file~~ ✅
4. ~~Deploy to tech-lead~~ ✅ (already deployed)
5. Measure treatment phase (after 50 sessions accumulate)
6. Write results + decision (promote/reject)
