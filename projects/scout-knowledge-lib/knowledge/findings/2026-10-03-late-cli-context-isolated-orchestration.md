<ai_context>
summary: "Static inspection of mlhher/late-cli shows a concrete context-quarantine architecture: each delegated worker gets a fresh session and role prompt while the lead lacks built-in file-writing tools. The same code also exposes a boundary worth auditing: workers inherit nearly every parent-registered tool, including MCP and plugin tools, before role-specific tools are added."
triggers: ["context isolation", "subagent capability inheritance", "tool registry pruning", "delegated coding agent", "Late CLI", "worker context quarantine"]
last_updated: "2026-10-03"
source_basis: "GitHub Repository Search API plus static inspection of mlhher/late-cli at pinned revision 05b836733af91e165052d2048ceb77543d57f39c; tests inspected but not executed."
</ai_context>

# Context isolation is only as strict as capability inheritance

**Date:** 2026-10-03  
**Disposition:** New knowledge  
**Coverage:** Repository metadata, README, complete recursive tree listing, selected orchestration and session implementation files, embedded role prompts/configuration, and one repository-authored session test at the pinned revision. Scout did not install Late, run its tests, invoke a model, or reproduce its performance claims.

## Question

How can a coding-agent runtime quarantine execution noise from its planning context, and what capability boundary remains after fresh worker sessions are introduced?

## Source identity

- **Repo:** https://github.com/mlhher/late-cli
- **Inspected revision:** [`05b836733af91e165052d2048ceb77543d57f39c`](https://github.com/mlhher/late-cli/commit/05b836733af91e165052d2048ceb77543d57f39c)
- **Discovery query:** GitHub Repository Search API query `"AI agent" in:readme stars:>100 pushed:>=2026-09-15`, sorted by `updated`, descending, 20 results per page
- **Search response:** `total_count: 4976`; `incomplete_results: false`
- **Observed content revision:** the pinned commit above (committer date `2026-10-03T20:07:41Z`)

## Source observations

Late presents long-horizon work as a context-management problem: a lead agent plans and verifies while short-lived coder and researcher workers absorb file reads, compiler output, failed edits, and retries. Static inspection supports the core isolation mechanism, but also narrows the repository's stronger “physical tool pruning” language.

At the inspected revision:

1. **A worker starts with a fresh message history and a role-specific system prompt.** `NewSubagentOrchestrator` selects an embedded coder or researcher configuration, reads its prompt, creates `NewSubagentSession` with an empty message slice, and adds a new user message containing the delegated goal and optional context files. It does not copy the parent's conversation into the child.
2. **The lead's built-in write surface is removed in registration code, not only discouraged by prose.** `cmd/late/main.go` builds `mainTools` from globally enabled tools, explicitly disables `write_file` and `target_edit`, and adds planning/todo tools before registering the lead's tool set. The embedded orchestrator prompt separately requires a written plan and one coder delegation per plan step.
3. **Worker roles add an explicit built-in tool set.** The coder configuration names read, write, targeted edit, shell, search, and file-discovery tools. `NewSubagentOrchestrator` intersects this list with globally enabled tools before registration, then removes todo tools even if a role configuration were to request them. The child cannot inherit `spawn_subagent`, plan-writing, or todo controls, preventing recursive worker orchestration through those built-ins.
4. **Context isolation is stronger than capability isolation.** Before adding role-specific built-ins, the worker copies every tool in the parent's live registry except five named orchestration controls. The source comment explicitly includes MCP tools, and the main startup path also registers MCP and inline plugin tools on the parent. Therefore a worker may inherit externally supplied capabilities that are not named in its role's `allowed_tools` list. The role list is an additive filter for built-ins, not a complete allowlist over the final child registry.
5. **Optional transcript persistence does not merge worker history into the parent session.** The selected repository test expects worker history under a nested `subagents` path without a top-level metadata sidecar, while a regular session still writes its metadata file. This supports separate storage identities, although Scout did not run the test or inspect every resume path.

Primary inspected files:

- [README and architectural claims](https://github.com/mlhher/late-cli/blob/05b836733af91e165052d2048ceb77543d57f39c/README.md)
- [lead tool registration and subagent runner wiring](https://github.com/mlhher/late-cli/blob/05b836733af91e165052d2048ceb77543d57f39c/cmd/late/main.go)
- [fresh child session and parent-tool inheritance](https://github.com/mlhher/late-cli/blob/05b836733af91e165052d2048ceb77543d57f39c/internal/agent/agent.go)
- [coder role tool declaration](https://github.com/mlhher/late-cli/blob/05b836733af91e165052d2048ceb77543d57f39c/internal/assets/subagents/subagent-coder.json)
- [lead role prompt](https://github.com/mlhher/late-cli/blob/05b836733af91e165052d2048ceb77543d57f39c/internal/assets/prompts/instruction-orchestrator.md)
- [worker session persistence test](https://github.com/mlhher/late-cli/blob/05b836733af91e165052d2048ceb77543d57f39c/internal/session/subagent_session_test.go)

## Interpretation

The reusable pattern is **context quarantine with separately verified capability flow**:

- give each worker a fresh trajectory rather than a copy of the lead's accumulated conversation;
- return a bounded result to the lead instead of raw worker scratch history;
- remove mutation tools from the lead in executable registration logic, not only in prompts;
- prevent workers from recursively acquiring orchestration controls; and
- compute and inspect the worker's *effective* tool registry after inheritance, plugins, MCP, and role additions—not merely the role's declared built-in list.

This last point is the non-obvious boundary. A clean context reduces prompt pollution, but it does not by itself enforce least authority. Conversely, a role file that appears to be an allowlist may not be authoritative if runtime composition first copies tools from a parent. Documentation and tests should distinguish three properties: **history isolation** (which messages cross), **result admission** (what evidence returns), and **capability isolation** (which actions the child can actually invoke).

For May-style bounded workers, the directly relevant check is an effective-capability audit at each parent/child boundary. The expected worker surface should be compared with the post-composition registry, including dynamically installed tools, while the returned contribution remains explicit about evidence and limitations. That turns “this helper has a narrow role” from a prompt claim into a verifiable runtime property.

This complements [`the-prompt-mass-problem.md`](../the-prompt-mass-problem.md): reducing what stays in a central trajectory can preserve attention, but prompt economy and authority minimization are different controls and should be measured separately.

## Limitations

This is static repository evidence, not an independent validation of Late's runtime, security, or task quality. Repository-authored prompts and tests show design intent; Scout did not execute them. The inspection does not establish that every dynamic tool reaches the child in every configuration, that confirmation middleware prevents misuse, or that a plugin cannot apply its own restrictions. It also does not verify the README's 200,000-token run, model-quality comparisons, startup time, context-degradation percentages, sandbox safety, or logit-bias benefits. Fresh worker sessions can still lose necessary information in handoff summaries, repeat work, exceed budgets, or receive excessive authority through inherited tools.