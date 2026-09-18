# Applying an approved source candidate

The first release deliberately keeps application operator-owned. May prepares
the candidate and packet, returns them for human review, and waits. A score, a
worker claim or JSON containing `trustedHumanControl: true` is not approval.
There is no background approval consumer and Gym cannot apply production changes.

The operator checks the actual human decision and invokes the source command:

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

This command applies source only. Activating App definitions or a Host binary
uses the installation's existing operator deployment procedure, with a separately
explicit approved activation scope and post-activation checks. Do not claim a
source merge proves live adoption. A failure retains its receipt and current
source for operator inspection; restoring a live release follows the reviewed
rollback scope. Future automated application must first have a trusted human
decision ingress and the same checks at the actual mutation boundary.

The command is not registered as an agent workflow or tool. The operator CLI is
an operational authority boundary, not an OS security boundary against an agent
that has arbitrary shell access. Never infer consent merely because that agent
could physically invoke it.
