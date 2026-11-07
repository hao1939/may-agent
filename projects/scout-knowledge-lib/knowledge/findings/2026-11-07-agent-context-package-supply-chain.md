<ai_context>
summary: "Pinned review of Microsoft APM: skills, prompts, plugins, and MCP declarations can be managed as a reproducible install-time supply chain, but package integrity and install policy do not govern runtime authority or prove prompt safety."
triggers: ["agent package manager", "APM", "agent context supply chain", "skill lockfile", "prompt package governance", "MCP dependency policy"]
last_updated: "2026-11-07"
source_basis: "HN item 50402824 plus full static inspection of Microsoft APM documentation and source at commit 2920043258932f0f67e6f01df7b9047eb42f358c; software and tests were not run."
</ai_context>

# Agent context needs a package supply chain and a separate runtime boundary

**Date:** 2026-11-07  
**Disposition:** new knowledge  
**Question:** What useful agent-infrastructure signal does the current HN item about APM provide, and what does its package model not establish?  
**HN source:** [item 50402824](https://news.ycombinator.com/item?id=50402824)  
**Source:** https://microsoft.github.io/apm/  
**Repo:** https://github.com/microsoft/apm  
**Reviewed version:** commit [`2920043258932f0f67e6f01df7b9047eb42f358c`](https://github.com/microsoft/apm/commit/2920043258932f0f67e6f01df7b9047eb42f358c) (`pyproject.toml` version `0.35.0`)  
**Coverage:** complete project README; OpenAPM v0.1 goals/non-goals, lockfile, frozen-install, integrity, and policy sections; generated v0.1.1 conformance statement; selected repository structure. The CLI, tests, installation paths, and supported harnesses were not executed.

## Source observation

Microsoft APM treats agent context as a dependency graph rather than a collection of setup instructions. One `apm.yml` can declare instructions, skills, prompts, agents, hooks, plugins, and MCP servers for deployment into several agent harnesses. Its lockfile records resolved sources, exact Git commits or registry archive hashes, tree or content hashes, dependency depth and parentage, and deployed-file paths and hashes.

The normative draft makes several useful boundaries unusually explicit:

- Frozen install checks the manifest against the lockfile before lockfile, target-configuration, deployment, or persistent-cache mutation. In v0.1 this mode is opt-in, although CI should default to it.
- Git dependencies use an exact commit plus a canonical tree SHA-256; registry archives use a resolved SHA-256. This separates source identity from the bytes admitted to the workspace.
- Install policy can allow, deny, require, constrain, or depth-limit dependencies. In blocking mode, violations abort before proposed install bytes are written.
- The generated conformance statement reports assertion coverage for normative requirements, but explicitly says this does not automatically detect all specification-versus-behavior drift. Its prompt audit looks for hidden or suspicious Unicode, not semantic prompt injection.

Most importantly, APM states that `apm-policy.yml` governs what is installed while the agent harness governs what runs. OpenAPM v0.1 specifies what is written to disk and where, not the harness runtime API. Publisher identity, signatures, attestations, version withdrawal, and reproducible registry archives are also deferred or out of scope.

## Interpretation

Prompts and skills are executable in effect, so agent infrastructure benefits from familiar package-supply-chain controls: a declarative manifest, transitive resolution, immutable byte identities, an ownership/deployment inventory, frozen CI, policy before activation, and drift checks. These controls answer **what context was admitted and deployed**.

They do not answer **what authority that context obtained at runtime**. A content hash cannot show that a prompt is benign, an allowed MCP declaration cannot prove that the server or harness mediates effects correctly, and a reproducible deployment cannot establish that the harness actually loaded the intended files. A complete control design therefore needs separate receipts for:

1. package source and resolved bytes;
2. policy and dependency-graph admission;
3. deployed paths and post-deployment drift;
4. harness loading and effective configuration;
5. runtime capability, effect, and revocation boundaries.

That separation is the reusable signal: agent-context packaging is a distinct assurance plane, not a substitute for runtime authorization or outcome verification.

## Limitations

This is a static inspection of a fast-moving project at one commit. Scout did not install APM, execute its tests or conformance suite, reproduce a frozen install or policy denial, inspect every target adapter, verify the website against a release artifact, or test hostile packages. The conformance counts and security behavior are project-authored. The HN submission had no discussion when retrieved, so the useful evidence comes from the linked project rather than community review.
