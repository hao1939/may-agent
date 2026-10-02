<ai_context>
This finding separates Cordium’s upstream-credential isolation from the credentials and privileges that implement it. The pinned source keeps application passwords and keys behind an identity-aware proxy, gives each workspace a revocable session, and tests egress policy across restarts; it also places workspace access and refresh tokens in a supervisor-side Unix-socket proxy and runs that supervisor in a privileged root Kubernetes container. Review “secretless” agent sandboxes as a chain of distinct authority boundaries rather than as a credential-free runtime.
</ai_context>

# Secretless workspaces still have identity and privilege boundaries

**Date:** 2026-10-02  
**Source:** GitHub repository search and pinned repository contents  
**Repo:** https://github.com/octelium/cordium  
**Inspected revision:** [`65c8fc7f208e99a39b70635d3ac33ce76aa68481`](https://github.com/octelium/cordium/commit/65c8fc7f208e99a39b70635d3ac33ce76aa68481)  
**Discovery query:** GitHub Repository Search API `"AI agent" sandbox stars:>50`, sorted by updated; `total_count: 105`, `incomplete_results: false`  
**Coverage:** Static inspection of the complete README and pinned 834-entry recursive tree (`truncated: false`), plus selected workspace-controller, supervisor, proxy, Podman, and checked-in end-to-end test files. Scout did not install Cordium, run its tests, deploy Kubernetes or Octelium, or attempt a security bypass.  
**Disposition:** New knowledge — existing library notes discuss credential brokers and sandbox enforcement, but no note declared this repository or examined how its “secretless” boundary is assembled.

## What the source implements

Cordium describes Kubernetes-hosted workspaces for developers and AI agents. Its distinctive claim is narrower than “no credentials”: upstream application credentials—database passwords, SSH keys, API tokens, and similar secrets—remain at an Octelium identity-aware proxy, which can inject them at the protocol layer after policy evaluation. The workspace instead gets an identity represented by an Octelium Session.

The pinned code provides implementation evidence for several pieces of that design:

- The workspace lifecycle test requires a running workspace to have a Session associated with the same user, and verifies that stopping the workspace removes both the Session reference and the Session itself.
- During initialization, the controller retrieves that Session, mints an access token and refresh token, and passes both to the workspace supervisor. The supervisor stores them in an `OcteliumProxy`, refreshes them, and exposes its proxy through a Unix socket mounted into the inner workspace container. Socket permissions are `0600` for the configured workspace user, with a `0666` fallback if ownership cannot be set or the configured UID is zero.
- The inner Podman workload receives the proxy socket and `OCTELIUM_AUTH_PROXY_SOCKET`, not the upstream application credential described in the README. This is the concrete mechanism behind the useful reduction in secret exfiltration surface.
- Checked-in network end-to-end tests cover deny-overrides-allow, protected Kubernetes and metadata addresses surviving an allow-all rule, policy reapplication after restart, and a changed policy taking effect on the next run.

The source also exposes two important scope boundaries. First, “secretless” means **upstream-credential isolation**, not absence of sensitive authority. The supervisor possesses renewable workspace identity tokens, and the workload can invoke the proxy. A compromised agent may be unable to read a database password while still being able to exercise whatever operations current identity policy permits. Second, the README calls each Workspace an isolated, rootless container sandbox, but the inspected Kubernetes pod that hosts the supervisor is configured `Privileged: true`, with writable root filesystem and UID/GID 0. The user workload is then launched as an inner Podman container without Podman’s `--privileged` flag. Thus the rootless or constrained inner workload and the privileged outer supervisor are different trust boundaries; the former does not establish least privilege for the latter.

## Reusable review rule

Evaluate a “secretless sandbox” as an authority chain, not a binary credential property:

1. **Upstream credential custody:** which component can read the real application credential?
2. **Workload identity custody:** which component holds renewable session or bootstrap tokens, and how are they revoked?
3. **Use authority:** what can untrusted code request through the broker even when it cannot extract a secret?
4. **Broker channel:** which principals can open the socket or endpoint, and what happens when ownership or permission setup fails?
5. **Outer-runtime privilege:** what can the supervisor or hosting pod do to the node, network, volumes, and inner workload?
6. **Policy evidence:** do tests exercise real denied and allowed effects, revocation, restart, and policy changes, rather than only configuration construction?

Credential non-disclosure is valuable, but it must not be promoted into proof of least authority or containment. Reviews should record the inner workload boundary and the outer broker/supervisor boundary separately, then test whether an adversarial workload can use, replay, relay, or retain authority beyond the intended task and session.

## Limitations

This inspection did not establish an exploitable path or production weakness. A privileged outer container may be an intentional implementation prerequisite, and the source may apply controls elsewhere that were not traced here. The README’s protocol-layer credential injection and L7 ABAC behavior depend substantially on the separate Octelium implementation; this scan inspected Cordium’s integration points, not the complete pinned dependency closure or a live policy decision. The checked-in end-to-end tests are source evidence that scenarios exist, not proof they passed at this revision. No claims are made about deployment hardening, node isolation, token audience, token replay resistance, Unix-socket peer authentication, audit export, performance, or production reliability.

## Primary sources

- [README and product boundary](https://github.com/octelium/cordium/blob/65c8fc7f208e99a39b70635d3ac33ce76aa68481/README.md)
- [workspace initialization and token minting](https://github.com/octelium/cordium/blob/65c8fc7f208e99a39b70635d3ac33ce76aa68481/cluster/nocturne/nocturne/controllers/workspaces/watcher.go)
- [supervisor-side identity proxy and socket permissions](https://github.com/octelium/cordium/blob/65c8fc7f208e99a39b70635d3ac33ce76aa68481/cluster/supervisor/supervisor/oproxy/oproxy.go)
- [inner Podman workload and proxy-socket mount](https://github.com/octelium/cordium/blob/65c8fc7f208e99a39b70635d3ac33ce76aa68481/cluster/supervisor/supervisor/podman.go)
- [outer Kubernetes pod security context](https://github.com/octelium/cordium/blob/65c8fc7f208e99a39b70635d3ac33ce76aa68481/cluster/nocturne/nocturne/controllers/workspaces/k8s.go)
- [session lifecycle end-to-end test](https://github.com/octelium/cordium/blob/65c8fc7f208e99a39b70635d3ac33ce76aa68481/cluster/e2e/suite/lifecycle.go)
- [network-policy end-to-end scenarios](https://github.com/octelium/cordium/blob/65c8fc7f208e99a39b70635d3ac33ce76aa68481/cluster/e2e/suite/network.go)
