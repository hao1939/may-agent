# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1777052436524_216
- **Status:** interrupted
- **When:** 2026-04-24T19:14:51.229Z
- **Duration:** 94m14s

## What Happened
**N=3 Pilot Results — EXP-178:**

| Arm \ Scenario | sql-injection (medium) | cascading (hard) |
|---|---|---|
| **G1** no-guard | 3/3 (100%) | 0/3 (0%) |
| **G2** production-mode | 2/3 (67%) | 0/3 (0%) |
| **G3** passive-injection | 3/3 (100%) | 0/3 (0%) |
| **G4** adaptive | 3/3 (100%) | 1/3 (33%) |

**Surprising findings vs pre-registered predictions:**
- **G1 sql-injection at 100%** — WAY above the expected 30-45% baseline. The agent seems much better at recognizing SQL injection now than when baseline was measured (~33%).
- **Cascading still hard** — 0% for G1/G2/G3, one pass for G4
- **G4 shows the only cascading pass** — promising for the adaptive hypothesis
- **G2 production-mode may HURT** on sql-injection (67% vs 100% G1) — consistent with H-165 displacement on medium tasks too?

This is very interesting but N=3 is too small. Let me continue to N=5 to get better signal, then document and save. Let me run trials 4-5:
