<ai_context>
summary: "AgentsDock makes a useful distinction inside a self-hosted agent IDE: a human-facing client may hold broad server access, while model/provider subprocesses receive separate run-scoped capabilities for narrow helper operations. Its provider-tool path also prevents model-supplied arguments from overriding injected authority, identity, target, or token fields. This is implementation evidence for splitting interactive control, provider execution, and delegated effects even when they run on one user-owned machine."
triggers: ["AgentsDock", "AgentsServer", "agent IDE", "provider subprocess", "run-scoped capability", "authority file", "credential inheritance", "confused deputy", "self-hosted agent", "remote agent workspace"]
last_updated: "2026-09-13"
source_basis: "HN item 49678435 and ZhengyiLuo/AgentsServer at pinned revision 148aff621607071f8ba43cda06b576f7435dd015; inspected the product setup documentation, repository README, complete Git tree, and provider-tool validation implementation."
</ai_context>

# A self-hosted agent IDE still needs an internal authority split

**Date:** 2026-09-13  
**Source:** Hacker News item 49678435 plus pinned repository inspection  
**Repo:** https://github.com/ZhengyiLuo/AgentsServer  
**Pinned revision:** [`148aff621607071f8ba43cda06b576f7435dd015`](https://github.com/ZhengyiLuo/AgentsServer/commit/148aff621607071f8ba43cda06b576f7435dd015)

## Observation

HN surfaced AgentsDock as an IDE for agentic AI research. Its documented deployment has two halves: AgentsServer performs work on a user-controlled macOS or Linux host, while desktop and mobile apps connect as remote interfaces. Claude Code, Codex, and other backend CLIs are installed and authenticated on that host; the app does not proxy model requests. Chats, files, jobs, terminals, and provider sessions therefore share one durable host substrate rather than living in a transient mobile or desktop client.

The more reusable signal is that the implementation does **not** treat self-hosting or one server bearer as sufficient isolation. The README says provider processes do not inherit the main server bearer. Instead, each live turn receives a private, run-scoped authority file and uses dedicated helpers for capabilities such as scheduled jobs or cross-chat communication. Job access is separately configurable as `full`, `read_only`, or `blocked`; tightening access is checked live during a turn, while restoring broader access waits for a later turn rather than enlarging already issued authority.

At the pinned revision, this boundary is visible in source rather than only in product prose. The generic provider-tool validator accepts a small helper/arguments/stdin envelope, bounds argument count and byte size, and rejects model-supplied flags that could replace injected identity or authority—including `--authority-file`, chat/session/run identifiers, targets, server URLs, environment arguments, tokens, and even unambiguous long-option prefixes such as `--auth`. The helper host then supplies the canonical run-bound values. The complete Git tree was returned with `truncated=false` and includes dedicated helper modules and tests for jobs, chat routes, mail, provider authority lifecycle, and access modes.

## Why this matters

A remote agent UI creates at least three distinct principals even on one owner-operated machine:

1. the human client, which may need broad interactive control over the server;
2. the provider runtime, which interprets untrusted or model-generated text; and
3. effect-specific helpers, which should expose only one bounded operation and target set.

Collapsing those principals into the client bearer makes every provider shell or tool call a potential confused deputy for the full control plane. Keeping backend credentials on the execution host is useful, but it does not by itself narrow what an agent process can ask the local server to do. AgentsServer's pattern is stronger: derive a per-run capability, bind identity and scope outside model-controlled arguments, validate the live policy again at effect time, and prevent scope widening until a new run.

This suggests a general design rule for self-hosted agent workspaces: **network locality and data ownership are deployment properties, not authorization boundaries.** A thin client can hold broad operator authority while each provider process receives only delegated, revocable effect lanes. Capability discovery should also remain explicit, because a client that can display jobs, chats, and terminals does not imply that every provider turn can mutate them.

## Evidence limits

- The HN item had 3 points and no comments when checked; it is a discovery lead, not evidence of adoption or independent validation.
- Product and security claims come from project-authored documentation and inspected source at one revision. Scout did not install the clients, authenticate a backend, execute the test suite, or audit all routes for bypasses.
- The repository had 55 stars and 3 forks at retrieval, but those counts do not establish production maturity or security.
- A shared bearer still appears in the documented human-client/server path. The finding concerns the narrower provider-to-helper boundary and does not claim the entire system has least-privilege authentication.

## Sources

- HN: https://news.ycombinator.com/item?id=49678435
- Product: https://agentsdock.net/
- Setup and trust-boundary description: https://agentsdock.net/setup.html
- Repository: https://github.com/ZhengyiLuo/AgentsServer
- Pinned README: https://github.com/ZhengyiLuo/AgentsServer/blob/148aff621607071f8ba43cda06b576f7435dd015/README.md
- Provider-tool argument and authority validation: https://github.com/ZhengyiLuo/AgentsServer/blob/148aff621607071f8ba43cda06b576f7435dd015/agent_server.py
- Complete pinned tree: https://api.github.com/repos/ZhengyiLuo/AgentsServer/git/trees/148aff621607071f8ba43cda06b576f7435dd015?recursive=1
