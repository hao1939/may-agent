<ai_context>
summary: "Ontology Atlas makes codebase meaning a reviewable Markdown artifact shared by people and coding agents. Its pinned source separates declared relationships from code evidence, returns unknown when evidence cannot be established, and keeps agent-authored changes inside ordinary file review; this is implemented static source, not proof that the ontology improves task answers."
triggers: ["Ontology Atlas", "codebase ontology", "coding-agent context", "reviewable agent context", "MCP knowledge graph", "evidence drift"]
last_updated: "2026-10-05"
source_basis: "Static inspection of wlsdks/ontology-atlas at revision 2d95c6729235bc074a5be79ad5ebc2c1aab5f34f: README, complete repository tree, ontology compiler, evidence-verdict rule, and read/write-boundary tests. Scout did not install or run the application, CLI, MCP server, or tests."
</ai_context>

# Put codebase meaning in a reviewable artifact, not only in agent context

**Date:** 2026-10-05  
**Disposition:** New source signal  
**Repo:** https://github.com/wlsdks/ontology-atlas  
**Inspected revision:** [`2d95c6729235bc074a5be79ad5ebc2c1aab5f34f`](https://github.com/wlsdks/ontology-atlas/commit/2d95c6729235bc074a5be79ad5ebc2c1aab5f34f)

## Question

Can a codebase ontology give coding agents durable architectural context without turning generated interpretation into unreviewed truth?

## Source observations

Ontology Atlas stores one Markdown file per concept in an `atlas/` folder beside the code. Frontmatter gives each concept a stable `uid`, a current slug, a kind, code paths, and graph relations. People see the same files through maps, documents, insights, and Git history; connected coding agents query and propose changes through MCP. The README says agent changes arrive as Markdown diffs that a person may keep, correct, or reject.

The pinned implementation supports a narrower and more useful claim than “the graph understands the codebase.” The ontology compiler resolves documents and declared relations into nodes and edges, reports malformed relation fields, and fails the graph operation when node identities are unstable or ambiguous. Its own README explicitly says that a line is a declared relationship rather than proof of runtime impact.

A separate shared evidence rule classifies a concept's cited code as `current`, `stale`, `missing`, or `unknown`. Missing paths dominate; a file changed after the concept document becomes stale; an unwalked path, missing date, or folder-only change remains unknown. This is important because it prevents incomplete observation from silently becoming “safe” or “current.”

The inspected boundary tests describe another distinction: source reads reject symbolic links, hidden files, and credential-named files; write tools refuse agent instruction files and hidden folders while still permitting ordinary ontology-node writes. These are project-authored tests inspected as source, not reproduced behavior.

## Reusable implication

Agent context becomes easier to govern when three layers stay separate:

1. **authored meaning:** reviewable statements about capabilities, dependencies, decisions, and unknowns;
2. **code evidence:** paths and revision-sensitive observations that may support or invalidate those statements; and
3. **runtime truth:** actual behavior, impact, and task outcomes, which neither a graph edge nor a fresh file timestamp proves.

Keeping the first layer in ordinary repository files creates useful ownership and review mechanics: changes can be diffed, attributed, branched, reverted, and discussed by people who do not use the agent. Stable concept identities also let names and paths change without pretending the subject is new.

The more consequential design choice is explicit uncertainty. A context system should not report freshness when a path was not walked, timestamps are absent, or only a broad directory changed. It should also bind every generated relationship to its evidence status and preserve the difference between a declared dependency and observed runtime impact.

For agent-runtime design, this suggests evaluating context artifacts on at least four independent axes: identity stability, evidence coverage, review/admission of writes, and downstream task effect. A valid ontology file can pass the first three and still fail to improve an agent's answer or patch.

## Evidence limits

- GitHub Repository Search returned `incomplete_results: false`; Scout then inspected the repository at the pinned revision. Search metadata was used for discovery, not as implementation proof.
- Scout statically inspected the README, complete recursive tree, ontology compiler, evidence-verdict rule, and read/write-boundary tests. The application, CLI, MCP server, and tests were not installed or run.
- The repository contains substantial implementation and test source, but existence of code and project-authored tests does not establish correctness, security, usability, or deployment reliability.
- The README candidly reports that its re-scored benchmark has not measured better answer quality with Atlas and found it slower. Its construction measurements are bounded author-run trials with incomplete results, timeouts, and remaining semantic gaps.
- Timestamp and path checks can detect some drift; they cannot prove that prose is semantically correct, that unchanged code behaves as claimed, or that a declared relation reflects runtime causality.

## Sources reviewed

- [Repository](https://github.com/wlsdks/ontology-atlas)
- [README at the inspected revision](https://github.com/wlsdks/ontology-atlas/blob/2d95c6729235bc074a5be79ad5ebc2c1aab5f34f/README.md)
- [Ontology compiler](https://github.com/wlsdks/ontology-atlas/blob/2d95c6729235bc074a5be79ad5ebc2c1aab5f34f/mcp/src/ontology-compiler.mjs)
- [Evidence-verdict rule](https://github.com/wlsdks/ontology-atlas/blob/2d95c6729235bc074a5be79ad5ebc2c1aab5f34f/mcp/src/evidence-verdict.mjs)
- [Read/write-boundary tests](https://github.com/wlsdks/ontology-atlas/blob/2d95c6729235bc074a5be79ad5ebc2c1aab5f34f/mcp/src/read-write-boundaries.test.mjs)
