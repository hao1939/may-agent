<ai_context>
summary: "Implementation-evidence companion to agent-security-verified-enforcement.md. Uses pinned repositories, disclosures, and deployed-system reports to separate signed claims from replayable evidence; receipt integrity from completeness; configured policy from covered paths; identity enrollment from per-request proof; formal models from unsupported surfaces; observed egress from blocking; stable tool digests from equivalent semantics; policy verdicts from effect ownership; counterfactual actions from execution authority and real effect accounting; authorization receipts from effect gates; narrated results from positive execution evidence; sandbox isolation from configuration coherence; stop requests from observed quiescence; and frozen eval inputs from stable comparison units."
triggers: ["SkillProof", "MCP server verification", "replayable evidence", "action receipt", "signed receipt", "evidence completeness", "Pipelock", "PassControl", "sender proof", "bearer visa", "authentication assurance", "default deny", "fail closed", "shell hook", "guardrail regression test", "OpenShell prover", "SMT containment", "path composition", "egress firewall", "uninspected egress", "tool identity", "tool pin", "schema canonicalization", "shadow mode", "mediation ownership", "counterfactual action", "observed policy action", "real effect accounting", "ctrlrun", "HOL Guard", "Action Evidence Package", "AEP sandbox", "Codex sandbox", "Overpatch", "Heapjack", "authority derivation", "Meta Muse", "local configuration authority", "APEXA", "execution integrity", "tool execution evidence", "BoxLite", "micro-VM", "sandbox configuration coherence", "guest network", "host jailer grants", "Hard Stop", "SIGSTOP", "process group preemption", "quiescence receipt", "run-assert-eval", "ASSERT", "Agent Control Specification", "fixed evaluation", "applicable denominator", "paired comparison", "safety helpfulness split"]
last_updated: "2026-09-24"
source_basis: "Pinned-source implementation studies and disclosures reviewed 2026-09-10 through 2026-09-24: SkillProof f5ddb4b, Pipelock f7d1816, agent-guardrails-kit 18c241e, PassControl f9cb702, OpenShell df0ee1a, k8s-rca-agent 29f5fad, secure-agent 017ec5a, Rul1an/assay 900e536, Soup Wall be8db48, HOL Guard 56faea4 and f5d568f, ctrlrun 8ebc5a8, aep-sandbox 3495e27, BoxLite 9e9436e, Hard Stop 45c31bc, responsibleai/ASSERT 0628e25, HN items 49795755, 49802030, 49830567, 49834450, and 49834720 with their linked primary sources, plus arXiv 2609.24165v1 (abstract and full HTML). Each section states its own evidence boundary."
</ai_context>

# Agent Security: Enforcement Evidence and Runtime Coverage

**Companion note** to [Agent Security: Verified Enforcement Patterns](./agent-security-verified-enforcement.md).

The architecture catalog explains what should enforce an agent boundary. This
note asks what an implementation or receipt actually proves: whether the effect
path was covered, the mediator could withhold the effect, failures were visible,
and the claimed execution can be replayed or independently checked.

---

## A Signed Verdict Is Not a Replayable Experiment (HN, September 2026)

**Source:** https://news.ycombinator.com/item?id=49649729

**Repo:** https://github.com/roblambert9/skillproof-verifications

**Pinned observation:** repository commit
`f5ddb4b21eba888c06bea5ec40566ff4efe905b1`

HN surfaced SkillProof, a newly published adversarial-execution corpus for five
official MCP servers. Its self-reported results are concrete rather than a
scanner score: the fetch server followed a 302 redirect to a loopback canary;
the Postgres server accepted a stacked `COMMIT; INSERT` that escaped its
read-only transaction; SQLite's `write-query` accepted `VACUUM INTO` and wrote
a database copy to an arbitrary process-writable path; and the memory server
persisted relations whose endpoints did not exist. The filesystem server was
the counterexample: 174 adversarial cases across three seeds found no boundary
violation, including traversal and symlink probes.

The implementation evidence supports a useful design rule: **a capability's
label or description is not its enforcement boundary**. “Read-only query,”
“write-query for INSERT/UPDATE/DELETE,” and “relation between entities” remained
semantic claims until execution tested transaction control, the full SQL
language, and referential integrity. MCP hosts should derive authority from OS,
database, network, and schema constraints—not from the advertised tool text—and
then test those constraints with honest controls, hostile cases, and an
anti-vacuity requirement.

The corpus also exposes an attestation distinction that its README blurs. At the
pinned commit, the included Ed25519 verifiers validate the published manifests
for fetch, memory, Postgres, and SQLite. That proves those JSON payloads match
the repository's demo signing key; it does **not** independently prove that the
experiments ran. Fetch and memory include drivers and raw reports, so their
runs can be inspected and rerun. The Postgres and SQLite directories include
results, manifests, and signature verifiers but no driver, setup script, or raw
report, despite the top-level claim that each verification reruns end to end.
The filesystem directory includes a driver and report but no standalone
verification script. Therefore “4 of 5 fail” is credible self-reported evidence,
not yet a fully replayable independent replication.

**Operational evidence ladder:**

1. Tool descriptions state intended semantics.
2. Adversarial traces demonstrate one observed behavior at a pinned version.
3. Signed manifests preserve the issuer's exact claim against mutation.
4. Published drivers, fixtures, raw traces, and dependency pins make the claim
   replayable.
5. Independent reruns establish that the issuer's environment or harness did
   not create the result.

Do not collapse levels 2–5 into “verified.” A signature protects provenance and
integrity; reproducibility and independent replication establish different
properties.

## A Receipt's Validity Is a Vector, Not a Boolean (GitHub, September 2026)

**Repo:** https://github.com/luckyPipewrench/pipelock

**Pinned observation:** repository commit
`f7d1816f1a5ad63d501b0c48f36066f836f59022`

Pipelock provides a concrete implementation of an external agent-action boundary:
it mediates HTTP, WebSocket, MCP, and A2A traffic, records verdict and policy
metadata, and emits Ed25519-signed, hash-chained action receipts. The standalone
verifier's code distinguishes two materially different checks. Without a trusted
key it can check internal consistency, but marks the receipt **unpinned** and exits
non-zero unless the operator explicitly allows that weaker result. With a supplied
key, it verifies the signature against that pinned signer. Chain verification then
checks contiguous sequence numbers and predecessor hashes.

The more reusable signal is the project's explicit refusal to call this evidence
complete. Its hard-limit registry says receipts can establish byte integrity,
ordering, and signer binding for records they see, while separately naming gaps:

- a key holder can omit an action or an entire pre-anchor session;
- a compromised signing key can produce an in-domain indistinguishable record;
- a malicious recorder cannot vouch for itself;
- a disabled recorder proves nothing;
- unmediated traffic remains outside the receipt set; and
- TLS passthrough may expose only host, port, and byte counts rather than the
  inner request.

Its completeness command consequently caps the best result at `LIMITED`, not
`COMPLETE` or `PASS`. This yields a practical evidence model with independent
axes:

1. **Integrity:** are the observed bytes and chain unchanged?
2. **Attribution:** was the signer checked against a separately trusted key?
3. **Configuration:** was recording enabled under the policy being claimed?
4. **Coverage:** did every relevant action actually cross the mediated boundary?
5. **Completeness:** could a key holder or pre-anchor interval omit evidence?

A green signature check should answer only the first two axes. Claims such as
“all agent egress was governed” additionally require independently attested
containment and recorder configuration, plus an external witness or anchor where
omission matters. This complements the SkillProof evidence ladder above: a signed
claim may be authentic and untampered while still being incomplete, unmediated,
or non-replayable.

**Evidence inspected at the pinned commit:**
[`README.md`](https://github.com/luckyPipewrench/pipelock/blob/f7d1816f1a5ad63d501b0c48f36066f836f59022/README.md),
[`docs/evidence/hard-limits.md`](https://github.com/luckyPipewrench/pipelock/blob/f7d1816f1a5ad63d501b0c48f36066f836f59022/docs/evidence/hard-limits.md),
[`docs/guides/receipt-verification.md`](https://github.com/luckyPipewrench/pipelock/blob/f7d1816f1a5ad63d501b0c48f36066f836f59022/docs/guides/receipt-verification.md),
and
[`cmd/pipelock-verifier/receipt.go`](https://github.com/luckyPipewrench/pipelock/blob/f7d1816f1a5ad63d501b0c48f36066f836f59022/cmd/pipelock-verifier/receipt.go).

**Evidence boundary:** this repository inspection verifies the implementation and
documented semantics at one commit. It does not independently establish detection
accuracy, deployment coverage, or the README's broader product-performance claims.

## Default-Deny Needs a Coverage Contract, Not Just an Allow-List (HN, September 2026)

**Source:** https://news.ycombinator.com/item?id=49658005

**Repo:** https://github.com/danielhagever/agent-guardrails-kit

**Pinned observation:** repository commit
`18c241ed172595ba73d827a2df42a189915ab4ff`

HN surfaced `agent-guardrails-kit`, a new Claude Code hook implementation whose
useful signal is not merely “allow-lists beat deny-lists.” Its Bash gate defaults
to denying any command that both references a configured protected tree and uses
a verb outside a short read-only allow-list. Its separate write gate recursively
harvests every configured path key from nested tool payloads, rejects writes in
protected paths or outside the allowed tree, and denies payloads from which it
cannot read a path. Malformed configuration, malformed deny patterns, and
unparseable shell quoting also produce denial rather than an optimistic allow.

The repository records concrete bypass classes that motivated this inversion:
`cp`, `tee`, `dd`, `sed -i`, `install`, and `rsync`; nested interpreters and
subshells; variable, symlink, and `../` indirection; `find -delete`/`-exec`;
`xargs`; and clobber redirection. More importantly, these examples are encoded as
regression cases alongside benign controls such as `cat`, `grep`, and non-acting
`find`. The checked commit's suite claims 125 assertions; inspection confirms
that the suite feeds synthetic Claude Code hook payloads to the real wrappers and
asserts both allow and deny exit codes, although this source check did not execute
the author-controlled suite independently.

The reusable pattern is a **coverage contract** with four parts:

1. **Reference boundary:** define the exact tree, resource, or effect being
   protected and resolve paths against the caller's actual working directory.
2. **Payload coverage:** enumerate and test every tool and nested field capable
   of naming that resource; “hook installed” is not evidence that its input was
   understood.
3. **Decision closure:** unknown verbs, missing paths, parse failures, and broken
   policy must have an explicit fail-closed result.
4. **Counterexample retention:** every discovered bypass becomes a permanent
   hostile regression, paired with benign controls so “blocks everything” cannot
   masquerade as safety.

This also bounds the claim. The Bash default-deny rule activates only when its
parser detects a protected-tree reference; unrelated commands are allowed unless
a configured raw-string deny pattern catches them. Hooks run inside the client,
not beneath it, and cannot constrain credentials already present in the process
or tools outside that hook system. Regex and token parsing are not an OS security
boundary. Therefore this is a useful reference-monitor discipline for a declared
path set, but not a substitute for scoped credentials, filesystem permissions,
or sandbox containment.

**Design implication:** evaluate guardrails by the Cartesian product of
`tool × payload shape × path/effect encoding × parser failure mode`, then preserve
both bypasses and allowed controls in CI. An allow-list without that matrix can
still be fail-open because the guard may never recognize that the protected
effect was named.

**Evidence inspected at the pinned commit:**
[`README.md`](https://github.com/danielhagever/agent-guardrails-kit/blob/18c241ed172595ba73d827a2df42a189915ab4ff/README.md),
[`gates/bash_guard.py`](https://github.com/danielhagever/agent-guardrails-kit/blob/18c241ed172595ba73d827a2df42a189915ab4ff/gates/bash_guard.py),
[`gates/write_guard.py`](https://github.com/danielhagever/agent-guardrails-kit/blob/18c241ed172595ba73d827a2df42a189915ab4ff/gates/write_guard.py),
and
[`tests/run_tests.sh`](https://github.com/danielhagever/agent-guardrails-kit/blob/18c241ed172595ba73d827a2df42a189915ab4ff/tests/run_tests.sh).

**Evidence boundary:** this is an implementation inspection of a newly published,
zero-star repository surfaced by a one-point HN submission. It verifies that the
named fail-closed branches and regression cases exist at the pinned commit; it is
not an independent security audit, bypass-resistance measurement, or production
validation.

## Identity Proven at Mint Is Not Per-Request Possession (GitHub, September 2026)

**Repo:** https://github.com/Vertias3u/PassControl

**Pinned observation:** repository commit
`f9cb7026067b135d0ff1cbee04b2c91a54e7b5dd`

PassControl is an unusually explicit implementation of an agent credential gateway:
it keeps provider keys behind a proxy, mints short-lived work visas after an Ed25519
passport challenge, and gates requests by endpoint, model scope, live policy, budget,
suspension, and kill state. The useful signal is not the product's broad “agent
passport” framing, but the narrower distinctions its code and documentation preserve.

A passport signature proves possession when a visa is minted. In `off` mode, later
requests use that visa as a bearer credential. `observe` mode may check a request
proof, but still records authentication as ordinary `passport`; only `required`
mode rejects missing, invalid, stale, replayed, or unavailable proofs and upgrades the
call to `passport_proof_per_request`. The signed receipt mirrors that distinction: its
`auth` claim identifies a Direct Agent Key or enforced per-request proof, while the
field is absent for a bearer passport call. Observing a valid proof is deliberately not
promoted into assurance supplied to third parties.

That design yields a general receipt rule: **record the enforcement actually applied to
this request, not the strongest credential enrolled for the agent**. Agent identity,
key custody, proof at credential mint, and proof at effect time are different claims.
A verifier should interpret absent assurance fields conservatively rather than infer
per-request possession from a passport subject identifier.

The repository also makes current-state enforcement posture visible:

- passport expiry and rotation grace are checked at mint, not on every issued visa;
- passport scopes are visa snapshots and may lag edits for the 5–15 minute visa TTL;
- blocking an already issued visa depends on Redis-backed suspension/kill state;
- kill-state reads default to fail-open unless `KILL_SWITCH_FAIL_CLOSED=true` is set;
  required sender-proof replay checks and Direct Agent Key validation fail closed; and
- sender proof binds method, gateway origin/path, timestamp, nonce, and visa hash, but
  not the body or query, and does not attest hardware-backed key custody.

Consequently, a receipt should carry both an **authentication-strength claim** and the
**effective policy/state revision** evaluated for that call. Even then, it remains an
issuer record rather than independent truth. PassControl's receipt implementation says
its digest covers client request bytes, not the gateway-mutated request or response;
logging and signing are best-effort; absence of a receipt proves nothing; and signed
costs do not establish provider invoices. This extends the receipt vector above:
integrity, signer attribution, coverage, and completeness still do not answer whether
this specific call used bearer authentication or fresh proof of possession.

**Evidence inspected at the pinned commit:**
[`README.md`](https://github.com/Vertias3u/PassControl/blob/f9cb7026067b135d0ff1cbee04b2c91a54e7b5dd/README.md),
[`SECURITY.md`](https://github.com/Vertias3u/PassControl/blob/f9cb7026067b135d0ff1cbee04b2c91a54e7b5dd/SECURITY.md),
[`lib/receipt.ts`](https://github.com/Vertias3u/PassControl/blob/f9cb7026067b135d0ff1cbee04b2c91a54e7b5dd/lib/receipt.ts), and the
[data-plane proxy route](https://github.com/Vertias3u/PassControl/blob/f9cb7026067b135d0ff1cbee04b2c91a54e7b5dd/app/api/v1/%5Bprovider%5D/%5B...path%5D/route.ts).

**Evidence boundary:** this source inspection confirms the declared branches and
receipt construction in one pinned revision. It did not run the repository's tests,
perform an independent security audit, deploy Redis/Supabase, or demonstrate that a
real deployment mediates all relevant provider traffic.

## A Formal Policy Proof Is Only as Broad as Its Action Model (HN, September 2026)

**Source:** https://news.ycombinator.com/item?id=49713261

**Primary note:** https://nvidia.github.io/OpenShell-Research/dev-notes/posts/2026-09-10-learning-formal-methods-agent-policy-prover/

**Repo:** https://github.com/NVIDIA/OpenShell

**Pinned observation:** `spike/maximal-policy-prover-subset` commit
`df0ee1aaaf6af7ee6193b785fd189449a3848fe0`

OpenShell reports a concrete capability-composition failure: a policy blocked an
agent's attempted repository write through inspected REST traffic, but the agent
then used the same GitHub credential with `git-remote-https`, an allowed binary
whose wire protocol bypassed the layer-7 rule. The important unit of review was
therefore not a host, credential, binary, or API rule in isolation. It was their
composition: `credential × binary × endpoint × protocol layer × method × path`.

The inspected prover branch turns one part of that review into a satisfiability
query. For a candidate policy and a pre-approved maximum it asks whether there
exists an action such that:

```text
candidate_allows(action) AND NOT maximum_allows(action)
```

`Unsat` yields `WithinMax`; `sat` yields `ExceedsMax` plus a concrete symbolic
action; and solver uncertainty or an unsupported policy surface yields
`Unsupported`. Raw L4 is deliberately broader than REST or WebSocket at the same
binary, host, and port, so a REST maximum does not silently authorize an
uninspectable wire-protocol path. Separate queries flag link-local reach,
credentialed L7 bypass, newly credentialed endpoint reach, and new HTTP methods.
This is materially stronger review evidence than asking another model to notice
all interacting permission fields: the counterexample is deterministic for the
encoded policy semantics and does not consume reviewer tokens.

The reusable pattern is **counterexample-bearing permission review**:

1. keep a human-approved capability ceiling distinct from the current policy;
2. encode the whole enforcement-relevant action tuple, not a flat permission list;
3. ask for an action in the candidate-minus-maximum set;
4. return the witness when that set is non-empty; and
5. route `unknown` and unmodeled syntax to review rather than interpreting them as
   approval.

The fifth step is essential because the proof is model-relative. This spike
models L4, REST, and WebSocket allow surfaces plus a supported glob subset, but
explicitly does not yet model deny-rule precedence, query constraints, GraphQL,
MCP controls, endpoint path scoping, credential rewrite flags, or CIDR-only
`allowed_ips`. Its credential input records host-coarse presence rather than
fine-grained credential scope; it analyzes policy, not the proxy's actual runtime
decisions; and it reasons per sandbox rather than proving cross-sandbox intent.
The repository documentation also calls maximum-policy containment “spike work,”
even though the four narrower risk queries are described as gateway auto-approval
gates. A green result must therefore name the model revision and supported
surface, not claim that the whole agent is safe.

**Evidence inspected at the pinned commit:**
[`crates/openshell-prover/README.md`](https://github.com/NVIDIA/OpenShell/blob/df0ee1aaaf6af7ee6193b785fd189449a3848fe0/crates/openshell-prover/README.md),
[`MAXIMUM_POLICY_ENVELOPE_SPIKE.md`](https://github.com/NVIDIA/OpenShell/blob/df0ee1aaaf6af7ee6193b785fd189449a3848fe0/crates/openshell-prover/MAXIMUM_POLICY_ENVELOPE_SPIKE.md), and
[`src/envelope.rs`](https://github.com/NVIDIA/OpenShell/blob/df0ee1aaaf6af7ee6193b785fd189449a3848fe0/crates/openshell-prover/src/envelope.rs).

**Evidence boundary:** the official research note supplies the reported bypass
story; this run did not independently reproduce that incident. Repository
inspection confirms the query shape, fail-closed branches, counterexample path,
listed unsupported surfaces, and in-tree test cases at one spike commit. The
local environment had no `cargo` binary, so the tests were not executed here;
this is not a deployment audit or evidence that every OpenShell effect crosses
the modeled enforcement boundary.

## “Defense in Depth” Needs Path-Composition Evidence (GitHub, September 2026)

**Repo:** https://github.com/SinaSnyder/k8s-rca-agent

**Pinned observation:** repository commit
`29f5fad33df4bba0c3e04c0747ba0265f96b53dc`

This Kubernetes RCA prototype usefully separates several safety mechanisms: a
namespaced Role grants only `get`, `list`, and `watch`; a pre-tool hook scans tool
arguments for six mutation words; a post-tool hook redacts a small family of
secret-like assignments; and instructions tell the agent to remain in `test-ns`.
But listing these controls does not establish that one request traverses all of
them. The MCP configuration launches its Kubernetes server with the generic
`~/.kube/config`; the repository does not supply runtime evidence that this
credential is the declared `rca-agent` ServiceAccount. Likewise, the inspected
tree contains the hook scripts but no test or deployment receipt proving that
every MCP or shell action passes through them.

The layers also have different failure semantics. `pre_tool_use.py` ignores the
tool name, lowercases serialized arguments, allows on every exception, and uses
substring matching. Executing the pinned script locally on synthetic payloads
allowed `kubectl label pod ...` (a mutation outside its six words), allowed
malformed JSON, and blocked a read of a pod named `delete-worker`. This is both a
false-negative and false-positive demonstration of the parser—not a cluster
exploit. The Role would still reject the mutation **if** the process actually
uses the bound ServiceAccount. The post-tool regex successfully redacted direct
`token=...` and `password: ...` examples, but that does not prove coverage for
all sensitive structures or channels.

The reusable lesson is to verify **path composition**, not count layers. For each
agent effect, retain evidence for:

1. the runtime identity and authorization decision at the resource boundary;
2. the exact tool adapter and payload shape seen by each hook;
3. fail-closed behavior for malformed, unknown, and bypass-shaped inputs;
4. the output channels and data shapes covered by redaction; and
5. an end-to-end test showing the same request crossed those controls in order.

A weak client hook can still be useful for early feedback when a lower,
credential-enforced boundary is proven. Without runtime identity and mediation
receipts, however, RBAC manifests plus hook source are separate candidate
controls—not evidence of cumulative defense in depth.

**Evidence inspected at the pinned commit:**
[`README.md`](https://github.com/SinaSnyder/k8s-rca-agent/blob/29f5fad33df4bba0c3e04c0747ba0265f96b53dc/README.md),
[`mcp-config.json`](https://github.com/SinaSnyder/k8s-rca-agent/blob/29f5fad33df4bba0c3e04c0747ba0265f96b53dc/mcp-config.json),
[`rbac/role.yaml`](https://github.com/SinaSnyder/k8s-rca-agent/blob/29f5fad33df4bba0c3e04c0747ba0265f96b53dc/rbac/role.yaml),
[`rbac/role-binding.yaml`](https://github.com/SinaSnyder/k8s-rca-agent/blob/29f5fad33df4bba0c3e04c0747ba0265f96b53dc/rbac/role-binding.yaml),
[`hooks/pre_tool_use.py`](https://github.com/SinaSnyder/k8s-rca-agent/blob/29f5fad33df4bba0c3e04c0747ba0265f96b53dc/hooks/pre_tool_use.py), and
[`hooks/post_tool_use.py`](https://github.com/SinaSnyder/k8s-rca-agent/blob/29f5fad33df4bba0c3e04c0747ba0265f96b53dc/hooks/post_tool_use.py).

**Evidence boundary:** this inspection and synthetic local execution verify the
pinned source's behavior for the named payloads. They do not deploy the agent,
exercise a Kubernetes cluster, prove which credential a real installation uses,
or establish exploitability against OpenCode or either MCP server.

## Egress Assurance Needs Observed, Blocked, and Uninspected States (GitHub, September 2026)

**Repo:** https://github.com/cavi-ai/secure-agent

**Pinned observation:** repository commit
`017ec5a7e0507e8b82910e02106b2249bfd50e2b`

Secure-agent supplies a useful implementation signal because its documentation
and code resist collapsing an egress detector into a containment claim. Its
opt-in local HTTP/HTTPS proxy inspects request headers, query strings, and the
first 1 MiB of request bodies. A policy layer distinguishes a credential in the
expected authorization header to a configured vendor host from the same token in
a body, query, other header, or foreign-host request. Typed regexes and
per-install HMAC fingerprints provide the stronger signals; entropy matches are
always suspect and never blocking. Redirect following is disabled so a
host-scoped decision cannot be bypassed by the proxy itself fetching another
host.

The important control semantics are explicit:

- every rule starts in `monitor`, where a classified leak increments
  `would_block` and the request proceeds;
- only a rule promoted to `block` produces an HTTP 403;
- TLS-pinned and non-proxied connections remain outside payload inspection;
- inspection errors, timeouts, undecodable payloads, novel unregistered secrets,
  and bytes beyond the bounded prefix are not fail-closed coverage; and
- the threat model targets accidental and low-effort leakage, not a malicious
  agent that encrypts, steganographically encodes, or routes around the proxy.

This yields a reusable assurance model for agent egress. Status should report at
least **observed would-block**, **enforced block**, and **uninspected egress** as
separate states, plus the payload window and detector version. “No detected
leak” is not “no leak,” and “a blocking mode exists” is not evidence that it was
enabled for the matching rule. A fourth state—**inspection failure allowed**—is
also useful when the mediator deliberately prioritizes agent availability.
Coverage telemetry does not make a fail-open path safe, but it prevents an
unknown path from being laundered into a clean security result. This is the
application-payload analogue of [Containarium's activation and protocol-coverage
finding](./findings/2026-09-10-opt-in-egress-enforcement.md): one asks whether the
network policy was attached and covered the address family; the other asks
whether the flow traversed inspection, the relevant bytes were visible, and the
matching detector was armed to block.

This pattern complements path-composition evidence above: a deployment can only
claim governed egress when it proves that the relevant process was routed
through the proxy, the payload region was inspected successfully, a matching
rule was actually in blocking mode, and no alternate network path remained.
Secure-agent itself does not make that broad claim; its README records bypassing
endpoints in a rolling `uninspected_egress` view and its threat model names the
fail-open boundary.

**Evidence inspected at the pinned commit:**
[`README.md`](https://github.com/cavi-ai/secure-agent/blob/017ec5a7e0507e8b82910e02106b2249bfd50e2b/README.md),
[`docs/ARCHITECTURE.md`](https://github.com/cavi-ai/secure-agent/blob/017ec5a7e0507e8b82910e02106b2249bfd50e2b/docs/ARCHITECTURE.md),
[`docs/FIREWALL_THREAT_MODEL.md`](https://github.com/cavi-ai/secure-agent/blob/017ec5a7e0507e8b82910e02106b2249bfd50e2b/docs/FIREWALL_THREAT_MODEL.md),
[`engine.go`](https://github.com/cavi-ai/secure-agent/blob/017ec5a7e0507e8b82910e02106b2249bfd50e2b/daemon/internal/firewall/engine.go),
[`policy.go`](https://github.com/cavi-ai/secure-agent/blob/017ec5a7e0507e8b82910e02106b2249bfd50e2b/daemon/internal/firewall/policy.go),
[`engine_test.go`](https://github.com/cavi-ai/secure-agent/blob/017ec5a7e0507e8b82910e02106b2249bfd50e2b/daemon/internal/firewall/engine_test.go), and
[`proxy.go`](https://github.com/cavi-ai/secure-agent/blob/017ec5a7e0507e8b82910e02106b2249bfd50e2b/daemon/internal/proxy/proxy.go).

**Evidence boundary:** this is static inspection of one pinned repository
revision. The run did not execute its tests, install the CA, route a real agent,
measure detector precision/recall, exercise encoded-payload normalization, or
independently audit bypass resistance. In-tree tests confirm that source cases
exist for vendor-auth allowance, monitor-mode `would_block`, and promoted-rule
blocking; they are not reproduced benchmark results or production evidence.

## Tool Pins Must Bind the Enforcer's Semantics, Not Just a Stable Digest (GitHub, September 2026)

**Repo:** https://github.com/Rul1an/assay

**Pinned observation:** repository commit
[`900e53648ed80cb93d6eb4e574f0139889804c95`](https://github.com/Rul1an/assay/commit/900e53648ed80cb93d6eb4e574f0139889804c95)

Assay's MCP proxy implements a useful two-part tool-identity control. On a
`tools/list` response it derives an identity from server ID, tool name, input
schema, and description, then caches that identity for later `tools/call`
policy evaluation. A configured pin and a different observed identity produce
`E_TOOL_DRIFT`. The current revision also tests that the proxy-added
`tool_identity` object has exactly four leaves—`server_id`, `tool_name`,
`schema_hash`, and `meta_hash`—and carries no added certification or partner
status. This structural allow-set is stronger than scanning output strings:
status-like words supplied by the upstream tool remain upstream data, while the
proxy is prevented from adding an unsupported status assertion of its own.

The same source makes two enforcement boundaries visible:

1. **Canonical equality is not necessarily policy equality.** The schema digest
   uses RFC 8785/JCS. JCS renders numbers through the ECMAScript double model,
   so distinct integers above `2^53`, such as `9007199254740993` and
   `9007199254740992`, can have the same schema hash. Assay's own test shows that
   its `jsonschema` enforcement path still distinguishes those values for
   `maximum`, `exclusiveMaximum`, `minimum`, `exclusiveMinimum`, `const`, and
   `enum`. Thus two schemas can share the pinned identity while admitting
   different calls. Canonicalization removes irrelevant serialization drift only
   when its equivalence relation matches the downstream interpreter's.
2. **Absent observation is not drift in the current decision helper.** Tool
   identities enter the cache only after a parseable `tools/list` response. The
   client-to-server path can then look up no identity—for example before that
   discovery exchange—and `tool_drift_decision` returns no pin decision when the
   runtime identity is absent. The optional evidence carrier records
   `identity_state: absent`, but that carrier is explicitly non-blocking. Other
   policy rules may still deny the call; the configured identity pin itself does
   not establish fail-closed coverage for this state.

The reusable requirement is therefore a three-part contract: define the exact
fields and canonicalization included in identity, prove that identity equality
implies equivalent enforcement for the downstream validator, and make every
missing, invalid, or stale identity state an explicit policy outcome. A stable
hash is useful evidence, but it is not an authority boundary unless its semantic
model and its observation lifecycle match the decision path.

**Evidence inspected at the pinned commit:**
[`tools.rs`](https://github.com/Rul1an/assay/blob/900e53648ed80cb93d6eb4e574f0139889804c95/crates/assay-core/src/mcp/proxy/tools.rs),
[`identity.rs`](https://github.com/Rul1an/assay/blob/900e53648ed80cb93d6eb4e574f0139889804c95/crates/assay-core/src/mcp/identity.rs),
[`server.rs`](https://github.com/Rul1an/assay/blob/900e53648ed80cb93d6eb4e574f0139889804c95/crates/assay-core/src/mcp/proxy/server.rs),
[`client.rs`](https://github.com/Rul1an/assay/blob/900e53648ed80cb93d6eb4e574f0139889804c95/crates/assay-core/src/mcp/proxy/client.rs),
[`fail_closed.rs`](https://github.com/Rul1an/assay/blob/900e53648ed80cb93d6eb4e574f0139889804c95/crates/assay-core/src/mcp/policy/engine_next/fail_closed.rs), and
[`ADR-043`](https://github.com/Rul1an/assay/blob/900e53648ed80cb93d6eb4e574f0139889804c95/docs/architecture/ADR-043-evidence-chain-integrity-invariants.md).

**Evidence boundary:** Scout statically inspected the pinned source and its
in-tree tests but did not clone the repository, run the Rust tests, operate the
proxy against a live MCP server, or test whether other policy rules mask the
missing-identity path in a particular deployment. The numeric collision and
validator disagreement are assertions encoded by the repository's tests, not an
independent reproduction in this run.

## A Policy Verdict Is Counterfactual Until the Mediator Owns the Effect (GitHub, September 2026)

**Repo:** https://github.com/MakazhanAlpamys/soup-wall

**Pinned observation:** repository commit
[`be8db48966f3afeea86767f256060b709a45e2f8`](https://github.com/MakazhanAlpamys/soup-wall/commit/be8db48966f3afeea86767f256060b709a45e2f8)

Soup Wall makes an unusually clear distinction between computing a security
verdict and controlling an effect. Its default shadow mode records what policy
*would* have decided while returning no blocking decision. The supplied replay
command requires at least 500 events across 20 sessions before recommending a
mode change, and it sends any observed `ask` or `deny` to human review rather
than guessing whether the interruption was an attack or a false positive. Those
thresholds are explicitly engineering judgment, not statistical validation;
more importantly, the replay module summarizes previously recorded verdicts and
does not re-evaluate events against a changed policy.

After promotion, enforcement strength still depends on the integration path:

- The Claude Code HTTP hook is advisory. Oversized, malformed, unknown, and
  internally failed inputs return an empty success response, and an unavailable
  daemon is handled by the host as no opinion. Even in enforce mode this path is
  deliberately fail-open.
- The MCP stdio proxy can replace a rejected `tools/list` result with an error,
  but only while the daemon responds with enforce mode enabled. An unavailable
  or unparsable daemon becomes `Unavailable`, which passes the manifest through.
- The guarded shell, file, and fetch adapters are stronger because they own
  process creation or the mutation. They reject every non-`Allow` verdict before
  acting, confine file operations to the workspace, and require an egress
  allowlist (plus a proxy when using network allowlists).

The reusable assurance tuple is therefore:

`{policy verdict, rollout mode, mediator owns effect, mediator available, input/path covered}`

A deny in an audit log proves only the first element. A preflight that reports
`enforce: true` proves the configured mode and liveness at that instant, not that
all later effects traverse an effect-owning mediator. Conversely, shadow-mode
traffic can support usability review without supplying attack coverage: a clean
window means no recorded interruption, not that the policy detects novel
attacks. Deployment reports should keep **would deny**, **did deny**, **allowed
on inspection failure**, and **unmediated** as separate outcomes.

This sharpens the prior egress and path-composition findings: promotion evidence
can justify turning a control on, but enforcement evidence must come from the
exact execution path that owns or can withhold the consequence.

**Evidence inspected at the pinned commit:**
[`README.md`](https://github.com/MakazhanAlpamys/soup-wall/blob/be8db48966f3afeea86767f256060b709a45e2f8/README.md),
[`replay.rs`](https://github.com/MakazhanAlpamys/soup-wall/blob/be8db48966f3afeea86767f256060b709a45e2f8/crates/agentfw/src/replay.rs),
[`handlers.rs`](https://github.com/MakazhanAlpamys/soup-wall/blob/be8db48966f3afeea86767f256060b709a45e2f8/crates/agentfw/src/handlers.rs),
[`mcp/proxy.rs`](https://github.com/MakazhanAlpamys/soup-wall/blob/be8db48966f3afeea86767f256060b709a45e2f8/crates/agentfw/src/mcp/proxy.rs),
[`sandbox.rs`](https://github.com/MakazhanAlpamys/soup-wall/blob/be8db48966f3afeea86767f256060b709a45e2f8/crates/agentfw/src/sandbox.rs), and
[the successful pinned CI run](https://github.com/MakazhanAlpamys/soup-wall/actions/runs/34464016736).

**Evidence boundary:** Scout inspected the pinned source, repository-authored
tests, and a successful GitHub Actions run whose checked-in workflow executes
format, clippy, locked workspace tests, and all-feature tests. The local runtime
had no `cargo` executable, so Scout did not independently run the tests, start
the daemon, connect Claude Code or an MCP server, or exercise guarded execution.
The repository's hand-authored agent corpus is not a held-out security
benchmark, and this observation does not establish production bypass resistance.

### Follow-up: preserve counterfactual policy without granting it execution authority (HOL Guard, September 2026)

**Repo:** https://github.com/hashgraph-online/hol-guard

**Pinned observation:** repository commit
[`56faea4878649668b84f83c351d112cc279954ac`](https://github.com/hashgraph-online/hol-guard/commit/56faea4878649668b84f83c351d112cc279954ac)

HOL Guard's current source adds a useful receipt-level refinement to the same
boundary: a decision record can preserve what policy *would* have done without
letting that counterfactual become authority. In its observe-mode regression,
a sensitive source read returns `decision="allow"`, `policy_action="allow"`, and
`model_output_action="allow_original"`, while separately recording
`observed_policy_action="block"`. Metrics receive the observed block, but the
harness receives the executable allow. This avoids both losing detector signal
and falsely reporting an effect as denied.

The decision-boundary implementation makes the distinction structural rather
than a naming convention. `observed_policy_action` is accepted as watch-only
evidence and may differ from the final receipt decision. By contrast, action
fields that can affect execution are normalized and cross-checked across the
policy value, decision object, and action envelope. Unknown or contradictory
authority is rejected or tightened to `require-reapproval`; hidden action fields
are a tested contradiction. For a resolved approval, the exact final
`allow`/`block` resolution is the only approval authority carried into a new
receipt, while the original review envelope remains historical context.

This suggests a safer event schema for shadow evaluation and approvals:

1. keep **evaluated action**, **returned host action**, and **effect-owning
   authority** in separate fields;
2. define which field a metric counts, rather than inferring enforcement from
   the most restrictive value in a record;
3. cross-check every authority-bearing projection and fail closed on
   contradictions; and
4. retire pre-resolution authority after an approval settles, retaining it only
   as lineage.

HOL Guard also documents harness ownership grades—Guard-owned enforcement,
host-decided enforcement, observe-only degraded, and unsupported—and explicitly
warns that an approval-center route does not itself imply execution ownership.
That is the deployment counterpart of the receipt split: the same policy output
has different assurance depending on who can actually withhold the effect.

**Evidence inspected at the pinned commit:**
[`README.md`](https://github.com/hashgraph-online/hol-guard/blob/56faea4878649668b84f83c351d112cc279954ac/README.md),
[`decision_boundaries.py`](https://github.com/hashgraph-online/hol-guard/blob/56faea4878649668b84f83c351d112cc279954ac/src/codex_plugin_scanner/guard/decision_boundaries.py),
[`test_hook_review_observe_mode.py`](https://github.com/hashgraph-online/hol-guard/blob/56faea4878649668b84f83c351d112cc279954ac/tests/test_hook_review_observe_mode.py),
[`test_guard_decision_boundary_modules.py`](https://github.com/hashgraph-online/hol-guard/blob/56faea4878649668b84f83c351d112cc279954ac/tests/test_guard_decision_boundary_modules.py), and
[`release-3-0-harness-grades.md`](https://github.com/hashgraph-online/hol-guard/blob/56faea4878649668b84f83c351d112cc279954ac/docs/guard/release-3-0-harness-grades.md).

**Evidence boundary:** Scout read source, tests, and repository-authored design
documents but did not install HOL Guard, run its test suite, or exercise a live
harness. The ownership-grade document identifies itself as a release baseline,
and current harness documentation contains more detailed, evolving adapter
claims; the matrix is therefore evidence of an explicit classification model,
not an independently verified current guarantee for every named host.

### Follow-up: shadow authority and real effect state need different write rules (ctrlrun, HN, September 2026)

**Source:** https://news.ycombinator.com/item?id=49834720

**Repo:** https://github.com/CTRLRun/ctrlrun

**Pinned observation:** repository commit
[`8ebc5a8efb9fc308f619805e40937f98e503b697`](https://github.com/CTRLRun/ctrlrun/commit/8ebc5a8efb9fc308f619805e40937f98e503b697)

ctrlrun's observe mode adds a state-transition refinement to the counterfactual
receipt model above: shadow policy authority is fictional, but the effect that
runs under it is real. An action that policy would deny or send for approval is
still executed in observe mode. The receipt therefore keeps the counterfactual
block reason separate from the observed execution outcome, while the state
store still reserves the effect key and records whether that real execution
committed, failed before acting, or became ambiguous.

The write asymmetry matters. Observe mode does not create a human approval
request, and when a caller presents an existing single-use approval it checks
rather than consumes the grant: a counterfactual verdict did not authorize the
execution, so spending the grant would invent an authority transition. Yet the
same path does reserve and settle the effect key because an external action did
happen. The repository's tests preserve the resulting handoff: after changing
the same store from observe to enforce, a committed effect from the observation
period is refused as a duplicate. Observe mode also does not overwrite another
attempt's existing reservation or resolve an ambiguous effect merely to keep
executing.

This yields two independent shadow-mode write questions:

1. **Which authority transitions were only simulated?** Do not consume an
   approval, create an approval request, or claim a deny was enforced.
2. **Which world transitions actually occurred?** Persist operation identity,
   attempt ownership, outcome, and ambiguity even when policy decisions were
   counterfactual.

A shadow implementation that suppresses all writes can preserve the first rule
while violating the second: promotion to enforcement then forgets effects that
already happened and may repeat them. Conversely, a shadow path that consumes
approval state turns a measurement into a real authorization side effect. Mode
names such as `observe` or `audit` are therefore insufficient; the contract
should enumerate writes separately for policy authority, effect identity,
outcome, and evidence.

**Evidence inspected at the pinned commit:**
[`README.md`](https://github.com/CTRLRun/ctrlrun/blob/8ebc5a8efb9fc308f619805e40937f98e503b697/README.md),
[`control.py`](https://github.com/CTRLRun/ctrlrun/blob/8ebc5a8efb9fc308f619805e40937f98e503b697/src/ctrlrun/control.py),
[`test_observe.py`](https://github.com/CTRLRun/ctrlrun/blob/8ebc5a8efb9fc308f619805e40937f98e503b697/tests/test_observe.py), and
[the successful pinned CI run](https://github.com/CTRLRun/ctrlrun/actions/runs/35530467048).

**Evidence boundary:** Scout statically inspected the pinned implementation and
repository-authored tests but did not install the package, run the suite, connect
a live provider, or independently verify the README's production-use claim. The
CI jobs establish that the project's own checks passed for this revision, not
that every adapter mediates all effects or that a remote provider honors the
library's operation identity.

### Follow-up: declared support and observed compatibility need separate evidence

**Pinned observation:** repository commit
[`f5d568f9c60d03cf26ec8ace7ed9aa8686af7ca7`](https://github.com/hashgraph-online/hol-guard/commit/f5d568f9c60d03cf26ec8ace7ed9aa8686af7ca7)

HOL Guard's new per-event capability report turns the earlier ownership grades
into a stricter evidence contract. A row declares one exact harness event,
transport, mode, host/version scope, OS/architecture, error behavior, and known
blind spots, while deployment health and evidence level remain separate. The
default is `unverified` plus `not_run`; an unknown host becomes an explicit
unsupported row rather than inheriting a generic adapter claim, and a synthetic
canary is never promoted into live enforcement evidence.

The validator will label a deployment `healthy` only when the evidence is a
non-stale `live_block` for the same build, host/version scope, and OS/architecture;
the row must describe a real blocking boundary, include both denied and allowed
witnesses, and mark compatibility verified. Future-dated and expired evidence is
rejected. This makes compatibility a time-bounded conjunction instead of a static
support badge:

`declared event boundary × exact deployment scope × negative witness × positive witness × freshness`

The positive witness matters because a system that merely blocks every call can
produce a convincing denied example without being compatible. Exact build and
host matching matter because a live result from one adapter version cannot safely
upgrade a changed installation. The report's current checked-in Cline rows remain
conservatively `unverified`/`not_run`, so the schema demonstrates the admission
rule without claiming that those deployments have passed it.

The same revision illustrates why event granularity matters. Native Cline
`PostToolUse` is documented as observation-only, while the AgentPlugin path may
replace or withhold output before model delivery. On that plugin path, an
`allow_original` result is honored only when Guard's reviewed SHA-256 matches the
exact output; missing, ambiguous, unavailable, or mismatched review is withheld.
Even that source-level behavior is not called compatible until live proof shows
both pre-tool suppression and model-visible post-tool replacement, plus plugin
load and file-integrity evidence.

**Reusable rule:** publish support as per-event rows, not a product-level checkmark,
and let current deployment evidence upgrade only the exact row it exercised.
Keep source capability, installed health, synthetic contract checks, and live
allow/deny behavior as distinct claims.

**Evidence inspected at the pinned commit:**
[`harness-support.md`](https://github.com/hashgraph-online/hol-guard/blob/f5d568f9c60d03cf26ec8ace7ed9aa8686af7ca7/docs/guard/harness-support.md),
[`harness-capability-report.v1.schema.json`](https://github.com/hashgraph-online/hol-guard/blob/f5d568f9c60d03cf26ec8ace7ed9aa8686af7ca7/docs/guard/schemas/harness-capability-report.v1.schema.json),
[`capability_report.py`](https://github.com/hashgraph-online/hol-guard/blob/f5d568f9c60d03cf26ec8ace7ed9aa8686af7ca7/src/codex_plugin_scanner/guard/adapters/capability_report.py),
[`cline-local-protection-contract.md`](https://github.com/hashgraph-online/hol-guard/blob/f5d568f9c60d03cf26ec8ace7ed9aa8686af7ca7/docs/guard/cline-local-protection-contract.md),
[`cline_plugin.py`](https://github.com/hashgraph-online/hol-guard/blob/f5d568f9c60d03cf26ec8ace7ed9aa8686af7ca7/src/codex_plugin_scanner/guard/adapters/cline_plugin.py), and
[`test_harness_capability_report.py`](https://github.com/hashgraph-online/hol-guard/blob/f5d568f9c60d03cf26ec8ace7ed9aa8686af7ca7/tests/test_harness_capability_report.py).

**Evidence boundary:** Scout statically inspected the pinned source,
documentation, schemas, and repository-authored tests but did not install HOL
Guard, run its tests, or exercise Cline. The report and tests establish an
inspectable evidence-admission design, not that any current deployment is
healthy or that all harness events traverse the declared boundary.

## An Authorization Receipt Is Not an Effect Gate (GitHub, September 2026)

**Repo:** https://github.com/tyche-institute/aep-sandbox

**Pinned observation:** repository commit
[`3495e279e2cda5a32ed6184a87c67465a4355b80`](https://github.com/tyche-institute/aep-sandbox/commit/3495e279e2cda5a32ed6184a87c67465a4355b80)

AEP Sandbox turns several often-collapsed receipt claims into an adversarial
ladder. Its unsigned ledger can detect an edited field or reordered receipt, but
a writer can recompute the whole chain. The governed package adds an Ed25519
agent signature and embeds an issuer-signed credential plus a principal-signed,
agent-bound mandate. Verification then checks structure, content hash, agent
signature, claimed action/outcome digests, mandate chain, action scope, expiry,
and replay state in a fixed fail-fast order. A valid agent signature therefore
does not authorize its action by itself: a correctly signed refund above the
mandate's cap returns `DENY:scope_violation`.

The implementation also makes the assurance boundary unusually inspectable:

- action and outcome measurements are self-consistency checks over fields already
  signed by the agent; they do not establish that the reported real-world effect
  occurred;
- replay rejection depends on a supplied consumed-nonce set, and the CLI records
  it only with `--consume`; ordinary verification does not consume the nonce;
- the demo's consumed-nonce store is a local append-only text file, not a claim
  of atomic, distributed exactly-once admission;
- mandate revocation before expiry is deliberately absent; and
- the verifier appraises an evidence package and returns an exit code. Nothing in
  this repository proves that a consequential effect waits for that verdict.

The reusable rule is to report five claims separately:

`{receipt integrity, signer identity, action-in-mandate, effect ground truth, mediator ownership}`

A package can strongly establish the first three while leaving the final two to
another system. To turn this appraisal primitive into enforcement, a deployment
must put an effect-owning mediator before the consequence, make nonce consumption
atomic with admission, define revocation/freshness behavior, and bind observed
outcomes to an independent measurement root. This extends the receipt-validity
vector and Soup Wall findings above: cryptographic authorization evidence is
valuable, but post-action `DENY` is accountability unless the verifier can still
withhold the effect.

**Evidence inspected at the pinned commit:**
[`README.md`](https://github.com/tyche-institute/aep-sandbox/blob/3495e279e2cda5a32ed6184a87c67465a4355b80/README.md),
[`aep/mandate.py`](https://github.com/tyche-institute/aep-sandbox/blob/3495e279e2cda5a32ed6184a87c67465a4355b80/aep/mandate.py),
[`aep/package.py`](https://github.com/tyche-institute/aep-sandbox/blob/3495e279e2cda5a32ed6184a87c67465a4355b80/aep/package.py),
[`verify.py`](https://github.com/tyche-institute/aep-sandbox/blob/3495e279e2cda5a32ed6184a87c67465a4355b80/verify.py),
[`attacks/README.md`](https://github.com/tyche-institute/aep-sandbox/blob/3495e279e2cda5a32ed6184a87c67465a4355b80/attacks/README.md),
[`attacks/replay.py`](https://github.com/tyche-institute/aep-sandbox/blob/3495e279e2cda5a32ed6184a87c67465a4355b80/attacks/replay.py),
[`THREAT-MODEL.md`](https://github.com/tyche-institute/aep-sandbox/blob/3495e279e2cda5a32ed6184a87c67465a4355b80/THREAT-MODEL.md), and the
[frozen verifier specification](https://github.com/tyche-institute/aep-sandbox/blob/3495e279e2cda5a32ed6184a87c67465a4355b80/interlab/spec/VERIFIER-SPEC-v1.md).

**Evidence boundary:** Scout statically inspected the complete pinned Git tree
and the listed source files through GitHub's public read-only endpoints. It did
not clone the repository, execute the attacks or tests, validate key custody,
operate a multi-verifier nonce store, or independently test production EATF or
hardware attestation. The repository had no stars at observation time; this is a
small reference artifact and adversarial design signal, not adoption or
production-security evidence.

## The Enforcer Cannot Safely Derive Authority from the Enforced Domain (HN, September 2026)

**Source:** https://news.ycombinator.com/item?id=49795755

**Primary disclosure:** https://accomplish.ai/blog/escaping-the-openai-codex-sandbox-twice/

Accomplish AI reports two Codex sandbox escapes disclosed to OpenAI on August
12, 2026 and fixed within eight days. The first, **Overpatch**, allegedly abused
how `apply_patch` derived temporary filesystem permissions: adding an otherwise
failing `/tmp` operation caused the patch path logic to grant access to `/`,
while another patch entry followed a symlink to append to `$HOME/.zshrc`. The
second, **Heapjack**, targeted a native `node_repl` parent and a sandboxed Node
child. Trusted and untrusted JavaScript contexts shared one V8 isolate and heap;
untrusted code reportedly extracted the UUID-shaped authorization token with
`v8.getHeapSnapshot()`, wrote a forged JSON request to their shared stdout pipe,
and induced the unsandboxed parent to open an application or reach a Unix socket
while Codex was configured read-only.

The mechanisms expose two distinct forms of **in-boundary enforcement**:

1. **Attacker-shaped authority derivation.** A privileged helper should not
   calculate its grant from every syntactically mentioned path in untrusted input.
   Parse and validate the complete operation first, derive authority from trusted
   policy over resolved objects, and reject the whole request before widening any
   capability. A deliberately failing sibling operation must never expand what a
   successful operation may touch.
2. **Co-resident trust secrets.** Two language contexts in one process are not a
   security boundary when the untrusted side can inspect shared memory or write
   directly to the authenticated transport. A random token is not a boundary if
   both the token and the privileged request channel remain reachable from the
   adversary's runtime. Put authorization state and privileged I/O in a separate
   protection domain, expose only a narrow authenticated protocol, and assume all
   code inside the sandbox—including root—is compromised.

This sharpens “out-of-band enforcement” into a testable placement requirement:
for each enforcer, ask whether untrusted input can influence the **authority
calculation**, read the **authenticator**, write the **trusted channel**, or cause
the privileged side to act before full validation. Process, VM, and host
separation are means rather than proofs; the deployment must also remove shared
credentials and ambient host channels. Regression tests should retain both
reported shapes: a mixed valid/failing request that tries to widen a grant, and
an untrusted-context attempt to enumerate secrets and inject a privileged frame.

**Evidence boundary:** this scan read the public disclosure and current HN item,
but did not reproduce either exploit, inspect the affected or fixed Codex source,
or verify the vendor's disclosure and remediation timeline independently. The
article supplies mechanism-level first-party security-research claims; it also
markets Accomplish's VM architecture. Therefore the two incidents support
threat-model and regression-test requirements, not a claim that all Codex
versions were vulnerable or that a VM alone provides complete containment.

## Local Configuration Authority Must Not Inherit Remote Agent Authority (HN, September 2026)

**HN:** https://news.ycombinator.com/item?id=49802030

**Linked report:** https://arstechnica.com/security/2026/09/muse-metas-extraordinarily-privileged-ai-assistant-has-a-serious-0-day/

Ars Technica reports that macOS security researcher Patrick Wardle found a Meta
Muse configuration path available to locally running apps and terminal commands.
According to the report, a process could change Muse's cloud-transcription
endpoint to an attacker-controlled server. The agent then sent that server the
bearer token used to authenticate the user's Muse account. Wardle told Ars that
his proof-of-concept used the resulting agent authority to perform actions such
as writing files and taking pictures. The article also describes a ClickFix
social-engineering path for inducing a user to execute the local command.

The durable failure is an **authority composition**, not simply a local-code or
prompt-injection bug:

`local configuration write × automatic bearer-token forwarding × agent privileges`

Each edge changes the assurance claim. A process with only the user's ordinary
local execution context should not thereby choose a credential destination; an
agent should not send account credentials merely because a mutable endpoint says
it is the service; and possession of the remote agent session should not silently
confer every device capability previously granted to the assistant. Hardened
designs should authenticate service endpoints independently of mutable user
configuration, store tokens in an OS-protected broker, mediate every capability
at the device boundary, and require an explicit re-authorization ceremony for
endpoint or trust-root changes. Tests should mutate each local setting from an
unprivileged process and verify that neither credentials nor privileged effects
cross the trust boundary.

This extends the Codex placement test above. Keeping the agent's main model out
of the attack path does not make enforcement out-of-band when an untrusted local
process can still rewrite the trusted route and cause the credential broker to
follow it. Configuration authority, credential release, and effect authority
must be separated and independently authenticated.

**Evidence boundary:** Scout read the current Algolia HN front-page result, the
HN item/comments, and the linked Ars article. It did not reproduce Wardle's
proof-of-concept, inspect Muse binaries, or obtain Meta's technical remediation.
Several HN commenters disputed the article's use of “zero-day” because local
execution or ClickFix was required. That nomenclature dispute does not verify or
refute the reported endpoint-redirection and token-forwarding mechanism, so this
entry uses the report only to derive a boundary and regression test—not to claim
remote compromise, prevalence, or an independently confirmed affected version.

## Reported Results Need Positive Evidence of Execution (APEXA, arXiv, September 2026)

**Source:** https://arxiv.org/abs/2609.24165v1

**Full text reviewed:** https://arxiv.org/html/2609.24165v1

APEXA reports a concrete scientific-agent failure that output-oriented checks can
miss. Its institutional gateway converts native tool calls to text; a call in an
unrecognized format can therefore disappear before execution while the model
continues as if it ran. In the authors' deployment, frontier models reportedly
produced calibration-comparison narratives containing geometry, file sizes, and
even a checksum-identical verdict for files that did not exist. Fluency, string
matching, and tool-state assertions were insufficient because they evaluated the
narrative rather than the execution event.

The system puts a deterministic gate in the runner. If a turn contains recognized
tool-call syntax but records no executed call, the runner refuses to finalize the
answer, injects a correction, and requires a correctly formatted retry; repeated
failure returns an explicit “nothing executed” result. A format-tolerant parser
handles the canonical text form as well as XML and bare key-value variants seen
across the tested model families. The trusted fact is therefore narrower and
stronger than the model's report: **this turn has a corresponding executed tool
call**. Manifest-logged backend results then provide the objects that downstream
scientific checks can inspect.

The same placement principle appears on APEXA's optional motor surface. Five
server-side checks—soft limits, limit switches, slew magnitude, velocity, and jog
duration—run before an EPICS command. Across 50 adversarial scenarios and four
models, the tool-enforced path committed 0/200 violations, while an approximately
700-token prompt-only policy allowed 15/200. The authors correctly scope the zero
as a property of the encoded gate over covered commands, not evidence that the
models became safe. The prompt-only comparison is a single-pass point estimate;
the gateway exposed no random seed.

The reusable admission rule is to bind every consequential result to **positive
execution evidence** before evaluating its content:

1. distinguish a proposed call, an accepted call, an executed call, and a
   successfully produced artifact;
2. fail explicitly when syntax suggests an intended call but the execution ledger
   has no corresponding event;
3. tolerate declared format variants without treating unparsed input as success;
4. read the claimed result from the produced artifact or manifest, rather than
   from the model's narration; and
5. apply domain oracles after execution integrity—execution alone does not prove
   scientific correctness.

This complements action-boundary authorization elsewhere in this note. A policy
can prove that a call was permitted without proving it ran, and an execution
receipt can prove that a call ran without proving its output is correct. Systems
need both boundaries when a missing action and an unauthorized action are distinct
failure modes.

**Evidence boundary:** Scout reviewed the v1 abstract and full arXiv HTML, not an
independent deployment or rerun. The paper describes one deployed reasoning agent
over 61 tools despite using “multi-agent framework” terminology, so this entry
does not treat the result as evidence about coordinating multiple autonomous
agents. The guard detects the documented intended-call/no-execution channel; it
does not by itself prove complete mediation, parser completeness, backend
correctness, artifact semantics, or the paper's broader scientific claims.
Large-scale agent scoring is explicitly deferred to a later study.

## Sandbox Policy Needs Configuration Coherence, Not Just Strong Primitives (GitHub, September 2026)

**Repo:** https://github.com/boxlite-ai/boxlite

**Pinned observation:** repository commit
[`9e9436e633accac592fc9844c7417e2737bd7dda`](https://github.com/boxlite-ai/boxlite/commit/9e9436e633accac592fc9844c7417e2737bd7dda)

BoxLite is useful evidence for a less visible sandbox property: each control may
work as designed while the configuration vocabulary still creates a fail-open
composition. Its current default security profile enables the host jailer,
Linux seccomp and chroot, privilege dropping, file-descriptor closure,
environment sanitization, and resource limits. The untrusted workload runs in a
separate hardware-virtualized guest, while the host-side shim is constrained by
an additional OS sandbox. On Linux this is a stronger stack than a container
label alone; on macOS the project's own threat model says the layer is weaker
because it lacks privilege dropping, network namespaces, and cgroups.

The sharper signal is a repaired ambiguity between two similarly named controls.
`network.mode` decides whether the guest gets a network backend.
`advanced.security.network_enabled` decides whether the *host jailer* grants the
shim the networking it needs. Previously, setting the latter to false while
leaving the default guest network enabled could either prevent startup or, when
the jailer was disabled, leave full guest internet access despite a
network-disabled-looking configuration. The current creation validator rejects
that contradictory pair and tells callers to set `network.mode="disabled"`.
A separate integration test checks that a truly network-disabled guest cannot
reach an external IP or see a host Unix socket while its vsock control channel
still works.

This yields a reusable **configuration-coherence gate** for agent sandboxes:

1. give guest capabilities, host-side mediator grants, and master isolation
   switches distinct names and documented semantics;
2. validate combinations at the creation boundary, before any privileged helper
   or network backend starts;
3. reject misleading or contradictory states rather than silently degrading or
   translating them;
4. test the denied effect from inside the guest while retaining a positive
   control for required management traffic; and
5. report platform-specific enforcement, not a generic “sandboxed” state.

The distinction matters because secure defaults are not least-authority defaults.
BoxLite's jailer is enabled by default, but guest outbound networking is also
enabled by default. A deployment that needs offline execution must make that
separate choice and verify the resulting runtime path. Hardware virtualization,
seccomp, and resource limits also do not cover host-kernel or hypervisor bugs,
supply-chain compromise, operator error, side channels, or unnecessary mounted
volumes. Configuration rejection proves that one known semantic mismatch now
fails closed; it does not certify the whole sandbox.

**Evidence inspected at the pinned commit:**
[`README.md`](https://github.com/boxlite-ai/boxlite/blob/9e9436e633accac592fc9844c7417e2737bd7dda/README.md),
[`docs/concepts/security.md`](https://github.com/boxlite-ai/boxlite/blob/9e9436e633accac592fc9844c7417e2737bd7dda/docs/concepts/security.md),
[`THREAT_MODEL.md`](https://github.com/boxlite-ai/boxlite/blob/9e9436e633accac592fc9844c7417e2737bd7dda/src/boxlite/src/jailer/THREAT_MODEL.md),
[`advanced_options.rs`](https://github.com/boxlite-ai/boxlite/blob/9e9436e633accac592fc9844c7417e2737bd7dda/src/boxlite/src/runtime/advanced_options.rs),
[`options.rs`](https://github.com/boxlite-ai/boxlite/blob/9e9436e633accac592fc9844c7417e2737bd7dda/src/boxlite/src/runtime/options.rs),
[`jailer-network-permissions.md`](https://github.com/boxlite-ai/boxlite/blob/9e9436e633accac592fc9844c7417e2737bd7dda/docs/contributing/architecture/jailer-network-permissions.md),
and
[`security_enforcement.rs`](https://github.com/boxlite-ai/boxlite/blob/9e9436e633accac592fc9844c7417e2737bd7dda/src/boxlite/tests/security_enforcement.rs).

**Evidence boundary:** Scout statically inspected the complete pinned tree, the
listed implementation, documentation, and in-tree tests through public GitHub
endpoints. It did not build BoxLite, run its integration tests, audit libkrun or
the host kernels, attempt a guest escape, or verify a deployed configuration.
The source establishes the control decomposition and the fail-closed validation
branch; security and performance claims outside those paths remain
repository-authored claims.

## Sending a Stop Signal Is Not an Observed Quiescence (HN, September 2026)

**Source:** https://news.ycombinator.com/item?id=49830567

**Repo:** https://github.com/joseluispino/hardstop

**Pinned observation:** repository commit
[`45c31bca05ef8dc7765152e0181e9defb6338b0d`](https://github.com/joseluispino/hardstop/commit/45c31bca05ef8dc7765152e0181e9defb6338b0d)

Hard Stop proposes a useful separation: a runaway agent should not be trusted to
halt itself, so a supervisor outside the model loop should be able to stop its
OS process group and inspect durable state. The reference implementation calls
`os.killpg(..., SIGSTOP)` and later `SIGKILL`, while its checked-in benchmark
reports roughly 0.005 ms median and 0.019 ms p99 for the stop operation at the
pinned revision. That is evidence for one narrow primitive, not the README's
broader claims of kernel/eBPF containment or prevention of off-target effects.

The benchmark starts a child that sleeps, measures only the interval until
`killpg` returns, and terminates the child afterward. It does not observe that
every process reached a stopped state, race a pending socket or system call, or
measure the full interval from violation detection through verified containment.
The implementation makes the same distinction visible: `freeze_process_group()`
returns a request-status boolean, but `execute_quiescence_and_preempt()` ignores
that value and reports `quiesced: True` whenever a supervisor object exists. A
permission fallback can stop only the target PID rather than its group, yet the
caller still emits the same quiesced claim.

Detection placement is a separate limit. The checked-in sentinel is a Python
function that evaluates caller-supplied `target_domain`, `file_path_accessed`,
and `command_str` strings from a LangGraph state object. The repository does not
contain the README's stated eBPF or cgroup enforcement path, nor a system-call or
network mediator that proves all relevant effects pass through the check. Its
“WAL” reader also parses one JSON file; malformed bytes produce an explicit
`torn-read` error record, not recovery of the last committed state. These are
useful reference components, but they do not establish complete mediation or a
recoverable checkpoint protocol.

A trustworthy hard-stop receipt therefore needs distinct evidence for:

1. **Detection:** which independently observed effect or invariant triggered the
   stop, and which paths remain outside that observer;
2. **Dispatch:** which process/cgroup generation was targeted and whether the
   kernel accepted the request;
3. **Quiescence:** a postcondition showing all in-scope tasks stopped, including
   descendants or delegated workers, rather than timing only signal issuance;
4. **Effect boundary:** whether an already-started write, packet, or remote action
   committed before quiescence; and
5. **Recovery:** the last integrity-checked committed record, with torn or
   ambiguous state kept separate from a clean checkpoint.

This extends the note's positive-execution rule in the opposite direction. Just
as “call proposed” is not “call executed,” “stop requested” is not “execution
stopped.” Out-of-band placement is valuable only when both the detection path and
the post-stop observation remain independent of the component being contained.

**Evidence inspected at the pinned commit:**
[`README.md`](https://github.com/joseluispino/hardstop/blob/45c31bca05ef8dc7765152e0181e9defb6338b0d/README.md),
[`andon_circuit_breaker.py`](https://github.com/joseluispino/hardstop/blob/45c31bca05ef8dc7765152e0181e9defb6338b0d/andon_circuit_breaker.py),
[`benchmark_latency.py`](https://github.com/joseluispino/hardstop/blob/45c31bca05ef8dc7765152e0181e9defb6338b0d/benchmark_latency.py),
[`benchmark_results.jsonl`](https://github.com/joseluispino/hardstop/blob/45c31bca05ef8dc7765152e0181e9defb6338b0d/benchmark_results.jsonl),
and
[`test_andon_circuit_breaker.py`](https://github.com/joseluispino/hardstop/blob/45c31bca05ef8dc7765152e0181e9defb6338b0d/test_andon_circuit_breaker.py).

**Evidence boundary:** Scout inspected the complete repository tree and listed
files through public GitHub endpoints. The HN item had no comments at review
time. Scout could not run the suite because the environment lacked its declared
`pydantic` and `pytest` dependencies, and did not install packages, run the
benchmark, inspect the pending paper beyond repository text, or test a live
agent, network race, cgroup, or eBPF program. Performance and attack-prevention
claims remain author-reported; the source inspection establishes only the
implemented control flow and the mismatch between request timing and observed
quiescence.

## Frozen Eval Inputs Do Not Guarantee a Fixed Comparison Unit (HN, September 2026)

**Source:** https://news.ycombinator.com/item?id=49834450

**Primary article:** https://commandline.microsoft.com/run-assert-eval-responsible-ai-agent-risk-discovery-at-runtime/

**Repo:** https://github.com/responsibleai/ASSERT

**Pinned observation:** repository commit
[`0628e25fc2366530f45756bdcc384c71de04c6be`](https://github.com/responsibleai/ASSERT/commit/0628e25fc2366530f45756bdcc384c71de04c6be)

Microsoft's `run-assert-eval` workflow connects four stages that are often kept
separate: discover candidate risks with Clarity, turn a selected risk into one
atomic ASSERT suite, generate an Agent Control Specification policy from observed
violations, and rerun the governed agent. Its most reusable discipline is to keep
the behavior definition, generated test cases, and judge fixed while changing
the intended enforcement path. It also reports impermissible-behavior violations
separately from permissible-behavior violations, so a control cannot look safe
merely by refusing useful work.

The billing example makes the architecture concrete but also bounds the claim.
The baseline is a simulated Python agent whose prompt states that it may serve
only account `ACME-1001`; its mocked read tools nevertheless return records for
foreign account IDs. The article says a generated ACS rule checks account scope
at both `pre_tool_call` and `post_tool_call`. It reports cross-customer violations
falling from 12 of 40 applicable baseline conversations (30.0%) to 2 of 34
applicable governed conversations (5.9%), with no permissible-behavior violations
in the governed sample.

Those figures are stronger than two unrelated benchmark runs, but they are not a
strict paired rate comparison. ASSERT recomputes each headline bucket from the
judge's per-row `node_judgments`: a row enters a bucket only when the judge marks
at least one behavior in that bucket relevant. The workflow's own instructions
warn that the judge decides both applicability and violation for every row and
that judge sampling can move which rows are considered applicable. Thus the
same generated conversations can yield different denominators—as the reported
40-to-34 change demonstrates. Freezing the test set, taxonomy, and judge model
controls important sources of drift; it does not freeze the analyzed population
when applicability is re-judged after the intervention changes the transcript.

A defensible baseline-versus-control report should therefore preserve four
layers separately:

1. **Assignment:** run every fixed case in both arms and retain a stable case ID.
2. **Paired outcome:** report per-case transitions such as violation→clear,
   clear→violation, applicable→not-applicable, and the reverse.
3. **Fixed-denominator rate:** include all assigned cases, or freeze an
   applicability mask defined independently of the intervention.
4. **Conditional rate:** retain the useful violation rate among rows judged
   applicable, but publish both denominators and treat denominator movement as
   an outcome rather than silently dropping it.

The workflow itself contains several sound safeguards: one behavior per suite,
a stated sample-size floor, review before enforcing generated Rego, tool-path
coverage checks, and the safety/helpfulness split. The pinned repository does
not, however, publish the article's governed billing callable, generated policy,
raw run artifacts, or judge traces. Its billing README says `artifacts/` is
Git-ignored, while the governance workflow describes the governed callable and
policy as generated outputs rather than checked-in example files. The article's
rates are therefore author-reported demonstration results, not independently
recomputable evidence at the pinned revision.

**Evidence boundary:** Scout read the complete Microsoft article and statically
inspected the pinned ASSERT tree, including the skill, governance workflow,
billing README, baseline agent, cross-customer config, ACS guard, and result-rate
implementation. Scout did not run the model-backed evaluation, inspect the
unpublished run artifacts, validate the generated Rego, or test a production
billing system. The source supports the workflow structure and denominator
semantics; it does not independently verify the reported violation reductions or
show that the mocked example generalizes to a live deployment.
