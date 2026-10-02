---
name: design-authoring
description: Author, review or reorganize May designs, tracing choices to purpose, principles and current contracts. Use when changing design docs or resolving conflicting proposals.
---

# Authoring and reviewing May designs

**Supports:** [Purpose and value](../../1-principles/purpose.md). Makes designs understandable, comparable and usable by people and agents, reducing repeated explanation and maintenance cost.

**Choice basis:** [Simple first](../../1-principles/core-principles.md#simple-first) and [decision review](../../1-principles/core-principles.md#review-rule).

Use this document directly when writing, reviewing or reorganizing a design.
It is both the human guide and the agent's skill instructions; maintain only
this source. For an authoring/refinement request, update the owning documents.
For a review request, return concrete findings and recommended corrections.
Find the owner through [INDEX](../../INDEX.md), then read only the relevant
principles, contract and evidence. Do not load the full documentation tree.

## Design hierarchy

```text
Purpose and value
  -> needed system abilities
    -> responsibilities and boundaries
      -> behavior and contracts
        -> practical use, implementation and evidence

Philosophy, conventions and verified practice
  -> reasons for choosing a mechanism at each level
```

Purpose explains why the feature matters. Philosophy and conventions explain
why we choose this way of providing it. For example, avoiding repeated human
reminders justifies retaining unanswered input. Whether recovery repeats cheap
work or preserves an expensive intermediate result is a separate tradeoff.

Keep a specific **Supports** link and a brief explanation of the contribution
beside each design. Link the applicable principle and explain its consequence;
merely naming "simple" or "agent decides" does not justify the mechanism.
State material limitations, supporting evidence and what would change the choice.
A short paragraph is sufficient for a small decision; no mandatory form or
extra approval step is needed.

Use one primary parent for navigation. Dependency links explain what a design
uses; its parent explains why it exists. Shared mechanisms can support several
abilities without being copied into every branch of the hierarchy.

## Give each document a job

| Reader's question | Home |
| --- | --- |
| What is May for, and what counts as enough? | [Purpose](../../1-principles/purpose.md) |
| How do we choose among alternatives? | Philosophy and technical principles |
| How does the whole system work? | [System Model](../../2a-design/system-model.md): vocabulary and one end-to-end example |
| Which component owns a responsibility? | Architecture and Host/App boundary |
| What behavior can a caller rely on? | One owning contract in `2a-design/` |
| How do I use or operate it? | A practical guide in `2b-manual/`, including `<name>/SKILL.md` packages, with checked examples |
| What change is still being considered? | An active proposal, naming the owning contract and unresolved choice |
| Why was a choice made, and what was observed? | A dated decision, trial or review in `archive/` |

Use [INDEX](../../INDEX.md) to find the owner before adding a page. Create a new
file when it answers an independently useful question, has a clear owner and
can be read without its sibling's full text. Length is a signal to inspect
mixed responsibilities, not a reason to split every heading. Consolidate
overlapping explanations before adding another overview.

## Write for understanding

Lead with what the reader can accomplish and the core rule. Define unfamiliar
terms before using them. Show one ordinary example, then the important failure
or continuation case. Put exact types, limits and adapter details after the
explanation, or in the owning reference when they answer a different question.

Explain the complete path where relevant: input, accountable state, agent
decision, infra execution, result, and what the caller can do next. A capability
description should make acceptance, later results and failure understandable.
Do not make an ordinary agent learn delivery wiring to use a capability.

Keep the rule in one place. Overviews summarize and link; practical guides
explain use and can themselves serve as skills. None should independently
redefine a schema or lifecycle.
Keep consequential exceptions beside the rule they qualify. Put dated PR
chronology, discarded alternatives and old cutovers in linked evidence.

Use plain language and concrete examples. Explain why a choice helps and what
it costs. Avoid accumulating qualifications that obscure the normal flow.
State an important limitation once, where a reader would otherwise rely on it.

## Keep status and history honest

Distinguish **design acceptance**, **source implementation**, and **deployment**.
A merged document can describe an unimplemented proposal. A source check does
not identify the installed binary or App release. Keep a short status near a
contract's beginning and specific implementation gaps beside affected behavior.
Record exact revisions and deployment observations in dated evidence.

| When a proposal changes | What to do |
| --- | --- |
| Accepted and implemented | Integrate enduring behavior and rationale into the owning contract and affected guide; move dated evidence into the archive |
| Accepted but unimplemented | State the intended requirement and explicit gap; do not teach the proposed API as callable |
| Partially implemented | Put established behavior at its owner; keep only remaining choices in the active proposal and link the implementation record |
| Superseded or rejected | Remove obsolete guidance from current reading paths; retain useful reasoning and the replacement link |
| Trial completed with uncertain adoption | Archive the trial as evidence; retain any live design question or implementation gap explicitly |

Before archiving, check that useful rules, limits and open obligations have a
current home. Archiving is not evidence that a gap was fixed. Preserve material
trial findings, including failures. Remove duplication and obsolete instructions;
Git retains editorial history. Update repository links and the index when moving
files. Preserve a small forwarding link where a known published entry needs one.

## Make guidance usable by agents

A practical guide should let an agent answer:

- When is this method useful, and what outcome is sufficient?
- What context is needed, and how is more detail discovered?
- What does the agent decide, and which supported capability carries it out?
- What does the returned result establish, and what remains unresolved?
- How can work continue, wait, finish or recover within the existing contract?

Keep foundational knowledge short. Load task-specific procedures and exact
reference material only when needed. Write the practical document so an agent
can use it directly as a skill: clear applicability, actions, decision boundaries,
results and relevant links. Do not maintain a separate skill summary or instruction
copy. Keep a manual that serves as a skill at `2b-manual/<name>/SKILL.md`, with
required `name` and `description` frontmatter, and link to it from the documentation
index. This guide and the [Task execution guide](../task-execution-guide/SKILL.md)
follow that layout. Agents and people read the same files. The optional
`shared/skills/paths.json` discovery path points to this manual directory; see
[availability and discovery](../../2a-design/skills.md#optional-discovery-paths).
Foundational knowledge, exact contracts and detailed manuals stay at their
owning paths as on-demand references.

When changing a design, check the linked skill's applicability, actions, examples
and references. Update affected guidance in the same change. A proposed feature
can remain documented as a gap; do not teach it as available before implementation.
Check [packaging, discovery and activation](../../2a-design/skills.md)
when moving or adding a skill. References resolve from the skill directory and
must be readable in the intended workspace or definition release. These guides
depend on the May documentation tree; do not distribute their folders alone.
Missing documentation is a limitation to report, not a reason to invent an API.

Separate examples for current APIs from proposed interfaces. A review/authoring
skill should work in both modes using the same rules: author the decision at its
owner, or report a concrete defect and a feasible improvement. Preserve the good
parts of a design as well as identifying problems.

## Review and validate

Apply [the decision review](../../1-principles/core-principles.md#review-rule) and,
when choices conflict, [the conflict rule](../../1-principles/core-principles.md#resolve-conflicting-designs).
Distinguish a contract conflict, source defect, missing evidence, historical
statement and editorial preference; they need different remedies. Trust admitted
agent judgment by default without presenting it as guaranteed correctness.

For a substantive finding, name the affected behavior, its consequence and the
smallest useful correction. Link evidence. Do not replace reasoning with a
scorecard, mandatory independent review or a blanket proof requirement.

From the workspace root, run `bun run check:may-design` after changing contracts,
examples or navigation. Inspect moved links and heading targets as well as the
ordinary example and one relevant failure path. These checks establish structure
and executable examples; they do not prove agent comprehension or live adoption.
For new or repackaged skills, verify metadata and references from the canonical
location. If catalog delivery is intended, also verify trusted-root discovery,
visibility and full-body invocation through the existing loader. The bounded
prompt can omit a discovered skill. Source edits reach installed definitions
only after normal activation; existing sessions retain their snapshot.
Use an actual task comparison before claiming that new guidance improves behavior.
