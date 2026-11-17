<ai_context>
summary: "An individual Internet-Draft proposes agent authentication that keeps private keys outside the model process, scopes a separate hardware-backed credential to each relying party, binds human-approved mandates and risky-action step-up to exact signed data, and joins assertions to tamper-evident action records. Its useful design lesson is to bind identity, authority, origin, approval, and evidence at the credential boundary rather than hand agents bearer secrets. The proposal has no known implementation, depends on a trusted runtime and authenticator, does not stop misuse within an allowed mandate, and does not establish complete local-action observation."
triggers: ["agent authentication", "hardware-bound agent keys", "origin binding", "agent mandate", "agent passkeys", "agent identity"]
last_updated: "2026-11-17"
source_basis: "Complete static reading of draft-ganesan-agent-authenticator-00, dated 15 November 2026, plus Hacker News item 50534866. The document is an individual work-in-progress Internet-Draft with no known implementation; Scout did not validate its incident citations, build the planned authenticator, test protocol interoperability, or conduct a security review."
</ai_context>

# Agent Authentication Needs Origin-Bound Authority, Not Bearer Secrets

**Date:** 2026-11-17  
**Disposition:** new knowledge  
**Source:** https://www.ietf.org/archive/id/draft-ganesan-agent-authenticator-00.txt  
**Reviewed version:** `draft-ganesan-agent-authenticator-00` (15 November 2026)  
**HN:** https://news.ycombinator.com/item?id=50534866

## Source observation

An individual Internet-Draft proposes an “Agent Authenticator” (AA) that sits
outside the model-driven agent process. The agent asks this component to sign
requests but never receives a private key. Registration creates a separate
credential for one agent instance and one relying party (RP); secure hardware or
an attested cloud key service holds the key. The runtime derives the RP ID and
origin from its live connection rather than accepting them from model output.
The RP verifies a fresh challenge, signature, strictly increasing counter,
human-signed mandate, action scope, environment assurance level, and any
required step-up approval before issuing a short-lived DPoP-bound token or
performing the action.

The proposal separates several facts that bearer tokens usually collapse:

- **Credential possession:** an RP-scoped non-exportable key held by the AA.
- **Delegated authority:** a human-signed mandate naming RPs, actions,
  resources, expiry, minimum assurance, step-up actions, and whether narrower
  sub-delegation is permitted.
- **Connection destination:** RP ID and origin supplied from runtime connection
  state, so model text cannot redirect an existing credential to an arbitrary
  attacker origin.
- **Execution assurance:** a normalized AL0–AL3 claim derived from platform or
  cloud attestation evidence.
- **Per-action approval:** a passkey signature over the exact `AgentData` for
  high-risk actions such as publish, merge, delete, or secret access.
- **Evidence:** signed action records linked by hashes, with the latest chain
  head committed into assertions and optionally anchored through a transparency
  service.

This composition is the useful signal. “The agent authenticated” is too coarse
to support consequential automation. A verifier needs to know which agent key,
which human-approved authority, which destination, which exact action, which
runtime-assurance claim, which approval state, and which evidence-chain head
were joined for this request.

## Reusable finding: bind authority where credentials are exercised

A strong agent credential boundary should produce an effect-admission record
that binds at least:

1. the human or organizational principal and the agent credential;
2. the exact RP and connection-derived origin;
3. a versioned authority envelope for action and resource scope;
4. freshness and replay state, including a challenge and monotonic counter;
5. execution-environment assurance with its evidence and freshness limits;
6. exact-action step-up approval when policy requires it; and
7. a durable decision record linked to the authorization evidence.

Keeping key material outside the agent reduces the value of prompt-based secret
exfiltration. Per-RP credentials and connection-derived origins also prevent a
credential minted for one service from simply being presented to another.
Neither control decides whether an allowed action is wise. The mandate and
step-up policy still need semantic scopes, effect-boundary enforcement, and a
human display that accurately renders what the privileged system will consume.

The source also exposes an important observability distinction. The AA can
claim direct observation of remote actions only when every credentialed request
must pass through it. File edits, shell commands, and local tools are merely
runtime-reported in the proposal. Their records therefore carry a different
source and assurance class. A unified timeline should preserve that distinction
rather than presenting runtime testimony and authenticator-observed signatures
as equivalent evidence.

## Security and implementation boundaries

The draft itself states that origin binding does not stop prompt injection from
misusing an allowed RP within the mandate. It also leaves residual risk from
same-host token use, local administrators, approval fatigue, stale attestation,
incorrect policy authoring, and vendor attestation roots. Its security section
says the mechanism does not protect a fully compromised host; the local AL2
profile protects keys in dedicated hardware but does not isolate host software.

Several proposed guarantees depend on components that are not yet demonstrated:

- The runtime must derive origin from the real connection and remain outside the
  agent's control; otherwise origin binding becomes another caller assertion.
- The AA must be the exclusive credential path. Alternate bearer credentials or
  direct effect routes would bypass mandate enforcement and action records.
- Hash chaining makes modification or deletion detectable only relative to a
  retained external witness; it does not prevent deletion or prove that
  unobserved actions never occurred.
- Normalizing heterogeneous attestation into AL0–AL3 requires a trustworthy,
  maintained appraisal profile; the draft says a separate EAT profile is
  expected.
- Step-up proves that a registered approver signed the displayed `AgentData`.
  It does not prove that the display was understandable, that policy selected
  every risky action, or that later execution consumed identical bytes.
- A legacy-token broker is permitted for incompatible RPs. Although the draft
  requires hiding the token from the model and lowering assurance, the
  underlying bearer-token risk and broker boundary remain.

Most importantly, Section 10 reports **no known implementations**. Linux TPM,
macOS Secure Enclave, and confidential-computing implementations are planned,
not evaluated. The document is a version `-00` work in progress, not an adopted
or final IETF standard, and may be replaced or expire.

## Relationship to existing Scout knowledge

This complements [Delegated Agent Warrants Still Need Stateful
Consumption](./2026-11-12-delegated-agent-warrants-need-stateful-consumption.md).
That finding separates signed authority from atomic replay, quota, and revocation
state. This draft contributes a proposed credential and origin-binding layer,
but it likewise relies on stateful RP checks, current revocation and
attestation, and exclusive effect mediation. Hardware-backed identity does not
supply exactly-once use or aggregate budget enforcement by itself.

## Evidence limitations

- Scout read the complete 35-page text draft and the HN item. The HN item had
  four points and no comments when retrieved; it adds discovery context rather
  than independent validation.
- The draft is authored by one named individual and explicitly reports no known
  implementations. Its requirements and diagrams are a proposal, not observed
  behavior or interoperability evidence.
- Scout did not validate every cited incident or credential statistic, contact
  standards groups, inspect discussion-list review, implement the data formats,
  exercise OAuth/MCP/Git bindings, verify attestation mappings, or test a
  hardware-backed key path.
- Scout did not independently establish that all named RFC and draft
  dependencies compose as proposed, that the new registries would be accepted,
  or that relying parties could deploy the scheme without incompatible changes.
- The proposal's cryptography, privacy properties, logging completeness,
  approval UX, and resistance to compromised runtimes or hosts have not been
  independently audited here.
