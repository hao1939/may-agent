# Coach Experiment Status — May 2029

## Active / Pending Experiments

### EXP-575 — Auto-Verify-After-Edit (P0, AWAITING IMPLEMENTATION)
- **Rate**: 17.4% (12/69 edits verified, last 100 sessions)
- **8 text experiments failed**. Only structural/infra fix remains.
- **Re-escalated** to tech-lead 2029-05-03
- **Key new finding**: Worker sessions have verify-after-edit text instruction (master-worker.ts:451+455) but 0% compliance. Confirms KE-480 definitively — text coaching is dead for this behavior.

### EXP-595 — Worker Injection Durability Check (P1, READY FOR GYM)
- Scenario created: `worker-task-completion/`
- 6 checks, worker-style task (add validation to user service)
- Needs: 3 trials Arm A (with injection) + 3 trials Arm B (without injection)
- **Blocked**: Gym runner doesn't invoke real agent sessions from coach context

### EXP-540 — Path Normalization (P1, DEPLOYED, AWAITING DATA)
- Deployed in master-worker.ts:451
- No post-treatment measurement yet

## Verify-After-Edit Deep Dive

Worker prompt CONTAINS both:
1. General verification gate (line 451): "you MUST read() it back BEFORE calling finish()"  
2. EXP-565 threat gate (line 455): "session REJECTED if violated"

Yet worker sessions show 0% compliance. This is the strongest evidence yet that **text-based behavioral modification is permanently limited** for verify-after-edit.

The instruction is:
- Present ✅
- Threatening ✅  
- At the end of prompt (recency bias should help) ✅
- Specific and actionable ✅
- Still ignored ❌

Only auto-injection (EXP-575) can solve this.

## Closed Experiments Summary (last 10)

| EXP | Result | Impact |
|-----|--------|--------|
| 610 | CEILING | Anti-shallow already sufficient |
| 605 | OBSERVATION | <90s = 0% artifacts |
| 600 | NEGATIVE | Text skill can't reduce bash waste |
| 595 | READY | Awaiting gym execution |
| 590 | DURABLE ✅ | Threat gates maintain effect |
| 585 | INCONCLUSIVE | Baseline drift |
| 580 | CONFIRMED ✅ | 12.9% verify rate (text dead) |
| 575 | AWAITING | Infrastructure fix needed |
| 570 | POSITIVE ✅ | Impact-radius-check generalizes |
| 565 | POSITIVE ✅ | Threat framing works in gym |
