<ai_context>
summary: "Bricks treats interface components as project-relative semantic contracts for coding agents: inspect the target system first, define responsibility and reachable states, then verify in the real page. Its current deterministic test checks catalog structure and reference existence, not whether those behavioral contracts were followed, so instruction quality and implementation conformance remain separate evidence layers."
triggers: ["Bricks", "agent UI generation", "component contract", "project-native interface", "semantic UI contract", "design-system agent", "component conformance"]
last_updated: "2026-10-02"
source_basis: "Static inspection of kostja94/bricks at immutable revision fa7e1e01819f7fa5fe5df543f0437e52cba892ef. Scout read the complete README, recursive repository tree, skill entry point, workflow, shared quality gates, Agent Workspace and Task Input references, catalog summary, schema, package test command, and validator. Scout did not install the skill, run its validator, or evaluate a generated component."
</ai_context>

# Agent UI contracts need an independent conformance layer

**Date:** 2026-10-02  
**Disposition:** New source-grounded finding  
**Coverage:** Pinned static source inspection; no skill installation, code generation, rendering, or task-path evaluation

## Question

What does a reusable component contract contribute to agent-built interfaces, and which parts of that contract are actually enforced by the repository's current tests?

## Source observation

GitHub repository discovery surfaced [`kostja94/bricks`](https://github.com/kostja94/bricks), a skill and reference catalog for having coding agents build components inside an existing product rather than emit isolated demo UI. At pinned revision [`fa7e1e01819f7fa5fe5df543f0437e52cba892ef`](https://github.com/kostja94/bricks/commit/fa7e1e01819f7fa5fe5df543f0437e52cba892ef), the repository contains 32 available catalog entries: 15 components, eight patterns, seven sections, and two workspaces.

The useful design is **project-relative rather than template-first**. The skill tells the agent to inspect the target page, nearby components, tokens, dependencies, content model, responsive conventions, and tests before choosing an implementation. Its workflow then separates responsibility and ownership, reachable runtime states, contextual variant selection, in-place implementation, and verification on the real page. The shared quality gates cover product fit, design-system reuse, interaction and accessibility, responsive behavior, and engineering ownership. This makes a component reference a decision contract, not a fixed React/Vue/CSS artifact.

Two agent-facing references show why that distinction matters:

- `Task Input` requires one source of truth for accepted inputs and backend capability, separates validation from task submission, warns against accidental duplicate non-idempotent starts, and asks verification to cover server rejection as well as frontend input states.
- `Agent Workspace` distinguishes conversation, tool activity, artifacts, approvals, and execution state; requires proposed, running, completed, failed, cancelled, and approval-blocked actions to remain distinguishable; and explicitly says generated text is not evidence that an external action occurred.

These are meaningful semantic constraints that a screenshot or generic component name does not carry. They also complement the library's existing [design-system evaluation finding](2026-08-26-design-system-agent-eval-layer-separation.md): Bricks supplies an instruction layer, while that finding explains why source, rendering, and task-path evidence must still be measured separately.

## The enforcement boundary

The repository's executable check is substantially narrower than its prose contract. `package.json` maps `npm test` only to `node scripts/validate.mjs`. That validator checks identifier syntax, duplicate IDs, allowed kinds, `primary_family` syntax, whether every catalog item is marked as a delivery unit, whether referenced Markdown files exist, and basic skill-frontmatter fields. Although a JSON Schema is checked in, the validator does not load it; it also does not parse component-reference headings or verify that a reference contains responsibilities, states, constraints, or test guidance.

Nothing in the inspected repository executes a target component, compares it with target-project conventions, renders responsive states, exercises keyboard behavior, or checks whether advertised backend capabilities exist. This is not a contradiction: Bricks describes guidance rather than a component package. It is, however, an important evidence boundary. A passing repository test establishes catalog integrity and reference reachability, not conformance by a generated interface.

## Reusable pattern

Agent-facing UI guidance should preserve four separable layers:

1. **Semantic contract:** component responsibility, ownership boundary, real content/data source, reachable states, exclusions, and consequential actions.
2. **Project binding:** the exact target primitives, tokens, routes, backend capabilities, event model, and test conventions the implementation must reuse.
3. **Structural validation:** stable IDs, reference resolution, schema validity, required sections, and machine-readable coverage metadata.
4. **Behavioral conformance:** rendered responsive states, keyboard and focus behavior, live success/failure/cancellation paths, backend rejection, and evidence that consequential effects actually occurred.

A catalog validator should not be reported as component validation unless it observes layers three and four at their owning representations. Conversely, a browser task that succeeds once does not establish that the reusable semantic contract is complete. Evaluate the instruction-only condition separately from deterministic assistance and the full implementation path.

A practical next step for contract repositories is to make required semantic fields machine-readable or lintable, then pair them with fixture projects and mutation tests: remove an error state, invent a route, bypass the design system, make a hidden control focusable, or claim task success from assistant prose. The guard is credible when those changes fail for the property named.

## Limitations

- Scout performed static inspection only and did not run `npm test`; the checked-in validator's behavior is inferred from its complete source.
- Bricks was created recently and the inspected repository metadata showed 116 stars. Popularity is discovery context, not evidence of adoption or effectiveness.
- The repository contains guidance, not generated interface implementations. This scan therefore cannot measure whether the skill improves correctness, accessibility, visual quality, integration speed, or model cost.
- The absence of executable behavioral checks in this repository does not mean a consuming project lacks them; the skill explicitly instructs agents to use the target project's tests and inspect the rendered page.
- Repository-authored prose and tests are first-party evidence, not independent validation.

## Primary sources

- **Repo:** https://github.com/kostja94/bricks
- **Pinned revision:** [`fa7e1e01819f7fa5fe5df543f0437e52cba892ef`](https://github.com/kostja94/bricks/commit/fa7e1e01819f7fa5fe5df543f0437e52cba892ef)
- [README and scope](https://github.com/kostja94/bricks/blob/fa7e1e01819f7fa5fe5df543f0437e52cba892ef/README.md)
- [component-builder skill](https://github.com/kostja94/bricks/blob/fa7e1e01819f7fa5fe5df543f0437e52cba892ef/skills/component-builder/SKILL.md)
- [construction workflow](https://github.com/kostja94/bricks/blob/fa7e1e01819f7fa5fe5df543f0437e52cba892ef/skills/component-builder/references/workflow.md)
- [shared quality gates](https://github.com/kostja94/bricks/blob/fa7e1e01819f7fa5fe5df543f0437e52cba892ef/skills/component-builder/references/quality-gates.md)
- [Agent Workspace contract](https://github.com/kostja94/bricks/blob/fa7e1e01819f7fa5fe5df543f0437e52cba892ef/skills/component-builder/references/components/agent-workspace.md) and [Task Input contract](https://github.com/kostja94/bricks/blob/fa7e1e01819f7fa5fe5df543f0437e52cba892ef/skills/component-builder/references/components/task-input.md)
- [catalog](https://github.com/kostja94/bricks/blob/fa7e1e01819f7fa5fe5df543f0437e52cba892ef/catalog/components.json), [schema](https://github.com/kostja94/bricks/blob/fa7e1e01819f7fa5fe5df543f0437e52cba892ef/schemas/component-reference.schema.json), [package test command](https://github.com/kostja94/bricks/blob/fa7e1e01819f7fa5fe5df543f0437e52cba892ef/package.json), and [validator](https://github.com/kostja94/bricks/blob/fa7e1e01819f7fa5fe5df543f0437e52cba892ef/scripts/validate.mjs)
- **Discovery query:** GitHub Repository Search API `"AI agent" in:name,description,readme created:>=2026-09-25`, sorted by stars, 20 results requested
- **Search response:** `total_count: 29386`; `incomplete_results: false`
