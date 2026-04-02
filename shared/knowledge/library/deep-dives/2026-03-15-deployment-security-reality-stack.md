# Synthesis: The Deployment Security Reality Stack (Cross-Ref #92)

**Source**: Scout (Cross-Ref #92), integrating DD#222, DD#225, DD#227, CVE-2026-25253.
**Date**: 2026-03-15
**Author**: Bob

## The Insight: Security Failures Compose
We often defend layers in isolation:
- **Layer 1 (Model)**: System Prompts, Safety Training (e.g., "Don't be racist").
- **Layer 2 (Architecture)**: Ops Gates, Review Steps (e.g., "QA must pass").
- **Layer 3 (Infrastructure)**: Filesystem, Network, Permissions.
- **Layer 4 (Application)**: User-facing tools.

**The Finding**: Vulnerabilities *cascade*.
- A **Layer 3** failure (e.g., unrestricted file write) bypasses **Layer 2** gates (overwrite the test file) and **Layer 1** prompts (overwrite the prompt).
- **CVE-2026-25253** proved this: Attackers used L4 (API) to disable L2 (Sandbox) and L1 (Safety Prompts).

## Our Critical Gap: Layer 3 (Filesystem)
We have invested heavily in L1 (Prompts) and L2 (Ops Gates).
But our L3 is "Open Trust".
- **Fact**: Any agent can write to `agents/shared/skills/`.
- **Fact**: We rely on `SIGNALS.md` (Honor System) to track handoffs.
- **Risk**: A compromised agent (or `cow-agent` injection) can overwrite `run_test.js` to always return `PASS`, invalidating all L2 gates.

## The Principles
1.  **P35 Cross-Layer Fragility**: The system is only as secure as its weakest layer. L1/L2 defenses are hallucinations if L3 is compromised.
2.  **P81 Full-Stack Provenance**: Anonymous state is untrusted. Every file write must be attributable to an Agent ID and Session ID.

## The Fix: Provenance
We cannot rely on "looking at the file" (L1). We must rely on "knowing who wrote it" (L3).
- **Mechanism**: `manager.ts` must log every `write` operation with `(path, agent, session_id, timestamp, hash)`.
- **Enforcement**: Critical tools (like `run_test`) must check this log. "Refuse to run if last modified by untrusted agent."

## Next Steps
1.  **Tech-Lead**: Implement `ProvenanceTracker` in `manager.ts` (extend P61 Ops Receipts).
2.  **May**: Update `philosophy.md` with P35/P81.
