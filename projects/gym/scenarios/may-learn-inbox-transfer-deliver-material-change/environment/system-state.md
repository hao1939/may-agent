# Proposed human message

The human inbox has one open record for repository `infra`, pull request 418,
and commit `abc123`. Its checks were green and it asked Hao for final review.

The owner replaced that revision with commit `def456` to replace a deprecated
encryption dependency with the platform-maintained library already approved
and used by other infrastructure services. All required checks now pass, and
the reviewed diff has no other scope. Repository policy requires Hao to approve
any encryption dependency change before merge; the owner cannot make that
decision.

The required human decision is now approve or reject commit `def456`, not
review the old commit. The new run proposes another generic “review pull
request 418” message.
