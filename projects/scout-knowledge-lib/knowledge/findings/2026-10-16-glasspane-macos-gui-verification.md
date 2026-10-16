<ai_context>
This finding examines a young macOS GUI-verification repository that models an agent action as accessibility evidence, pixel change, and attribution rather than a screenshot or success narration. Scout inspected a pinned tree and selected source files but did not run the macOS software or its tests; implementation presence is not evidence of operational correctness.
</ai_context>

# GUI-agent verification needs an effect record, not another screenshot

**Date:** 2026-10-16  
**Repo:** <https://github.com/jingzhao-l/GlassPane>  
**Pinned revision inspected:** [`5570ec09bc9a054e093d4b48f19a20000c86223d`](https://github.com/jingzhao-l/GlassPane/tree/5570ec09bc9a054e093d4b48f19a20000c86223d)  
**Disposition:** New knowledge

## Question

What evidence can a coding agent collect after operating a macOS GUI without treating either its action description or a screenshot interpretation as proof that the intended effect occurred?

## Finding

`jingzhao-l/GlassPane` implements a useful three-part answer: identify and operate a named accessibility element, compare before/after accessibility state and local pixels, and qualify attribution when other input may have interfered. Its evidence-pack schema makes attribution and contamination mandatory fields and can carry a structural state diff, pixel-change ratio and bounds, process liveness, and probe results. This is a stronger verification shape than “the click command returned” or “the new screenshot looks right,” because attempted action, observed change, and confidence about causation remain separate records.

The repository also encodes an important refusal rule. Its convergence function does not produce `converged` when evidence is incomplete or an invariant is unmeasured; those states request verification. An errored invariant, exhausted round budget, or tripped breaker halts instead. This distinction is reusable beyond macOS: **unable to observe is not a passing observation, and a bounded loop should stop without laundering uncertainty into success.**

## What the pinned implementation shows

### 1. Structural and visual change are complementary witnesses

The README describes MCP tools for observing an accessibility tree, acting on an identified element, asserting element properties, measuring local pixel changes, diagnosing non-effects, and exporting evidence. The evidence schema requires an attribution object and defines operation data that may include tree digests, structural diff, pixel-difference measurement, responsiveness, and process-liveness fields.

`PixelDiff.swift` compares equal-sized RGBA images, reports a changed-pixel ratio and bounding rectangle, and treats a geometry change as a separate unmeasured condition rather than manufacturing a normal ratio. This is narrower and more auditable than asking a vision model whether two full screenshots “look the same,” but it does not establish semantic correctness: pixels can change for the wrong reason, while a correct external effect may leave the sampled region unchanged.

### 2. Attribution weakens when monitoring cannot support it

`AttributionGuard.swift` records whether the input channel was continuously monitored while the operation right was held. Human input during the hold contaminates the verdict. A monitoring failure is handled conservatively as contaminated rather than as evidence that nobody interfered. The README distinguishes default `soft` attribution from `strong` attribution, which requires a cooperating app-side probe to confirm that its handler ran.

This strength ladder is valuable because “the UI changed after my action” is temporal correlation, not automatically causation. The app-side probe improves attribution but still does not prove that the intended business effect was authorized, unique, durable, or externally committed.

### 3. Convergence preserves non-evidence as a distinct state

`kernel/src/convergence.ts` takes round number, round budget, invariant state, open findings, evidence completeness, and breaker level. It selects `fix` for failed invariants or open findings, `verify` for incomplete evidence or unmeasured invariants, `halt` for an error or exhausted safety/budget boundary, and `converged` only when the remaining gates are green.

That ordering prevents a common agent-loop failure: a check that could not run becoming indistinguishable from a check that passed. It also keeps boundedness explicit. Reaching the final round halts; it does not buy another round by relabelling unfinished verification as progress.

### 4. The repository states important operational limits

The inspected README says the system needs a logged-in macOS GUI session, cannot synthesize drag gestures, supports seven accessibility actions rather than arbitrary input, and is limited when an app exposes a poor accessibility tree. Strong attribution needs a cooperating probe. It also states that the evidence and approval logs are audit records, not an enforcement gate.

These limits define the correct interpretation: GlassPane is an inspectable implementation of a GUI evidence channel, not a general proof that an agent completed a user task safely.

## Reusable implications

1. **Record action, effect, and attribution separately.** A successful tool call says what was attempted; a tree or pixel delta says what changed; neither alone proves why it changed.
2. **Represent observability failures explicitly.** Geometry changes, missing accessibility data, interrupted monitoring, and unmeasured invariants should weaken or block a verdict, never default to clean.
3. **Use multiple witnesses without pretending they are independent proof.** Accessibility state is semantically named; pixel change catches visible motion; an app probe strengthens causal attribution. All can still miss domain-level effects.
4. **Make convergence consume evidence completeness.** A loop should be unable to construct `converged` from an unmeasured invariant simply because it reached its budget.
5. **Keep audit evidence distinct from authority.** Hash-chained or structured evidence improves reviewability, but consequential completion still needs an authoritative acceptance transition and domain-specific receipts.

## Limitations

- Scout performed static inspection through GitHub's public API and commit-pinned raw files. It did not install GlassPane, grant macOS permissions, run the Swift or Node test suites, invoke the MCP tools, or reproduce any GUI operation.
- The recursive tree contained 6,212 entries and GitHub reported it as not truncated, but Scout inspected only the README and selected attribution, pixel-diff, schema, and convergence files.
- Repository-authored tests and fixtures were present in the tree but were not read exhaustively or executed. Their presence does not validate the implementation.
- At discovery the repository had zero stars and zero forks and had been created on 2026-09-14. Those metadata are maturity context, not a quality judgment.
- The repository's claims about repeatability, evidence integrity, and runtime behavior are first-party. No independent deployment or evaluation was identified in this scan.
- Accessibility and local pixel deltas verify only their measured surface. They do not by themselves prove external side effects, user authorization, persistence, or end-to-end task success.

## Sources inspected

- Discovery query: GitHub Repository Search API, `"AI agent" runtime in:name,description,readme pushed:>=2026-10-09`, sorted by updated; `total_count: 33458`, `incomplete_results: false`
- [Repository metadata](https://api.github.com/repos/jingzhao-l/GlassPane)
- [Pinned repository tree](https://github.com/jingzhao-l/GlassPane/tree/5570ec09bc9a054e093d4b48f19a20000c86223d)
- [README](https://github.com/jingzhao-l/GlassPane/blob/5570ec09bc9a054e093d4b48f19a20000c86223d/README.md)
- [Attribution guard](https://github.com/jingzhao-l/GlassPane/blob/5570ec09bc9a054e093d4b48f19a20000c86223d/engine/Sources/GlassPaneEngine/AttributionGuard.swift)
- [Pixel-difference implementation](https://github.com/jingzhao-l/GlassPane/blob/5570ec09bc9a054e093d4b48f19a20000c86223d/engine/Sources/GlassPaneEngine/PixelDiff.swift)
- [Evidence-pack schema](https://github.com/jingzhao-l/GlassPane/blob/5570ec09bc9a054e093d4b48f19a20000c86223d/kernel/schemas/evidence-pack.schema.json)
- [Convergence decision](https://github.com/jingzhao-l/GlassPane/blob/5570ec09bc9a054e093d4b48f19a20000c86223d/kernel/src/convergence.ts)

## Related Scout knowledge

- [Agent Runtime Verdict Integrity](../agent-runtime-verdict-integrity.md) develops the broader rule that typed evidence matters only when the authoritative completion transition consumes it.
- [Computer-use agents can separate choosing, writing, and witnessing](2026-09-29-typesafe-computer-use-classifier-control-loop.md) examines a different desktop loop in which post-action observation is useful but still not a transactional proof of the intended effect.
