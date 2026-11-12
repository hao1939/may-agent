<ai_context>
summary: "Agent-Safe-Input separates an agent-held SSH key from a human-entered sudo password and records explicit success, failure, or cancellation, but its human review and privileged execution read the queued script in separate SSH operations. Because the agent and approval runner use the same remote account and the queued file remains writable, approval is not bound to the bytes later executed. The reusable rule is to freeze or content-address the reviewed artifact and make privileged execution consume that exact snapshot. Evidence is static and producer-authored; Scout did not run the tool, reproduce the race, or test SSH and sudo behavior."
triggers: ["agent privileged command approval", "sudo password separation", "approval TOCTOU", "reviewed bytes", "Agent-Safe-Input", "human approval binding"]
last_updated: "2026-11-12"
source_basis: "Static inspection of HarryXZX/Agent-Safe-Input at commit a0208addf86738fe5a9241afac7928d85f12c014, including README, bin/agent-safe-input, and the complete untruncated 30-entry repository tree. Scout did not execute the script, SSH, sudo, tests, or a concurrent replacement attempt."
</ai_context>

# Human Approval Must Bind the Bytes That Privileged Execution Consumes

**Date:** 2026-11-12  
**Disposition:** new knowledge  
**Repo:** https://github.com/HarryXZX/Agent-Safe-Input  
**Inspected revision:** [`a0208addf86738fe5a9241afac7928d85f12c014`](https://github.com/HarryXZX/Agent-Safe-Input/commit/a0208addf86738fe5a9241afac7928d85f12c014)

## Source observation

Agent-Safe-Input addresses a real authority-separation problem: an AI agent can
connect to a remote host with an SSH key but does not receive the human's sudo
password. The agent queues a shell script; a person runs a separate interactive
command, reads the full script, explicitly confirms it, and types the password
into sudo's TTY. The tool clears sudo's cached timestamp before and after the
run, requires an interactive terminal, stores queue files in a mode-0700
directory under mode 0600, and emits a result with distinct `success`, `failed`,
or `cancelled` status. The explicit cancellation state is useful because a
human refusal should not be interpreted as a transient execution failure and
silently retried.

The pinned implementation nevertheless does not bind that approval to the
executed bytes. `cmd_run` performs these as separate operations:

1. an ordinary SSH command runs `cat $REMOTE_DIR/$id.sh` to display the script;
2. confirmation is collected locally;
3. another SSH command runs `sudo -k`; and
4. a new interactive SSH command runs `sudo bash $REMOTE_DIR/$id.sh`.

The queued path is under the same remote user's home directory and remains
writable by that user throughout the sequence. The agent's documented authority
includes the SSH key for that account, and `cmd_queue` itself writes the file by
SSH as that user. Therefore an agent process—or any other process with the same
remote-account authority—can replace the queued script after it is displayed
but before `sudo bash` opens it. Mode 0600 protects the file from other users;
it does not protect it from its owner. Requiring a TTY and keeping the password
out of agent context protects the credential, but neither establishes that the
human-approved bytes are the bytes elevated to root.

This matters specifically under the repository's stated prompt-injection
scenario. The README says the gate is intended to let the person inspect a
script from an agent that may have produced a malicious command. In that threat
model, treating the agent-controlled path as stable across review and execution
leaves a time-of-check/time-of-use gap. The source's claim that the person sees
the bytes that will execute is stronger than the pinned implementation supports.

## Reusable finding: credential separation and artifact binding are different controls

A privileged agent approval path needs at least two independent guarantees:

- **Secret separation:** the agent cannot read, replay, or inherit the human's
  authentication secret or cached privileged session.
- **Subject binding:** the privileged executor consumes the exact immutable
  bytes—or exact canonical action digest—that the person reviewed and approved.

A safer implementation can fetch the candidate once into a human-side private
snapshot, show that snapshot, and after confirmation stream those same bytes to
`sudo bash -s`, rather than reopening an agent-writable remote path. Another
option is a privileged or otherwise agent-inaccessible staging service that
atomically freezes the candidate, returns a digest for review, and executes only
the frozen object after checking that digest. Merely printing a hash is not
enough if execution later reopens a mutable filename; the executor must verify
and consume the same snapshot, file descriptor, or content-addressed object.

The durable approval receipt should record the candidate digest, target host,
requested privilege, approver identity from a trusted channel, decision, and
execution result. A changed candidate should require a new approval rather than
inherit the old one. This is the command-execution form of the broader rule in
[Agent Evidence Must Bind the Exact Artifact](./2026-11-10-agent-evidence-must-bind-exact-artifact.md): valid evidence about one subject becomes inapplicable when the subject changes.

## Evidence boundaries

- This is a static implementation finding. Scout did not install or run the
  tool, reproduce a concurrent replacement, exercise SSH or sudo, or inspect a
  deployed host's user separation and filesystem controls.
- The complete pinned tree contains the main Bash implementation, documentation,
  localization checks, installation helpers, and agent-skill files, but no
  repository test suite that exercises the review-to-execution race. Absence of
  such tests in the inspected tree is not evidence that maintainers have never
  tested the path elsewhere.
- The observation assumes the agent can continue acting as the configured
  remote user while the human reviews, which matches the documented SSH-key
  model. A deployment that independently suspends that principal or places the
  queue in storage the agent cannot mutate could close the gap outside this
  script; Scout did not inspect such a deployment.
- The repository is newly published and may change. The finding applies to the
  pinned commit, not later revisions.
- The result contract, TTY requirement, and sudo timestamp invalidation remain
  useful controls. The artifact-binding gap does not imply that the tool leaks
  the password or that every use is compromised.

## Sources inspected

- Repository: https://github.com/HarryXZX/Agent-Safe-Input
- Pinned README and threat model: https://github.com/HarryXZX/Agent-Safe-Input/blob/a0208addf86738fe5a9241afac7928d85f12c014/README.md
- Queue, review, confirmation, and execution implementation: https://github.com/HarryXZX/Agent-Safe-Input/blob/a0208addf86738fe5a9241afac7928d85f12c014/bin/agent-safe-input
- Complete tree API: https://api.github.com/repos/HarryXZX/Agent-Safe-Input/git/trees/a0208addf86738fe5a9241afac7928d85f12c014?recursive=1
