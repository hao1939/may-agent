<ai_context>
summary: "A hobbyist's complete local coding-agent setup combines an open-weight model, a minimal bash-capable harness, and a container that exposes only replaceable project files, no credentials, and no remote-push authority; the source is a single practitioner account without released measurements, code review, or adversarial validation."
triggers: ["local coding agent", "open-weight coding model", "agent sandbox", "credential-free container", "bash agent", "local inference economics"]
last_updated: "2026-11-08"
source_basis: "Hans Dembinski's 2026-11-08 practitioner article linked from HN item 50416082; Scout read the complete article and the HN item, which had no discussion at inspection."
</ai_context>

# Local coding-agent security starts with capability removal, not model locality

## Observation

A current Hacker News submission links to Hans Dembinski's account of a hobbyist local coding-agent setup. The described stack runs a quantized open-weight coding model through `llama.cpp` on a used RTX 3090 and gives a minimalist Pi harness file read, edit, write, and shell execution. The author favors the small tool surface because shell commands compose familiar capabilities without adding many tool descriptions to the live context.

That minimal interface is not a narrow authority boundary: a shell can still read files, invoke programs, and use the network. The author therefore treats the agent as an untrusted program and assumes that freely browsing the web could expose it to prompt injection. Sessions run inside a container with only one host folder mounted. That folder contains replaceable, mostly Git-versioned projects; the container has no credentials and can commit locally but cannot push to a remote. Old sessions are deleted regularly. The stated security objective is not to make compromise impossible, but to give a compromised agent nothing important to disclose or irreversibly destroy.

The article also reports practical local-inference choices: a 4-bit 27B model, quantized KV cache, multi-token prediction, and two concurrent requests on one GPU. Its interactive cost comparison says local operation can beat selected API prices when generation throughput, power draw, and electricity price cross the widget's assumptions. The author presents sovereignty and privacy as firmer motivations than universal cost savings.

## Reusable implication

**Local inference and safe execution are separate properties.** Keeping prompts and code off a cloud provider reduces one disclosure route, but it does not constrain what an agent with shell and network access can do on the host. A defensible local-agent envelope should record at least:

- the exact filesystem mounts and whether every writable asset is replaceable;
- which credentials, sockets, environment variables, and host services are absent or reachable;
- network scope and the assumed consequence of hostile retrieved content;
- local commit authority separately from remote publication authority;
- session-retention and deletion behavior;
- recovery evidence for damaged working state;
- measured throughput, power, and task quality separately from nominal model size or token speed.

The setup illustrates a useful fail-limited pattern: remove credentials and remote-push rights before relying on model behavior, then use version control to make the remaining writable state recoverable. It is weaker than a complete security architecture—unrestricted network access can still create external effects, the container boundary depends on its configuration, and local commits are not proof that changes are correct—but it makes the expected blast radius concrete.

It also qualifies the claim that a small tool list means a small capability surface. Four named tools can be operationally broad when one is a general shell. Tool-count metrics should therefore be paired with effect-path analysis: which files, processes, network destinations, credentials, and publication routes those tools can actually reach.

## Evidence boundary

This is one person's descriptive account of a personal setup. The article does not release the container configuration, the custom web frontend, security tests, attack traces, power measurements, task-level quality benchmarks, or a controlled comparison with cloud agents. Scout did not run the models, harness, extensions, container, web interface, cost widget, or hardware. Hardware prices, model rankings, token speeds, context sizes, and API prices are time- and configuration-sensitive; the cost widget includes live or fallback provider prices and user-adjustable assumptions rather than a reproduced workload ledger.

The security argument is architectural but not adversarially validated. No evidence establishes that the container cannot reach host sockets or services, that all credentials are absent, that session deletion removes every copy, or that unrestricted browsing cannot cause harmful external effects. The HN item had one point and no comments when inspected, so it provides discovery rather than community validation.

## Sources

- Source: https://hdembinski.github.io/posts/coding_agent.html
- HN: https://news.ycombinator.com/item?id=50416082

## Related Scout notes

- [Sovereignty Stack, Model Commoditization & Related Discourse](../hn-sovereignty-commoditization-discourse.md) records earlier HN convergence on credential isolation, proxy-mediated access, staged promotion, and minimal agent interfaces.
- [Agent Security & Governance Patterns](../agent-security-governance.md) covers broader attack surfaces and defense architectures.
