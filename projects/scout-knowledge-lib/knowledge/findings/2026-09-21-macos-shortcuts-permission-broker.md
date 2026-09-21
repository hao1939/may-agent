---
summary: "A pinned macOS MCP server shows how an agent tool can reuse Shortcuts.app's data permissions without holding them itself, but its read-only claim is recipe-scoped: the same server can run any installed Shortcut, and output labeling is not information-flow enforcement."
triggers: ["MCP permissions", "macOS Shortcuts", "ambient authority", "read-only tools", "prompt injection", "agent data access"]
last_updated: "2026-09-21"
source_basis: "Static review of Dominic-DK/mac-shortcuts-mcp at pinned commit fd256234be53d62f97040c056a29ce0abed145b3, including its README, MCP tool registrations, Shortcuts CLI wrapper, installer, recipe manifest and tests."
---

# OS automation can become an agent permission broker—and a confused deputy

<ai_context>
Use this note when exposing desktop applications to an agent through an OS automation service. The reviewed implementation makes the privilege boundary unusually clear: Shortcuts.app, not the MCP process, receives protected-data permission. Treat read-only as an enforced operation-level property, not a server label, and do not confuse an output warning with taint tracking or sink control. This is a recent, macOS-only implementation reviewed statically, not a production-safety result.
</ai_context>

**Observed:** 2026-09-21  
**Disposition:** New source-grounded finding  
**Coverage:** GitHub repository search; pinned repository metadata and complete tree; README; MCP registrations; Shortcuts CLI wrapper; installer; recipe manifest; three representative XML recipes; and the checked-in test file. No macOS runtime test was performed.

## Sources

- **Repo:** [Dominic-DK/mac-shortcuts-mcp](https://github.com/Dominic-DK/mac-shortcuts-mcp)
- **Pinned revision:** [`fd256234be53d62f97040c056a29ce0abed145b3`](https://github.com/Dominic-DK/mac-shortcuts-mcp/commit/fd256234be53d62f97040c056a29ce0abed145b3)
- **Scope and caveats:** [README at the pinned revision](https://github.com/Dominic-DK/mac-shortcuts-mcp/blob/fd256234be53d62f97040c056a29ce0abed145b3/README.md)
- **Exposed MCP tools and output labeling:** [`src/index.ts`](https://github.com/Dominic-DK/mac-shortcuts-mcp/blob/fd256234be53d62f97040c056a29ce0abed145b3/src/index.ts)
- **Shortcut resolution and execution:** [`src/shortcuts.ts`](https://github.com/Dominic-DK/mac-shortcuts-mcp/blob/fd256234be53d62f97040c056a29ce0abed145b3/src/shortcuts.ts)
- **Local recipe installation:** [`src/install.ts`](https://github.com/Dominic-DK/mac-shortcuts-mcp/blob/fd256234be53d62f97040c056a29ce0abed145b3/src/install.ts)
- **Bundled recipe declarations:** [`recipes/manifest.json`](https://github.com/Dominic-DK/mac-shortcuts-mcp/blob/fd256234be53d62f97040c056a29ce0abed145b3/recipes/manifest.json)
- **Checked-in tests:** [`test/mac-mcp.test.ts`](https://github.com/Dominic-DK/mac-shortcuts-mcp/blob/fd256234be53d62f97040c056a29ce0abed145b3/test/mac-mcp.test.ts)

## What the implementation demonstrates

The server does not directly request Calendar, Contacts, Notes, Location, or other application permissions. Instead it invokes `/usr/bin/shortcuts`; the installed recipes execute inside Apple's Shortcuts machinery, and the README says the first protected access prompts for permission on behalf of Shortcuts. This is a practical **permission-broker pattern**: a narrow adapter delegates to an OS automation principal that already knows how to request and exercise application-level authority.

The bundled path is inspectable and intentionally low-friction. Setup signs readable XML recipes locally, opens each for import, and normally requires the user to click **Add Shortcut**. The optional automatic click path is opt-in and requires Accessibility access. The manifest declares nine retrieval recipes; the representative Notes, Contacts, and Clipboard plists reviewed here contain retrieval/format/output actions rather than an obvious write action.

The implementation also exposes the boundary that a product-level “read-only” label can hide:

- `mac_run_shortcut` accepts the name or identifier of **any installed Shortcut**, not only a bundled recipe.
- The tool description tells the model to ask the user when behavior is unknown, but code does not enforce approval, an allowlist, a recipe hash, or an effect class.
- The README explicitly acknowledges that an arbitrary installed Shortcut may write data or send messages.
- Protected data returned by recipes receives a suffix saying it is data rather than instructions. That may help a cooperative model, but it neither tracks the value into later tool calls nor prevents disclosure to a sink.

Thus the same broker contains two different capability shapes: named, inspectable retrieval recipes and an ambient “run anything already installed” primitive. They should not inherit the same trust label merely because they share a transport.

## Reusable design implications

1. **Bind authority to an inspected operation, not an intermediary application.** “Shortcuts has permission” is broader than “this exact recipe may read these fields.” A broker should admit a pinned recipe identity, declared data classes, and declared effect class before execution.
2. **Separate discovery from execution.** Listing every installed Shortcut plus accepting arbitrary identifiers makes the local automation inventory part of the agent's ambient action space. A safer default exposes only explicitly enrolled recipes.
3. **Make read-only machine-checkable.** Validate the imported recipe's action graph against an allowlist or effect manifest, retain its digest, and reject drift. A prompt description is not a capability boundary.
4. **Treat retrieved desktop content as tainted.** A textual “data, not instructions” suffix is useful context, not enforcement. Preserve provenance through the trajectory and gate later external or mutating sinks. This is the composition problem described in [the ChainCaps summary](./2026-06-29-arxiv-scan-249.md#1-chaincaps-monotonic-capability-attenuation-for-tool-composition-arxiv-260526542).
5. **Put consent at consequential transitions.** Import consent, protected-data consent, arbitrary execution, and later disclosure are distinct decisions. One setup click should not silently authorize every future Shortcut or every output destination.

## Verification gap exposed by the checked-in test

The test named “bundled recipes are read-only” does not inspect each recipe's action graph for mutating actions. Its write check applies a suffix regex to recipe metadata IDs such as `calendar.list`; a separate assertion only excludes notification triggers in the XML. Those checks are useful regression signals, but they do not prove the read-only property named by the test. A stronger test would parse every plist action identifier, compare it with a reviewed effect taxonomy, and fail closed on unknown actions or changed recipe digests.

## Limitations

- The repository was created on 2026-09-19 and had 13 stars when observed; maturity and independent adoption are unknown.
- This review is static. The Linux research environment could not validate macOS permission prompts, locked-screen behavior, recipe import, action-catalog extraction, or end-to-end results.
- The repository reports a 539-action catalog and locked-screen measurements in its README. Those are author claims, not independently reproduced results here.
- Only three representative recipe plists were inspected directly. The complete manifest was reviewed, but this note does not certify every XML action or Apple action's true side effects.
- Local execution avoids a separate service account, but data still flows to whichever MCP client/model the user connects; “local” is not equivalent to “undisclosed.”
