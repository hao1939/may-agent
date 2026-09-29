<ai_context>
summary: "A pinned inspection of Agentcap shows a useful host-observability pattern for coding agents: attribute descendant process activity at the kernel boundary, export explicit probe-health and dropped-event signals, and keep observation separate from enforcement. Its process-name attribution, DNS visibility, path telemetry, deployment dependency, and lack of runtime validation in this review sharply limit what the dashboard can prove."
triggers: ["Agentcap", "eBPF agent monitoring", "coding agent observability", "process-tree attribution", "kernel telemetry", "agent activity audit"]
last_updated: "2026-09-29"
source_basis: "HN item 49898915 plus static inspection of yeet-src/agentcap at pinned revision 71cb2a22dd1ccbc184150ec314a3bc366b9becc4: README, complete repository tree, eBPF probe, collector, service definition, package metadata, and CI workflows. Scout did not install yeet, authenticate a host, build or load the probe, run the exporter, or validate the dashboard against live agent activity."
</ai_context>

# Kernel telemetry can observe agent effects without agent cooperation

**Date:** 2026-09-29  
**Disposition:** New knowledge  
**Source:** https://news.ycombinator.com/item?id=49898915  
**Repo:** https://github.com/yeet-src/agentcap  
**Inspected revision:** [`71cb2a22dd1ccbc184150ec314a3bc366b9becc4`](https://github.com/yeet-src/agentcap/commit/71cb2a22dd1ccbc184150ec314a3bc366b9becc4)

## Question

What can host-level eBPF telemetry establish about coding-agent activity, and what remains unproved?

## Source-grounded observations

Agentcap is a young Linux Prometheus exporter that observes selected process trees from the kernel rather than requiring instrumentation inside each agent. At the inspected revision:

- A userspace list of process `comm` prefixes is loaded into a BPF LPM trie. A matching root and descendants it forks inherit one agent label, so tools such as `bash` or `curl` can be counted under the launcher.
- Tracepoints capture lifecycle activity; BPF LSM hooks observe socket connects, socket sends, and regular-file opens; fexit programs count completed receive, read, and write bytes. High-rate totals stay in kernel maps while lifecycle, port, DNS, and file events use ring buffers.
- The exporter exposes process count and churn, tool executions, CPU, network and file-I/O bytes, destination ports, selected DNS lookups, and opened file paths. It also exposes `agentcap_probe_up`, worker health, and dropped-event counts, which are necessary to distinguish quiet activity from a failed or lossy sensor.
- User-space cardinality guards retain at most 50 command labels, 200 domains, 50 ports, and 300 file paths per agent, folding later values into `other`. Common read-only system paths are suppressed while writes are retained.
- CI definitions build the BPF object, check JavaScript and deployment configuration, regenerate the dashboard, and define verifier jobs for Linux 6.1, 6.6, 6.12, and `bpf-next`.

The reusable pattern is **out-of-process witnessing with explicit sensor health**. An agent does not need to report its own child commands or resource use, and a monitoring failure has a first-class signal rather than masquerading as zero activity.

## What the evidence does not establish

The dashboard is an observation layer, not an identity, policy, or containment boundary:

1. **Process labels are heuristic attribution.** A short process-name prefix plus ancestry is useful operational correlation, not authenticated agent identity. Name reuse, deliberate spoofing, exec patterns, shared helpers, adoption after probe attachment, and work delegated to a separate service can create false attribution or blind spots.
2. **DNS and network visibility are incomplete.** Destination ports are retained but destination addresses are not. Direct port-53 DNS and systemd-resolved varlink calls are parsed, while DoH and DoT appear only as encrypted connections. A domain lookup also does not prove which later connection used its result.
3. **Metrics are not a complete forensic trace.** Ring-buffer events can drop; high-cardinality values are folded into `other`; path strings are bounded; common read-only paths are deliberately filtered; and counters do not preserve command arguments, content, intent, or causal success.
4. **Sensitive metadata is exposed.** File paths and domains become Prometheus labels. The service definition binds the metrics endpoint to `0.0.0.0:9464` and relies on the operator to firewall it, despite nearby setup prose describing loopback access. Collection and scrape access therefore need an explicit privacy and network policy.
5. **Deployment is not self-contained.** The documented path installs the separate `yeet` CLI and daemon, requires host authentication, and uses that runtime to load BPF and serve metrics. GitHub reported no repository license, and no license file was present in the inspected tree; the BPF source's `Dual BSD/GPL` kernel declaration alone is not a repository-wide software license.

## Operational implication

Kernel telemetry can complement transcript-level accounting because it witnesses host effects even when an agent omits or misstates them. A production measurement contract should nevertheless preserve at least:

- observer and probe version;
- host, cgroup or other independently assigned workload identity;
- attribution method and confidence;
- coverage and known blind spots;
- dropped-event and collector-health state;
- metric-cardinality folding rules;
- retention and access controls for paths and domains; and
- a clear label that the signal **observes** rather than blocks.

For stronger attribution, launch each agent inside an externally assigned cgroup or equivalent workload boundary and key telemetry to that boundary; process names can remain a discovery aid. For stronger control, pair observation with separately enforced network, filesystem, credential, and effect policies. Neither a clean dashboard nor the absence of a recorded event proves that an agent stayed within authority.

## Comparison with existing Scout knowledge

This complements [coding-agent telemetry measurement contracts](./2026-09-29-coding-agent-telemetry-measurement-contracts.md), which focuses on transcript-derived token and cost accounting, and [agent security defense architectures](../agent-security-defense-architectures.md), which discusses eBPF enforcement. Agentcap is a distinct primary source and contributes a narrower host-observation pattern: process-tree correlation, explicit probe/drop health, and the limits of audit-style kernel telemetry.

## Verification evidence and limits

Scout inspected the repository's complete, non-truncated GitHub tree at the pinned revision and read the README, `src/bpf/agentcap.bpf.c`, `src/collector.js`, `service.toml`, `package.json`, and both GitHub Actions workflows. The code contains the described BPF maps, hooks, bounded labels, health metrics, and deployment bind.

Scout did **not** run the install script, install or authenticate the external yeet daemon, compile or load BPF, inspect live Prometheus output, reproduce CI, or compare observed activity against ground truth. The repository was created the day of observation and had one GitHub star; neither novelty nor its HN appearance establishes reliability or adoption. The source tree contained no dedicated tests beyond build, syntax, configuration, generated-dashboard, and kernel-verifier workflow definitions.

## Sources reviewed

- [HN item 49898915](https://news.ycombinator.com/item?id=49898915)
- [README at inspected revision](https://github.com/yeet-src/agentcap/blob/71cb2a22dd1ccbc184150ec314a3bc366b9becc4/README.md)
- [eBPF probe](https://github.com/yeet-src/agentcap/blob/71cb2a22dd1ccbc184150ec314a3bc366b9becc4/src/bpf/agentcap.bpf.c)
- [Userspace collector](https://github.com/yeet-src/agentcap/blob/71cb2a22dd1ccbc184150ec314a3bc366b9becc4/src/collector.js)
- [Service definition](https://github.com/yeet-src/agentcap/blob/71cb2a22dd1ccbc184150ec314a3bc366b9becc4/service.toml)
- [CI workflow](https://github.com/yeet-src/agentcap/blob/71cb2a22dd1ccbc184150ec314a3bc366b9becc4/.github/workflows/ci.yml)
- [Kernel verifier matrix](https://github.com/yeet-src/agentcap/blob/71cb2a22dd1ccbc184150ec314a3bc366b9becc4/.github/workflows/kernel-matrix.yml)

## Discovery coverage

The live HN Algolia `search_by_date` query for `AI agent` stories newer than Unix time `1790696414` returned 13 items. Eight were newer than the prior accepted scan: Agentcap, an offline Raspberry Pi voice agent, TIRx Harness, adaptive voice design, Relay, an agent-security tutorial, CoreWeave ARIA, and a report about Meta Muse privacy. Agentcap was selected because its implementation exposed a concrete, inspectable observability boundary. The other seven were assessed from current HN item metadata only and were not treated as evidence for their linked pages' substantive claims.
