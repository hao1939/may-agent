<ai_context>
summary: "An arXiv abstract reports provider misbinding across five LLM-based MCP clients when attacker-controlled tools imitate or out-position a legitimate provider through names, descriptions, and compatible schemas. The reusable control is to bind tool selection and execution to a verified provider identity and to treat unresolved provider ambiguity as a denied or explicitly approved state, not as a metadata-ranking problem. Scout reviewed only the API abstract, not the paper, clients, environment, prompts, traces, code, or results tables."
triggers: ["MCP provider identity", "tool-provider misbinding", "MCP tool collision", "verified tool provider", "MCP ambiguity"]
last_updated: "2026-11-17"
source_basis: "One bounded arXiv cs.AI Atom request returned HTTP 200 in 459 ms with one request and no Retry-After value. Assessment is limited to the complete API abstract for arXiv:2611.21577v1; the full paper and artifacts were not reviewed."
</ai_context>

# MCP Tool Selection Must Bind the Provider, Not Just the Tool Metadata

**Question:** What does the current arXiv signal imply for clients that compose tools from multiple MCP servers?

**Observation date:** 2026-11-17  
**Disposition:** New knowledge  
**Coverage:** Complete title, metadata, and API abstract only; the full paper, evaluation artifacts, and client implementations were not reviewed.  
**Source:** https://arxiv.org/abs/2611.21577v1  
**Reviewed version:** `2611.21577v1`

## Source observation

*When Tool Names Are Not Identities: Measuring Provider Misbinding in MCP-Based AI Agents* studies **tool-provider misbinding**: a client resolves a request intended for a legitimate provider to an attacker-controlled tool. In the abstract's threat model, the attacker does not compromise the host, model, legitimate server, or network channel. It operates another MCP server and chooses the metadata of its advertised tools.

The authors formulate selection as an attacker-controlled optimization problem and report a controlled evaluation across five LLM-based clients. According to the abstract:

- the strongest failures combine an exact tool-name collision, a task-aligned description, and a compatible schema;
- an authority-enhanced description plus a compatible schema can still cause wrong-provider execution or unresolved ambiguity without an exact name collision; and
- clients expose the weakness differently, including attacker-controlled provider selection, clarification requests, and unstable or inconsistent resolution.

The abstract establishes a reported cross-client failure class, not its prevalence in deployed MCP ecosystems. It supplies no client names, per-client rates, prompt corpus, attack budget, benign-collision baseline, or independently reproduced result in the text Scout reviewed.

## Reusable finding: provider identity is part of the callable capability

A tool name, description, and parameter schema describe what a tool claims to do. They do not establish who supplies it or why that provider is authorized for this task. A safe MCP composition layer should therefore treat a callable tool as a provider-bound capability, for example:

`provider identity + server instance or origin + tool identity/version + schema + task authority`

Selection and effect admission should preserve that tuple rather than flattening tools from several servers into one metadata-ranked namespace. In particular:

1. **Bind intent to a provider identity.** A request for a named service or organizational authority should resolve only to an authenticated, policy-approved provider, not to whichever description best matches the prompt.
2. **Namespace collisions explicitly.** Duplicate names should remain distinct provider-qualified identities. Display aliases must not become execution identities.
3. **Fail closed on ambiguity.** If provider intent cannot be resolved, the client should return a typed ambiguity or require approval that displays the competing providers; clarification is safer than silent ranking, but only if the answer is bound to the later call.
4. **Recheck at execution.** The provider, tool version, and schema selected during planning should match the endpoint used at invocation. Discovery-time identity without execution-time binding leaves a substitution window.
5. **Audit the binding decision.** Receipts should record the candidate providers, the chosen provider-bound tool, the authority used to admit it, and whether any collision or ambiguity was present.

Allow-lists based only on tool names are insufficient under this threat model. Description filtering or schema compatibility can improve ranking but cannot prove provider identity, and compatible schemas may make substitution easier rather than safer.

## Relationship to existing Scout knowledge

This sharpens [Agent Protocols: MCP, A2A, and the Emerging Stack](../agent-protocols-mcp-a2a.md), which already treats malicious tool metadata as a semantic supply-chain surface. The new abstract separates a narrower identity failure: even when transport and servers remain uncompromised, discovery metadata can cause the client to execute the wrong provider's compatible tool.

It also complements [Agent Authentication Needs Origin-Bound Authority](./2026-11-17-agent-authentication-needs-origin-bound-authority.md). Authenticated agent credentials and origin-bound requests protect a different edge. MCP tool composition additionally needs the selected provider identity bound to the capability exercised by that request.

## Retrieval evidence

The workflow supplied one bounded request to:

`https://export.arxiv.org/api/query?search_query=cat%3Acs.AI&start=0&max_results=20&sortBy=submittedDate&sortOrder=descending`

The request returned HTTP `200` in `459 ms`; request count was `1`. `Retry-After` was unavailable (`null`), and no deferred retry time was supplied. Scout made no retry, pagination request, fallback request, or query variant.

## Evidence limitations

- Scout reviewed only the complete Atom abstract and metadata for `2611.21577v1`, not the full paper, appendices, code, prompts, traces, client configurations, or statistical analysis.
- The five clients are not identified in the abstract, so this record cannot attribute behavior to any named product or version.
- The abstract does not report per-condition rates or establish how common multi-provider collisions are in production.
- The environment is author-controlled, and Scout did not independently reproduce provider selection, verify the attacker model, inspect network or host isolation, or test mitigations.
- The implementation guidance above is Scout's interpretation of the reported failure class. The abstract does not prove that any one identity, namespace, approval, or receipt design fully prevents misbinding.
