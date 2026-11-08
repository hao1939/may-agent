<ai_context>
summary: "Sentient separates agent-authored logs from kernel-observed activity, but its own pinned design makes capture gaps, policy freshness, privilege separation, and attribution explicit limits on any 'complete' or tamper-evident audit claim."
triggers: ["Sentient", "coding agent audit", "kernel monitoring", "Tetragon", "agent observability"]
last_updated: "2026-11-08"
source_basis: "HN item 50409020, the Sentient product page, and pinned repository documentation/source at commit 538e6c5a6179dcf7e8bac3228148939cff2b0da0. Static inspection only; Scout did not install or run Sentient or Tetragon."
</ai_context>

# A kernel agent audit still needs capture and attribution receipts

**Date:** 2026-11-08  
**Disposition:** new knowledge  
**Coverage:** HN submission, product page, pinned repository README, design, storage design, Tetragon integration plan, and tracing-policy template; no runtime execution

**Source:** https://news.ycombinator.com/item?id=50409020  
**Source:** https://nosaka.ai/sentient/  
**Repo:** https://github.com/nosaka4i/sentient/tree/538e6c5a6179dcf7e8bac3228148939cff2b0da0

## Observation

Sentient proposes a useful evidence split for coding-agent review: agent session logs explain which prompt and stated reason accompanied an action, while an independently privileged monitor records file, process, and network activity from the kernel. Its architecture keeps the monitor and SQLite store in a root-owned daemon, exposes a narrow local API over a Unix socket, and leaves the user-facing CLI and dashboard unprivileged.

The pinned repository also makes the boundary narrower than the product page's claims that it captures “all actions” in a “tamper-evident” record:

- the README says the Tetragon dependency is still a placeholder in the installation path;
- `docs/tetragon-integration.md` says v1 is log-only and kernel collection is an optional verify mode;
- Tetragon's event stream has no replay, so disconnects, restarts, loss, or a slow reader can create evidence gaps;
- the tracing policy matches exact agent binary paths, so an agent auto-update can leave a stale policy until it is regenerated and Tetragon is restarted;
- session/prompt attribution is a derived correlation based on process ancestry, working directory, timing, and command-text matching rather than kernel evidence itself;
- network capture records TCP connects but not DNS or byte counts, and several hooks remain deferred;
- the README explicitly says passwordless `sudo` for the agent account removes the privilege boundary;
- the storage design records that older process exits were not chained, gap rows were not yet fully immutable, and several storage changes remained proposed.

## Interpretation

Kernel observation is stronger than asking the agent to witness itself, but the resulting audit verdict should remain typed. A reviewer needs at least:

1. **capture status** — log-only, kernel-verified, or partially observed;
2. **monitor continuity** — policy installed before the agent, stream-loss counters, restarts, and explicit gap intervals;
3. **policy identity and freshness** — exact collector policy and matched agent binary version;
4. **privilege separation** — whether the observed agent could stop the monitor or alter its store;
5. **attribution confidence** — direct process ancestry versus heuristic prompt/session correlation;
6. **coverage declaration** — which file, process, network, and lifecycle events were actually collected;
7. **record verification** — which rows are append-only and hash-verified, versus mutable derived indexes.

This supports a general design rule: an external observer can make agent effects independently inspectable, but “the monitor saw no violation” is reliable only when capture continuity, policy applicability, privilege separation, and attribution are themselves evidenced.

## Limitations

Scout inspected static project-authored material only. It did not build or run Sentient, install Tetragon, inspect a produced database, verify a hash chain, test policy reload or stream loss, exercise privilege bypasses, measure event completeness, or reproduce the product page's 19-session command statistics. The repository documentation mixes built, proposed, and deferred components, so this note does not treat the advertised complete audit trail as a demonstrated runtime property.
