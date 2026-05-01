# EXP-212: Schema-Organized Context Reduces Knowledge-Activation Violations

**Date**: 2026-07-28
**Status**: PHASE-2-DEPLOYED — schema context.md live on tech-lead as of 2026-07-31. Measuring next 20 sessions.
**Predecessor**: H-EXP-012 (75% known-but-violated rate)
**Hypothesis**: H-077 (Schema-Organized Context Activates Knowledge Better Than Flat Lists)

---

## Research Question

Does restructuring agent context.md from flat fact lists into schema-organized sections with trigger conditions reduce the rate at which agents violate facts already in their context?

## Hypothesis

- **H-212a**: Schema-organized context reduces knowledge-activation violations by ≥40% vs flat lists, with compound errors (requiring 2+ facts) dropping more than single-fact errors.
- **H-212-null**: Format doesn't matter — violations are driven by context window position or task complexity, not organization.

## Design

### Method: Production A/B on context.md restructuring

This is a **production experiment**, not gym-based. We restructure one agent's context.md and measure violation rate over real sessions.

### Arms

| Arm | Intervention | N | Notes |
|-----|-------------|---|-------|
| A   | Flat list (current context.md format) | 20 sessions | Baseline: audit 20 recent sessions for violations |
| B   | Schema-organized context.md | 20 sessions | Post-restructure: same agent, same task types |

### Target Agent

**tech-lead** — highest violation rate per H-EXP-012, most sessions per day (fast data collection).

### Schema Design Principles (from SCG-MEM paper + H-077)

1. **Trigger conditions**: Group facts by activation context, not topic
   - `## When reviewing PRs:` → git rules, path rules, merge policies
   - `## When running tools:` → bun path, npx unavailable, sqlite via bun
   - `## When writing code:` → no src/, agents/ is the codebase, pre-compiled runtime
2. **Cross-references**: Link co-activated facts
   - "See also: [Tool Availability]" after path rules that affect tool choice
3. **Salience markers**: Bold the most-violated facts within each schema
4. **Max 3 levels**: Category → Section → Fact (no deeper nesting)

### Metrics

- **Primary**: Knowledge-activation violation rate (facts in context.md that agent contradicts in session)
- **Secondary**: Compound-error rate (violations requiring 2+ facts), time-to-first-violation (session position)

### Measurement Protocol

For each session in both arms:
1. Extract all agent actions that could violate a context.md fact
2. Check each against the relevant context.md fact
3. Score: violation / correct / not-applicable
4. Classify: single-fact vs compound (requires combining 2+ facts)

### Decision Rule

- **Confirmed** if: Violation rate drops ≥40% (Arm B vs A), p<0.05 on Fisher's exact test
- **Partially confirmed** if: Drop is 20-39%, significant
- **Falsified** if: Drop <20% or not significant after 20 sessions each

## Phase 1: Baseline Audit (actionable now)

Audit 10 recent tech-lead sessions for violations against current flat context.md. This establishes the baseline rate and identifies the most-violated facts (which should be prioritized in schema redesign).

### Steps
1. Pull 10 recent tech-lead sessions from checkpoint files
2. Read tech-lead's current context.md
3. For each session, identify actions that contradict context facts
4. Calculate baseline violation rate
5. Identify top-5 most-violated facts

## Phase 2: Restructure (after baseline)

Redesign tech-lead's context.md using schema principles above. Deploy.

## Phase 3: Measure (20 sessions post-deploy)

Audit sessions using same protocol as Phase 1.

## Cost

~$2-3 for auditing sessions (bob time). Zero runtime cost (context.md is already loaded).

## Risk

- Low: context.md changes are easily reverted
- Schema could increase token count (mitigate: keep total facts the same, just reorganize)
- Hawthorne effect unlikely (agents don't know their context format changed)
