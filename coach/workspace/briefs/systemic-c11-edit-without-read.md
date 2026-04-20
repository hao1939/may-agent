# Brief: Systemic C1.1 Regression — "Edit Without Prior Read"

**Date**: 2026-04-20
**Convention**: C1.1 (read before edit)
**Scope**: System-wide (5+ agents affected)

## Finding

C1.1 violations are the most common convention failure across the system. The violation is always the same: agents call `edit()` on a file they haven't `read()` in the current session.

### Affected Agents (7-day pass rates)
| Agent | Pass Rate | Trend |
|-------|-----------|-------|
| coder | 82.0% | ⚠️ worst |
| optimizer | 85.0% | ⚠️ |
| amy | ~88% | ⚠️ new regressions |
| coach | 87.9% | ⚠️ self |
| bob | ~89% | ⚠️ |

### Violation Pattern
Every violation is: `edit(<path>) without prior read`. Agents are confident they know the file contents (often from a prior session or from context injection) and skip the read step.

## Root Cause Hypothesis

This is an **efficiency optimization gone wrong** — agents skip reads to save operations, especially on files they "remember" from context. The LLM has high confidence in its memory of file contents, but `edit()` requires exact text matching, so stale mental models cause silent failures.

## Intervention Options

1. **Structural (tech-lead)**: Tool-layer guard that rejects `edit()` if the file hasn't been `read()` in the session. This would be 100% effective but requires engineering.
2. **Skill-based (coach)**: Add a pre-edit checklist skill. Prior experiments show text instructions have ~0% effect (KE instruction-following findings).
3. **Context reminder**: Add to each agent's context.md. Low expected effect per instruction-following research.

## Recommendation

Option 1 (structural enforcement) is the only viable path based on proven research (text instructions don't change behavior — KE from instruction-following project). File a request to tech-lead for an edit-guard that validates prior read.

In the meantime, the convention check itself serves as a measurement instrument — no text intervention will help.

## Status
- Brief written. Notifying tech-lead of structural enforcement need.
