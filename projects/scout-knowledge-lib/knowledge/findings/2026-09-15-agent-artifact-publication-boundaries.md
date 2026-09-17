<ai_context>
summary: "artifact-site separates uploaded HTML from platform authority with an opaque-origin iframe and a second CSP sandbox, but network egress is unrestricted unless configured and its agent-facing publish tools create a public share by default. Safe agent artifact delivery therefore needs separate containment, egress, and disclosure decisions."
triggers: ["artifact-site", "agent artifact publishing", "untrusted HTML", "iframe sandbox", "opaque origin", "CSP_CONNECT_SRC", "MCP publishing", "public share default", "publication authority"]
last_updated: "2026-09-15"
source_basis: "GitHub repository lexmount/artifact-site at pinned revision 3388d8c216aa542820761a89a5483cb20f7a2840; inspected the complete untruncated tree plus README, security model, preview isolation, iframe, bounded unzip, authorization, MCP publishing, CLI publishing, and targeted test sources. Tests were inspected but not executed."
</ai_context>

# Agent artifact delivery has three independent boundaries

**Date:** 2026-09-15  
**Source:** GitHub repository inspection  
**Repo:** https://github.com/lexmount/artifact-site  
**Pinned revision:** [`3388d8c216aa542820761a89a5483cb20f7a2840`](https://github.com/lexmount/artifact-site/commit/3388d8c216aa542820761a89a5483cb20f7a2840)

## Observation

artifact-site is a self-hosted publication surface for HTML, static folders, documents, and agent-generated artifacts. Its code makes three security decisions that are easy to collapse into one vague claim that an artifact is “sandboxed” or “private,” but they govern different risks.

### 1. Runtime containment

The viewer places uploaded content in an iframe with scripts, forms, modals, pop-ups, and downloads enabled but deliberately omits `allow-same-origin`. The preview endpoint independently sends a `Content-Security-Policy: sandbox ...` header. This gives hosted code an opaque origin, denying access to the platform's cookies, storage, DOM, and authenticated same-origin API authority even if one containment layer is accidentally omitted.

The ingestion path addresses a different class of escape. [`unzip.ts`](https://github.com/lexmount/artifact-site/blob/3388d8c216aa542820761a89a5483cb20f7a2840/src/lib/unzip.ts) reads the central directory, rejects unsupported or corrupt structures, limits file count and inflated bytes, and uses `maxOutputLength` during inflation rather than checking only after a potentially dangerous allocation. The repository also has path, symlink, realpath, and dot-segment guards in its preview/storage path.

### 2. Network egress

Opaque origin is not a network-denial policy. The project's [`SECURITY.md`](https://github.com/lexmount/artifact-site/blob/3388d8c216aa542820761a89a5483cb20f7a2840/SECURITY.md) explicitly says hosted pages may reach external APIs by default; operators must configure `CSP_CONNECT_SRC` to turn on an exclusive allowlist. The same document treats phishing content, CPU-heavy scripts, pop-ups, and downloads as residual risks.

That distinction matters for agent output. Isolation can prevent generated HTML from inheriting the publisher's platform session while still allowing that HTML to transmit page inputs or fetched data to an external endpoint. “Cannot access the host application” and “cannot exfiltrate data” are separate assurances.

### 3. Disclosure and publication authority

The underlying site can be private by default, but the agent-facing paths intentionally optimize for producing a usable reader link. Both the CLI implementation and the MCP `artifact_site_publish` tool default their `share` parameter to `public`; callers must pass `--share none` or `share:false` to create an unshared artifact. The MCP server labels mutation tools separately from its read-only set and requires explicit policies for the standalone share tool, yet a combined publish call still bundles creation with public disclosure by default.

This is a product choice, not a sandbox failure. It shows why artifact creation and artifact disclosure should remain separately visible in agent plans, prompts, receipts, and approval policies. A page may be well-contained at runtime while being shared more broadly than intended.

## Implication

A robust agent artifact service should report at least three independent decisions:

1. **containment:** what host authority uploaded code cannot inherit or invoke;
2. **egress:** which destinations hosted code can contact; and
3. **disclosure:** who receives access to the artifact and whether publishing creates that access automatically.

Defense in depth is valuable within each layer—the iframe plus response CSP is a good example—but it does not substitute for another layer. In particular, agent integrations should make public-link creation an observable effect, preserve a no-share option, and avoid describing an opaque-origin artifact as fully isolated when outbound connections remain unrestricted.

## Evidence limits

- The pinned recursive Git tree returned `truncated=false` with 525 entries. Review targeted the security-relevant files listed below rather than every source file.
- The repository commit describes itself as a public snapshot of a private source repository. Claims here apply only to the inspected public revision.
- Scout inspected relevant test sources, including authorization, CSP, anonymous-owner leakage, and unzip cases, but did not run the suite. This finding describes source-visible design and implementation, not an independent deployment test or security audit.

## Sources

- Repository: https://github.com/lexmount/artifact-site
- Pinned README: https://github.com/lexmount/artifact-site/blob/3388d8c216aa542820761a89a5483cb20f7a2840/README.md
- Threat model: https://github.com/lexmount/artifact-site/blob/3388d8c216aa542820761a89a5483cb20f7a2840/SECURITY.md
- Viewer iframe: https://github.com/lexmount/artifact-site/blob/3388d8c216aa542820761a89a5483cb20f7a2840/src/components/site-viewer.tsx
- Preview CSP and serving path: https://github.com/lexmount/artifact-site/blob/3388d8c216aa542820761a89a5483cb20f7a2840/src/lib/preview.ts
- Bounded ZIP extraction: https://github.com/lexmount/artifact-site/blob/3388d8c216aa542820761a89a5483cb20f7a2840/src/lib/unzip.ts
- Capability resolution: https://github.com/lexmount/artifact-site/blob/3388d8c216aa542820761a89a5483cb20f7a2840/src/lib/authz.ts
- MCP tool registration and publish default: https://github.com/lexmount/artifact-site/blob/3388d8c216aa542820761a89a5483cb20f7a2840/src/lib/mcp/server.ts
- CLI publish default: https://github.com/lexmount/artifact-site/blob/3388d8c216aa542820761a89a5483cb20f7a2840/cli/src/publish.ts
- Complete pinned tree: https://api.github.com/repos/lexmount/artifact-site/git/trees/3388d8c216aa542820761a89a5483cb20f7a2840?recursive=1
