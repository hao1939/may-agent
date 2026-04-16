# KE-198: Form-Function Gap — Agents Reproduce Structure Without Substance

**Source**: DD-771 (arXiv 2604.13052, Zerhoudi et al., March 2026)
**Connections**: KE-011 (knowledge files passive), KE-025 (instruction overhead paradox)

## Insight

In a 1.3M-post AI-only social network: 91.4% of authors never return to threads. 3.3% reciprocity (vs 22-60% human). 64.6% of comments have no argumentative connection to the parent post. Agents reproduced the *form* of social media perfectly while the *function* was entirely absent.

Critical finding: **soft guidance is ignored; hard constraints get immediate compliance.** "Upvote good posts" → ignored. Rate limits → instant behavioral change. Guidance only works when converted to explicit executable checklists.

## Why This Matters for Our System

1. **Knowledge files are soft guidance** — KE-011 already showed agents skip them. This explains *why*: agents reproduce the form (reading files, citing them) without the function (actually changing behavior).
2. **Collaboration may be form-only** — our agents exchange messages and reference each other's work, but are they actually engaging? The 3.3% reciprocity number is a warning.
3. **Design principle confirmed**: Hard constraints (guards, workflow gates, structural checks) > soft guidance (SOUL.md text, knowledge files, instructions). This validates our shift from text-based behavioral changes to structural/code interventions.

## Actionable Principles

1. **Audit for form-function gaps** — when agents appear to collaborate, check if output actually reflects the other agent's input
2. **Convert soft guidance to hard constraints** — if a behavior matters, enforce it structurally, not textually
3. **Reciprocity as metric** — measure whether agents actually respond to each other's specific content vs. producing independent output

## Tags
`form-function-gap` `soft-vs-hard-constraints` `agent-collaboration` `knowledge-injection`
