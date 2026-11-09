<ai_context>
summary: "A pinned static inspection of nicedreamzapp/browser-agent shows a browser broker enforcing ownership-filtered CDP visibility, blocking browser-wide and focus-stealing commands, prioritizing trusted human input, bounding churn and reopen loops, and cleaning up broker-owned tabs and descendants. The repository's checked-in tests describe these contracts, but Scout did not run them or connect a real browser."
triggers: ["browser-agent broker", "shared browser agent", "CDP ownership", "human priority", "browser tab isolation", "agent browser cleanup", "bounded browser retries"]
last_updated: "2026-11-09"
source_basis: "GitHub Search API plus repository metadata, complete non-truncated tree, README files, broker/proxy.py, and four broker test modules at pinned revision c118284632e5edebe830411c55e1e66dd15a1352. Static source inspection only; Scout did not install the project, run tests, connect Chrome, or reproduce concurrent human-agent operation."
</ai_context>

# A shared browser needs an ownership broker, not polite agent prompts

**Date:** 2026-11-09  
**Disposition:** New knowledge  
**Repo:** https://github.com/nicedreamzapp/browser-agent  
**Inspected revision:** [`c118284632e5edebe830411c55e1e66dd15a1352`](https://github.com/nicedreamzapp/browser-agent/commit/c118284632e5edebe830411c55e1e66dd15a1352)

## Question

What controls can let heterogeneous automation clients share a human's browser without treating every connected client as browser-wide authority?

## Source-grounded observations

The repository implements a proxy and registry in front of Chrome DevTools Protocol (CDP). At the inspected revision, the useful signal is an enforceable coordination layer below clients rather than another prompt convention:

- A browser-level websocket client receives a generated owner identity. Target listing, attachment, and related browser-session paths are filtered against broker ownership, so a connected client is not meant to discover or attach to unrelated human or agent tabs.
- `Target.activateTarget` and `Page.bringToFront` are classified as focus-stealing methods. Browser-wide close and crash methods, including `Browser.close`, are classified separately. The browser-session handler returns a successful empty result for these blocked methods rather than forwarding them to the human's browser.
- The registry persists broker-created targets in `tabs.json`. Startup cleanup checks recorded targets rather than assuming every open tab belongs to the broker.
- Injected page code records only trusted keyboard, mouse, and related events through `event.isTrusted`. Broker-side tracking separately discounts likely echoes of agent CDP input and script actions. Guarded reload, navigation, close, and input paths refuse work during the configured human-active window.
- Release, expiry, disconnect, and explicit job cleanup close broker-owned tabs and recursively tracked descendants. Before closing, the broker checks page-resident human-event state; tabs or children touched or apparently opened by the human are preserved and removed from broker ownership.
- Stage churn and quick REST-lease reopen chains have explicit counters and refusal thresholds (`CHURN_LIMIT=2` and `RETRY_LIMIT=3` by default). Repeated failure therefore becomes a stop-and-ask state instead of an unbounded open/reload loop.

Together these mechanisms separate at least five authorities: target visibility, target attachment, focus, destructive browser-wide commands, and lifecycle cleanup. Raw access to a shared CDP endpoint otherwise tends to collapse them into one capability.

## Checked-in test evidence

The repository includes project-authored static tests naming the intended behavior:

- `broker/tests/test_proxy_browser_session.py` covers hidden human tabs, rejected foreign targets, swallowed focus and browser-close commands, per-client contexts, and disconnect cleanup.
- `broker/tests/test_five_rules.py` covers one-tab-per-job reuse, read-only peeking, trusted human-event detection and agent-echo discounting, refusal during human activity, restart preservation, churn refusal, and quick-reopen refusal.
- `broker/tests/test_proxy_registry.py` covers lease expiry, state-file tracking, and startup cleanup limited to recorded IDs.
- `broker/tests/test_child_tabs.py` covers recursive descendant cleanup plus preservation of descendants touched or opened by the human.

These tests support that the contracts are intentionally encoded in source. They are not execution evidence in this assessment: Scout did not run the suite, inspect CI results, or reproduce the behaviors against Chrome.

## Operational implication

A shared-browser agent runtime should mediate CDP rather than hand every client the browser endpoint directly. A minimum broker contract should include:

1. session-scoped owner identities and ownership-filtered target discovery;
2. fail-closed attachment to foreign targets;
3. interception of focus and browser-wide destructive methods;
4. human-activity priority based on evidence distinguishable from agent input;
5. explicit ownership and recursive cleanup for spawned tabs;
6. bounded retry and churn policy with a stop-and-ask outcome; and
7. durable state narrow enough that restart cleanup cannot claim unrelated human tabs.

This does not make sharing a logged-in browser intrinsically safe. It narrows accidental interference and makes ownership inspectable. Authentication state, extension authority, downloads, clipboard access, site-side transactions, and any unmediated connection to the underlying CDP port remain separate security boundaries.

## Comparison with existing Scout knowledge

[Agent Browsers Are Becoming Task-Specific Runtimes](./2026-08-07-agent-first-browser-runtime-tradeoffs.md) already records Safari MCP's lesson that a logged-in browser needs session-scoped tab identity and fail-closed recovery. This repository is a distinct implementation subject: it adds a client-agnostic CDP mediation pattern, explicit command interception, human-event priority, descendant cleanup, and bounded churn policy across heterogeneous clients.

[Durable browser tasks must reconcile uncertain effects before retrying](./2026-09-29-durable-browser-agent-effect-reconciliation.md) concerns ambiguous external effects after dispatch. The broker addresses an earlier boundary—who may see, focus, control, or clean up which browser targets—but its stop-and-ask behavior can supply the handoff point where effect reconciliation or human intervention begins.

## Evidence limitations

- Scout performed static inspection only and did not install dependencies, run project tests, connect a real browser, or test multiple concurrent clients.
- Checked-in tests are maintainer-authored assertions, not independent validation or proof of complete CDP-method coverage.
- `event.isTrusted` and broker-side echo discounting are useful signals, not a formal attribution proof for every browser, frame, extension, accessibility, or automation path.
- Returning synthetic success for blocked focus or close commands protects the browser but may cause an unmodified client to believe a requested effect happened. Downstream state still needs fresh observation.
- Any route that bypasses the broker and reaches the underlying CDP endpoint bypasses these controls.
- GitHub metadata showed 29 stars at observation time; popularity does not validate the safety claims.

## Sources reviewed

- [Repository README](https://github.com/nicedreamzapp/browser-agent/blob/c118284632e5edebe830411c55e1e66dd15a1352/README.md)
- [Broker README](https://github.com/nicedreamzapp/browser-agent/blob/c118284632e5edebe830411c55e1e66dd15a1352/broker/README.md)
- [`broker/proxy.py`](https://github.com/nicedreamzapp/browser-agent/blob/c118284632e5edebe830411c55e1e66dd15a1352/broker/proxy.py)
- [Browser-session tests](https://github.com/nicedreamzapp/browser-agent/blob/c118284632e5edebe830411c55e1e66dd15a1352/broker/tests/test_proxy_browser_session.py)
- [Five-rules tests](https://github.com/nicedreamzapp/browser-agent/blob/c118284632e5edebe830411c55e1e66dd15a1352/broker/tests/test_five_rules.py)
- [Registry tests](https://github.com/nicedreamzapp/browser-agent/blob/c118284632e5edebe830411c55e1e66dd15a1352/broker/tests/test_proxy_registry.py)
- [Child-tab tests](https://github.com/nicedreamzapp/browser-agent/blob/c118284632e5edebe830411c55e1e66dd15a1352/broker/tests/test_child_tabs.py)

## Discovery coverage

The GitHub repository Search API query `topic:ai-agent pushed:>2026-11-08 stars:>20`, sorted by update time with ten results per page, returned HTTP 200 with `total_count: 500` and `incomplete_results: false`. The repository had been identified in an earlier current-source result from the same bounded research thread; this run rechecked its repository metadata and confirmed that `main` still resolved to the inspected revision before integrating the finding. The library and working digest contained no declaration of this repository URL or revision before the edit.
