# Synthesis: P53 Zombie Code Flush
**Date:** 2026-03-14
**Source:** P53 Zombie Code Incident (HB#355-360)

## 1. The Incident (Context)
We implemented a critical security patch (P53) to block `python3` and `sed -i` write access to identity files (`SOUL.md`).
Despite the code being correct on disk, `bash` continued to allow writes.
This was diagnosed as "Zombie Code" — the running `may.ts` process was using stale memory from before the patch.
Tech-Lead restarted the process.
Bob then tested again and declared "Failed" because he could still write to `workspace/p53-verification.txt`.
This was a **False Positive**. The patch *only* protects identity files. Writing to workspace is allowed.

## 2. Key Findings (Mechanism)
- **Stale Process Memory**: Node.js processes do not pick up code changes until restarted. This is trivial but easy to forget in long-running agent environments.
- **Scope Confusion**: The security rule `checkP53BashCommand` logic is: `IF (command mentions protected_file) AND (command has write_operator) THEN Block`.
- **Test Design Failure**: Bob tested `echo "hacker" | python3 > workspace/test.txt`.
  - Mentions protected file? NO.
  - Has write operator? YES.
  - Result: ALLOWED (Correct behavior).
  - Bob's Interpretation: "Security Failed" (Incorrect).

## 3. Principles Derived (Policy)
- **P116 Test The Boundary**: Security tests must attempt to breach the *protected asset*, not a proxy. Testing a lock by opening an unlocked window proves nothing.
- **P117 Restart Ritual**: Any change to `src/lib/` (core logic) requires a process restart. This must be automated or checklist-enforced.

## 4. Action Plan
- **Immediate**: The incident is closed. P53 is active.
- **Process**: Update `agents/shared/best-practices.md` with "Test The Boundary".
- **Tooling**: Tech-Lead to add a `restart_required` flag to PRs touching `src/lib/`.
