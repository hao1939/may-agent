# Approval context

- `reports.app` has one maintain task, `improve/reports`.
- The current task is generation 9 and waits on candidate fingerprint `new-9`.
- Hao's reply was attached to generation 8 and fingerprint `old-8`.
- Generation 8 is closed. Its artifact differs from the current candidate.
- The app accepts an approval only when the approval id, task generation, and
  artifact fingerprint all match.
- No files or production state have changed.
