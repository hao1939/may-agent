# Common Sense Infra Review — 2026-04-06

## Task
Cron: Review agents/shared/common-sense.md for infra-owned items. Identify highest-priority unbuilt mechanism. Check if Coach flagged anything needing infra help.

## Changes Since Last Review (2026-04-05)
- common-sense.md: **Unchanged** (same 10 items under "How We Think")
- Coach status tracker: Updated Item #9 to ✅ (one thing at a time recovered)
- New Coach brief: **tech-lead C1.3 regression** (45.5% pass rate, worst agent)
- Coach applied text interventions (skill tightening + context.md nudge) for tech-lead C1.3

## Infra-Owned Items Status

| Item | Status | Mechanism |
|------|--------|-----------|
| C1.7 Success Requires Evidence | ✅ BUILT | finish-guard.ts Gate 2 (FM-3.3) |
| C1.8 Match finish() to reality | ✅ BUILT | finish-guard.ts Gate 0 (ghost deliverables) |
| git add agents/ = NO | ✅ BUILT | .gitignore + pre-commit hook (100% catch rate, 43 blocked in 48h) |
| C1.3 Verify every write | ⚠️ GAP | edit() returns diff preview; write() returns 30-line preview; finish-guard backstop exists |

## Highest Priority Unbuilt Mechanism: Still C1.3

### What Changed Since Last Review

My April 5 review concluded "no new infra needed" for C1.3. I was partially wrong. New evidence:

1. **Tech-lead C1.3 collapsed**: 87.5% → 45.5% in 4 days (worst agent, Coach brief today)
2. **write() vs edit() gap confirmed**: Coach's root cause analysis found that **write() has no diff** — only a 30-line content preview. 37% of violations are on test files created via write()
3. **Coach's own evidence defeats text**: EXP-020 DISPROVEN (verify-after-edit skill: 0/3). Post-edit-readback skill: 1/8. Yet Coach just applied... another text intervention (skill tightening + context nudge). The intervention hierarchy evidence (KE-007, KE-021, KE-025) says this won't work.
4. **Coach explicitly flagged infra**: "If no improvement in 48h: Consider L5 workflow enforcement"

### Why My April 5 "No New Infra" Was Wrong

I said "edit() already returns diffs — this IS auto-verification." True for edit(), but:
- **write() only shows first 30 lines** — for 100+ line test files, the agent can't verify correctness from the preview
- **Agents treat previews as informational**, not actionable — the "Verify the content above" text is ignored (same text injection failure pattern)
- **The finish-guard catches it too late** — by the time finish() is called, 5+ files may be unverified

### Assessment: This Is At The Design Boundary

Three possible interventions ranked by evidence:

**Option A: Do Nothing (monitor Coach's 48h window)**
- Coach applied text fixes today. Wait 48h, see if tech-lead C1.3 improves.
- Expected outcome: Won't work (text-based verify-after-edit has 0/3 to 1/8 historical success rate).
- Risk: Low. We can always build something later.
- **My recommendation: This is the right first step.** Let Coach's intervention play out. If it fails (which history predicts), that becomes the evidence base for an infra proposal.

**Option B: Enhance write() output to match edit()**
- Make write() return a full diff against previous file contents (like edit() does) when overwriting an existing file.
- For new files, return full content (current behavior).
- This is a small code change in `src/lib/tools/write.ts`.
- Doesn't force read-back, but gives the agent the same verification information edit() provides.
- **My recommendation: Worth doing regardless of other interventions. Low cost, fills a real gap.**

**Option C: Soft gate — inject "verify" reminder into next turn**
- After write(), inject a system-level prompt fragment: "You just wrote {path}. Read it back to verify."
- Not a hard block — just a structural nudge stronger than preview text.
- Risk: May increase op count system-wide.
- **My recommendation: Premature. Try B first.**

### Decision
1. **Wait 48h** for Coach's text intervention results on tech-lead C1.3
2. **If no improvement**: Write a design brief for Option B (write() diff enhancement)
3. **Don't build Option C** — it's a slippery slope toward injecting behavioral guidance via infra, which violates the code-vs-data boundary (see design/code-vs-data-decisions.md)

## Coach Flagged Items Needing Infra

### 1. Tech-Lead C1.3 (described above)
Coach explicitly said "Consider L5 workflow enforcement" if text fails in 48h. This is a coaching→infra escalation in progress.

### 2. Sycophancy Gate Pattern (EXP-025)
Coach discovered strict two-phase gated workflows fix sycophancy (3/3 vs 3/6 baseline). This is a **coaching pattern** (specific workflow design), not a general infra mechanism. No infra action needed — Coach deploys these per-scenario.

### 3. Scout C1.1 Regression
Coach created a new gym scenario (scout-library-update) and is coaching via training. Not an infra issue — C1.1 (read-before-edit) is a pre-action habit where skills DO work (unlike C1.3 post-action habits).

### 4. Pull-Model Discovery Dead (KE-026)
Coach proved agents never spontaneously discover resources (0/26 attempts). This isn't a common-sense item but is an infra-relevant finding — it means any new mechanism we build must be push-based (injected into context), not pull-based (available for discovery).

## Ownership Updates
No changes to common-sense.md ownership. All 10 items remain correctly categorized.

## Summary
- **Highest priority unbuilt mechanism**: C1.3 write() verification gap (write() lacks diff output unlike edit())
- **Action**: Wait 48h for Coach's text intervention to fail, then propose write() diff enhancement
- **No items recently built** that need ownership updates
- **Coach flagged 1 item** for potential infra escalation (tech-lead C1.3) — monitoring
