<ai_context>
summary: "Pipelock recovery-seal evidence shows that signed recovery metadata should attest a damaged-log discontinuity without upgrading it to continuous evidence. This is the narrow writable addendum for the accepted 2026-11-08 update to the protected agent-security enforcement-evidence note."
triggers: ["Pipelock", "recovery seal", "attested discontinuity", "damaged log", "receipt continuity", "END UNPROVEN", "evidence recovery"]
last_updated: "2026-11-08"
source_basis: "Static documentation and source inspection at pipelab-org/pipelock commit cfb7b6838f6fd13a529abe35a0561f1095aa6fdb."
</ai_context>

# Pipelock Recovery Seals: Attest the Break, Do Not Relabel It as Continuity

This finding is a narrow addendum to [A Receipt's Validity Is a Vector, Not a Boolean](../agent-security-enforcement-evidence.md#a-receipts-validity-is-a-vector-not-a-boolean-github-september-2026). It preserves the accepted follow-up without replacing or renaming that established note.

**Repo:** https://github.com/pipelab-org/pipelock

**Pinned observation:** repository commit
`cfb7b6838f6fd13a529abe35a0561f1095aa6fdb`

After the repository moved from `luckyPipewrench/pipelock` to
`pipelab-org/pipelock`, the current source adds a useful failure-evidence pattern:
a signed `recovery_seal` for a torn recorder shard. The seal binds the full raw
damaged shard by size and SHA-256, the end of its complete newline-terminated
prefix, the last complete action-receipt head, and a fresh successor run's signed
`session_open`. Verification re-reads those artifacts rather than trusting only
the seal's embedded fields, and cross-language fixtures exercise the Go,
TypeScript, and Rust verifiers.

Crucially, the verifier reports `attested_discontinuity`, keeps the evidence
directory unhealthy, and exits non-zero. The seal records that recovery observed
a damaged predecessor and continued in a new run; it does **not** restore missing
bytes, establish why they disappeared, or prove that no earlier run was omitted.
A copied seal must also fail when its shard, predecessor, or successor bindings do
not match.

This extends the receipt-validity vector with a sixth independent axis:

6. **Continuity:** does the evidence prove an uninterrupted history, or only bind
   an explicitly damaged prefix to a successor?

The operational rule is broader than Pipelock: recovery metadata should be a
signed, replay-resistant admission of discontinuity, not a mechanism that turns
a broken log green. Health status, exit code, and downstream acceptance must
preserve the distinction between **valid evidence of damage** and **valid
continuous evidence**. Endpoint proof remains separate as well: current chain
verification treats an otherwise valid receipt prefix as `END UNPROVEN` unless a
terminal close, whole-recorder boundary, closed receipt group, or independently
known head/sequence proves the selected scope's end.

**Evidence inspected at the pinned commit:**
[`README.md`](https://github.com/pipelab-org/pipelock/blob/cfb7b6838f6fd13a529abe35a0561f1095aa6fdb/README.md),
[`docs/specs/evidence-recovery-seal-v1.md`](https://github.com/pipelab-org/pipelock/blob/cfb7b6838f6fd13a529abe35a0561f1095aa6fdb/docs/specs/evidence-recovery-seal-v1.md),
[`docs/guides/receipt-verification.md`](https://github.com/pipelab-org/pipelock/blob/cfb7b6838f6fd13a529abe35a0561f1095aa6fdb/docs/guides/receipt-verification.md),
[`docs/evidence/hard-limits.md`](https://github.com/pipelab-org/pipelock/blob/cfb7b6838f6fd13a529abe35a0561f1095aa6fdb/docs/evidence/hard-limits.md),
and
[`internal/receipt/recovery_seal.go`](https://github.com/pipelab-org/pipelock/blob/cfb7b6838f6fd13a529abe35a0561f1095aa6fdb/internal/receipt/recovery_seal.go).

**Evidence boundary:** Scout inspected current documentation and static source
only. It did not run Pipelock, reproduce a torn-shard recovery, execute the
cross-language fixtures, validate deployment mediation, or independently verify
cryptographic correctness.
