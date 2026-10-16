<ai_context>
summary: "Heldkeys inventories credentials and credential-adjacent authority visible from an agent's actual process context, but the result is a point-in-time exposure map—not access proof, enforcement, or a guarantee that every usable credential was found."
triggers: ["Heldkeys", "agent credential inventory", "credential exposure", "secret reachability", "AI agent CI security", "credential preflight"]
last_updated: "2026-10-16"
source_basis: "HN item 50118028 and hugomn/heldkeys documentation and repository tree at commit 3024afeebac243ad6a5caa4b0f7b6cdf4eaf4b10 inspected 2026-10-16; software and tests were not run."
</ai_context>

# Credential inventory should run from the agent's authority context

**Date:** 2026-10-16  
**Disposition:** New implementation-evidence finding  
**Coverage:** HN item, repository README sections, complete threat-model document, dependency manifest, and repository tree at one pinned commit; implementation and tests not run

## Observation

[HN item 50118028](https://news.ycombinator.com/item?id=50118028) links to
[Heldkeys](https://github.com/hugomn/heldkeys), a read-only Rust utility framed
around a concrete question: if prompt injection hijacked the agent running in
this environment, which credentials could that process use? The item had one
point and no comments when inspected, so HN supplies discovery rather than
community validation.

At repository commit
[`3024afeebac243ad6a5caa4b0f7b6cdf4eaf4b10`](https://github.com/hugomn/heldkeys/commit/3024afeebac243ad6a5caa4b0f7b6cdf4eaf4b10),
the documented scan covers environment variables, cloud and developer CLI
logins, package and Git credentials, SSH keys and agents, project `.env` files,
MCP configurations, Docker sockets, Kubernetes service-account tokens, cloud
metadata reachability, and several AI-tool login stores. Its CI mode separately
inventories job credentials and statically checks agent workflows for
untrusted triggers, pull-request-head checkout, broad permissions, extra
secrets, unpinned actions, and unrestricted shell access. The repository tree
contains dedicated check modules and project-authored integration fixtures for
these categories.

The useful design choice is **vantage-point fidelity**. A credential scanner run
against a repository answers what was committed. Heldkeys instead asks what the
agent process can observe in its inherited environment, home directory,
working tree, runtime mounts, sockets, and CI job. The README's recommended
preflight gate can fail on long-lived write-capable findings, while `--strict`
turns unreadable or unparseable inputs into failure rather than silently
reporting a clean scan. The threat model also treats scanned repositories,
configuration values, container responses, and workflow text as hostile input;
it documents output redaction, control-character sanitization, confined project
reads, parser budgets, command timeouts, and non-execution of credential-helper
or kubeconfig commands.

That exposure map is not an authority proof. The project states that it cannot
inspect OS keychains, browser sessions, unlocked password managers, or every IDE
token; usually does not know what a token can do; does not inspect Git history;
and trusts executables resolved through `PATH`. Home-level symlinks may point
outside the home, and the default metadata check makes a visible TCP connection.
Most importantly, Heldkeys does not block access. Its report is a snapshot made
by a binary and environment that must themselves be trusted, and files or
credentials may change immediately afterward.

## Reusable implication

Credential governance for agents should separate four questions:

1. **Discovery:** what credential material, helper, socket, mount, or minting
   path is visible from the agent's actual execution context?
2. **Authority:** what operations can each discovered mechanism perform now,
   for which resources, and for how long?
3. **Enforcement:** which boundary prevents the agent from using authority that
   the task does not require?
4. **Freshness and coverage:** when was the inventory taken, what surfaces were
   unreadable or unsupported, and can the environment drift before execution?

An inventory tool is valuable before an agent starts and inside the exact CI job
or sandbox it will use. Its output should drive credential removal, narrower
scopes, short-lived issuance, and separate effect-owning jobs—not become a
badge that the runtime is safe. A clean result means no covered finding was
reported under that version and configuration; it does not prove absence of
usable authority.

This complements [Agent Security: Defense
Architectures](../agent-security-defense-architectures.md): exposure discovery
is a prerequisite to enforcement, while a gateway such as the separately
reviewed [DAM credential boundary](./2026-10-16-dam-credential-gateway-boundary.md)
addresses a different question—whether secret use and destinations are actually
mediated.

## Evidence boundary

Scout statically inspected the pinned README through its local and CI model, the
complete `docs/threat-model.md`, `Cargo.toml`, and the recursive repository tree.
Scout did not install or run Heldkeys, execute its project-authored tests, scan a
real machine or CI job, inspect every check implementation, validate redaction
against real secrets, assess detection accuracy or false positives, review
binary-release provenance, or establish operational adoption. All behavioral
claims here are therefore bounded to project documentation and source layout,
not independent runtime verification.

## Sources

- **HN:** https://news.ycombinator.com/item?id=50118028
- **Repo:** https://github.com/hugomn/heldkeys
- **Pinned revision:** https://github.com/hugomn/heldkeys/commit/3024afeebac243ad6a5caa4b0f7b6cdf4eaf4b10
