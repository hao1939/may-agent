<ai_context>
summary: "Moching's public repository advertises a proprietary desktop agent with 219 tools spanning screen perception, HID, browser storage and network interception, files, shell, services, registry, networking, task scheduling, persistent memory, and extensible skills. The capability inventory is useful as an authority-surface checklist, but the inspected public revision contains only marketing/documentation assets and does not document an approval, allowlist, sandbox, or effect-settlement boundary; it explicitly promotes terminal execution with no whitelist. These are documentation observations, not proof of unsafe runtime behavior."
triggers: ["Moching", "desktop agent authority surface", "219 agent tools", "desktop agent no whitelist", "computer-use capability inventory"]
last_updated: "2026-10-05"
source_basis: "HN item 49959897 and the complete public tree, README, and proprietary license of moching-ai-dev/moching at revision 87cfb44decae6bc593c79a2c2ca4b30669fb14b7. Scout did not install or execute the proprietary binaries."
</ai_context>

# A desktop-agent capability matrix is an authority map, not a safety case

**Date:** 2026-10-05  
**Disposition:** New source signal  
**Source:** https://news.ycombinator.com/item?id=49959897  
**Repo:** https://github.com/moching-ai-dev/moching  
**Inspected revision:** [`87cfb44decae6bc593c79a2c2ca4b30669fb14b7`](https://github.com/moching-ai-dev/moching/commit/87cfb44decae6bc593c79a2c2ca4b30669fb14b7)

## Question

What reusable operational signal is present in Moching's claim of a desktop agent with 219 built-in tools?

## Source observations

Moching's README describes a proprietary Windows and macOS agent that closes a `See → Understand → Take Action → Verify` loop. Its advertised tool matrix crosses several authority domains in one process family:

- screen capture, UI-tree inspection, continuous monitoring, mouse, keyboard, app launch, and clipboard input;
- browser cookies and storage, network interception, JavaScript execution, geolocation, and page automation;
- file read/write/search/replace, unrestricted command execution, processes, services, registry, networking, Wi-Fi, disks, task scheduling, and software management;
- office-document mutation, media pipelines, persistent memory and document ingestion, and an extensible skill store.

The comparison table explicitly markets terminal execution as **“No Whitelist.”** The quick start asks users to supply an OpenAI, Claude, Gemini, or OpenAI-compatible key and to watch the agent work. The public architecture diagram claims a Rust core around HID, screen capture, and IPC plus an embedded Python agent/tool runtime.

The inspected Git tree is complete according to GitHub's tree response and has only ten entries: README and license files, `.gitignore`, and five images. It contains no implementation, tests, threat model, permission-policy specification, or auditable runtime configuration. The proprietary license also prohibits reverse engineering. Within the complete README, Scout found no documented approval flow, allowlist, sandbox, credential broker, effect receipt, or recovery/settlement rule. This is an absence in the inspected public evidence, not proof that the distributed binaries contain no controls.

## Reusable implication

A broad desktop-agent tool count should be read as an **authority-composition map**. Each domain is risky on its own, but cross-domain paths create qualitatively stronger effects: browser storage can supply credentials to shell or network tools; screen perception can discover targets for HID; persistent memory can carry sensitive observations across runs; task scheduling and services can extend an effect beyond the visible session; and skills can add new execution paths after the original product review.

Consequently, “watch it work” and a final visual verification step are not an adequate control model for such a surface. A serious deployment review should require, per effect path:

1. an execution-time host policy and resource scope;
2. non-widening ceilings for high-authority combinations such as credentials plus network or shell plus persistence;
3. an explicit approval identity and expiry where human consent is required;
4. secret handling that does not silently grant every tool the user's provider or browser authority;
5. durable effect receipts and an honest unknown state when terminal or background work cannot be settled; and
6. coverage evidence showing that shell, HID, browser interception, plugins/skills, and background services cannot bypass the same policy boundary.

The source does not establish that Moching violates those requirements. It demonstrates why a capability matrix this broad demands a corresponding, publicly reviewable authority matrix before tool count can be treated as more than a product feature.

## Limits

- Scout inspected the pinned public repository tree, README, license, GitHub metadata, and HN item. Scout did not download, install, decompile, or run the proprietary Windows or macOS release.
- Product capability and architecture statements are vendor-authored and were not independently reproduced. The repository title's “Rust” claim is supported only by the README architecture diagram, not public source code.
- Absence of a control in public documentation does not prove absence in the binaries or hosted services.
- At inspection, the HN item had one point and no comments; the repository had eleven stars and no forks. This is an early product signal, not evidence of adoption, reliability, or incident history.

## Relation to existing Scout knowledge

[PI-Desktop's host-owned permission finding](./2026-09-24-pi-desktop-host-owned-agent-permissions.md) provides the constructive contrast: effect-capable paths should converge on one authoritative host decision, and later convenience grants must not widen earlier mode or resource ceilings. Moching contributes a different source record—a concrete inventory of how much authority a desktop product may compose while its public repository offers no comparable policy evidence.

## Sources reviewed

- [HN item 49959897](https://news.ycombinator.com/item?id=49959897)
- [README at the inspected revision](https://github.com/moching-ai-dev/moching/blob/87cfb44decae6bc593c79a2c2ca4b30669fb14b7/README.md)
- [Complete Git tree at the inspected revision](https://api.github.com/repos/moching-ai-dev/moching/git/trees/87cfb44decae6bc593c79a2c2ca4b30669fb14b7?recursive=1)
- [Proprietary license](https://github.com/moching-ai-dev/moching/blob/87cfb44decae6bc593c79a2c2ca4b30669fb14b7/LICENSE)

## Discovery coverage

The current HN Algolia `search_by_date` query for `agent` stories (20 newest hits) surfaced item 49959897 after the previous scheduled scan. Case-insensitive searches for the HN item ID, repository URL, owner, and product name found no existing Scout assessment. Broader searches found desktop-agent permission and runtime-effect notes, but none assessed this source or its particular cross-domain authority inventory, so a distinct source-level finding was warranted.
