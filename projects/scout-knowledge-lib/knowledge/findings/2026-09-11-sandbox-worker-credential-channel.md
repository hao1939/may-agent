<ai_context>
summary: "Landstrip's Pi integration separates sandbox execution from credential possession: workers inherit neither parent API keys nor arbitrary environment variables, request freshly resolved provider auth over a private pipe, and may use it only for the model and endpoint pinned by the parent. A later TET 0.4.0 Reddit announcement provides a weaker ecosystem signal: sandbox products increasingly expose mount, egress, instruction, and access-mode controls, but 'authentication stays inside the sandbox' is only a location claim unless credential custody has its own authority policy. Evidence strength is kept explicit: Landstrip is pinned source and repository-test inspection; TET is a self-authored release post, not implementation verification."
triggers: ["sandbox credentials", "worker authentication", "credential delegation", "ambient authority", "private auth channel", "endpoint pinning", "subagent secrets", "credential custody", "Landstrip", "TET"]
last_updated: "2026-09-12"
source_basis: "GitHub repository discovery and pinned source inspection of landstrip/landstrip at commit 4388f5b9eb0d964d20c91dc795a4f33ac05b89ab, plus a Reddit release announcement for TET 0.4.0 used only as an ecosystem and control-surface signal."
</ai_context>

# Sandboxed Workers Should Receive Request Authority, Not Ambient Credentials

**Date:** 2026-09-11  
**Repo:** https://github.com/landstrip/landstrip  
**Inspected revision:** [`4388f5b9eb0d964d20c91dc795a4f33ac05b89ab`](https://github.com/landstrip/landstrip/tree/4388f5b9eb0d964d20c91dc795a4f33ac05b89ab)

## Signal

Landstrip supplies OS-level sandboxing and agent integrations across Linux,
macOS, and Windows. Its Pi extension exposes a boundary that filesystem and
network policy alone do not solve: an isolated subagent still needs model
credentials, but copying the parent's environment would give it unrelated keys,
proxy settings, and provider state.

The pinned
[`pi-landstrip` documentation](https://github.com/landstrip/landstrip/blob/4388f5b9eb0d964d20c91dc795a4f33ac05b89ab/packages/pi-landstrip/README.md#worker-environment-and-authentication)
says workers inherit selected runtime, locale, certificate, and Pi configuration
only—not parent API keys, tool tokens, proxy URLs, or arbitrary environment
variables. For model calls, the parent resolves the selected provider's current
authentication and sends it through a private Unix pipe rather than command-line
arguments or the worker environment.

The implementation adds three constraints:

1. [`worker-auth.ts`](https://github.com/landstrip/landstrip/blob/4388f5b9eb0d964d20c91dc795a4f33ac05b89ab/packages/pi-landstrip/worker-auth.ts)
   clones the already selected model before asynchronous auth work. Each request
   resolves authentication afresh in the parent, preserving the parent's refresh
   behavior, and rejects the result if its effective endpoint host is not in the
   worker's original domain grant.
2. [`worker-auth-channel.ts`](https://github.com/landstrip/landstrip/blob/4388f5b9eb0d964d20c91dc795a4f33ac05b89ab/packages/pi-landstrip/worker-auth-channel.ts)
   puts this resolver behind a dedicated inherited file descriptor, not the
   worker's ordinary RPC stdin/stdout. The worker can ask only for `auth`; it
   cannot choose another provider. Frames, pending requests, and wait time are
   bounded, malformed protocol input closes the channel, and exception details
   do not cross it.
3. [`worker-auth-runtime.ts`](https://github.com/landstrip/landstrip/blob/4388f5b9eb0d964d20c91dc795a4f33ac05b89ab/packages/pi-landstrip/worker-auth-runtime.ts)
   injects the parent-owned resolver into the selected provider at request time.
   Resolved secrets are excluded from model/provider metadata because that
   metadata is visible over RPC.

This does not make the worker credential-free: the credential necessarily
exists in worker memory while a request is made. It does reduce **ambient and
persistent possession**. The subagent does not start with the parent's whole
environment, cannot select arbitrary provider auth through this channel, and
cannot silently follow a changed endpoint outside its initial network grant.

## Repository test contract

The pinned
[`worker-auth-startup.test.ts`](https://github.com/landstrip/landstrip/blob/4388f5b9eb0d964d20c91dc795a4f33ac05b89ab/packages/pi-landstrip/worker-auth-startup.test.ts)
starts a packaged worker against a local model endpoint, serves a sentinel API
key through the auth pipe, and expects repeated parent auth resolution plus the
sentinel bearer header on the model request. The
[`worker-endpoints.test.ts`](https://github.com/landstrip/landstrip/blob/4388f5b9eb0d964d20c91dc795a4f33ac05b89ab/packages/pi-landstrip/worker-endpoints.test.ts)
exercises the effective endpoint in the real worker network grant and includes
an explicit-denial case. These are checked-in test contracts; Scout inspected
but did not run them.

## Design implication

Treat model access as a supervised capability, not a startup secret bundle. A
minimum pattern for sandboxed subagents is:

- construct a small allowlist of inherited environment and filesystem state;
- pin model/provider identity before credential lookup;
- resolve or refresh credentials in a trusted parent for each use;
- carry them over a private, bounded, non-log transport;
- bind effective endpoint changes to the worker's original network grant; and
- keep auth-bearing fields out of observable model, task, and RPC metadata.

This separates two controls that are often conflated. The sandbox constrains
where a process can act; the credential channel constrains which authority it
possesses while acting. A strong sandbox with ambient parent credentials still
leaves every readable key available for misuse or exfiltration through an
allowed endpoint.

## Reddit ecosystem signal — make credential custody a separate control

A [TET 0.4.0 release announcement on
Reddit](https://www.reddit.com/r/aipromptprogramming/comments/1wdven7/tet_040/)
([stable post ID `t3_1wdven7`](https://www.reddit.com/r/aipromptprogramming/comments/1wdven7/tet_040/))
describes a per-project Docker sandbox UI for four coding-agent CLIs. The post
says operators can separately choose extra file mounts, allowed ports and hosts,
whether skills/plugins/instruction files are mounted, and whether each mounted
resource is read-only or read/write. It also says agent authentication remains
inside the sandbox.

This self-authored release post is not implementation verification, and Scout
did not inspect TET's repository in this Reddit-only run. It is useful as an
ecosystem signal because the advertised controls expose filesystem, network,
and instruction surfaces independently, while authentication is described only
by location. **Credential location is not an authority policy**: keeping auth
inside a container may prevent host exposure while still giving the agent an
ambient, reusable secret. Sandbox products should therefore expose credential
custody as its own control surface: which provider identity is available, whether
the worker possesses or requests the secret, which destination may receive it,
how long it remains valid, and what evidence records each use.

This strengthens rather than replaces the Landstrip implementation lesson.
Mount, egress, and credential policies should be independently configurable and
jointly tested; "inside the sandbox" answers where a secret lives, not what the
worker is authorized to do with it.

## Limits

This is implementation evidence at one public commit, not a security audit or a
claim that Landstrip is escape-proof. The project documents platform differences:
private worker authentication and non-empty `denyReadAlways` are unsupported on
Windows, runtime seccomp query approval is Linux-only, and primary Pi file tools
are not automatically OS-isolated. Scout did not execute the repository tests,
inspect a release binary, or validate credential lifetime in process memory.

## Discovery record

GitHub Search API query:
`agent sandbox in:name,description stars:>20 pushed:>=2026-08-01`, sorted by
`updated` descending, 30 results per page. The response reported
`incomplete_results: false`. Repository metadata was used only for discovery;
all implementation claims above are tied to the pinned revision.
