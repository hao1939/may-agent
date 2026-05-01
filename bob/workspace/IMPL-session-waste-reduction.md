# Implementation Tracker: Session Waste Reduction

**Proposal**: `proposal-session-waste-reduction.md`  
**Approved**: 2027-09-04  
**Owner**: Bob

## Layer Status

| Layer | Description | Status | Notes |
|-------|-------------|--------|-------|
| 1 | Preflight skip (mark stale todos) | ✅ DONE | Marked 3 stale items in May's todo.md as `[x] STALE` (2027-09-04) |
| 2 | Cron interval 5min→30min | ✅ DONE | Confirmed by tech-lead in approval |
| 3 | Smart preflight filter (code) | TODO | Requires code change to project cron handler |

## Next Actions

### Layer 1 (immediate, zero risk)
1. Read May's todo.md
2. Identify stale `- [ ]` items that are effectively BLOCKED
3. Mark them `- [x] BLOCKED:` or remove
4. Verify hasRemainingWork() won't retrigger

### Layer 3 (code change, medium risk)
1. Locate project cron handler in infrastructure code
2. Add preflight: count non-BLOCKED items before spawning
3. If 0 actionable items, log and skip
4. Test with dry-run

**Note (2027-09-04)**: Project cron handler code not in this repo. Escalate to tech-lead by 2027-09-10 if no access. Layer 2 (30min interval) confirmed deployed per tech-lead approval notification.

## Measurement Plan
- Baseline: ~350 May no-op sessions/day (from proposal analysis)
- Target: <10 May no-op sessions/day after all layers
- Method: Count sessions with 0 deliverables in next 48h after Layer 1+3 deploy

## Dedup Guard (separate but related)
The dispatch dedup guard (`DESIGN-dispatch-dedup-guard-v2.md`) addresses a broader class of duplicate sessions. Layer 3 here is a specific case. Consider whether Layer 3 should be a special case of the general dedup guard or standalone.
