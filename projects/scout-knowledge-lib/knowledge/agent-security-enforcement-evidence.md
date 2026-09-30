<ai_context>
summary: "Implementation-evidence companion to agent-security-verified-enforcement.md. Uses pinned repositories, disclosures, and deployed-system reports to separate signed claims from replayable evidence; receipt validity from verifier isolation and claim scope; verifier correctness from adversarial agent resistance; receipt integrity from completeness; configured policy from covered paths; identity enrollment from per-request proof; formal models from unsupported surfaces; observed egress from blocking; static egress policy from irreversible post-sensitive-access session restriction; stable tool digests from equivalent semantics and complete lifecycle coverage; policy verdicts from effect ownership; counterfactual actions from execution authority and real effect accounting; authorization receipts from effect gates; declared mediation architecture from per-effect path evidence; narrated results from positive execution evidence; sandbox isolation from configuration coherence; stop requests from observed quiescence; frozen eval inputs from stable comparison units; untrusted analysis failure from trusted configuration degradation; human approval records from end-to-end effect binding; effect-owning execution routes from provider-reported hook correlation and ambient process coverage; signed workflow conformance from evidence-grade propagation and independently proved declaration pre-existence; and workflow stage labels from prerequisite and ship-gate enforcement."
triggers: ["SkillProof", "MCP server verification", "replayable evidence", "action receipt", "signed receipt", "evidence completeness", "MAX Authorization Sandbox", "signed policy", "adversary capability", "rollback state", "Pipelock", "HELM AI Kernel", "offline verifier", "verifier isolation", "claim-typed verification", "PassControl", "sender proof", "bearer visa", "authentication assurance", "default deny", "fail closed", "shell hook", "guardrail regression test", "OpenShell prover", "SMT containment", "path composition", "egress firewall", "uninspected egress", "session-aware egress", "sensitive-source transition", "sticky egress restriction", "tool identity", "tool pin", "schema canonicalization", "MCP Hangar", "cold-start pinning", "tool annotations", "shadow mode", "mediation ownership", "counterfactual action", "observed policy action", "real effect accounting", "ctrlrun", "HOL Guard", "Action Evidence Package", "AEP sandbox", "Codex sandbox", "Overpatch", "Heapjack", "authority derivation", "Meta Muse", "local configuration authority", "APEXA", "execution integrity", "tool execution evidence", "BoxLite", "micro-VM", "sandbox configuration coherence", "guest network", "host jailer grants", "Hard Stop", "SIGSTOP", "process group preemption", "quiescence receipt", "run-assert-eval", "ASSERT", "Agent Control Specification", "fixed evaluation", "applicable denominator", "paired comparison", "safety helpfulness split", "CC Safety Net", "analysis budget", "configuration degradation", "typed failure policy", "emisar", "approval binding", "bridge attestation", "pack hash", "Aegis", "exact action policy", "provider hook correlation", "direct child execution", "route coverage", "Treeship", "workflow conformance", "evidence grade", "declaration pre-existence", "CE-AI", "workflow stage evidence", "ship gate", "prerequisite enforcement"]
last_updated: "2026-09-30"
source_basis: "Pinned-source implementation studies and disclosures reviewed 2026-09-10 through 2026-09-30: SkillProof f5ddb4b, MAX Authorization Sandbox 380efe6, Pipelock f7d1816, HELM AI Kernel fe122d4 and 44d4622, agent-guardrails-kit 18c241e, PassControl f9cb702, OpenShell df0ee1a, k8s-rca-agent 29f5fad, secure-agent 017ec5a, Rul1an/assay 900e536, MCP Hangar f02651c, Soup Wall be8db48, HOL Guard 56faea4 and f5d568f, ctrlrun 8ebc5a8, aep-sandbox 3495e27, BoxLite 9e9436e, Hard Stop 45c31bc, responsibleai/ASSERT 0628e25, CC Safety Net 0439757, AndrewDryga/emisar ac0d942, antropos17/Aegis 6cae92e, zerkerlabs/treeship 7fd3993, HN items 49795755, 49802030, 49830567, 49834450, 49834720, 49840107, 49841469, 49844056, and 49855568 with their linked primary sources, plus arXiv 2609.24165v1 and 2609.29808v1 (abstracts and full HTML). Each section states its own evidence boundary."
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

## A Signed-Policy Sandbox Is Not Yet an Agent-Resistance Test (HN, September 2026)

**Source:** https://news.ycombinator.com/item?id=49841469

**Repo:** https://github.com/max-russo-com/MAX_AUTHORIZATION_SANDBOX

**Pinned observation:** repository commit
`380efe64764ffdb381d40b2d1d6311599bbdaefc`

The MAX Authorization Sandbox makes a useful, unusually narrow claim: can its
Rust baseline be made to execute `READ_SECRET` while the active signed manifest
allows only `STATUS` and `PING`? At the pinned commit, the implementation parses
its manifest and signature envelope with unknown fields denied, checks the exact
manifest hash and signed text, verifies a SPHINCS+ signature against a bundled
administrator public key, rejects unknown or duplicate actions, and checks the
allow-list both before and inside the effect function. Its policy-state machine
also rejects a lower sequence and a different manifest at the same sequence.
The Docker profile narrows the process further with a read-only root filesystem,
all Linux capabilities dropped, `no-new-privileges`, and a dedicated writable
state volume.

That is a reproducible verifier and closed-world authorization exercise, but the
HN framing asks a broader question than the artifact currently tests. The
repository contains no AI-agent harness, tool adapter, prompt corpus, attack
campaign, or published attempt results. The command-line path accepts one of
three fixed action names; the HTTP candidate path accepts a caller-supplied
manifest and signature but still verifies them against the bundled key. The
suite has positive and negative unit cases for parsing, signatures, action
selection, and sequence transitions, not evidence that an autonomous adversary
could reach every relevant mutation or effect path.

The implementation also reveals why the adversary contract matters. Rollback
protection is local state, and absence of that state is treated as first-use
initialization. The container preserves it in a writable volume, while the trust
key, signed manifest, and binary are on the read-only image. This is coherent for
the documented container profile; it does not by itself establish who may reset
or replace the volume, alter files in a non-container run, invoke another secret
path, or compromise the process. Post-quantum signature strength addresses
policy authenticity, not those runtime-authority questions.

A meaningful agent-resistance evaluation should therefore declare and exercise
at least four surfaces:

1. **Policy input:** malformed, unknown, replayed, conflicting, and correctly
   signed newer policies.
2. **Trust and continuity:** key replacement, state deletion or rollback,
   interrupted state writes, and restart behavior under the privileges actually
   granted to the adversary.
3. **Effect reachability:** every direct and indirect path to the protected
   secret, including paths that bypass the named action dispatcher.
4. **Agent campaign:** the exact tools, filesystem/network authority, budget,
   seeds, attempts, successes, and preserved traces.

Until those are supplied, a failed bypass means the tested verifier cases held;
it does not measure “AI agents” as a class or establish that the deployment has
complete mediation.

**Evidence inspected at the pinned commit:**
[`README.md`](https://github.com/max-russo-com/MAX_AUTHORIZATION_SANDBOX/blob/380efe64764ffdb381d40b2d1d6311599bbdaefc/README.md),
[`src/lib.rs`](https://github.com/max-russo-com/MAX_AUTHORIZATION_SANDBOX/blob/380efe64764ffdb381d40b2d1d6311599bbdaefc/src/lib.rs),
[`src/main.rs`](https://github.com/max-russo-com/MAX_AUTHORIZATION_SANDBOX/blob/380efe64764ffdb381d40b2d1d6311599bbdaefc/src/main.rs),
[`compose.yml`](https://github.com/max-russo-com/MAX_AUTHORIZATION_SANDBOX/blob/380efe64764ffdb381d40b2d1d6311599bbdaefc/compose.yml),
and
[`.github/workflows/ci.yml`](https://github.com/max-russo-com/MAX_AUTHORIZATION_SANDBOX/blob/380efe64764ffdb381d40b2d1d6311599bbdaefc/.github/workflows/ci.yml).

**Evidence boundary:** this source inspection establishes what the pinned code,
tests, and container configuration declare. It did not independently conduct an
adversarial campaign, prove absence of alternate effect paths, or validate the
broader MAX products that the repository itself excludes from scope.

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

### Follow-up: isolate the verifier and type each claim (HELM AI Kernel, September 2026)

**Repo:** https://github.com/Mindburn-Labs/helm-ai-kernel

**Pinned observation:** repository commit
[`fe122d461529f62a270397c5104641697202a799`](https://github.com/Mindburn-Labs/helm-ai-kernel/commit/fe122d461529f62a270397c5104641697202a799)

HELM's `receiptverify` package adds two useful disciplines to the receipt-validity
vector above. First, the offline verifier is deliberately a separate leaf package
rather than a path through the producer's larger cryptographic stack. An in-tree
test walks the non-test import closure of both the package and verifier binary and
fails if `net`, `net/http`, `crypto/tls`, or `os/exec` becomes reachable. Another
test rejects wall-clock reads from production verifier code. This turns “offline”
from a runtime promise into two checkable build properties: no transitive transport
or subprocess path, and no date-dependent reinterpretation of an old receipt.

Second, its result is claim-typed rather than a single undifferentiated green
check. The verifier separately reports identity, integrity, policy, execution
observation, chain closure, and permit checks; `not_applicable` is not silently
promoted to success. The code comments also bound each claim. Policy verification
means `policy_hash` and verdict were signed, not that the policy was evaluated.
Execution verification means argument and output hashes were signed, not that the
payloads were supplied or the action re-executed. Permit verification preserves
signed terms and evidence obligations, but the receipt format lacks a `permit_id`
link and expiry belongs to dispatch time. For a single receipt, chain closure is
explicitly not applicable.

The trust path is similarly explicit. The CLI requires a caller-owned Ed25519
public-key file and exits non-zero unless the signature verifies under it. An
embedded key can establish only self-consistency; it is not a trust root. The
`receipt.v5` parser rejects duplicate members, trailing JSON values, non-integer
Lamport spellings, missing signed members, unknown signature versions, and partial
or contradictory signature metadata instead of retrying a declared v5 artifact
against a legacy preimage.

This yields a reusable verifier contract:

1. **Isolation:** prove the verifier's dependency and I/O closure, not just that
   one code path happens not to call the network.
2. **Temporal purity:** keep historical cryptographic validation independent of
   the current clock; evaluate expiry as a separately named dispatch-time claim.
3. **Claim typing:** expose what was checked, what was absent, and what requires
   external evidence rather than returning an ambiguous `valid=true`.
4. **External trust:** resolve signer keys from caller-controlled material, never
   from the artifact being verified.
5. **Version closure:** reject unknown or contradictory profiles without downgrade
   retries.

**Evidence inspected at the pinned commit:**
[`README.md`](https://github.com/Mindburn-Labs/helm-ai-kernel/blob/fe122d461529f62a270397c5104641697202a799/README.md),
[`receipt-v5.md`](https://github.com/Mindburn-Labs/helm-ai-kernel/blob/fe122d461529f62a270397c5104641697202a799/protocols/specs/receipts/receipt-v5.md),
[`receiptverify.go`](https://github.com/Mindburn-Labs/helm-ai-kernel/blob/fe122d461529f62a270397c5104641697202a799/core/pkg/receiptverify/receiptverify.go),
[`receiptverify_test.go`](https://github.com/Mindburn-Labs/helm-ai-kernel/blob/fe122d461529f62a270397c5104641697202a799/core/pkg/receiptverify/receiptverify_test.go), and
[`verify_receipt_cmd.go`](https://github.com/Mindburn-Labs/helm-ai-kernel/blob/fe122d461529f62a270397c5104641697202a799/core/cmd/helm-ai-kernel/verify_receipt_cmd.go).

**Evidence boundary:** Scout statically inspected source, specifications, and
repository-authored tests at one revision. It did not run the Go tests or verifier,
validate a real receipt, audit every receipt family, or establish that a deployed
agent's effects all traverse HELM. The source supports verifier semantics and
build-time assertions, not the repository's broader enforcement or product claims.

### Follow-up: effect recovery must preserve uncertainty instead of retrying it (HELM AI Kernel, September 2026)

**Repo:** https://github.com/Mindburn-Labs/helm-ai-kernel

**Pinned observation:** repository commit
[`44d462261efe95dfb0448098304b4dc82d754613`](https://github.com/Mindburn-Labs/helm-ai-kernel/commit/44d462261efe95dfb0448098304b4dc82d754613)

HELM's newer gateway code adds an effect-lifecycle contract that is distinct
from the receipt verifier above. Before provider I/O, one database transaction
locks the admitted attempt and unused permit, rechecks stops, authority-row
versions, permit expiry, and mandate validity, consumes the permit once, moves
the attempt to `DISPATCHING`, sets a dispatch fence, and enqueues reconciliation.
A client disconnect cannot roll this transition back, and a repeated dispatch
on `DISPATCHING` or any later state returns the existing attempt without calling
the adapter again.

The adapter result deliberately has three values rather than a success boolean:

- `SENT` means the provider accepted or already contains the requested object;
  the gateway reads it back immediately.
- `NOT_SENT` means the adapter knows no effect occurred, so the attempt becomes
  failed and its reservation is released.
- `INDEFINITE` means the write may have happened despite a lost or ambiguous
  response. The attempt becomes `UNKNOWN`, retains its reservation, and is
  never dispatched again.

Read-back then treats time and contradiction asymmetrically. Absence inside the
dispatch fence is not failure because an in-flight write may still appear.
Absence after the fence establishes failure and releases the reservation. An
object that exists but contradicts the requested effect establishes
`READBACK_MISMATCH` even inside the fence—and consumes rather than releases the
reservation, because this attempt may have created the conflicting object.
Worker death after the pre-I/O commit similarly becomes an unknown state for
observation, not evidence that retrying is safe.

This yields a reusable recovery rule for external effects:

1. **Commit attempt ownership before I/O.** Bind one permit, claim ID, caller,
   timeout fence, and reconciliation job before contacting the provider.
2. **Require the adapter to report epistemic status.** “Not sent” and “answer
   lost” have different retry safety and must not share one error branch.
3. **Let time qualify negative evidence.** Provider absence is conclusive only
   after the declared in-flight window closes.
4. **Account for contradictory positive evidence conservatively.** A mismatched
   object can prove the desired result failed without proving that no billable,
   quota-consuming, or irreversible action occurred.
5. **Make conformance scenarios portable.** HELM's versioned pack hashes each
   scenario and includes double dispatch, indefinite outcome, in-fence absence,
   contradictory read-back, and certain not-sent cases, so another gateway or
   fake can pin the contract rather than imitate prose selectively.

The distinction complements the receipt-validity vector: a signed record may
faithfully say `UNKNOWN`; cryptographic integrity must not pressure recovery
code into inventing a terminal outcome. It also sharpens “exactly once” claims.
The inspected source prevents the gateway from knowingly invoking its adapter
twice for one claimed attempt, but it cannot make a remote provider transaction
atomic with the local database. Safety comes from retained ambiguity,
provider-specific read-back, and refusal to redispatch—not from distributed
exactly-once execution.

**Evidence inspected at the pinned commit:**
[`gateway-effect-api.md`](https://github.com/Mindburn-Labs/helm-ai-kernel/blob/44d462261efe95dfb0448098304b4dc82d754613/docs/architecture/gateway-effect-api.md),
[`dispatch.go`](https://github.com/Mindburn-Labs/helm-ai-kernel/blob/44d462261efe95dfb0448098304b4dc82d754613/core/pkg/gateway/admission/dispatch.go),
[`dispatch_test.go`](https://github.com/Mindburn-Labs/helm-ai-kernel/blob/44d462261efe95dfb0448098304b4dc82d754613/core/pkg/gateway/admission/dispatch_test.go), and the
[`gateway v1 conformance table`](https://github.com/Mindburn-Labs/helm-ai-kernel/blob/44d462261efe95dfb0448098304b4dc82d754613/protocols/conformance/gateway/v1/README.md).

**Evidence boundary:** Scout statically inspected the pinned design, Go
implementation, repository-authored unit tests, and conformance scenarios. It
did not run the PostgreSQL conformance runner, call GitHub through this gateway,
independently reproduce a crash window, or establish that the design covers
every provider's consistency behavior. The source supports the stated state
transitions and test intent, not production reliability or true distributed
exactly-once semantics.

### Follow-up: workflow conformance needs an evidence algebra (Treeship, September 2026)

**Repo:** https://github.com/zerkerlabs/treeship

**Pinned observation:** repository commit
[`7fd39938ed821c8a871366b43e6f14a4f15df9d5`](https://github.com/zerkerlabs/treeship/commit/7fd39938ed821c8a871366b43e6f14a4f15df9d5)

Treeship extends the receipt-validity vector from individual actions to declared
workflows, but its useful contribution is the refusal to flatten unlike evidence.
The conformance reducer carries three grades—`checked`, `captured`, and
`asserted`—and every aggregate inherits the weakest required grade. It reports
undeclared nodes and edges, missing terminal nodes, out-of-scope tools, and loop
budget violations separately. A transition touching asserted input is retained
as an `asserted_edge`, rather than silently promoted because neighboring actions
have valid signatures.

The composed verification path also separates **a signed declaration** from
**proof that the declaration predates the run**. It verifies the declaration and
the first run artifact, checks that the signed `session.start` binds the same
workflow, and grants `checked` pre-existence only when earlier and later Merkle
checkpoints, inclusion proofs, leaf ordering, log identity, and consistency all
hold. Without that proof it replaces any caller-supplied grade with `asserted`.
Signed timestamps alone are therefore not ordering evidence.

The observation builder applies the same discipline to attribution. It derives a
node from signed actor/capability and action fields; a runtime-provided node label
may break a genuine ambiguity but cannot override an inadmissible mapping or lift
the grade above `captured`. Unattributable actions are returned as issues, and an
empty action set is refused instead of producing a vacuously clean report.

This suggests a reusable contract for workflow receipts:

1. **Type evidence by strength** and propagate the weakest dependency into every
   aggregate verdict.
2. **Prove policy chronology independently**; a valid signature and claimed time
   do not show that the policy existed before execution.
3. **Recompute attribution from signed fields**; treat runtime labels as bounded
   hints, not authority.
4. **Preserve omissions and ambiguity** as gaps or issues instead of dropping
   evidence that cannot be placed.
5. **Keep presentation claims scoped**: Treeship's own README says package
   narrative, timeline, and side-effect summaries derive from an unsigned event
   log, while signed artifacts and the Merkle root are the authenticated layer.

**Evidence inspected at the pinned commit:**
[`README.md`](https://github.com/zerkerlabs/treeship/blob/7fd39938ed821c8a871366b43e6f14a4f15df9d5/README.md),
[`workflow_conformance.rs`](https://github.com/zerkerlabs/treeship/blob/7fd39938ed821c8a871366b43e6f14a4f15df9d5/packages/core/src/verify/workflow_conformance.rs),
[`workflow_conformance_golden.rs`](https://github.com/zerkerlabs/treeship/blob/7fd39938ed821c8a871366b43e6f14a4f15df9d5/packages/core/tests/workflow_conformance_golden.rs),
[`receipt.rs`](https://github.com/zerkerlabs/treeship/blob/7fd39938ed821c8a871366b43e6f14a4f15df9d5/packages/core/src/session/receipt.rs), and
[`package_anchors.rs`](https://github.com/zerkerlabs/treeship/blob/7fd39938ed821c8a871366b43e6f14a4f15df9d5/packages/core/tests/package_anchors.rs).

**Evidence boundary:** this is static inspection of implementation and
repository-authored tests at one revision. Scout did not execute the suite,
verify a live receipt, audit the cryptography, or establish capture completeness
or real-world adoption.

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

### Follow-up: pin coverage has both lifecycle and field-set dimensions (MCP Hangar, September 2026)

**Repo:** https://github.com/mcp-hangar/mcp-hangar

**Pinned observation:** repository commit
[`f02651ca771b32b620582e8a528b01b9a4fa97f3`](https://github.com/mcp-hangar/mcp-hangar/commit/f02651ca771b32b620582e8a528b01b9a4fa97f3)

MCP Hangar closes one of Assay's lifecycle gaps in a concrete call path. Its
batch executor starts a cold upstream before the final pin check, resolves the
actual selected member when a call targets a server group, and refuses the call
when the post-start projection is absent or its digest cannot be computed under
`block` mode. Repository tests assert that a stale pin prevents the invocation
command even on the first call after boot, while a matching member pin succeeds
through a group. Pins may apply to all callers or to one tenant, and every pin
in scope must validate; an audit setting on another server cannot downgrade a
server whose mode remains the default `block`.

This stronger observation lifecycle does not make the digest a complete tool
identity. `compute_tool_digest` JCS-canonicalizes and hashes exactly `name`,
`description`, `inputSchema`, and `outputSchema`, omitting empty values. The
repository's `ToolSchema` deliberately preserves additional MCP fields—most
notably `annotations` and `execution`—and describes behavioral hints such as
`readOnlyHint` and `destructiveHint` as governance inputs. Yet the digest test
explicitly confirms that annotations and other extra fields are ignored.
Changing a tool description is therefore detected, but changing only whether a
tool advertises itself as destructive, read-only, idempotent, open-world, or
task-capable does not invalidate the pin.

The reusable contract has two independent completeness questions:

1. **Lifecycle coverage:** can a call occur before discovery, after a cold start,
   through group routing, or when identity computation fails without receiving
   the intended pin verdict?
2. **Semantic coverage:** does the pinned field set include every property that
   downstream authorization, approval, UI, or execution policy treats as a
   governance input?

MCP Hangar is useful positive evidence for the first question and a clear scope
boundary for the second. A deployment can reasonably call this a schema-and-
description pin, but should not report it as a pin over the complete advertised
tool contract unless the digest expands or those unbound fields are excluded
from security decisions.

**Evidence inspected at the pinned commit:**
[`digest_computation.py`](https://github.com/mcp-hangar/mcp-hangar/blob/f02651ca771b32b620582e8a528b01b9a4fa97f3/src/mcp_hangar/domain/services/digest_computation.py),
[`tool_catalog.py`](https://github.com/mcp-hangar/mcp-hangar/blob/f02651ca771b32b620582e8a528b01b9a4fa97f3/src/mcp_hangar/domain/model/tool_catalog.py),
[`executor.py`](https://github.com/mcp-hangar/mcp-hangar/blob/f02651ca771b32b620582e8a528b01b9a4fa97f3/src/mcp_hangar/server/tools/batch/executor.py),
[`test_digest_computation.py`](https://github.com/mcp-hangar/mcp-hangar/blob/f02651ca771b32b620582e8a528b01b9a4fa97f3/tests/unit/domain/services/test_digest_computation.py),
[`test_digest_pinning_executor.py`](https://github.com/mcp-hangar/mcp-hangar/blob/f02651ca771b32b620582e8a528b01b9a4fa97f3/tests/unit/test_digest_pinning_executor.py), and
[`test_pin_writes_and_detects_drift.py`](https://github.com/mcp-hangar/mcp-hangar/blob/f02651ca771b32b620582e8a528b01b9a4fa97f3/tests/integration/test_pin_writes_and_detects_drift.py).

**Evidence boundary:** Scout inspected source and repository-authored tests at
one pinned revision. The local environment lacked `pytest`, so the tests were
not executed; no MCP server was started, and the repository's broader claims
about authentication, policy enforcement, and production operation were not
independently validated.

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

### Follow-up: a mediator design becomes assurance only when every effect path is evidenced

**HN:** https://news.ycombinator.com/item?id=49840107

**Primary source:** https://research.meta.ai/blog/security-and-safety-for-ai-agents-our-approach-with-muse

Meta's launch architecture for Muse is unusually specific about moving authority
outside the model-controlled runtime. The core harness, tools, workspace, and
agent-authored code run in an unprivileged `systemd-nspawn` cell. Separate
host-side services hold credentials and connector logic. Sentinel is described as
the sole authority for connector actions and all network egress; it evaluates the
concrete destination and request, then replaces short-lived surrogate tokens with
real credentials only at the network boundary. Connector workers have explicit
credential allow-lists. User approvals travel directly between the client and
Sentinel and become scoped capabilities rather than conversational text.

The design also turns data provenance into an authorization input. Kernel-level
taint tracking marks a tool process after it reads user data; tainted or
unverifiable processes lose narrowly bounded automatic egress and return to an
approval flow. Browser credentials are brokered outside the agent, the browser
sub-agent receives an accessibility-tree view rather than raw DOM or CDP access,
and purchases require direct approval with merchant-, amount-, and time-bounded
payment credentials. These are useful implementation patterns because they split
**model intent**, **credential possession**, **request authorization**, and
**effect execution** across different principals.

But the article is an architecture disclosure, not coverage evidence. It gives no
quantitative classifier results, false-positive/false-negative rates, path census,
or independently replayable traces for the claims that every egress request and
connector action crosses Sentinel. Its “close to SOTA” prompt-injection statement
is not accompanied by an eval name or score. Meta explicitly says prompt
injection remains open, Muse will make mistakes, and the announced Confidential
VM—which is intended to keep even Meta from accessing VM data—was not yet the
launch architecture.

The assurance requirement is therefore a **per-effect path matrix**. For each
connector, browser action, raw network protocol, sub-agent handoff, custom tool,
and failure mode, retain a negative witness, a benign positive witness, the
runtime principal and policy revision, credential-substitution evidence, and the
final effect outcome. Also test that local configuration, DNS resolution,
redirects, alternate protocols, malformed requests, unavailable classifiers, and
broker failure cannot produce an unmediated path. The prior endpoint-redirection
report above makes this distinction concrete: a later design description does not
by itself prove that the reported route was fixed or that no equivalent route
remains.

**Evidence boundary:** Scout read the full Meta technical post and HN item. It
did not inspect Muse source or binaries, operate the product, reproduce the
published architecture, access Meta's private red-team evals, or verify the bug
bounty results. Treat the post as a detailed vendor claim and test-plan source,
not an independent security audit or proof of complete mediation.

### Follow-up: sensitive access should be a sticky session transition, not a per-call guess

**HN:** https://news.ycombinator.com/item?id=49855568

**Primary source:** https://a16y.ai/blog/securing-ai-agents-when-no-human-is-watching

Autonomous Security describes a related control with one useful refinement: the
agent's network authority changes after the first declared sensitive-source
access. Before that transition, the background coding agent uses its ordinary
network policy. After it queries a production database, log system, or other
administrator-marked sensitive source, the session may communicate only with
destinations approved in advance for that workflow. The restriction is one-way
for the rest of the session. Approved repository pushes, pull-request creation,
and internal-service calls can continue; arbitrary websites and newly discovered
remote tools cannot become exfiltration routes.

That is stronger than independently classifying each later request. A detector
does not need to infer whether the model was prompt-injected or whether a
particular outbound payload contains a secret. The trusted runtime records a
security-relevant state transition—`sensitive source accessed`—and monotonically
narrows the egress set. Credentials for production systems remain behind an
MCP/API gateway, while runtime interception is intended to cover file, shell,
and local-tool activity that the gateway cannot see.

The reusable pattern is a **sticky authority transition**:

1. administrators declare which access paths can introduce sensitive data;
2. the effect-owning mediator records when one of those paths succeeds;
3. that event irreversibly narrows the session's allowed destinations; and
4. the restricted state persists across later tool calls, subprocesses, and
   agent-generated code until the session ends.

This complements Meta Muse's taint-based loss of automatic egress above. The
narrower source-declaration design avoids asking a content classifier whether
each response is sensitive, but shifts assurance to trigger coverage and state
integrity. A deployment still needs tests for alternate access paths, concurrent
processes, pre-existing connections, redirects and DNS changes, session restart
or checkpoint restore, broker failure, and every destination that remains on the
post-transition allow-list. Otherwise “restricted after sensitive access” can be
true for the advertised gateway path while another process or restore path keeps
the earlier authority.

**Evidence boundary:** this is a complete reading of a vendor-authored design
article surfaced by a two-point, zero-comment HN submission. The article says the
three layers are used on the vendor's own unattended engineering agents, but it
provides no source code, configuration, test corpus, bypass evaluation, incident
counts, or measured false-positive/false-negative results. Scout did not operate
the product or independently verify that the transition is immutable or that all
egress paths are mediated. Treat this as a concrete architecture pattern and
verification checklist, not production proof or comparative evidence.

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

### Follow-up: an incident baseline does not validate the proposed intervention

**Source:** https://news.ycombinator.com/item?id=49844056

**Paper:** https://arxiv.org/abs/2609.29808v1

The full preprint now combines two different evidence sets. Its historical
baseline—the July 2026 autonomous-agent intrusion—is independently described by
the cited [Hugging Face technical
timeline](https://huggingface.co/blog/agent-intrusion-technical-timeline), which
reports roughly 17,600 recovered actions, an escaped evaluation sandbox, and a
multi-stage intrusion into Hugging Face infrastructure. But the paper's
intervention column is a simulation: its comparison table changes from the
historical incident to a test harness that trips on action 1. “Zero secrets
leaked” and “complete attack surface elimination” therefore describe that
constructed run, not a replay of the production incident under the proposed
control.

The paper also reports 500/500 eBPF syscall detections and calls a measured p99
below 0.154 ms a passed WCET guarantee. Those claims outrun the inspected public
artifact. The repository revision reviewed above contained no eBPF program, and
the paper says its complete production implementation is closed source. Its
published appendix still uses the POSIX supervisor whose quiescence-reporting
gap is documented above. An `O(n)` Aho-Corasick transition bound constrains
algorithmic growth, but does not by itself bound end-to-end wall-clock latency;
the paper itself notes that general-purpose Linux without `PREEMPT_RT` cannot
provide hard real-time guarantees. A bootstrapped p99 confidence interval is an
empirical distribution estimate, not a worst-case execution-time proof.

The reusable review rule is to keep four columns separate: **historical incident
evidence**, **synthetic replay outcome**, **microbenchmark timing**, and
**deployed mediator coverage**. A real incident can motivate a control without
validating it; a formal complexity result can support a detector design without
proving its system latency; and a fast signal-dispatch measurement still needs
observed quiescence and effect-boundary evidence.

**Evidence inspected at the pinned commit:**
[`README.md`](https://github.com/joseluispino/hardstop/blob/45c31bca05ef8dc7765152e0181e9defb6338b0d/README.md),
[`andon_circuit_breaker.py`](https://github.com/joseluispino/hardstop/blob/45c31bca05ef8dc7765152e0181e9defb6338b0d/andon_circuit_breaker.py),
[`benchmark_latency.py`](https://github.com/joseluispino/hardstop/blob/45c31bca05ef8dc7765152e0181e9defb6338b0d/benchmark_latency.py),
[`benchmark_results.jsonl`](https://github.com/joseluispino/hardstop/blob/45c31bca05ef8dc7765152e0181e9defb6338b0d/benchmark_results.jsonl),
and
[`test_andon_circuit_breaker.py`](https://github.com/joseluispino/hardstop/blob/45c31bca05ef8dc7765152e0181e9defb6338b0d/test_andon_circuit_breaker.py).

**Evidence boundary:** Scout inspected the complete pinned repository tree, the
arXiv v1 abstract and full HTML, and the cited Hugging Face technical timeline.
The HN paper submission had no comments at review time. Scout did not execute the
suite or benchmarks, inspect the paper's closed-source implementation, reproduce
the incident, parse the full cited METR PDF, or test a live agent, network race,
cgroup, or eBPF program. Performance, eBPF-detection, and intervention claims
remain author-reported; the source inspection establishes only the public
implementation's control flow and the mismatch between signal dispatch and
observed quiescence.

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

## “Fail Closed” Is a Typed Failure Policy, Not One Global Switch (GitHub, September 2026)

**Repo:** https://github.com/kenryu42/cc-safety-net

**Pinned observation:** repository commit
[`043975720b8416012d911e2096eb7342f088800f`](https://github.com/kenryu42/cc-safety-net/commit/043975720b8416012d911e2096eb7342f088800f)

CC Safety Net exposes an instructive asymmetry. Inputs controlled by an agent are
bounded before or during analysis: hook input, recursive tool payloads, command
length, token count, nesting, derived child commands, wrapper peeling, heredoc
tracking, and control-flow states all have fixed caps. Crossing those caps yields
a denial rather than a partial allow. The repository's tests cover each named
analyzer counter at and below its boundary, and a packaged-path test sends an
exact one-MiB command through the built CLI hook and expects a deny verdict.
This prevents an attacker from turning parser exhaustion into permission.

Invalid optional policy configuration takes the opposite availability decision.
A bad or unreadable source produces a visible `degraded` snapshot: the invalid
rulebook contributes no custom denials, while validated sources and built-in
protections continue. The project explicitly acknowledges that this weakens the
configured posture, but argues that denying all work would not protect the
source under its current authority model: an agent that can alter `rule.json`
can already remove the rulebook cleanly, without causing a parse error. Universal
fail-closed handling would therefore create lockout without closing the tamper
path. Rulebooks are also monotone—they may add blocks but cannot disable built-in
catastrophic protection—so dropping one has a bounded fallback meaning rather
than turning malformed configuration into an allow-list.

The general lesson is not that configuration failures should fail open. It is
that failure behavior should be derived from a **typed authority and fallback
contract**:

1. **Who controls the failed input?** Attacker-shaped command complexity should
   not buy an allow; trusted-operator configuration may need a recoverable mode.
2. **What authority disappears?** Record the exact rules or effect paths lost,
   not just a generic warning.
3. **Is the fallback monotonic and bounded?** Continuing is easier to justify
   when rejected extensions can only add denials and a known built-in baseline
   remains active.
4. **Can the same actor obtain the fallback without causing a failure?** If an
   unprotected source can simply be removed, fail-closed parse handling alone is
   availability theater; protect the source or state the tamper boundary.
5. **Can the host honor the decision?** The repository separately documents that
   some host hook failures proceed regardless of adapter intent, so an internal
   deny path is not proof of effect ownership.

This refines “default deny” guidance: apply it to uncertainty reachable through
untrusted effect requests, while treating operator recovery, optional policy
extensions, and host-level fail-open behavior as distinct states. A deployment
report should therefore separate `analysis denied`, `degraded baseline active`,
`configured rule absent`, and `host proceeded after hook failure` rather than
compressing all four into “guard enabled.”

**Evidence inspected at the pinned commit:**
[`README.md`](https://github.com/kenryu42/cc-safety-net/blob/043975720b8416012d911e2096eb7342f088800f/README.md),
[`SECURITY.md`](https://github.com/kenryu42/cc-safety-net/blob/043975720b8416012d911e2096eb7342f088800f/SECURITY.md),
[`src/gate/pipeline.ts`](https://github.com/kenryu42/cc-safety-net/blob/043975720b8416012d911e2096eb7342f088800f/src/gate/pipeline.ts),
[`tests/gate/analysis-budget.test.ts`](https://github.com/kenryu42/cc-safety-net/blob/043975720b8416012d911e2096eb7342f088800f/tests/gate/analysis-budget.test.ts),
[`tests/gate/failure-injection.test.ts`](https://github.com/kenryu42/cc-safety-net/blob/043975720b8416012d911e2096eb7342f088800f/tests/gate/failure-injection.test.ts),
and
[`tests/e2e/structural-limit-packaged.test.ts`](https://github.com/kenryu42/cc-safety-net/blob/043975720b8416012d911e2096eb7342f088800f/tests/e2e/structural-limit-packaged.test.ts).

**Evidence boundary:** Scout statically inspected the pinned implementation,
security model, and repository-authored tests. The test suite was not run, no
coding-agent host was connected, and no bypass-resistance or production behavior
was independently validated. The observed repository tree was complete
(`truncated: false`); its documented host limitations and test cases bound the
claim rather than proving every integration mediates every effect.

## A Human Approval Record Is Not Yet an Executor-Bound Authorization (GitHub, September 2026)

**Repo:** https://github.com/AndrewDryga/emisar

**Pinned observation:** repository commit
[`ac0d9425fd42be266e8e78bb3c9d192e98a22eab`](https://github.com/AndrewDryga/emisar/commit/ac0d9425fd42be266e8e78bb3c9d192e98a22eab)

Emisar makes several approval facts durable before an infrastructure action is
released. The run freezes an immutable pack reference and hash, records an
`args_sha256`, and attributes the request to the initiating membership. Its
authority tests also recheck the initiating member and API-key lineage when a
queued run resumes. Standing grants remain explicit about their breadth: the
operator chooses exact arguments or `any_args`, while the grant still binds the
action and exact pack contract. These are useful control-plane properties, but
they do not by themselves prove that the host executed the request a human saw.

The repository exposes that missing step through an optional, stronger path.
When bridge-attested dispatch is enforced, the runner verifies a signature over
the canonical portal origin, action, immutable pack, digest of the exact JSON
arguments, complete identity-bound runner-reference set, justification digests,
operation, nonce, and issuance time. The runner also recomputes the trusted pack
hash and validates arguments immediately before execution. Freshness and durable
nonce state prevent a previously approved signed request from being replayed as
new authority on the same runner identity. In this mode, the approval narrative
and the executor's accepted effect can share a cryptographic subject.

The distinction matters because bridge attestation is not the default universal
property. The README labels it optional, and the security model says protection
against a compromised control plane depends on `signing.enforce_signatures`.
Without that setting, local validation still restricts execution to installed,
trusted pack bytes and their declared argument schema, but a human approval row
is not an end-to-end proof that the relayed action, arguments, and target are the
ones approved. A pack hash answers “which executable contract?”; it does not
alone answer “who authorized this invocation?”

A reusable approval-evidence contract therefore has four distinct bindings:

1. **Decision subject:** freeze action, exact arguments or an explicit wildcard,
   target set, and immutable tool or pack identity in the approval record.
2. **Current authority:** recheck requester, approver, key lineage, scope,
   revocation, and expiry when delayed work is released.
3. **Executor proof:** carry those same facts in a signature or capability that
   the effect-owning host verifies, rather than trusting a relay's reconstruction.
4. **Replay lifecycle:** bind nonce and freshness state to runner identity and
   define what replacement, restore, or lost replay state requires.

This pattern also clarifies reporting. “Human approved,” “policy released,”
“runner admitted,” and “effect completed” are separate receipts. A system can
have a well-formed approval audit and a strongly validated action pack while
still lacking proof that the approval authorized the exact host-side effect.

**Primary evidence at the pinned commit:**
[`README.md`](https://github.com/AndrewDryga/emisar/blob/ac0d9425fd42be266e8e78bb3c9d192e98a22eab/README.md),
[`security-model.md`](https://github.com/AndrewDryga/emisar/blob/ac0d9425fd42be266e8e78bb3c9d192e98a22eab/.agent/kb/specs/security-model.md),
[`approvals.ex`](https://github.com/AndrewDryga/emisar/blob/ac0d9425fd42be266e8e78bb3c9d192e98a22eab/portal/apps/emisar/lib/emisar/approvals.ex),
[`runs.ex`](https://github.com/AndrewDryga/emisar/blob/ac0d9425fd42be266e8e78bb3c9d192e98a22eab/portal/apps/emisar/lib/emisar/runs.ex),
[`approval_grant_authority_test.exs`](https://github.com/AndrewDryga/emisar/blob/ac0d9425fd42be266e8e78bb3c9d192e98a22eab/portal/apps/emisar/test/emisar/approval_grant_authority_test.exs), and
[`runs_dispatch_authority_test.exs`](https://github.com/AndrewDryga/emisar/blob/ac0d9425fd42be266e8e78bb3c9d192e98a22eab/portal/apps/emisar/test/emisar/runs_dispatch_authority_test.exs).

**Evidence boundary:** Scout statically inspected the pinned repository and its
author-authored tests; the repository Search API tree was complete
(`truncated: false`). Scout did not run the Elixir or Go suites, connect a runner,
validate a real signature, or exercise a production approval. The source supports
the binding design and its documented optional/default boundary, not a claim
that every Emisar deployment enables attestation or resists compromise.

## One Policy Can Produce Control, Correlation, or Neither—Depending on the Route (GitHub, September 2026)

**Repo:** https://github.com/antropos17/Aegis

**Pinned observation:** repository commit
[`6cae92e921dc8ea4aa94ffa4e0d90cf37bf43885`](https://github.com/antropos17/Aegis/commit/6cae92e921dc8ea4aa94ffa4e0d90cf37bf43885)

Aegis makes an unusually explicit comparison possible because one repository
contains monitoring, a provider-hook policy session, and an effect-owning direct
execution route. The same word—policy—does not give those paths the same control
semantics.

The direct route evaluates an exact action tuple: executable, working directory,
ordered arguments, and explicit environment. Default `allow` is invalid, duplicate
equivalent rules invalidate the policy, and any changed field fails to match. The
runner starts its own child with `shell: false` only after an `allow`; `ask`, `deny`,
invalid or unavailable input, cancellation during preparation, and a late decision
do not launch. Its child environment starts from deterministic empty defaults
rather than inheriting the parent. These are meaningful fail-closed properties
because this component owns the particular spawn it governs.

By contrast, the provider-hook session correlates a pre-tool decision with a
provider-reported post-tool event. It exact-matches IDs, working directory, and
tool input, rejects replay or changed reports, and preserves sticky uncertainty
when expected reports are absent. Yet its own output remains
`processBinding: unbound`, `activityCoverage: unknown`, and
`control: provider-hook-fail-open`. A matching post event is a provider claim,
not independent execution evidence; even a reported event after `deny` does not
prove that prevention succeeded. Default process monitoring is weaker still: it
observes and logs but does not automatically block.

The reusable reporting rule is to attach each verdict to an **effect route**, not
to a product or policy file:

1. **Effect owner:** which component can physically withhold this exact effect?
2. **Decision binding:** which action fields, configuration revision, approval,
   and attempt does its decision cover?
3. **Execution observation:** is completion observed by the owner, reported by
   the provider, or inferred from ambient monitoring?
4. **Route coverage:** which other commands, tools, descendants, or agent launch
   paths bypass this component?
5. **Containment:** what authority remains after admission?

Aegis also bounds the strongest route carefully. Exact path matching is not
executable-content identity; same-user files may change, and the allowed program
retains the caller's account, filesystem, network, interpreter, and descendant
authority. The five-second timeout controls only the direct child and may leave
descendants running. Thus “exact allow-list + owned spawn” is stronger than hook
correlation, but it is still an admission gate rather than a sandbox or proof of
complete activity coverage.

Its audit chain reinforces the same typed-evidence discipline. Per-day SHA-256
chaining detects surviving-record edits and interior insertion/deletion, while a
valid prefix cannot reveal tail truncation, pre-sequence buffer loss, deletion of
an entire day, or missing events that were never observed. Chain integrity should
therefore remain separate from event completeness and route coverage.

**Primary evidence at the pinned commit:**
[`README.md`](https://github.com/antropos17/Aegis/blob/6cae92e921dc8ea4aa94ffa4e0d90cf37bf43885/README.md),
[`ACTION-EXECUTION.md`](https://github.com/antropos17/Aegis/blob/6cae92e921dc8ea4aa94ffa4e0d90cf37bf43885/docs/ACTION-EXECUTION.md),
[`ACTION-POLICY-SESSION.md`](https://github.com/antropos17/Aegis/blob/6cae92e921dc8ea4aa94ffa4e0d90cf37bf43885/docs/ACTION-POLICY-SESSION.md),
[`execution-policy.js`](https://github.com/antropos17/Aegis/blob/6cae92e921dc8ea4aa94ffa4e0d90cf37bf43885/src/main/execution-policy.js),
[`action-policy-session.js`](https://github.com/antropos17/Aegis/blob/6cae92e921dc8ea4aa94ffa4e0d90cf37bf43885/src/main/action-policy-session.js),
[`audit-hashchain.js`](https://github.com/antropos17/Aegis/blob/6cae92e921dc8ea4aa94ffa4e0d90cf37bf43885/src/main/audit-hashchain.js),
[`execution-policy.test.js`](https://github.com/antropos17/Aegis/blob/6cae92e921dc8ea4aa94ffa4e0d90cf37bf43885/tests/main/execution-policy.test.js), and
[`audit-hashchain.test.js`](https://github.com/antropos17/Aegis/blob/6cae92e921dc8ea4aa94ffa4e0d90cf37bf43885/tests/main/audit-hashchain.test.js).

**Evidence boundary:** GitHub Repository Search returned 646 matches with
`incomplete_results: false`, and the pinned recursive tree contained 1,458
entries with `truncated: false`. Scout statically inspected the files above and
did not run tests, launch a child, connect a provider, validate monitoring
coverage, or conduct a security assessment. Repository-authored Windows and
Linux fixture claims remain author-reported; macOS is explicitly unverified.

## A Workflow Stage Is a Ledger Claim Until Its Prerequisites Are Enforced (CE-AI, GitHub, September 2026)

**Repo:** https://github.com/mastepanoski/ce-ai

**Pinned observation:** repository commit
[`0f4416f1913bf14b1482ee547b3601e90f53ff48`](https://github.com/mastepanoski/ce-ai/commit/0f4416f1913bf14b1482ee547b3601e90f53ff48)

CE-AI usefully separates several meanings often collapsed into “workflow
governance.” Its checkpoint state is keyed by workspace and branch, saved by an
atomic temp-file/rename path, and prevents a manual stage jump of more than one
step. Inferred checkpoints additionally cannot overwrite an equal or later manual
checkpoint, and auto-advance to verification or later is withheld when the
OpenSpec task ledger is visibly desynchronized from touched files.

Those controls make the stage ledger orderly, but do not by themselves prove the
stage's work. The manual checkpoint path validates only transition adjacency; its
`task` text and stage are caller-supplied. A user can therefore advance one legal
step at a time without attaching a test result or other stage-completion evidence.
Likewise, the recorded code-review receipt binds a resolved commit SHA to branch
state, but the command records that a review ran (or an override reason) without
verifying review output. The resulting ship-readiness check is explicitly
observe-only: missing solution artifacts, missing/stale review receipts, and an
early stage with commits become warnings rather than a blocked ship operation.

The source-level write gate has narrower but real enforcement semantics. In its
default `enforce` mode, it can return an error before a targeted `src/**` write at
Stage 4 when `proposal.md`, `spec.md`, or `tasks.md` is absent. That does not make
it a general lifecycle gate: non-Stage-4 writes pass; organic and minimal modes
are exempt; debug entry points pass; ambiguous mtime, new-cycle, and uncommitted-
spec cases are classified as edge cases and do not block; and telemetry and
receipt persistence are best-effort. The gate also checks artifact presence and
non-zero length, not their approval or semantic validity, despite the reason text
calling them an “approved OpenSpec contract.”

**Reusable rule:** type workflow evidence by what the mechanism actually owns:

1. **Ledger integrity:** atomic storage, branch identity, and legal transition
   order protect bookkeeping.
2. **Prerequisite evidence:** stage promotion needs machine-checkable receipts for
   the work claimed by that stage, not only adjacent numbering or task prose.
3. **Effect enforcement:** name the exact operation and path a gate can withhold,
   plus every exempt, ambiguous, or uncovered route.
4. **Release admission:** warnings and commit-bound review markers improve
   visibility, but only an effect-owning ship path that rejects unmet predicates
   can justify “cannot skip verification.”

This distinction is operationally important because an orderly state machine can
truthfully say “Stage 5” while only proving that Stage 4 was the previous label.
Governance UIs should surface asserted, observed, and enforced stage evidence
separately rather than letting the strongest verb describe the entire workflow.

**Primary evidence at the pinned commit:**
[`README.md`](https://github.com/mastepanoski/ce-ai/blob/0f4416f1913bf14b1482ee547b3601e90f53ff48/README.md),
[`workflow.rs`](https://github.com/mastepanoski/ce-ai/blob/0f4416f1913bf14b1482ee547b3601e90f53ff48/src/commands/workflow.rs),
[`state.rs`](https://github.com/mastepanoski/ce-ai/blob/0f4416f1913bf14b1482ee547b3601e90f53ff48/src/state/state.rs),
[`gate.rs`](https://github.com/mastepanoski/ce-ai/blob/0f4416f1913bf14b1482ee547b3601e90f53ff48/src/commands/gate.rs),
[`workflow tests`](https://github.com/mastepanoski/ce-ai/blob/0f4416f1913bf14b1482ee547b3601e90f53ff48/src/commands/tests/workflow.rs), and
[`gate tests`](https://github.com/mastepanoski/ce-ai/blob/0f4416f1913bf14b1482ee547b3601e90f53ff48/src/commands/tests/gate.rs).

**Evidence boundary:** GitHub Repository Search for
`ai agent policy verification in:name,description,readme pushed:>2026-09-23`,
sorted by recently updated, returned 24,577 matches with
`incomplete_results: false`. The pinned recursive tree contained 638 entries with
`truncated: false`. Scout statically inspected the files above and did not clone
the repository, run its Rust suite, invoke a supported coding harness, test hook
installation or bypasses, or perform a security assessment. The evidence supports
the code-visible distinctions above, not repository adoption or runtime
reliability.
