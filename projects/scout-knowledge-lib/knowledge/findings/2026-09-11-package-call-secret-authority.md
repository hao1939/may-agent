<ai_context>
summary: "Kody implements dependency-sensitive secret authority for portable MCP-hosted agent packages: host-validated package stamps let an imported package use its own grants without giving the importer ambient access. The useful design rule is to bind secret authority to the currently executing dependency frame and a host-computed provenance grant set, not to caller-supplied package IDs or the root run alone. Evidence is pinned source and repository tests at commit dba5cc84c02251e3078a0abbc214f2ed33901894; this review did not independently execute the tests or validate a deployment."
triggers: ["package secret authority", "dependency authority", "confused deputy", "ambient authority", "MCP portability", "secret grants", "authority stamp", "Kody"]
last_updated: "2026-09-11"
source_basis: "GitHub repository discovery and pinned source inspection of kentcdodds/kody at commit dba5cc84c02251e3078a0abbc214f2ed33901894."
</ai_context>

# Imported Agent Packages Need Call-Frame Secret Authority

**Date:** 2026-09-11  
**Repo:** https://github.com/kentcdodds/kody  
**Inspected revision:** [`dba5cc84c02251e3078a0abbc214f2ed33901894`](https://github.com/kentcdodds/kody/tree/dba5cc84c02251e3078a0abbc214f2ed33901894)

## Signal

Kody describes itself as a portable home for an assistant's memory, keys, code,
and automations across MCP hosts. Its repository exposes a less obvious security
requirement for that model: when one installed package calls another, the secret
principal must follow the **currently executing package frame**, rather than the
root package or an arbitrary package identifier supplied by caller code.

At the inspected revision, Kody's
[`secret-authority.ts`](https://github.com/kentcdodds/kody/blob/dba5cc84c02251e3078a0abbc214f2ed33901894/packages/worker/src/mcp/secrets/secret-authority.ts)
uses `AsyncLocalStorage` to carry two distinct facts:

- `currentPackageId`: the package whose code is executing now; and
- `grantedPackageIds`: package identities the host derived from the run's
  provenance.

A requested authority is honored only when it belongs to that host grant set.
An installed but empty grant set fails closed. Capability calls remove a hidden
reserved authority argument before schema parsing, while proxy construction
first deletes any caller-provided value and then attaches the runtime stamp.
Untrusted request headers are likewise accepted only if their package ID is in
the grant set.

This is a concrete defense against an intra-runtime confused-deputy failure. A
dependency can receive the secret intentionally locked to that dependency, but
an importer cannot gain the same secret merely by naming the dependency's
package ID.

## Repository test contract

The pinned
[`package-secret-authority.workers.test.ts`](https://github.com/kentcdodds/kody/blob/dba5cc84c02251e3078a0abbc214f2ed33901894/packages/worker/src/package-runtime/package-secret-authority.workers.test.ts)
encodes the boundary in one end-to-end-style worker test:

1. package A declares and reads `wakeToken`;
2. the user locks that secret to package A;
3. package B imports A and A successfully reads the secret under A's authority;
4. B's direct read of the same alias is rejected as not allowed for B;
5. B cannot bypass the check by passing A's package ID to the secret capability;
6. an unstamped top-level bundle does not receive `packageSecrets` at all.

The adjacent
[`execution-secret-redactor.ts`](https://github.com/kentcdodds/kody/blob/dba5cc84c02251e3078a0abbc214f2ed33901894/packages/worker/src/mcp/secrets/execution-secret-redactor.ts)
tracks resolved values and recursively redacts them from strings, errors,
stacks, arrays, object keys, and object values. That is complementary, not a
substitute for authorization: the authority boundary controls who can read;
redaction limits secondary disclosure after an authorized read.

## Design implication

A portable agent runtime should model package invocation as a principal change,
not just a function call. A minimum design has four separable controls:

1. **Host-derived provenance set** — compute which package identities actually
   participate in the bundled run.
2. **Call-frame stamp** — switch the active identity while dependency code runs.
3. **Unforgeable dispatch binding** — discard caller-supplied reserved identity
   fields and attach only the runtime's stamp.
4. **Sink revalidation** — the host checks that the stamp belongs to the run's
   provenance before resolving package-scoped secrets.

Scoping only to the root run is too coarse: it either prevents legitimate
dependencies from using their own credentials or shares those credentials with
the importer. Trusting a `packageId` argument is too weak because package code
can forge it. The authority must therefore be both **frame-sensitive** and
**host-validated**.

## Limits

This is implementation evidence, not a security audit. The repository was
inspected through public GitHub endpoints at one commit. The test behavior above
is what the checked-in test asserts; Scout did not execute the project test
suite, inspect production configuration, or verify resistance to every path by
which execution context might be lost. The repository's Fair Source license
also means this finding should not be read as evidence of open-source licensing
or deployment portability beyond the architecture described in its README.

## Discovery record

GitHub Search API query:
`"agent" in:name,description pushed:>=2026-09-08 stars:>100`, sorted by
`updated` descending, 30 results per page. The response reported
`incomplete_results: false`. Repository metadata was used only for discovery;
all implementation claims above are tied to the pinned revision.
