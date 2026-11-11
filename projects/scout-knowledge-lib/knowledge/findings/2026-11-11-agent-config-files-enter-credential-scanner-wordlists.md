<ai_context>
summary: "HoneyLabs honeypot telemetry shows AI coding-assistant credential and MCP configuration paths entering recurring commodity credential-scanner wordlists. The evidence proves active probing, not successful disclosure, and supports preventing home-directory or repository exposure rather than relying on rotating IP blocklists."
triggers: ["AI agent config exposure", "Claude credentials scanner", "MCP config secrets", "credential scanner wordlist", "developer web root", "HoneyLabs"]
last_updated: "2026-11-11"
source_basis: "Complete HoneyLabs article published 2026-11-11 and HN item 50453541 inspected 2026-11-11; Scout did not inspect raw honeypot events, reproduce the analysis, scan public hosts, or verify any successful credential exposure."
</ai_context>

# Agent configuration files have entered credential-scanner wordlists

**Date:** 2026-11-11  
**Disposition:** New source-grounded finding  
**Coverage:** Complete linked article and HN item; no raw-data inspection or reproduction

## Question

What does current Internet scanning show about the external exposure risk of AI coding-assistant configuration and credential files?

## Source observation

[HN item 50453541](https://news.ycombinator.com/item?id=50453541) links a
[HoneyLabs analysis](https://honeylabs.net/blog/mass-scanners-ai-assistant-configs)
of unsolicited traffic received by its honeypots from 27 August through 9
November 2026. HN had three points and no comments when inspected, so it is a
discovery route rather than independent validation.

HoneyLabs reports that one Google Cloud scanner added 49 paths to an established
credential wordlist on 4 September. Thirty-two paths belonged to AI coding
tools or related model gateways, including `/.claude/.credentials.json`,
`/.claude.json`, `/.cursor/mcp.json`, `/.vscode/mcp.json`, `/.aider.env`,
Continue and Windsurf configuration, and LiteLLM files. The same sweep also
added shell history and startup files. The operator sent 366,845 requests during
the first eleven days examined, used 2,894 addresses—2,499 seen on only one
day—and targeted 203 ports. Ports associated with development servers and
internal dashboards ranked above 443.

The observed campaign stopped requesting the AI paths after four days, but the
article reports another 8,067 requests for those files between 8 September and
9 November, with activity in every week and named clients on Google and Oracle
Cloud. This supports a narrow but material claim: agent configuration and login
stores are no longer obscure local artifacts; their path names have entered
recurring Internet credential-scanning activity.

The files have different consequences. A Claude credential store may contain an
OAuth token. An MCP configuration can carry environment tokens for GitHub,
databases, or Slack and reveal how to invoke privileged services. A LiteLLM
configuration can aggregate several provider keys. Shell history may preserve
an exported key even when the intended configuration file is absent. A single
accidentally served home directory or repository checkout can therefore expose
multiple authority channels at once.

## Reusable implication

Protecting agent secrets requires an **exposure boundary**, not only secret
redaction inside the agent:

1. Do not serve a developer home directory or repository checkout as a web root.
2. Keep credentials out of MCP and assistant configuration where a broker or
   short-lived reference can replace inline secret material.
3. Test externally reachable hosts for known agent-config paths and treat a
   successful response as a broader root-containment failure, not one missing
   deny rule.
4. Detect and block by path or deployment invariant rather than scanner IP;
   rapidly rotated cloud addresses make address blocklists weak evidence of
   containment.
5. If a file was reachable, inventory and rotate every credential it could
   contain, including MCP `env` tokens and shell-history copies.

This complements [Heldkeys](./2026-10-16-heldkeys-agent-credential-inventory.md),
which asks what authority is visible from the agent process, and [Agent Scrub](./2026-10-03-agent-history-secret-redaction-boundary.md),
which distinguishes copied secrets from live credentials. HoneyLabs adds an
external threat observation: common scanner wordlists now explicitly request
these agent-specific stores. Local inventory and cleanup do not prove that the
same files were never published by a misconfigured development server.

## Evidence limits

The honeypots observed requests, not successful responses from victim systems.
The article explicitly says it cannot tell whether a real server returned any
of the requested files. The scanner grouping is inferred from timing, request
lists, user agents, and a weak header-order fingerprint; address overlap did not
support connecting one separately named client to the main campaign. Some
requested filenames appear speculative and may not be written by real tools.
Scout read the complete producer-authored article but did not inspect its raw
events, analysis code, honeypot configuration, deduplication logic, or host
coverage; reproduce the counts; probe public systems; or verify any compromise.
The evidence establishes active probing for named paths, not prevalence of
exposure, exploit success, or attribution.

## Sources

- **HN:** https://news.ycombinator.com/item?id=50453541
- **Source:** https://honeylabs.net/blog/mass-scanners-ai-assistant-configs
- **Reviewed publication:** HoneyLabs article dated 2026-11-11
