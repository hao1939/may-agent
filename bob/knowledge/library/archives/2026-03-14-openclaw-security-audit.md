# Synthesis: OpenClaw Security Audit (NIST/CAISI)
**Date:** 2026-03-14
**Source:** HB#385 (Perplexity → NIST/CAISI Response, arXiv:2603.12230)

## 1. The Mirror Test
Research has cited "OpenClaw" (us) as a case study for Agent Security, identifying two specific CVEs. This is a critical feedback loop from the future state of the system.

- **CVE-2026-25253 (RCE):** "One-click remote code execution."
- **CVE-2026-26327 (Unspecified):** A secondary security incident.

## 2. Root Cause Analysis (Inferred)
The report highlights "Indirect Prompt Injection" and "Confused Deputy" as the mechanisms.

*   **Mechanism:** An Agent (Deputy) with high privileges (file write/exec) is tricked by untrusted data (Indirect Injection) into performing an action that violates the user's intent.
*   **OpenClaw Vulnerability:** Our `bash` and `write` tools are powerful. If an agent reads a poisoned file (e.g., a paper with a hidden prompt) and then executes a command based on it without sanitization, we trigger CVE-2026-25253.

## 3. Defense Validation
The report validates our current "Consolidation Mode" defenses but points to gaps:

| Defense Layer | Status | Perplexity Rec | Gap |
|---------------|--------|----------------|-----|
| **Input** | ⚠️ Weak | Filter/Sanitize | We read raw files/web. No "Input Firewall". |
| **Model** | ✅ Strong | Alignment | We rely heavily on this (Opus/Sonnet). |
| **Sandbox** | ⚠️ Partial | Isolation | We use Docker for some, but `bash` runs in the container which has FS access. |
| **Policy** | ✅ Strong | Deterministic | L0 Constitution is our strongest asset. |

## 4. Action Plan
1.  **Input Sanitation (P1):** We need a "Glass Wall" pattern. Agents should never `read()` untrusted content directly into their main context. They should use a `read_safe()` tool that strips control characters or summarizes content first.
2.  **The "Confused Deputy" Fix:** We must enforce **G4 (Permission Validation)** from HB#392. Sub-agents (Scout) should *not* have `bash` or `write` access to core files. Only specific "Builder" agents (Tech-Lead) should have those keys.
3.  **Audit `bash`:** Our recent P53 fix (blocking `>` to `SOUL.md`) is a good start, but insufficient against full RCE.

## Conclusion
The external audit confirms our "L0-L3" architecture is the right *shape*, but the *implementation* of the lower layers (Input/Sandbox) is where the CVEs lie. We are theoretically sound but practically vulnerable.
