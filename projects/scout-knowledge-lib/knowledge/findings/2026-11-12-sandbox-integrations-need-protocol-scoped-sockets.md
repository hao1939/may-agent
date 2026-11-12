<ai_context>
summary: "Agent Safehouse's current Herdr integration shows that enabling a local service in a deny-first agent sandbox should grant the protocol socket, not every socket in the service directory. Its pinned profile allows the default API socket plus named-session API sockets matching one anchored path shape, while explicitly withholding similarly located TUI-attach sockets; policy and execution tests cover default denial, enabled access, named sessions, and the negative client-socket case. The profile also grants recursive read access to Herdr's config directory, so socket scoping does not by itself establish least-privilege data access or message-level authorization."
triggers: ["Agent Safehouse", "Herdr", "Unix socket sandbox", "protocol-scoped socket", "sandbox integration", "local IPC authority", "negative authorization test"]
last_updated: "2026-11-12"
source_basis: "GitHub repository Search API discovery and static inspection of eugene1g/agent-safehouse at revision a802fe06af9b95c5c8f5f4730dafc57fdd99d322: README, Herdr policy profile, Herdr policy/execution tests, isolation-model documentation, repository metadata, and current commit message."
</ai_context>

# Sandbox Integrations Need Protocol-Scoped Sockets

**Date:** 2026-11-12  
**Repo:** https://github.com/eugene1g/agent-safehouse  
**Reviewed revision:** https://github.com/eugene1g/agent-safehouse/commit/a802fe06af9b95c5c8f5f4730dafc57fdd99d322

## Question

When a deny-first coding-agent sandbox enables a local developer service, what
should the integration grant: a directory, a service, or the exact protocol
endpoint the agent needs?

## Source signal

Agent Safehouse is a macOS `sandbox-exec` hardening layer for local coding
agents. Its README positions the project as practical blast-radius reduction,
not a VM or a perfect boundary against a determined attacker. The inspected
revision fixes its optional Herdr integration so agents can reach both the
default Herdr API socket and API sockets for named sessions.

The implementation makes a useful distinction within one service's local IPC
surface:

- the default agent API endpoint is
  `~/.config/herdr/herdr.sock`;
- named-session API endpoints are admitted only when they match the anchored
  shape `~/.config/herdr/sessions/<one-segment>/herdr.sock`;
- top-level and per-session `herdr-client.sock` endpoints, used for TUI attach,
  remain denied;
- the named-session rule does not grant the session directory as a generic
  Unix-socket subtree.

This is more precise than treating “Herdr access” as one Boolean capability.
The profile grants the interaction needed for status, snapshot, and bell-style
agent commands while withholding a neighboring protocol surface that the agent
does not need.

## The tests make the negative boundary explicit

The pinned test file checks both rendered policy and process-level behavior:

1. the optional profile is absent by default and enabled explicitly or through
   a host-side `HERDR_ENV` signal;
2. connecting to the default and named-session API sockets fails by default and
   succeeds after the integration is enabled;
3. the rendered named-session rule contains the exact API-socket regex rather
   than a broad session-directory subpath grant;
4. both top-level and named-session TUI-attach sockets remain unreachable even
   when Herdr integration is enabled;
5. when a real Herdr binary is available, the test starts default and named
   headless servers and exercises their snapshot API through Safehouse.

That last group remains producer-authored test evidence. Scout inspected the
committed source but did not run Safehouse, Bats, macOS Seatbelt, Herdr, or the
CI workflow. Passing repository tests would establish behavior in tested
configurations, not general resistance to sandbox escape or flaws in either
service protocol.

## Reusable implication

Local IPC endpoints are capabilities, even when they share one application
name and directory. A sandbox integration should inventory them by **protocol
and effect**, then grant only the endpoint shape needed by the agent:

| Endpoint class | Needed agent effect | Admission decision |
|---|---|---|
| Agent/status API socket | Send the intended bounded service commands | Allow exact path or anchored path shape |
| TUI/admin/attach socket | Join or control an operator-facing session | Deny unless independently required |
| Future or unknown sockets | Unreviewed service surface | Remain denied by default |

Tests should include three receipts: expected access succeeds, the same access
fails without the integration, and a nearby but more privileged endpoint still
fails after enablement. Positive-only integration tests can prove usability
while missing authority widening.

Directory naming is not a sufficient security type. A recursive socket grant to
`~/.config/herdr` or `sessions/*` would let later service versions silently add
reachable protocols. Anchoring the path to one basename and one session segment
keeps that expansion visible as a policy change.

## Important remaining boundary

The same Herdr profile grants `file-read*` over the entire
`~/.config/herdr` subtree. The source comment describes this as configuration
containing socket and state files, but static inspection did not establish that
every present or future file there is safe for an agent to read. Therefore the
socket rule is a strong example of endpoint scoping, not proof that the complete
integration is minimum-authority.

Nor does filesystem/socket admission provide message-level authorization. Once
a process can connect to an allowed API socket, the service must still validate
which operations, session objects, and data that client may use. Safehouse's
own documentation also states that it shares the host kernel and should be
layered with stronger isolation for adversarial workloads.

## Evidence boundary and disposition

**Coverage:** current GitHub repository Search API discovery; complete README;
repository metadata and latest commit message; complete pinned Herdr profile and
Herdr test file; pinned isolation-model documentation. Three repository searches
used for this run returned `incomplete_results=false`. Scout did not execute the
software or tests, inspect Herdr's server implementation, enumerate actual
runtime files, validate message-level authorization, or test a sandbox escape.

**Disposition:** new source-grounded finding. Existing Scout sandbox notes cover
single mediated command planes and broader authority containment, but the
inspected source adds a concrete, tested pattern for separating two neighboring
Unix-socket protocols belonging to the same local service.

**Primary evidence:**

- [README](https://github.com/eugene1g/agent-safehouse/blob/a802fe06af9b95c5c8f5f4730dafc57fdd99d322/README.md)
- [Herdr policy profile](https://github.com/eugene1g/agent-safehouse/blob/a802fe06af9b95c5c8f5f4730dafc57fdd99d322/profiles/55-integrations-optional/herdr.sb)
- [Herdr policy and execution tests](https://github.com/eugene1g/agent-safehouse/blob/a802fe06af9b95c5c8f5f4730dafc57fdd99d322/tests/policy/integrations/herdr.bats)
- [Isolation model](https://github.com/eugene1g/agent-safehouse/blob/a802fe06af9b95c5c8f5f4730dafc57fdd99d322/docs/docs/isolation-models.md)
