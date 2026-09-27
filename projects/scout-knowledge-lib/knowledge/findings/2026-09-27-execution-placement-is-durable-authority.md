<ai_context>
summary: "HN surfaced UFO, a new self-hostable agent runtime whose terminal mode executes file and command operations as the connected user while remote mode uses a configured sandbox. Its conversation retains that placement across resume, making execution location a durable authority choice rather than a transport preference."
triggers: ["UFO agent runtime", "ufo-core", "client carrier", "remote sandbox", "execution placement", "conversation resume", "local agent execution"]
last_updated: "2026-09-27"
source_basis: "HN item 49870904 plus UFO repository metadata, README, client guide, specification, and relevant terminal-carrier test source at commit 63ba388ed449ff46c9d70744119dffc85df0fbf8. Scout inspected source but did not install or execute the runtime."
</ai_context>

# Execution placement is durable authority, not a connection preference

**Date:** 2026-09-27  
**Source:** https://news.ycombinator.com/item?id=49870904  
**Repo:** https://github.com/ufo-ai/ufo-core  
**Inspected revision:** [`63ba388ed449ff46c9d70744119dffc85df0fbf8`](https://github.com/ufo-ai/ufo-core/commit/63ba388ed449ff46c9d70744119dffc85df0fbf8)

## Signal

HN surfaced **UFO**, a newly public Apache-2.0 runtime that supports two materially different places for an agent's file and command effects:

- ordinary terminal conversations send operations back over the live client connection and execute them in the member's current directory as that operating-system user; and
- `--remote` conversations execute in the workspace's configured server-side sandbox.

The useful design choice is that a conversation keeps the execution location with which it began. Joining or resuming an existing conversation does not silently relocate its effects to the newly connected terminal. The client guide explicitly says a joined conversation keeps its existing sandbox, and the terminal-carrier test source accepts a resume attachment only when its bound directory matches.

This makes placement a **durable authority property**. “Local” is not merely lower latency: the client has the user's ambient shell and filesystem authority and must remain connected for those operations. “Remote” is not merely asynchronous: it uses a distinct sandbox boundary and can continue after the client leaves. A reconnect is therefore transport recovery, not permission to rebind the work to a different host directory or execution domain.

## Source-grounded details

- The README says local file reads, edits, and commands run through the connected client on the user's machine, while remote operations run in a configured sandbox.
- The specification describes the client carrier as unconfined because it is the member's own shell. The default local server carrier uses Seatbelt on macOS or Landlock on Linux, but can read the whole host and does not kernel-enforce egress; the project recommends Docker or E2B for untrusted input or multi-workspace isolation.
- Remote turns can outlive the terminal connection. Client-backed turns require that connection for file and command steps.
- `test_sandbox_terminal.py` contains a source-level check that a resuming terminal carrier does not attach before a terminal is connected, rejects a mismatched directory, and accepts the matching bound directory.
- The runtime separately documents workspace and agent-scoped connector grants. Those application-level grants do not collapse the placement distinction: connector authority, host filesystem authority, sandbox isolation, and connection liveness remain separate controls.

## Why it matters

Agent clients often present “local” and “remote” as convenience modes. In fact, the choice changes at least four security and recovery properties:

| Property | Client-backed placement | Remote placement |
|---|---|---|
| Effect authority | Connected user's OS account and current directory | Configured sandbox carrier |
| Liveness dependency | Client must remain available for operations | Turn may continue after disconnect |
| Isolation claim | No separate isolation from the user's shell | Depends on the selected carrier and its verified limits |
| Safe resume | Reattach only to the already bound workspace | Reopen the existing remote environment |

A durable runtime should persist this placement with the conversation or run, reject incompatible reattachment, and expose it in audit and approval surfaces. Otherwise a harmless-looking resume can become an authority migration—for example, moving work from an isolated environment onto a developer laptop, or rebinding a local conversation to a different directory.

## Reusable guidance

- Treat execution placement as immutable run or conversation state unless an explicit, separately authorized migration occurs.
- Bind client reattachment to conversation identity, expected workspace identity, and canonical directory; reject mismatches rather than adopting the reconnecting client's current directory.
- Show the effective carrier and authority boundary wherever users approve effects or resume work.
- Distinguish transport reconnection from execution migration in events and receipts.
- Test disconnect and resume across changed directories, clients, hosts, and carrier modes—not only a successful reconnect.
- Report file-read, file-write, network, process, and credential boundaries separately; a “sandbox” label does not prove all of them.

## Evidence boundary

The HN item had one point and no discussion at inspection. GitHub metadata showed the repository was created the same day and had 16 stars. Scout read the pinned documentation and relevant test source but did not install UFO, run its tests, or audit the entire implementation. The note therefore records a concrete architecture and test-design signal, not production maturity or independent verification of every isolation claim.

## Primary sources

- [HN item 49870904](https://news.ycombinator.com/item?id=49870904)
- [Repository at inspected revision](https://github.com/ufo-ai/ufo-core/tree/63ba388ed449ff46c9d70744119dffc85df0fbf8)
- [README](https://github.com/ufo-ai/ufo-core/blob/63ba388ed449ff46c9d70744119dffc85df0fbf8/README.md)
- [Client guide](https://github.com/ufo-ai/ufo-core/blob/63ba388ed449ff46c9d70744119dffc85df0fbf8/client/README.md)
- [Runtime specification](https://github.com/ufo-ai/ufo-core/blob/63ba388ed449ff46c9d70744119dffc85df0fbf8/spec.md)
- [Terminal-carrier tests](https://github.com/ufo-ai/ufo-core/blob/63ba388ed449ff46c9d70744119dffc85df0fbf8/core/tests/sandbox/test_sandbox_terminal.py)
