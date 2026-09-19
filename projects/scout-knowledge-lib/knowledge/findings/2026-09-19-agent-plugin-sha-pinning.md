<ai_context>
summary: "Plugin4Shell is a reported agent-plugin supply-chain flaw in which clients request a pinned Git commit but fail to verify the checked-out HEAD. Ambiguous Git ref names can therefore redirect installation or background updates to attacker-controlled code. The durable control is end-state verification at the execution boundary: resolve HEAD after checkout, compare it exactly with the approved commit, and abort on mismatch. A marketplace pin or successful checkout is only an intent receipt, not proof of installed bytes."
triggers: ["Plugin4Shell", "agent plugin security", "SHA pinning bypass", "coding-agent marketplace", "Git ref ambiguity", "plugin auto-update", "supply-chain verification"]
source_basis: "Air Security's technical disclosure, The Register's vendor-response reporting, and HN items 49766285 and 49766366. Exploit claims were not independently reproduced."
</ai_context>

# Agent plugin pinning must verify the resolved checkout

**Date observed**: 2026-09-19  
**Disposition**: new knowledge  
**Coverage**: Full Air Security technical disclosure and full Register report as rendered in HTML; HN submission metadata and comments for the two items new since the previous accepted HN boundary. No proof-of-concept was executed and product patches were not independently audited.

## Sources

- **Primary researcher disclosure**: https://www.air.security/blog-posts/plugin4shell
- **Independent reporting and vendor responses**: https://www.theregister.com/security/2026/09/17/ai-coding-agents-0-click-rce-flaw-could-hand-attackers-keys-to-the-kingdom/5297335
- **HN item**: https://news.ycombinator.com/item?id=49766285
- **Related new HN item (already covered Paper2Agent source)**: https://news.ycombinator.com/item?id=49766366

## Observation

The current HN feed added two items after the previously accepted boundary, item 49765573. Item 49766366 points to the same Nature Paper2Agent article already assessed in [`2026-09-18-paper2agent-executable-research-artifacts.md`](2026-09-18-paper2agent-executable-research-artifacts.md); its single comment questions whether papers should remain the central artifact but adds no evidence that changes that assessment.

Item 49766285 points to reporting on **Plugin4Shell**, a disclosed plugin-installation flaw affecting coding agents. The useful signal is not the “zero-click” label by itself. It is the gap between recording an approved Git object ID and proving that the working tree actually resolved to that object.

## Reported mechanism

Air Security reports two variants of the same missing postcondition:

1. **40-hex ref ambiguity**: Claude Code, Codex, and GitHub Copilot reportedly cloned a plugin repository and ran `git checkout <pinned-sha>` without verifying the resulting commit. On Git hosts that permit a branch whose name is the 40-character hash, an attacker controlling the upstream repository can make that branch the default. Git may resolve the ambiguous name as the ref rather than the intended object ID.
2. **`FETCH_HEAD` ambiguity**: Gemini CLI reportedly fetched the desired object, then checked out `FETCH_HEAD`. A malicious default branch with that literal name could be selected instead of the fetched object.

The researcher describes background plugin auto-update as the zero-click delivery path for already-installed Claude Code and Codex plugins. Their proposed invariant is simple: after checkout, resolve `HEAD`, compare it exactly with the approved commit ID, and abort on mismatch.

Air reports that Anthropic patched Claude Code in 2.1.179 and OpenAI patched Codex in 0.146.0. It says Gemini CLI was deprecated without a patch and Microsoft had not patched Copilot. The Register records a material disagreement: GitHub said its prohibition on SHA-like branch names prevents exploitation on GitHub, while Air argued that Copilot's support for other marketplace hosts such as Bitbucket preserves exposure. Those status claims are time-sensitive and were not independently verified here.

## Durable interpretation

### A pin is an instruction, not an installation receipt

A manifest can truthfully contain an approved commit while the installed tree contains different bytes. Reliability therefore requires verification at the final resolver boundary, not only validation of the marketplace record or checkout command. The general pattern is:

1. resolve and fetch the approved immutable identity;
2. materialize the plugin in a controlled directory;
3. derive the identity of the materialized result (`git rev-parse HEAD`, plus tree or artifact digest when appropriate);
4. compare it with the approved identity using an exact, fail-closed check;
5. only then expose or execute the plugin.

This applies beyond Git: package locks, image digests, signed bundles, and agent skills all need a post-resolution identity check if an installer can reinterpret names.

### Auto-update changes a local flaw into a distribution channel

Automatic update turns a resolver bug into ambient code delivery. A reviewed plugin can become dangerous later if the updater trusts repository state more than the pinned identity. Agent runtimes should treat plugin update as privileged installation: stage it, verify it, preserve an auditable old version, and activate only after the same policy checks used for first install.

### Host policy is defense in depth, not a portable guarantee

GitHub's refusal to create SHA-like branch names may block one reported path on that host, but a client that accepts multiple Git backends cannot inherit the strongest host's policy. The client-side invariant must hold across every supported backend. A marketplace or host restriction can reduce exposure; it should not replace end-state verification by the component that will execute the code.

## Limitations

- Air Security is both the reporting researcher and a vendor of agent-security products; its exploit and mitigation claims were not independently reproduced in this review.
- The Register obtained vendor responses, but the Microsoft/GitHub and Air positions remain disputed in the cited report.
- Exact affected configurations depend on agent version, marketplace backend, auto-update behavior, and Git-host naming policy.
- HN item 49766285 had one point and no comments when checked, so the technical signal comes from the linked disclosure and reporting rather than community validation.
