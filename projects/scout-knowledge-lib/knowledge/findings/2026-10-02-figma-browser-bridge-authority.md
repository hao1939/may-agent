<ai_context>
summary: "figma-server replaces an approved MCP-client path with a local bridge to an authenticated browser. Its managed leases, loopback bearer boundary, and dedicated profile reduce some hazards, but arbitrary JavaScript and CDP deliberately expand authority beyond the managed file contract and can bypass coordination until browser restart."
triggers: ["figma-server", "Figma MCP", "CDP agent", "browser authority", "shared browser", "raw JavaScript", "agent tool approval"]
last_updated: "2026-10-02"
source_basis: "Static inspection of ctxrs/figma-server revision 30ceccb11ee29b5a477d85717b924528411ca8f5 after HN 49938648. Scout did not install the package, run its tests, sign in to Figma, or perform an edit."
</ai_context>

# A Browser Bridge Trades Client Approval for Browser-Session Authority

**Date:** 2026-10-02  
**Disposition:** New knowledge  
**Coverage:** HN post plus pinned repository source and documentation; no execution

## Question

What changes when an agent reaches an authenticated web application through browser automation rather than the application's approved agent protocol?

## Source observation

[HN 49938648](https://news.ycombinator.com/item?id=49938648) introduces [`ctxrs/figma-server`](https://github.com/ctxrs/figma-server) as an alternative to Figma's approved-client MCP path. At pinned revision [`30ceccb11ee29b5a477d85717b924528411ca8f5`](https://github.com/ctxrs/figma-server/commit/30ceccb11ee29b5a477d85717b924528411ca8f5), the project runs a dedicated Chromium profile, keeps a Figma login in that profile, and exposes MCP and JSON HTTP tools over a loopback service.

The implementation contains meaningful local controls:

- the HTTP boundary checks Host and Origin and requires a separate bearer token;
- agents receive session-owned file leases, and managed writes for one file serialize;
- normal file URLs are restricted to exact Figma origins and recognized file types;
- lease checks reject cross-session use, and uncertain browser cleanup retains the file lock or quarantines the lease; and
- stored receipts omit arguments, form values, clipboard contents, raw DOM, and raw browser errors.

These controls do not make the browser bridge equivalent to a narrow application API. The project intentionally exposes arbitrary page JavaScript and raw Chrome DevTools Protocol commands. Its own operations guide says those tools can navigate away from the leased file, use cross-target state, create targets outside managed-tab limits, and bypass managed file coordination. Browser-scope CDP can control every target for the shared account browser. Entering raw mode changes the worker's restrictions for that browser generation; detaching or releasing a lease does not restore them, while restarting the browser does. Concurrent tabs also share the authenticated profile and clipboard.

The useful boundary is therefore not “MCP versus CDP.” It is **what authority the effective runtime holds and which controls still mediate each operation**. A client-approval restriction can be avoided by driving the ordinary web UI, but the replacement inherits the authority and ambiguity of an authenticated browser session.

## Reusable assessment pattern

For an agent bridge that substitutes browser control for an official protocol, record separately:

1. **account authority:** which identity is logged in and which files or actions it can reach;
2. **transport admission:** bind address, client authentication, Origin/Host checks, and remote-tunnel exposure;
3. **managed contract:** leases, file locks, URL restrictions, operation limits, and result redaction;
4. **escape surface:** arbitrary JavaScript, CDP scope, downloads, popups, cross-target state, clipboard, and raw results;
5. **mode lifetime:** whether elevated/raw authority ends with the call, lease, session, browser generation, or persisted profile; and
6. **effect evidence:** dispatch, readback, rendered result, save state, and later persistence as distinct facts.

A dedicated profile is valuable separation from the operator's daily browser, but it is still a durable credential container. Loopback plus a bearer token protects the local service boundary; it does not constrain what a trusted connected agent or its model provider can do with the browser session.

## Evidence boundary

The repository's testing guide is unusually explicit about proof levels. It separates fake-backed unit tests, authenticated HTTP/MCP integration tests, real-browser package tests, headed login fixtures, and live disposable-account edits. It also reports platform-specific passes and gaps, including an all-six-job hosted Actions run that failed before product tests, an elevated-token Windows qualification, and unproven ordinary-user Windows setup. Those are project-authored records, not independent verification.

For adoption, require a pinned release archive, a disposable least-privilege Figma account, verification that the daemon remains local, tests of managed and raw modes, and readback plus persistence checks on disposable files. Do not infer that bypassing client approval bypasses account policy, terms, audit duties, or the need to settle ambiguous writes.

## Limitations

- Scout reviewed source and documentation but did not install the release, run tests, inspect retained external receipts, launch Chromium, authenticate, or edit Figma.
- The HN post had two points and no comments at inspection; it is discovery evidence, not validation.
- The code and qualification evidence are authored by the project itself.
- Figma's current policy and terms were not independently assessed beyond the repository's linked description.

## Source record

- **HN source:** https://news.ycombinator.com/item?id=49938648
- **Repo:** https://github.com/ctxrs/figma-server
- **Inspected revision:** [`30ceccb11ee29b5a477d85717b924528411ca8f5`](https://github.com/ctxrs/figma-server/commit/30ceccb11ee29b5a477d85717b924528411ca8f5)
- **Primary files:** [README](https://github.com/ctxrs/figma-server/blob/30ceccb11ee29b5a477d85717b924528411ca8f5/README.md), [operations guide](https://github.com/ctxrs/figma-server/blob/30ceccb11ee29b5a477d85717b924528411ca8f5/docs/operations.md), [testing guide](https://github.com/ctxrs/figma-server/blob/30ceccb11ee29b5a477d85717b924528411ca8f5/docs/TESTING.md), [security boundary](https://github.com/ctxrs/figma-server/blob/30ceccb11ee29b5a477d85717b924528411ca8f5/src/security.ts), [session manager](https://github.com/ctxrs/figma-server/blob/30ceccb11ee29b5a477d85717b924528411ca8f5/src/session-manager.ts), and [receipt writer](https://github.com/ctxrs/figma-server/blob/30ceccb11ee29b5a477d85717b924528411ca8f5/src/receipts.ts)
