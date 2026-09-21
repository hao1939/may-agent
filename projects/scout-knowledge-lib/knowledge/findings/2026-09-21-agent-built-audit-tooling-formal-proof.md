<ai_context>
summary: "Trail of Bits reports using coding agents during a six-month Miden VM audit to build an LSP, decompiler, abstract-interpretation analyses, and a Lean model. The durable pattern is to spend cheaper implementation capacity on independent audit instruments and machine-checked properties, while keeping analysis coverage and theorem statements under human review."
triggers: ["agent security audit", "audit tooling", "Miden VM", "MASM", "abstract interpretation", "Lean proof", "proof statement review", "verification economics"]
last_updated: "2026-09-21"
source_basis: "Complete Trail of Bits article and current HN item read 2026-09-21; the reported audit outcomes and effort were not independently reproduced."
</ai_context>

# Cheap Agent Implementation Can Fund Independent Audit Instruments

Date: 2026-09-21  
HN: https://news.ycombinator.com/item?id=49793957  
Source: https://blog.trailofbits.com/2026/09/18/auditing-in-the-age-of-good-enough-ai/  
Coverage: complete public article and the HN item, which had no comments at review time

## Signal

Trail of Bits describes a six-month preparation and review effort for Miden's
zero-knowledge VM and its custom stack-machine assembly language, MASM. Instead
of using agents only to inspect application code, the auditors used Claude and
Codex to build independent instruments around it: an LSP, a decompiler and
intermediate representation, static-analysis passes, a MASM linter, a minimal
Lean executor, and a translator from MASM procedures into Lean.

The reported outcomes make this more than a generic claim that agents can write
tools:

- The decompiler accumulated more than 100 AI-generated commits. Its most useful
  artifact was ultimately the internal analysis framework and intermediate
  representation, not full decompilation.
- The auditors deliberately restricted decompilation to a subset they believed
  could be handled correctly. Agents sampled procedures, compared decompiled
  output with the original assembly, and turned failures into regression tests.
- Abstract-interpretation passes checked properties such as validation of
  prover-supplied advice values, input type constraints, and initialization on
  all paths. The article reports more than 400 locations where type validation
  could be improved and one high-severity underconstrained-remainder issue that
  could permit forged Falcon signatures.
- Agent-assisted formalization produced 95 machine-checked correctness proofs
  over the binary-arithmetic portion of the core library. This work reportedly
  exposed a rotation edge case and a 256-bit multiplication routine that dropped
  caller-owned stack values.
- The client adopted the static-analysis engine, turning audit preparation into
  a repeatable check for later code changes rather than a one-off review
  artifact.

## Reusable pattern

When implementation becomes cheap, spend some of that capacity on **a separate
verification substrate**, not only on more candidate code or more natural-
language review:

1. **Build observability before verdicts.** For a language or runtime without
   mature tooling, first expose navigation, instruction semantics, stack
   effects, and an analyzable intermediate representation.
2. **Prefer a sound subset to plausible total coverage.** Unsupported calling
   conventions, stack effects, branches, or loops should become explicit
   analysis failures. A partial tool that refuses unknown cases is more useful
   for assurance than a fluent decompiler that invents them.
3. **Alternate builders and challengers.** Use one agent to plan or implement
   and another to review, then sample real programs and retain every discovered
   mismatch as a regression test. Model diversity is not proof, but it reduces
   same-pass confirmation before deterministic checks run.
4. **Turn domain assumptions into executable properties.** Advice validation,
   integer bounds, initialization, stack ownership, and arithmetic semantics are
   stronger audit targets than a broad request to “find bugs.”
5. **Separate proof checking from specification checking.** A Lean kernel can
   check that a proof follows from its theorem, but it cannot establish that the
   theorem states the intended behavior. Humans still need to inspect theorem
   statements, translation boundaries, and omitted code.
6. **Retain the instrument after the engagement.** A linter, analyzer, or formal
   model creates continuing leverage only if it runs against future changes and
   reports its coverage and unsupported cases.

The non-obvious shift is economic: agents make speculative audit infrastructure
cheap enough to attempt. The strongest payoff is not trusting more generated
review text; it is converting previously unaffordable domain knowledge into
independent, rerunnable checks that can reject agent and human mistakes alike.

## Evidence boundary

The production figures, vulnerability severity, proof count, and supervision
level are Trail of Bits' own account. Scout read the complete article but did
not reproduce the analyses, inspect the linked repositories or audit report, or
verify that the formal model exactly matches the deployed Miden VM. The article
also does not quantify false positives, total code coverage, token cost, or
human review time, and it says humans reviewed theorem statements. Therefore
this is evidence for an audit design pattern and a reported deployment case,
not proof that lightly supervised agents can autonomously conduct a complete
security audit.
