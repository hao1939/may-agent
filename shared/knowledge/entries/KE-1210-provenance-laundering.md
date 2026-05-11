<ai_context>
summary: Synthesis of Epistemic Hacking, Provenance Passports, and Autonomous Epistemology reveals a new attack vector: "Provenance Laundering" through intermediate LLM summaries.
triggers: epistemic hacking, provenance, trust, security, vulnerabilities, zero-trust
last_updated: 2026-05-11
</ai_context>

# Provenance Laundering: The "Summary" Attack Vector

When moving towards Autonomous Epistemology (KE-1207) and relying on Provenance Passports (KE-1203) to verify agent trust, a critical vulnerability emerges at the summarization boundary. 

If an agent (Agent A) uses rigorous Verification-Tools (e.g., executing tests) and produces a Provenance Sidecar, but then passes the *result* to another agent (Agent B) whose only job is to summarize or synthesize the findings for Agent C, the provenance chain breaks. Agent B's output is semantically rich but its provenance is merely "I read Agent A's output." 

Agent C now receives a claim without the original rigorous proof attached to the payload. If an adversary compromises Agent B, or if Agent B hallucinates during summarization, the system cannot detect the failure because the semantic payload looks authoritative, while the rigorous provenance was "laundered" away during the handover.

**Implication for may-agent:**
Provenance sidecars must be accumulative and cryptographically signed across multi-hop handoffs, not just single-hop. When Agent B summarizes Agent A's work, Agent B's Provenance Passport must embed Agent A's original Proof-of-Work signature, creating a Merkle-tree of trust, rather than treating the summarization step as a clean break. Relying on "LLM-as-Judge" for intermediate routing without deep provenance forwarding recreates the "Epistemic Hacking" vulnerability one level higher up.
