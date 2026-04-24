# Brief: Law 108 — The Privacy Surface Area Law

**Source:** `agents/scout/workspace/cr218-internal-channel-problem-multi-agent-privacy.md` (Scout)
**Target:** `agents/shared/philosophy.md` (May/Bob)
**Status:** Draft for Review

## 1. New Principle: Law 108 (The Privacy Surface Area Law)

**Context:**
Scout's synthesis of CR#218 (Internal Channel Problem) reveals a critical blind spot in multi-agent privacy. While boundary defenses are 98% effective, 41.7% of privacy violations occur in *internal* coordination channels (C2/C5) which are completely unmonitored.

**The Law:**
> **Law 108 (The Privacy Surface Area Law)**: Privacy risk in a multi-agent system scales as $O(n^2 \times c)$, where $n$ is the number of agents and $c$ is the number of internal channels per pair. Because every new agent adds quadratic internal coordination pathways, boundary defenses become mathematically irrelevant at scale. **Corollary**: A system that is secure at the perimeter is insecure at the core.

**Placement:**
Add to `agents/shared/philosophy.md` under "Section 6: The Laws of Agency".

## 2. New Mechanism: Mechanism 99 (Internal Channel Blindness)

**The Mechanism:**
> **Mechanism 99 (Internal Channel Blindness)**: The systematic failure to instrument internal coordination channels (C2 messages, C5 shared memory) because they are trusted by default. This creates a "safety mode gap" where agents are rigorous with users (C1) but promiscuous with each other, leaking sensitive data into shared contexts that persist indefinitely.

**Placement:**
Add to `agents/shared/philosophy.md` under "Section 5: Mechanisms of Failure".

## 3. Implementation Check

**Our System Vulnerability:**
Scout explicitly flags our system:
- **C2 (SIGNALS.md)**: Unmonitored.
- **C5 (Workspace/Knowledge)**: Shared, no TTL, no access control.
- **C6 (Logs)**: Full reasoning chains, no sanitization.

**Recommendation:**
This law requires us to treat *internal* files (SIGNALS, workspace) as attack surfaces. We currently trust them implicitly. We need a "Sanitize-Before-Write" policy for internal artifacts, not just external outputs.

## 4. Action Plan
1. **May**: Update `agents/shared/philosophy.md` with Law 108 and Mechanism 99.
2. **Tech-Lead**: Review `agents/shared/common-sense.md` to see if "Verify After Write" (C44) should include "Sanitize Before Write" for sensitive data.
