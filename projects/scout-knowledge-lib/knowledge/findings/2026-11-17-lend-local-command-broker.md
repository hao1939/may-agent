---
title: "Lend keeps credentials local, but approval must cover the executable's full effect"
source: hn
source_id: "50526152"
date: 2026-11-17
last_updated: 2026-11-17
type: finding
tags: [hacker-news, ai-agents, credentials, authorization, human-approval, ssh, mcp, audit]
relevance: high
---

<ai_context>
HN surfaced Lend, an early open-source broker that lets agents on remote VMs request selected commands and SSH signatures from a credential-holding laptop. Its useful design signal is the remote-to-local authority split: withholding credentials is meaningful, but an approved executable, its inputs, returned output, and the untrusted caller still define the real effect boundary. Scout inspected project-authored material and repository metadata but did not run or security-test the software.
</ai_context>

# Lend keeps credentials local, but approval must cover the executable's full effect

## Source and coverage

- **HN:** [item 50526152](https://news.ycombinator.com/item?id=50526152)
- **Article:** [Running coding agents without handing them my credentials](https://blog.antonio.cx/running-agents-with-lend)
- **Repository:** [antoniomika/lend](https://github.com/antoniomika/lend)
- **Inspected revision:** [`773e0f06adae6fc1abe1cd05605ac8b65d7b80af`](https://github.com/antoniomika/lend/tree/773e0f06adae6fc1abe1cd05605ac8b65d7b80af)
- **Observation date:** 2026-11-17
- **Read:** the complete project-author article, HN item and its two comments, repository metadata, and the README's architecture, command-policy, SSH-key-policy, and limitations material.
- **Not run:** Lend, its tests, SSH forwarding, MCP integration, biometric prompts, secret injection, leases, history, reconnect behavior, or adversarial bypass tests. Scout did not compare released binaries with the inspected revision.
- **Disposition:** new source-grounded finding. Existing Scout notes separate credential custody from request authority and egress; Lend adds a concrete remote-agent/local-command pattern and unusually explicit warnings about executable semantics, stdin, and untrusted caller descriptions.

## What the project claims

Lend wraps a laptop's existing SSH agent and forwards the wrapper socket, rather than the original socket, to a remote VM. A remote coding agent can ask for an SSH signature or request that an allowed command such as `gh` run on the laptop. Local policy selects absolute executables, optional argument prefixes, permitted SSH-key fingerprints and signing purposes, approval modes, signature caps, and optional short leases. The real credential stays on the laptop; command stdout, stderr, and exit status return to the remote caller.

The article also describes optional secret injection: Lend can obtain a value locally from a configured reader such as `op read`, place it in the approved command's environment, and avoid copying the value to the VM. It can expose one MCP tool for local command requests and can route coding-harness permission questions to the laptop, but the caller-supplied reason and identity details are displayed as unverified.

## Reusable design signal: approve effects, not just credential use

The architecture reduces secret disclosure without making the remote workload trusted. Reviews should preserve at least five separate facts:

1. **Credential custody:** which local component holds the upstream key or token, and whether the remote process can read it.
2. **Request admission:** which exact executable, arguments, key, signing purpose, and policy revision admitted the request.
3. **Executable semantics:** what other inputs can alter the approved program's behavior, including stdin, configuration files, plugins, environment, and referenced files.
4. **Returned authority:** what output or data the remote agent receives after the local command uses the credential.
5. **Caller trust:** whether displayed identity, reason, working directory, and context are independently authenticated or merely remote assertions.

Lend's own documentation makes the third boundary concrete. Argument prefixes narrow requests but do not constrain an executable's full capability. Approving a shell, interpreter, `env`, a secret reader, or a program that accepts instructions through stdin may disclose the secret or permit arbitrary local behavior even though the credential itself never crossed the socket. An approved command runs as the local user and is not sandboxed.

The implication is broader than this tool: a credential broker's approval object should bind the complete interpretable effect surface, not only a binary name and friendly reason. Where that surface cannot be bounded, run the command inside a separate local sandbox, use a narrower purpose-built operation, redact the response, or treat approval as equivalent to granting broad local execution.

## Operational boundaries

- Anyone able to reach the forwarded socket, including root on the VM, can submit requests while the session is connected. Policy and per-request approval still apply, but remote caller details can be forged.
- Command output is intentionally returned to the agent. Credential non-disclosure therefore does not establish response minimization or onward-egress control.
- Leases match an approved command and arguments and are session-scoped, but the inspected documentation says they are local in-memory conveniences, not durable delegated identities.
- History omits arguments, output, and secrets by default. That reduces sensitive logging but also means the default record cannot independently reconstruct the full approved effect.
- The local SSH connection must remain open; reconnecting creates a new session and fresh approvals or leases. The article's stable-symlink procedure repairs socket-path continuity but not requests during disconnection.
- macOS provides the documented biometric path; Linux uses a dialog or terminal prompt, and interactive programs are unsupported because local execution does not allocate a PTY.

## Limitations

This is an architecture assessment of a new, zero-star repository and its author's complete explanatory article, not an independent security evaluation. HN supplied discovery and two early practitioner comments, not corroboration. The implementation, policy parser, approval binding, signature validation, secret handling, logging, package provenance, and failure behavior were not executed or audited. The inspected revision may change quickly.

## Related notes

- [Agent IAP — Credential Non-Disclosure Is Not Data-Egress Control](./2026-09-24-agent-credential-proxy-is-not-data-egress-control.md)
- [Secretless workspaces still have identity and privilege boundaries](./2026-10-02-cordium-secretless-workspace-authority.md)
