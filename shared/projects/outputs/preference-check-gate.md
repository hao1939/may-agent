# Preference-Check Gate

**Purpose**: A mandatory pre-dispatch checklist for May that actively consults Hao's preferences before making autonomous decisions. This transforms the preference model from passive documentation into an active decision filter.

---

## The Gate (copy into May's context.md as operational rule)

### PRE-DISPATCH PREFERENCE GATE — Apply Before Every Fork/Decision

Before dispatching work or making an autonomous decision, verify ALL of the following:

```
□ STABILITY CHECK: Are all current projects healthy? (If not → fix first, don't start new work)
□ GUARD CHECK: Does this weaken any constraint or guard? (If yes → STOP, escalate to Hao)
□ EXISTING-FIRST CHECK: Does this fix/advance existing work rather than start something new?
□ THOUGHT CHECK: Have I added value to this task (context, breakdown, specifics) — not just forwarding?
□ ROLE CHECK: Am I assigning to the right agent? (Bob=design, tech-lead=implementation, coach=experiments)
□ SCORE CHECK: Decision scorecard ≥ 3? (See preferences.md §5)
```

**If any box fails**: Do NOT proceed. Either fix the blocker, reframe the task, or escalate.

**Quick-score formula** (from preferences.md):
- Fixes existing: +3
- Starts new: -2  
- Improves observability: +2
- Weakens constraint: -5
- Gate: existing work healthy? (must pass)
- Gate: May thought before delegating? (must pass)

**Score ≥ 3** → Proceed  
**Score 1-2** → Proceed but log reasoning  
**Score ≤ 0** → Escalate to Hao  

---

## Integration Instructions

Add the following block to `/app/agents/may/context.md` under "## Operational Facts" or as a new section:

```markdown
## Pre-Dispatch Preference Gate (MANDATORY)
Before EVERY fork() or autonomous decision, run this checklist:
1. **Stability**: All current projects healthy? (If no → fix first)
2. **No weakening**: Does this soften any guard/constraint? (If yes → escalate)
3. **Existing-first**: Fixing/advancing existing > starting new
4. **Value-add**: Have I broken down the task, added context? (No blind forwarding)
5. **Right agent**: Bob=design, tech-lead=impl, coach=experiments, optimizer=process
6. **Score ≥ 3**: +3 fix existing, -2 new thing, +2 observability, -5 weaken guard

If score < 1 or any gate fails → escalate to Hao, do not proceed.
Reference: `agents/shared/projects/hao-alignment/preferences.md`
```

---

## Why This Matters

The preference model currently sits in a file that agents *can* read but rarely *must* consult. This gate makes consultation mandatory and structural — it's a decision-time checklist, not a reference document. It prevents:

- Dispatching work that starts new things while existing projects are unhealthy
- Weakening guards without escalation
- Blind task forwarding without May adding value
- Misrouting work to wrong agents

---

## Measurement

Track gate effectiveness by monitoring:
- **Corrections from Hao after gate adoption** — should approach zero
- **Decision log entries** (score 1-2 range) — shows gate is being applied
- **Escalations** — healthy sign the gate is catching edge cases

Current baseline: ~1% correction rate (already excellent). Gate's value is *prevention* — ensuring the rate stays low as the system scales and faces novel situations.
