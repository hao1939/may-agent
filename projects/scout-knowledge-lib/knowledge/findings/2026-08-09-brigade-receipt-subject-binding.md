<ai_context>
summary: "GitHub finding on Brigade's local-first verification receipts: exit codes become durable evidence, but only manifest-selected runs with artifact, patch, producer, and independent-verifier bindings are scoreable; ad hoc command receipts remain audit-only."
triggers: ["Brigade", "verification receipt", "subject binding", "patch-backed verification", "scoreable evidence", "agent outcome scoring", "local-first agent operations"]
last_updated: "2026-08-09"
source_basis: "GitHub repository metadata, README, execution model, receipt schema, outcome scoring documentation, and verification implementation for escoffier-labs/brigade; checked via GitHub API."
</ai_context>

# Brigade: A Test Receipt Is Not Yet Proof of Which Work Passed

Date: 2026-08-09  
Source: GitHub  
Repo: https://github.com/escoffier-labs/brigade

## Signal

**Brigade** is a local-first operator CLI for coding agents that turns verification
commands into durable receipts. Its more important design choice is narrower:
it explicitly distinguishes a command receipt that proves **a check ran** from a
bound receipt that can support claims about **which artifact and patch passed**.

That distinction addresses a common evidence gap in agent workflows. A real exit
code is better than an agent's prose, but an unbound green test can still belong
to the wrong tree, patch, producer, or subject.

## Source-grounded details

- **Repository status:** GitHub metadata reports an MIT-licensed repository
  created 2026-05-13, with 65 stars and five forks at observation time. Release
  `v0.26.0` was published 2026-08-06. These are adoption signals, not evidence
  that the system's reliability claims have been independently benchmarked.
- **Durable local receipts:** `brigade work verify run` executes checks and writes
  `.brigade/work/verify-runs/<run-id>/receipt.json`. The documented receipt
  includes resolved argv, environment assignments, real exit status, logs, Git
  state, code-graph delta, and optional digest/signature fields.
- **Work identity is a tuple:** receipt schema version 2 always includes
  `baseline_commit`, `tree_fingerprint`, and `changes_patch_sha256`, using null
  values when identity capture is unavailable. This makes missing binding
  visible rather than silently treating a passing command as patch proof.
- **Scoreable evidence has a higher bar:** the receipt contract says only tracked,
  manifest-selected runs can carry `subject_binding`. That object binds the
  artifact and content fingerprint to the exact verifier manifest, patch source,
  producer-owned delta, independent verifier identity, and either a patch or
  fixture case. The docs explicitly classify ad hoc `--command` and
  `--argv-json` runs as **audit-only, non-scoreable**.
- **Verification is not executed through a shell:** the implementation parses
  argv, rejects shell executables and shell metacharacters on the raw-command
  path, checks executable resolution, and invokes checks directly. This narrows
  command ambiguity and shell-expansion risk, though it does not make the tested
  program itself trustworthy.
- **Evidence retention is fail-safe:** the documented archive flow hashes copied
  receipt bytes and retains the local run if archival fails. It rejects archive
  overlap, symlink/special-file source trees, and mismatched existing archive
  destinations.
- **Outcome scoring is recomputed from evidence:** successful runs score +1,
  model/output failures score -1, and allowlisted infrastructure-only failures
  are neutral. A completed verifier failure forces -1, and an apparently
  successful run with no non-Brigade file change is marked `suspected_noop` and
  scored -1. The scoring rules are current-code interpretations rather than
  immutable verdicts stamped at run time.
- **Explicit invocation boundary:** the execution model says Brigade has no
  scheduler daemon. Cron, CI, systemd, or an agent invokes it; local mutation is
  attributable to an explicit command or approved runbook step.

## Why it matters

The useful pattern is an **evidence ladder**, not merely “save test output”:

1. **Claim:** the agent says checks passed.
2. **Execution receipt:** a process really exited with the recorded status.
3. **State binding:** the receipt identifies the baseline, tree, and patch.
4. **Subject binding:** the check is tied to a named artifact and verifier-owned
   manifest.
5. **Authority separation:** producer identity and independent verifier identity
   are both recorded.
6. **Outcome use:** only sufficiently bound evidence may influence promotion or
   routing decisions.

Brigade's schema exposes where a workflow sits on this ladder. That prevents a
cryptographically signed but semantically unbound receipt from acquiring more
authority than it deserves: integrity can prove that a record was not changed,
but only subject and state binding establish what the record is evidence *of*.

## Connections to Scout themes

- **Verified durable state:** complements
  [LongHorizon-Harness](./2026-08-04-github-longhorizon-harness-verified-state.md),
  which separates executor and auditor roles. Brigade adds a concrete on-disk
  binding contract for deciding which verification can become durable outcome
  evidence.
- **Externalized verification:** reinforces the broader finding that completion
  should be an evidence-backed state transition outside model narration.
- **Verification-commons risk:** shared test infrastructure is not enough when a
  receipt can be replayed against or detached from the wrong subject. Identity
  binding and verifier separation are prerequisites for safely sharing evidence.
- **Caveat:** the strongest observations here are architecture and implementation
  signals from the project's own repository. Scout did not independently run
  Brigade or validate its performance claims in this source check.

## Primary sources

- Repo: https://github.com/escoffier-labs/brigade
- README: https://github.com/escoffier-labs/brigade/blob/main/README.md
- Receipt schema: https://github.com/escoffier-labs/brigade/blob/main/docs/receipt-schemas.md
- Execution model: https://github.com/escoffier-labs/brigade/blob/main/docs/execution-model.md
- Outcome scoring: https://github.com/escoffier-labs/brigade/blob/main/docs/outcome-scoring.md
- Verification implementation: https://github.com/escoffier-labs/brigade/blob/main/src/brigade/work_cmd/verification.py
- Release `v0.26.0`: https://github.com/escoffier-labs/brigade/releases/tag/v0.26.0
