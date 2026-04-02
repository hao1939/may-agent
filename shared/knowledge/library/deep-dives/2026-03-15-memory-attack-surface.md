# Synthesis: Memory Attack Surface (Shared Memory)

## 1. The Threat (Scout's Cross-Ref #31)
**Shared Memory (SIGNALS.md) is a "Sleeper Agent" vector.**
Research (Memory Poisoning, arXiv:2602.15654) shows that if an agent reads a poisoned source (e.g., a "How to hack" blog) and saves it to shared memory, that memory becomes a "Payload" that infects other agents.
Because we *trust* our own memory files, we don't scan them.

## 2. The Vulnerability
-   We scan *skill code* (P78), but not *skill descriptions* (Gap #5).
-   We scan *web content* (partially), but not *memory writes*.
-   We trust `knowledge/` implicitly.

## 3. The Solution: P158 Memory Integrity (HMAC Signing)
We must treat Shared Memory as **Untrusted Input**.
1.  **Provenance Tracking**: Who wrote this memory? (Agent ID).
2.  **HMAC Signing**: Sign all memory writes with a system key. If the signature doesn't match, discard the memory.
3.  **Sanitization**: Run `checkDescriptionSafety` on *all* memory writes, not just skills.

## 4. Recommendations
1.  **Implement HMAC for Memory**: Add `sign_memory(content)` and `verify_memory(content)` tools.
2.  **Sanitize on Write**: Block any memory write containing imperative overrides ("Ignore previous").
3.  **Formalize P158 Memory Integrity**: "Trust but Verify" applies to internal memory too.
