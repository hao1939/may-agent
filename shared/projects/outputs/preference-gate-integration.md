# Preference-Check Gate — Integration Package (Iteration 2)

## Status
The gate design exists in `preference-check-gate.md`. This iteration integrates it into May's operational flow and adds instrumentation.

---

## Section to Add to May's context.md

Insert after the "## Supervisor Discipline" section:

```markdown
## Pre-Dispatch Preference Gate (MANDATORY)

Before EVERY fork() or autonomous decision, run this checklist:

1. **STABILITY** — Are existing projects healthy? Fix broken before starting new.
2. **NO WEAKENING** — Does this weaken any guard/constraint? → STOP, escalate to Hao.
3. **EXISTING-FIRST** — Advance current work before creating new work.
4. **VALUE-ADD** — Am I adding context/breakdown, not just forwarding a raw request?
5. **RIGHT AGENT** — Correct assignment? (tech-lead=code, bob=design, coach=experiments)
6. **SCORE ≥ 3** — At least 3 of: aligns with Hao priority, has clear success criteria, advances a project milestone, won't create busywork.

**If any check fails**: Do not dispatch. Journal the decision and rationale. Revisit next heartbeat.

### Instrumentation
- Log gate results in heartbeat output: `GATE: PASS (6/6)` or `GATE: FAIL (reason: X)`
- When a dispatch is blocked by the gate, record in journal as `[GATE-BLOCK] <reason>`
- Monthly: count gate-blocks vs total dispatches to measure prevention rate
```

---

## Instrumentation Design

| Metric | How Measured | Target |
|--------|-------------|--------|
| Gate application rate | Count heartbeats with GATE log / total heartbeats | 100% |
| Block rate | GATE-BLOCK entries / total dispatch attempts | Track (no target yet) |
| False-block rate | Blocked decisions later dispatched unchanged | < 10% |
| Correction rate | Hao corrections on dispatched work | < 1% (maintain baseline) |

---

## Why This Matters

The preference model currently sits in `preferences.md` as passive documentation. This gate makes it **active** — May must consult it before every decision. The instrumentation lets us measure whether the gate actually prevents bad decisions vs. just adding friction.

## Next Steps

1. Apply the context.md edit to May's actual context file
2. After 7 days of operation, audit gate logs to measure application rate
3. Tune the checklist based on which checks actually catch problems
