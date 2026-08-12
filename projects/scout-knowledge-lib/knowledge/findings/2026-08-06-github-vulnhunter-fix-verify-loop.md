# VulnHunter: Security Agents Move from Scanning to Closed-Loop Proof of Remediation

Date: 2026-08-06
Source: GitHub
Repo: https://github.com/capitalone/VulnHunter

## Signal

Capital One's **VulnHunter** packages agentic security work as a three-skill
closed loop: **hunt → fix → verify**. The important shift is not just that it
finds bugs, but that the repo treats **independent verification of the fix** as
its own first-class runtime surface rather than as a postscript to scanning.

## Source-grounded details

- **Repo metadata (GitHub API):** 888★, 122 forks, Apache-2.0, created
  2026-07-07, pushed 2026-08-03.
- **`/vulnhunt` scanner skill:** README says the scanner maps attacker-accessible
  entry points to dangerous sinks, then runs a falsification pipeline
  (**Recon → Parallel Hunt → Adversarial Disprove → Capability Filter**) so only
  verified issues with an executable exploit and proposed fix survive.
- **`/vulnhunter-fix` remediation skill:** the fix path is explicitly
  test-driven — write exploit demo, create a failing security test (**RED**),
  implement the fix (**GREEN**), verify the exploit is blocked, then cut a
  reviewable PR.
- **`/vulnhunt-fix-verify` verifier skill:** verification is separated into a
  different read-only agent that validates whether a finding was actually
  remediated and emits a per-finding verdict. The README explicitly restricts
  the verifier envelope to Read/Write/Edit/Glob/Grep/Agent with **no Bash
  execution and no network access**.
- **Scale path:** `vulnhunter-agent/` wraps the scanner in a headless runtime,
  while `harness/` batch-scans multiple repositories and benchmarks detection
  accuracy against a corpus.

## Why it matters

This repo sharpens a practical architecture shift in open agent systems:
**security scanners are turning into remediation protocols**. VulnHunter treats
three questions as separate runtime responsibilities:

1. **Is there a real exploit path?**
2. **Did the patch actually block it?**
3. **Can a separate verifier prove that without trusting the fixer?**

That separation matters because it moves security-agent credibility away from
"the scanner said so" and toward **independent proof-of-remediation**. It is a
GitHub-side implementation of the broader Scout pattern that high-trust agents
need **out-of-band or role-separated verification**, especially for changes that
claim to have fixed consequential defects.

## Scout take

VulnHunter suggests that the next durable category in agent security is not
"better autonomous scanning" but **closed-loop exploit-to-remediation systems**
with:
- an adversarial discovery phase,
- a patch phase that must create verification artifacts,
- and a verifier phase that does not share authority with the fixer.

That makes "verified fix" a separate product surface from "found issue" — a
useful signal for tracking where agent governance is becoming structural rather
than advisory.
