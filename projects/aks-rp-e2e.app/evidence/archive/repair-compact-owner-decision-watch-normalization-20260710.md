# repair-compact-owner-decision-watch-normalization-20260710

- Task: `ops/repair-compact-owner-decision-watch-normalization-20260710`
- Attempt: `a_ops_repair-compact-owner-decision-watch-normalization-20260710_20260710040738`
- Reviewed at: `2026-07-10T11:43:09Z`
- Result: implemented app-side normalization in compact runtime projection logic

## Problem

The prior overdue-family audit was correct: some compact-local owner-decision holders stayed truthful in content but their compact-loop state clocks (`nextCheckAt` / `fallbackAt`) aged independently from the exact downstream owner-decision lineage that actually governed the frontier.

That produced repeated overdue resurfacing for unchanged compact carriers such as:

- `hold-compact-aad-rbac-package-partial-frontier`
- `hold-compact-defender-profile-reviewed-exception-frontier`
- `hold-compact-ccp-security-patch-os-variants-reviewed-exception-frontier`

The common shape was:

1. the compact holder remained the correct feature-local carrier;
2. the real blocker was either a downstream owner-decision/shared wait or a promotion/reclassification frontier;
3. compact state kept older watch metadata even when the represented downstream lineage had already moved to a newer valid watch window.

## Repair

I made the smallest durable app-side repair in `workflows/lib/feature-compact-runtime-projection.ts`.

### New rule

When a compact feature still resolves to `owner.decision`, runtime projection now derives the compact-holder watch source from the exact represented owner-decision frontier:

- if `frontierTaskIds` names a blocked downstream task whose `waiting_for.type` is `owner.decision`, inherit that task's `next_check_at` / `fallback_at` into compact state;
- otherwise, if the compact holder itself is the truthful owner-decision frontier (promotion/reclassification/represented-owner-response text), inherit from the holder itself;
- do not inherit from non-owner-decision frontier tasks.

This keeps one visible blocker per real family while stopping stale compact-local clocks from drifting away from the exact downstream owner-decision lineage.

## Why this matches the assigned families

### aad-rbac

`aad-rbac` is a mixed compact carrier with three exact downstream frontier tasks. The new rule now prefers the actual blocked downstream owner-decision frontier from `frontierTaskIds` instead of leaving compact state on its older compact-local timestamp.

### defender-profile

`defender-profile` is an accepted owner-promotion frontier with no separate sharper downstream wait. The new rule treats the compact holder itself as the watch source, so its state clocks stay aligned with the holder's own refreshed owner-decision window.

### ccp-security-patch

`ccp-security-patch-os-variants` is explicitly represented by the shared wait `wait-ccp-security-patch-reviewed-exception-owner-response-20260708`. The new rule now inherits state watch fields from that shared wait instead of preserving the older compact-local timestamps.

## Scope and non-goals

- No runtime task-tree file was edited directly.
- No sibling branches, planner routing, or task-tree reshaping was done from this worker session.
- No duplicate compact rerun or duplicate owner-response wait was created.
- This change only normalizes compact-state watch inheritance for already-blocked owner-decision carriers.

## Tests

### Focused verification

Ran the targeted feature-compact tests covering:

- the new owner-decision watch-window alignment behavior; and
- the adjacent generic-wait-type refresh behavior.

Command:

```bash
bun test workflows/feature-compact-loop.test.ts -t "aligns compact owner-decision holder watch windows to represented downstream owner-decision lineages|refreshes existing exact holders from generic wait types to the represented promotion or prerequisite frontier"
```

Result: both tests passed.

### Broader file run

Also ran the full `workflows/feature-compact-loop.test.ts` file.

Result:

- the new normalization test passed;
- the adjacent projection-refresh test passed;
- the full file still has two unrelated pre-existing timeout failures:
  - `controller represents staging capacity errors as blocked wait follow-ups`
  - `controller does not recreate grouped follow-up for feature with exact open successor`

Those timeouts are outside this owner-decision watch normalization change.

## Files changed

- `workflows/lib/feature-compact-runtime-projection.ts`
  - added owner-decision watch-source selection and compact-state watch-window inheritance
- `workflows/feature-compact-loop.test.ts`
  - added regression coverage for compact owner-decision watch normalization
