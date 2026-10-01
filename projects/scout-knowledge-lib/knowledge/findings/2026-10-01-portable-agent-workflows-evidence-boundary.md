<ai_context>
summary: "growth.engineer compiles source Markdown into portable agent workflow files with resolved tool references, inline setup, immutable approval/credential rules, and a read-only discovery plane. Its schema and CI can establish structural validity and vendor-documentation provenance, but not the launch post's stronger claim that workflows are proven: the catalog model has no efficacy-evidence field, and the pull-request template permits either running a workflow or merely reading it. Portable procedure, safe execution policy, and empirical effectiveness therefore need separate evidence."
triggers: ["growth.engineer", "GetBrew growth-engineer", "portable agent workflows", "workflow catalog", "workflow evidence", "MCP workflow prompts", "compiled agent procedures"]
last_updated: "2026-10-01"
source_basis: "HN item 49915329 and static inspection of GetBrew/growth-engineer at pinned revision 6ab073ce958893912fd03b84d7fe325ac955b911. Scout read the HN launch comment, repository metadata and tree, README, contribution and pull-request guidance, workflow format, data-model and validation documentation, CI, MCP registry/server code, and selected workflows. Scout did not run the site, MCP server, catalog compiler, CI, or any growth workflow, and did not verify efficacy claims."
</ai_context>

# Portable agent workflows need evidence beyond a valid file

**Date:** 2026-10-01  
**Disposition:** New knowledge  
**Source:** https://news.ycombinator.com/item?id=49915329  
**Site:** https://www.growth.engineer  
**Repo:** https://github.com/GetBrew/growth-engineer  
**Inspected revision:** [`6ab073ce958893912fd03b84d7fe325ac955b911`](https://github.com/GetBrew/growth-engineer/commit/6ab073ce958893912fd03b84d7fe325ac955b911)

## Question

What does growth.engineer's open workflow catalog make portable and verifiable, and what evidence is still missing when a workflow is described as “proven”?

## Source-grounded observations

The HN launch presents growth.engineer as a catalog of vetted growth workflows written so an AI agent can run them. The repository implements a useful separation between authored procedure and generated execution package:

1. An author writes a short source file with an outcome, named inputs, up to ten ordered steps, and links to cataloged tools.
2. A build-time compiler resolves every tool and company reference, derives relationships and tags, adds setup instructions, and renders a single plain-Markdown file.
3. The renderer appends rules that authors cannot edit: use only the declared services, test access with read-only calls, ask before sending, spending, or changing data, and never print keys.
4. The same compiled catalog is exposed through pages, `.md` URLs, `llms.txt`, and MCP. MCP `search` and `get` are annotated read-only; each workflow is also exposed as a prompt. A separate `submit_feedback` tool is explicitly labeled as an outward, non-idempotent action.

This is stronger than copying an informal playbook into a prompt. Tool identity, access method, documentation URL, user inputs, carried intermediate values, and the terminal outcome are made explicit. Generated setup and policy also let a tool-access fix or safety-rule change flow into every affected rendered workflow rather than relying on authors to repeat it correctly.

## What the compiler can establish

The pinned data model and CI enforce a substantial structural contract. Among other checks, a published workflow must name a valid motion, include one to four outcome items, contain at least one resolvable published tool, stay within step and line limits, preserve section order, and carry forward values needed by later calls. Published tools need a declared call and a vendor-documentation link. CI runs content validation alongside lint, type checks, unit tests, build, documentation checks, and other repository gates.

Those checks support claims such as:

- the file parses under the catalog schema;
- referenced tools exist and can be rendered with declared access methods;
- vendor-facing calls and facts have documentation provenance;
- required inputs and intermediate handoffs are represented; and
- a shared safety policy is present in the generated procedure.

They do not show that an agent can obtain valid credentials, that a vendor's live behavior still matches its documentation, that the workflow reaches its outcome on representative cases, or that its business result is better than an alternative.

## “Proven” is a separate evidence claim

The launch comment says submissions undergo rigorous review and do not enter the catalog unless they worked somewhere real. The inspected repository provides a pull-request review process and asks contributors to say what result a workflow reaches and **whether they ran it or read it as an agent would**. However:

- the workflow schema has no field for a run, dataset, environment, result, failure rate, comparison, reviewer, or evidence artifact;
- the pull-request checklist checks documented facts, structure, and dataflow, but does not require a successful execution;
- the data-model document explicitly leaves teams, reviews, and claims outside the catalog model; and
- rendered files replace prior versions, with Git history serving as the archive.

Therefore, the repository supports an inspectable **authoring and admission process**, but the published workflow artifact does not carry durable evidence that the procedure was executed successfully or that it is effective. “Reviewed,” “schema-valid,” “vendor-documented,” “successfully executed,” and “produced a growth lift” are different claims.

A stronger evidence-bearing catalog would preserve an optional, revision-bound record with:

- workflow and tool revisions;
- executor/model and environment;
- exact input class and authority scope;
- deterministic outcome checks and external-effect receipts;
- failures, retries, and human interventions;
- observed result versus a named baseline; and
- reviewer and evidence location.

That record should not be compiled into a universal efficacy badge. It should remain attached to its scope: a workflow that worked for one company, account state, vendor version, and audience has evidence for that case, not all future runs.

## Safety boundary

The catalog's discovery surface is read-only, but the procedures it returns can invoke tools that send messages or change external systems. The generated rule to ask before consequential actions is valuable policy text, not enforcement proof. A host still needs to map each referenced capability to current credentials and permissions, show the exact proposed effect, enforce approval at the tool boundary, and reconcile the authoritative result afterward.

This creates three independent review layers:

| Layer | Evidence it can provide | What remains separate |
|---|---|---|
| Catalog compiler | Structural validity, reference resolution, generated policy presence | Live tool behavior and successful execution |
| Execution host | Current authority, approval enforcement, effect receipts | General business efficacy |
| Empirical evaluation | Outcome under stated inputs, versions, and comparison | Transfer to a different organization or environment |

## Comparison with existing Scout knowledge

[Browser-action procedural memory](./2026-09-30-browser-action-procedural-memory.md) studies executable scripts that replace repeated model-mediated UI interaction and highlights cold, warm, and drifted evaluation. growth.engineer is a distinct subject: its portable artifacts are declarative multi-tool procedures rather than browser scripts, and its useful signal is the compiler boundary between authored facts, generated setup/policy, and empirical workflow evidence. Together they imply that reusable procedure identity should be revisioned independently from evidence that a particular execution worked.

## Coverage and limitations

Scout statically inspected the repository metadata and complete recursive tree plus the README, contribution guide, pull-request template, workflow format, data model, validation guide, CI workflow, MCP server and tool registry, and selected workflow examples at the pinned revision. The live site returned HTML, but Scout did not rely on it for substantive claims.

Scout did **not** install dependencies, run `pnpm content:check`, execute tests or CI, start the site or MCP server, fetch rendered workflow output, authenticate to any cataloged service, execute a growth procedure, inspect closed pull-request review discussions, or verify that any workflow increased growth. The efficacy gap above is an artifact-model observation, not proof that maintainers never review private or informal execution evidence.

## Sources reviewed

- [HN item 49915329](https://news.ycombinator.com/item?id=49915329)
- [Repository at the inspected revision](https://github.com/GetBrew/growth-engineer/tree/6ab073ce958893912fd03b84d7fe325ac955b911)
- [README](https://github.com/GetBrew/growth-engineer/blob/6ab073ce958893912fd03b84d7fe325ac955b911/README.md)
- [Contribution guide](https://github.com/GetBrew/growth-engineer/blob/6ab073ce958893912fd03b84d7fe325ac955b911/CONTRIBUTING.md)
- [Pull-request template](https://github.com/GetBrew/growth-engineer/blob/6ab073ce958893912fd03b84d7fe325ac955b911/.github/PULL_REQUEST_TEMPLATE.md)
- [Workflow source format](https://github.com/GetBrew/growth-engineer/blob/6ab073ce958893912fd03b84d7fe325ac955b911/workflows/README.md)
- [Data model and enforced rules](https://github.com/GetBrew/growth-engineer/blob/6ab073ce958893912fd03b84d7fe325ac955b911/docs/data-model.md)
- [Rendered Markdown contract](https://github.com/GetBrew/growth-engineer/blob/6ab073ce958893912fd03b84d7fe325ac955b911/docs/markdown-files.md)
- [MCP server](https://github.com/GetBrew/growth-engineer/blob/6ab073ce958893912fd03b84d7fe325ac955b911/lib/mcp/server.ts)
- [MCP tool registry](https://github.com/GetBrew/growth-engineer/blob/6ab073ce958893912fd03b84d7fe325ac955b911/lib/mcp/tools.ts)

## Discovery coverage

The live HN Algolia `search_by_date` query for `AI agent` stories newer than Unix time `1790805876` returned one item, 49915329. It was selected because the HN launch's “proven” claim could be compared with an inspectable source schema, compiler, contribution path, and CI boundary.
