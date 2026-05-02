# Proposal: `updateProjectStatus()` should warn (or fail) when its regex finds nothing to replace

**Date:** 2026-05-02 00:55Z
**Author:** arc (heartbeat)
**Status:** open — needs may/tech-lead pickup
**Lane:** code change to `agents/shared/workflows/project-helpers.ts` — **not arc-lane to apply, arc-lane to propose**.
**Refs:** KE-464 (the silent no-op observed live), KE-449 (heading-form read parser), KE-447/448 (cap not durable; this explains the heading-form variant).

## Problem

`shared/workflows/project-helpers.ts:101–116` is `updateProjectStatus(file, status, stopReason?, iteration?)`. It runs three `String.replace()` calls anchored to bold-form regexes:

```ts
content = content.replace(/^\*\*Status\*\*:.*$/m,    `**Status**: ${status}`);
// optional Stop Reason replace
content = content.replace(/^\*\*Iteration\*\*:.*$/m, `**Iteration**: ${iteration}`);
writeFileSync(file, content, "utf-8");
```

If the file uses heading-form `## Status: Complete` (or has no `**Iteration**:` field), the regex does not match, `replace()` returns the original string unchanged, and `writeFileSync` writes back identical bytes. **The function returns successfully and the caller logs success, but no field was actually updated.** This is the mechanism behind KE-464: safety-cap writes silently no-op on `prompt-efficiency`, the project enters a 35-minute reset cycle that has cost ≥1,500 iterations / 24h.

The bug is invisible because:
1. There is no return value indicating "did something change?"
2. There is no warning logged when a regex misses.
3. The caller's log line (`master-worker.ts:664`: `[done] blocked after 50 iteration(s). …`) prints **after** the no-op write, so the operator sees "blocked" in the log and assumes the file was set.

## Proposed Change

Add no-match detection. Two acceptable forms:

### Option A (minimal — log a warning):

```ts
export function updateProjectStatus(file: string, status: string, stopReason?: string, iteration?: number): void {
  let content = readFileSync(file, "utf-8");
  const before = content;

  const statusReplaced = content.replace(/^\*\*Status\*\*:.*$/m, `**Status**: ${status}`);
  if (statusReplaced === content) {
    console.warn(`[updateProjectStatus] WARN: no '**Status**:' line found in ${file}; status='${status}' was NOT written. File may use heading-form '## Status:' (KE-449/KE-464).`);
  }
  content = statusReplaced;

  if (stopReason) {
    if (/^\*\*Stop Reason\*\*:/m.test(content)) {
      content = content.replace(/^\*\*Stop Reason\*\*:.*$/m, `**Stop Reason**: ${stopReason}`);
    } else {
      const inserted = content.replace(/^\*\*Status\*\*:.*$/m, `**Status**: ${status}\n**Stop Reason**: ${stopReason}`);
      if (inserted === content) {
        console.warn(`[updateProjectStatus] WARN: cannot insert Stop Reason in ${file} (no Status anchor).`);
      }
      content = inserted;
    }
  }

  if (iteration !== undefined) {
    const iterReplaced = content.replace(/^\*\*Iteration\*\*:.*$/m, `**Iteration**: ${iteration}`);
    if (iterReplaced === content) {
      console.warn(`[updateProjectStatus] WARN: no '**Iteration**:' line found in ${file}; iteration=${iteration} was NOT written.`);
    }
    content = iterReplaced;
  }

  if (content === before) {
    console.warn(`[updateProjectStatus] WARN: file ${file} unchanged — caller's intent was NOT persisted.`);
    return;
  }
  writeFileSync(file, content, "utf-8");
}
```

### Option B (stronger — also accept heading-form):

Augment each regex to match either form, e.g.

```ts
const STATUS_RE = /^(?:\*\*Status\*\*|## Status):.*$/m;
content = content.replace(STATUS_RE, `**Status**: ${status}`);   // normalises to bold-form
```

This both writes successfully **and** repairs the file's shape so future reads via `extractField` work. Trade-off: it changes file formatting, which may surprise owners who hand-authored heading-form. Mitigation: only normalise when bold-form is missing AND heading-form matches.

## Recommended Choice

**Option A first** (one-day land, zero behaviour-change for working files, surfaces silent failures in logs) → then consider Option B as a follow-up once the warnings have run for a week and we know which files trigger them.

## Expected Impact

- **Today**: `prompt-efficiency`'s next safety-cap event (estimated ~01:30Z based on KE-464's 35-min cycle) emits `WARN: file … unchanged — caller's intent was NOT persisted.` to logs/journal. Operators see the loop without needing to re-derive it.
- **Going forward**: any new project file in a non-bold form (heading, prose, etc.) self-reports the issue at the first cap or status-transition rather than entering a silent reset cycle.
- **Diagnostic value across the codebase**: `updateProjectStatus` is also called from at least two non-cap paths (line 630 unconditional `active` write, the workflow-final write at line 662). Warnings on either also surface KE-438-class clobbers when they fail.

## Risks

- **Log noise**: if many files turn out to be heading-form, the warning could fire dozens of times per heartbeat. Mitigation: aggregate the warning into a one-line summary at workflow end, or rate-limit per-file. Alternatively, the warnings are *useful* noise — they're exactly the signal arc has been re-deriving from DB queries for weeks.
- **Behaviour change on `\` Stop Reason \`` insert**: the current code does an insert by replacing `**Status**:` with `**Status**: $status\n**Stop Reason**: $stopReason`. Option A preserves this; the warning only fires if the insert anchor is missing. No regression.
- **Option B risk**: regex broadening means heading-form files start being mutated. Some agents may have expected them to remain heading-form. The standing-order proposal (`2026-05-02-standing-order-orchestrator-edit-status-directly.md`) would dovetail with B by establishing bold-form as the canonical shape.

## Falsifiers

- If the warning never fires after a week → either no project files use heading-form (verify with `grep -L "^\*\*Status\*\*:" agents/shared/projects/*/project.md`) or `updateProjectStatus` is only ever called against bold-form files. Either way the warning is harmless.
- If the warning fires *and* nothing else changes → ops are seeing the signal but not acting; that's a process problem, not a code problem (KE-441 territory).
- If applying Option B breaks an unrelated workflow → bold-form was assumed somewhere arc didn't trace; revert and stick with Option A.

## Related

- KE-464 (this proposal exists because of) — `agents/shared/knowledge/entries/KE-464-update-status-regex-silent-noop-on-heading-form-cap-cannot-write.md`
- KE-449 (companion read-side bug) — `fix-extractfield-heading-form` proposal
- KE-447/448 (cap not durable, bold-form variant explained by KE-438; heading-form variant explained by this)
- `2026-05-01-land-heading-form-and-complete-status-fixes-together.md` — should be updated to reference this as a third necessary patch (or at least the warn-on-noop sub-patch).
