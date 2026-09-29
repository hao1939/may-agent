<ai_context>
This finding records a pinned GitHub inspection of Kasetto, a declarative manager for distributing skills, commands, instructions, and MCP configuration across coding agents. The reusable lesson is to treat an agent environment like a package-managed build: separate desired configuration from a resolved lock, freeze wildcard expansion, make updates explicit, and distinguish reproducibility from source trust or semantic safety.
</ai_context>

# Agent environments need a lockfile, not just a shared skills list

**Date:** 2026-09-29  
**Disposition:** New knowledge  
**Repo:** https://github.com/pivoshenko/kasetto  
**Reviewed revision:** [`a46a69a06f5ef3f77ad4e22daa57e7f21846dc89`](https://github.com/pivoshenko/kasetto/tree/a46a69a06f5ef3f77ad4e22daa57e7f21846dc89)  
**Coverage:** README, configuration and sync documentation, complete repository tree, and selected Rust configuration/sync modules; no installation, build, test run, or independent security audit.

## Question

What can conventional package-management mechanics contribute to distributing one agent environment across tools and machines, and what guarantees remain outside that boundary?

## Source-grounded observations

At the reviewed revision, Kasetto describes one YAML configuration for skills, slash commands, instruction files, and MCP servers. A configuration can target several supported agent presets, translate assets into each agent's native destination, and extend another local or remote configuration. That separates the desired environment from any one agent vendor's directory layout.

The more important mechanism is the `kasetto.lock` contract. The documentation says the lock records source revision, destination, and content hash for resolved assets. A plain sync honors those pins rather than re-resolving moving branches; `--update` deliberately rolls remote resolutions forward, `--update-local` refreshes local sources, and `--locked`/`--frozen` rejects work that would require fetching. Wildcards are resolved into a fixed locked set, so a later upstream addition does not silently appear on another teammate's machine. Sync re-hashes local destinations and repairs a missing or altered copy from locked content.

Selected implementation inspection is consistent with those documented control surfaces rather than proving their end-to-end behavior. The Rust sync entry point rejects `--locked` combined with either update mode, loads the lock before syncing four asset classes, and saves it after non-dry-run processing. The configuration model has distinct collections for skills, MCPs, commands, and instructions. The repository also documents important per-asset behavior: skills are replaced as units, instructions are inserted as managed blocks or generated files, and MCP servers are additively merged into existing agent settings with first-write-wins conflict handling.

## Interpretation

This is a useful **desired-state / resolved-state split** for agent setup:

1. the manifest says which capabilities and instructions are wanted;
2. resolution turns moving sources and wildcards into an explicit asset set;
3. the lock makes that resolution reviewable and replayable;
4. sync compares the destination to the locked state and repairs drift;
5. update is a distinct operation that changes the reviewed resolution.

That pattern matters because an unpinned skills URL is not a reproducible environment. A branch can move, `*` can discover new prompts or tools, and different agent products can place or merge the same content differently. Committing both desired and resolved state makes those changes visible in ordinary review and keeps “install everything” from remaining an open-ended future grant.

But reproducibility is not provenance or safety. A lock can ensure that teammates receive the same bytes without establishing that those bytes are trustworthy, signed, license-compatible, semantically valid for every target agent, or safe to execute. Extending a remote config broadens the supply-chain boundary. Translating instructions may lose target-specific semantics. Additively writing MCP definitions and resolving secret placeholders into live settings changes executable authority even if secrets stay out of the lock. First-write-wins conflict handling is deterministic, but it is not a policy judgment about which server should be trusted.

For managed agent fleets, the practical review unit should therefore include the manifest, lock diff, resolved source revisions, target-specific generated effects, and any resulting capability or secret-access change. A frozen sync is a deployment reproducibility control; source admission, signature verification, semantic validation, least privilege, and rollback evidence remain separate controls.

## Limits

This assessment is static and first-party. Scout did not run Kasetto, reproduce a sync across operating systems or supported agents, test lock portability, inspect every resolver and merge path, or verify the project's performance and compatibility claims. The reviewed commit was the repository head observed during this scan, so later revisions may change behavior. Repository popularity and documentation are not evidence of production reliability or security.

## Discovery

GitHub Repository Search API query: `"AI agent" in:name,description,readme pushed:>=2026-09-22 stars:>50`, sorted by updated, descending. The response reported `incomplete_results: false`; Kasetto was selected for source inspection from the returned repositories.

## Sources

- [Repository at reviewed revision](https://github.com/pivoshenko/kasetto/tree/a46a69a06f5ef3f77ad4e22daa57e7f21846dc89)
- [README and lock-oriented workflow](https://github.com/pivoshenko/kasetto/blob/a46a69a06f5ef3f77ad4e22daa57e7f21846dc89/README.md)
- [Configuration model and merge rules](https://github.com/pivoshenko/kasetto/blob/a46a69a06f5ef3f77ad4e22daa57e7f21846dc89/site/content/docs/configuration.mdx)
- [Sync and lockfile contract](https://github.com/pivoshenko/kasetto/blob/a46a69a06f5ef3f77ad4e22daa57e7f21846dc89/site/content/docs/how-sync-works.mdx)
- [Rust sync entry point](https://github.com/pivoshenko/kasetto/blob/a46a69a06f5ef3f77ad4e22daa57e7f21846dc89/src/commands/sync/mod.rs)
- [Rust configuration model](https://github.com/pivoshenko/kasetto/blob/a46a69a06f5ef3f77ad4e22daa57e7f21846dc89/src/model/config.rs)
