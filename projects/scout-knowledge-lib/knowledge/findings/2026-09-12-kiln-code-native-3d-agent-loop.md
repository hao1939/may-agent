<ai_context>
summary: "GitHub implementation signal: Kiln turns 3D asset generation into an inspectable code-edit-render loop, with immutable program references, exact edits, targeted visual review, and source-preserving revisions exposed through MCP, CLI, library, and harness skills."
triggers: ["Kiln", "3D agents", "code-native artifacts", "render feedback", "visual agent loop", "MCP", "artifact provenance"]
last_updated: "2026-09-12"
source_basis: "GitHub repository matthew-kissinger/kiln at pinned revision bfeb1a48e7fae7689eec29d3be6b55e5b6bac5f6, discovered through the public repository Search API."
</ai_context>

# Kiln makes 3D generation a source-preserving agent loop

**Date:** 2026-09-12  
**Repo:** https://github.com/matthew-kissinger/kiln  
**Pinned revision:** [`bfeb1a48e7fae7689eec29d3be6b55e5b6bac5f6`](https://github.com/matthew-kissinger/kiln/tree/bfeb1a48e7fae7689eec29d3be6b55e5b6bac5f6)  
**License at inspection:** MIT

## Finding

Kiln is a concrete example of moving an agentic creative workflow from opaque
one-shot media generation into an inspectable software-artifact loop. The model
writes JavaScript that constructs a 3D scene; the local runtime executes it,
returns rendered views and structural checks, and exports GLB while retaining the
editable source. The repository exposes the workflow through an MCP server, CLI,
TypeScript library, and harness-specific skills.

The most reusable design is not “LLMs can make 3D models.” It is the combination
of four controls around a non-text artifact:

1. **Source remains the canonical editable artifact.** A GLB is treated as an
   output, not enough state for later editing. Named parts, equations, and
   dimensions remain in JavaScript.
2. **Revisions use immutable content references.** `kiln_source` returns a
   `programRef`; `kiln_edit` applies exact string replacements and returns a new
   reference plus a diff. Failed or ambiguous edits leave the base unchanged.
3. **Review is question-directed.** Capture requests can pair a whole-object view
   with a close-up tied to an exact part path. The refinement skill tells the
   agent to use before/after views when they resolve uncertainty rather than emit
   a ritual number of images.
4. **Validation signals remain scoped.** The README explicitly says structural
   checks do not prove visual quality or game suitability, and renderer fidelity
   can leave PBR materials unverified. Edit success and render success are also
   checked separately in the refinement instructions.

This suggests a broader pattern for agent-built artifacts: when the final product
is binary or visual, keep a compact, executable source representation; expose
bounded reads and exact mutations; preserve parent-child revision lineage; and
make perceptual review an explicit tool result rather than asking the model to
reconstruct state from prose.

## Repository evidence

At the pinned revision:

- `README.md` documents the JavaScript → render/structural-check → review → GLB
  loop, program references, exact edits, targeted cameras, and limitations.
- `skills/kiln-refine-asset/SKILL.md` specifies bounded source reads, exact
  revision edits, diff/image review, immutable parent revisions, and separate
  checks for edit and render success.
- The complete recursive Git tree was returned with `truncated: false` and
  contains the MCP server, CLI/library source, rendering services, authoring/
  refinement/QA skills, and extensive test files. This is implementation
  evidence, not merely repository-description metadata.
- `package.json` identifies `@kiln/engine` version `0.6.0`, CLI entry points, and
  typecheck, lint, unit/coverage, packaging, live, and harness smoke scripts.

## Evidence boundary

This observation inspected public repository contents but did not install Kiln,
run its tests, reproduce a model-authored asset, or independently assess output
quality. The examples, platform claims, and successful integrations are therefore
maintainer evidence. The repository had 33 GitHub stars when observed; popularity
or adoption should not be inferred from this single discovery.

## Discovery record

The public GitHub repository Search API query was
`topic:ai-agents pushed:>=2026-09-05`, sorted by `updated` descending with
`per_page=10`. It returned HTTP 200, `incomplete_results: false`, and 17,614 total
matches. Kiln was selected from that bounded first page for commit-pinned content
inspection. Search completeness applies only to the returned GitHub response, not
to all possible agent repositories or to an assessment of the field.

## Sources

- Search endpoint: https://api.github.com/search/repositories?q=topic%3Aai-agents+pushed%3A%3E%3D2026-09-05&sort=updated&order=desc&per_page=10
- Repository metadata: https://api.github.com/repos/matthew-kissinger/kiln
- Pinned commit: https://github.com/matthew-kissinger/kiln/commit/bfeb1a48e7fae7689eec29d3be6b55e5b6bac5f6
- Pinned README: https://github.com/matthew-kissinger/kiln/blob/bfeb1a48e7fae7689eec29d3be6b55e5b6bac5f6/README.md
- Pinned refinement skill: https://github.com/matthew-kissinger/kiln/blob/bfeb1a48e7fae7689eec29d3be6b55e5b6bac5f6/skills/kiln-refine-asset/SKILL.md
- Pinned package manifest: https://github.com/matthew-kissinger/kiln/blob/bfeb1a48e7fae7689eec29d3be6b55e5b6bac5f6/package.json
