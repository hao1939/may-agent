<ai_context>
summary: "Candor-spec’s pinned schemas, conformance generator, and formal-model notes expose a subtle requirement for machine-consumed effect reports: a zero-finding result is meaningful only when it travels with evidence of the analyzed universe and structured disclosure of anything not analyzed. This is repository self-description and self-test evidence, not an independent run of the four language engines."
triggers: ["effect report", "effect checker", "analyzed universe", "completeness manifest", "false all-clear", "provably pure", "never seen", "machine-legible incompleteness", "Candor"]
last_updated: "2026-09-14"
</ai_context>

# Effect reports need coverage evidence, not only findings

**Date:** 2026-09-14  
**Source:** GitHub repository observation  
**Repo:** https://github.com/tombaldwin/candor-spec  
**Pinned revision:** [`22a93f7fb95b592a99ba40f0e1d944a39844f863`](https://github.com/tombaldwin/candor-spec/commit/22a93f7fb95b592a99ba40f0e1d944a39844f863)

## Signal

Candor is a language-agnostic specification for per-function, transitive side-effect reports. Its most reusable contribution for agent infrastructure is not the effect vocabulary itself, but its treatment of **negative findings**.

The report omits functions judged pure. That compression creates three states that an empty result alone cannot distinguish:

1. a unit was analyzed and judged pure;
2. a unit was never analyzed;
3. part of the source could not be analyzed.

Candor’s pinned specification addresses this with two machine-readable fields:

- `analyzed: {count, digest}` summarizes the universe for which the engine formed judgments;
- `unanalyzed: [{path, reason}]` identifies source the engine could not read or parse.

Its contract therefore limits “absent means pure” to the analyzed set. In particular, `analyzed.count == 0` means **nothing was judged**, not “everything is pure.” A pre-manifest report with no `analyzed` field likewise cannot support a coverage claim.

Sources: [SPEC.md at the pinned revision](https://github.com/tombaldwin/candor-spec/blob/22a93f7fb95b592a99ba40f0e1d944a39844f863/SPEC.md), [completeness-manifest design](https://github.com/tombaldwin/candor-spec/blob/22a93f7fb95b592a99ba40f0e1d944a39844f863/COMPLETENESS-MANIFEST-DESIGN.md).

## The caveat has to travel with derived answers

The specification goes beyond attaching incompleteness to the initial scan. It says report-consuming commands must re-disclose non-empty `unanalyzed` state and zero analyzed counts in their own machine output. This prevents a downstream query such as “where is filesystem access?” from returning an unqualified empty list after ingesting a report that omitted unreadable source.

That distinction is important for agents because they often consume derived JSON rather than stderr or the original artifact. A human-visible warning beside one command does not protect a machine that later sees only `{results: []}` or `ok: true`.

The same logic applies to baseline comparisons: incomplete current coverage can make findings too short, while incomplete baseline coverage makes the “new versus existing” split unreliable. A single merged warning does not identify which repair is needed.

## Executable evidence in the repository

The pinned [`conformance/gen_completeness.py`](https://github.com/tombaldwin/candor-spec/blob/22a93f7fb95b592a99ba40f0e1d944a39844f863/conformance/gen_completeness.py) defines equivalent fixtures for Rust, Java, TypeScript, and Swift containing:

- one effectful function;
- ordinary and isolated pure functions;
- a separate unparseable, corrupt, or unreadable source unit.

The generator checks that pure leaves count toward `analyzed`, the omitted source appears in `unanalyzed`, the analyzed-set digest is stable across an unchanged re-scan, and a configured gate over incomplete input exits `2` with `ok:false`, `incomplete:true`, and the reason-bearing `unanalyzed` list. This makes “the checker actually looked” a tested property rather than an implication of a clean verdict.

The pinned [Lean model README](https://github.com/tombaldwin/candor-spec/blob/22a93f7fb95b592a99ba40f0e1d944a39844f863/lean/README.md) sharpens the boundary: a soundness theorem can be true but hollow if the analyzer chooses its own scope by omission. It also says the compact `{count,digest}` manifest does not prove function-granular completeness by itself. The manifest separates known coverage from known gaps; it does not establish that every intended function was enumerated, nor that every analyzed-pure judgment was correct.

## Implication for agent systems

Any scanner, policy engine, evaluator, or receipt that can emit a negative result should carry a **coverage receipt** alongside its verdict:

- what units were eligible for inspection;
- what units were actually judged;
- what was skipped or unreadable, with structured reasons;
- whether downstream transformations preserved those caveats;
- whether the verdict is a policy decision, an incomplete evaluation, or merely a descriptive result.

This turns “no violation found” from an unbounded reassurance into a scoped statement: **no violation found among these judged units, subject to these named gaps**.

## Evidence boundary

This observation is grounded in repository contents pinned to one commit. The repository reports four shipped engines and contains a cross-engine conformance generator, but Scout did **not** independently build or run those engines. Accordingly, this supports the design and self-test contract, not a claim that every implementation currently satisfies it on arbitrary programs.
