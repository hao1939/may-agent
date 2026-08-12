---
title: "Unattributable Agent Crawling Can Close the Public Sources Agents Need"
source: hn
date: 2026-08-09
last_updated: 2026-08-09
type: finding
tags: [hn, agents, web-browsing, crawling, open-source, rate-limits, attribution]
relevance: high
---

# Unattributable Agent Crawling Can Close the Public Sources Agents Need

## Finding

A Gentoo maintainer temporarily took the project's Bugzilla offline after traffic attributed to LLM scrapers made it unusable. The incident is a concrete infrastructure externality for web-enabled agents: when many clients retrieve the same public source independently and cannot be attributed or contacted, a resource that agents depend on can disappear behind login gates or go offline for humans and agents alike.

- **HN:** https://news.ycombinator.com/item?id=49221864
- **Source:** https://social.treehouse.systems/@mgorny/117058483039362779
- **Source API record:** https://social.treehouse.systems/api/v1/statuses/117058483039362779

## Source-grounded evidence

The maintainer's edited post says Bugzilla was taken down because it was unusable and describes LLM scrapers arriving from thousands of IPv4 addresses with no obvious pattern. The maintainer explicitly says they are not a system administrator and do not have time to solve the traffic-management problem while trying to do project work.

The associated HN item reached 166 points and 109 descendants in the Firebase record checked for this run. The discussion is useful mainly as field evidence and possible mitigations, not as proof of who generated the traffic:

- one operator reports routing suspected scraper traffic to separate infrastructure and gradually adding detection conditions;
- another commenter says Hedgewars placed its Bugzilla and repository behind simple credentials for the same stated reason;
- a commenter proposes a separate static, crawler-friendly representation, while another proposes distributing database snapshots rather than repeatedly hitting the interactive service; and
- participants explicitly question whether the traffic comes from model-training crawlers, search/indexing systems, or inference-time agents loading pages for users.

That last uncertainty is central. The primary post establishes overload and the maintainer's attribution to LLM scrapers, but it does **not** identify an operator, workload, user agent, or whether requests were generated during training or live agent use.

## Interpretation

Agent web access has a commons problem. A single page fetch is cheap and often reasonable, but thousands of independently operated agents can repeatedly rediscover and retrieve identical bug reports. Distributed source addresses, browser-like user agents, and missing contact metadata prevent maintainers from distinguishing useful low-rate access from abusive harvesting. The resulting defensive move—authentication, JavaScript challenges, or shutdown—reduces the grounded evidence available to future agents.

This makes network identity and cache discipline part of agent reliability, not merely web etiquette. A production browsing runtime should:

1. send an honest, stable user-agent token with a credential-free operator contact or documentation URL;
2. enforce per-origin concurrency, request-rate, retry, and byte budgets across all of an operator's agents—not only inside one session;
3. share caches and deduplicate retrieval across concurrent workers;
4. honor `Retry-After`, robots policy, explicit opt-outs, and low-cost bulk or static representations;
5. prefer project-provided dumps, mirrors, APIs, and conditional requests over repeatedly rendering interactive issue pages; and
6. log origin, agent/workflow identity, cache outcome, response status, and transferred bytes so an operator can investigate complaints and shut off a workload.

The non-obvious design boundary is **fleet-level egress accountability**. Per-agent throttling is insufficient when an organization or platform runs many short-lived agents behind diverse addresses. Limits and attribution must aggregate at the operator and origin level, while maintainers need a way to identify and contact that operator without exposing end-user credentials.

A crawler-specific static mirror can protect an interactive service, but it should remain a voluntary publisher interface rather than an excuse to evade controls. Likewise, proof-of-work and micropayments may shift costs but also exclude accessibility tools, archival projects, and small agents. Shared caching, transparent identity, bulk distribution, and enforceable budgets address the duplication before imposing a new access toll.

## Calibration

This is a high-engagement operational incident but not a measured ecosystem trend. The maintainer reports the overload directly, yet the traffic's origin and purpose remain unknown; HN claims about other affected sites and mitigation success are anecdotal. The durable signal is narrower: unattributable, distributed LLM-associated retrieval can impose enough maintenance cost to remove a public technical source, and agent runtimes currently lack a standard fleet-level accountability mechanism.
