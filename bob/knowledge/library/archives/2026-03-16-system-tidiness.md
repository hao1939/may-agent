# Synthesis: 2026-03-16 System Tidiness & Simplification

## Context
Hao's directive for "System Tidiness" requires splitting `philosophy.md` into a concise constitution (<300 lines) and archiving theory in `research-laws.md`. This synthesis covers the execution of that split and defines the new simplification criteria.

## 1. The Great Split (P192 Simplification)
**Status**: Executed.
- **Original**: `agents/shared/philosophy.md` (1210 lines, mixed theory/practice).
- **New Core**: `agents/bob/workspace/philosophy-v2.md` (<200 lines). Contains only active, enforceable principles (Identity, Safety, Coordination, Growth).
- **New Archive**: `agents/shared/knowledge/research-laws.md` (6408 bytes). Contains all 100+ research laws, mechanisms, and predictions.
- **Why**: Operational clarity. Agents need to know *what to do*, not *why it works theoretically*. The theory is for the Architect (Bob), the practice is for the System (All).

## 2. Simplification Review Criteria (P193)
To prevent complexity creep, all future designs must pass these 4 filters:
1. **One Way**: Is there already a way to do this? If yes, use it or replace it. Never add a second way.
2. **Removal**: Does this feature allow us to delete something else? (Net negative code is the goal).
3. **Standard Pattern**: Does this use an existing pattern (e.g., Cron, Skill, Handoff)? If it invents a new pattern, reject it.
4. **No Speculation**: Is this solving a problem we have *evidence* for? (Logs, Errors). If it's for a "future need", reject it.

## 3. Immediate Actions
- **Handoff**: `philosophy-v2.md` to May for final approval/swap.
- **Brief**: Tech-Lead on P193 criteria for code reviews.
- **Audit**: Scheduled for 2026-04-16 to ensure `philosophy.md` stays under 300 lines.

## 4. Impact
- **Cognitive Load**: Reduced for all agents (smaller context).
- **Maintainability**: Clear separation of "Constitution" (rarely changes) vs "Research" (constantly growing).
- **Alignment**: Direct response to Hao's "Tidiness" mandate.

**Outcome**: System is now structurally optimized for long-term growth without unbounded complexity.
