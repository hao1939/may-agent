# Applying an approved source candidate

May prepares the candidate and packet, returns them for human review, and waits
on the ordinary human-owned Condition. A score, worker claim, or JSON containing
`trustedHumanControl: true` is not approval. Gym cannot apply production changes.

The primary plain-text path uses the exact proposal shown by Telegram and the
Host journal event id. After approval, May may invoke this bounded path; before
approval it has no mutation authority. The command rereads that event through
public `event.get`, parses the current Host stamp with the SDK's
`readVerifiedApprovalDecision`, and checks the exact owning Task generation,
Condition subject, expected contract and displayed proposal before running the
Git/evidence guard. The journal's nested `proposal` carries that binding;
`hostApproval` records trusted ingress and actor authorization. Flat legacy
fields and Telegram `provenance` cannot authorize this path. Its policy still
requires a human reply; a Host-verified operator event does not become approval
through this command. The packet-hash operator fallback below remains available.

Current source is verified by the [approval cleanup trial](../../alex.app/docs/archive/reviews/improvement-approval-contract-cleanup-20261112.md).
That synthetic trial does not establish installed activation.

```sh
bun projects/may.app/scripts/apply-improvement.ts \
  --packet /review/packet.json --proposal /review/proposal.json \
  --event-id 12345 --repo /target/clean-checkout \
  --diff /review/change.patch --verification /review/verification.json \
  --comparison /review/comparison.json --receipt /review/application.json
```

Reject and defer write a denial receipt and make no source mutation. Replaying
the same approved event after the candidate is already the clean target is an
idempotent success. The receipt remains source-only: it does not authorize or
prove App/Host activation.

The manual fallback lets an operator check the actual human decision and invoke
the same source command with an exact packet hash:

```sh
bun projects/may.app/scripts/apply-improvement.ts \
  --packet /review/packet.json --repo /target/clean-checkout \
  --diff /review/change.patch --verification /review/verification.json \
  --comparison /review/comparison.json --receipt /review/application.json \
  --approve EXACT_PACKET_SHA256
```

Omitting `--approve` performs checks and writes a denial receipt with no source
change. Review files and the new receipt belong outside the target checkout.
The command reads the actual Git baseline, candidate commit and tree, full binary
diff and retained evidence bytes. It refuses a dirty checkout, changed evidence,
different scope or stale approval. It performs only a fast-forward and verifies
the resulting commit and clean status. Use exclusive operator control of the
checkout during this bounded operation; it is not a distributed Git lock.

The packet uses `ApprovalPacket` in `improvement-approval.ts`. `packetHash` is
computed by its `packetHash` function over the other fields. Bind full 40-character
Git identities and SHA-256 hashes of the exact artifact bytes; generate the diff
with `git diff --binary --no-ext-diff --no-renames BASELINE CANDIDATE`.
`activationScope` is exactly `git-fast-forward:` followed by the target worktree's
real absolute path. `rollbackCommit` names the prior baseline. Keep the human
summary, commands, failed trials and limitations with the hashed evidence. The
human judges whether that evidence establishes the intended improvement; hashes
prove identity, not quality.

This command applies source only. If the displayed packet separately authorizes
the exact App-definition activation, `improvement-activation-follow-up` rereads
the trusted decision and source receipt, continues only the same current owner
generation, and emits the existing reload operation with the candidate source
commit pinned. Its correlated result must report that exact loaded commit;
failed or inconclusive adoption remains open. After the approval Condition is
satisfied and the exact activation operation is durably issued, later reconciliation
continues only from that retained request identity; it must not rediscover or widen
authority from mutable Task presentation. Host-binary deployment and any unshown
scope still use a separate
explicit operator procedure. Independent Evaluation follows verified adoption
only when a concrete current-generation Task outcome was executed afterward.

The command is not a public App input kind or standing controller. The manual
packet-hash CLI remains an operator fallback and an operational authority
boundary, not an OS security boundary against an agent that has arbitrary shell
access. Never infer consent merely because an agent could physically invoke it.
A failure retains its receipt and current source for inspection; restoring a live
release follows the reviewed rollback scope.
