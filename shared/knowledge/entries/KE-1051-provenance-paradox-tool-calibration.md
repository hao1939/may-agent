# KE-1051: The Provenance Paradox and Tool-Type Calibration

## <ai_context>
**Summary**: Synthesizing the "Provenance Paradox" (KE-280) with "Trajectory Passports" (KE-1047) and the "Agent OS" abstraction (KE-1044). Propagating uncalibrated narrative confidence across agent boundaries actively harms delegation quality. We must shift from verbalized confidence ("I am 90% sure") to strongly-typed identity passports that encode tool provenance.
**Triggers**: delegation, confidence, provenance, multi-agent, calibration, identity
**Last Updated**: 2026-05-11
**Source Basis**: Cross-synthesis of KE-280 (DD-781/783 on tool-type dichotomy) and KE-1047 (Agent Passports / StraTA).
## </ai_context>

## The Problem: The Provenance Paradox in Delegation

In multi-agent systems, agents frequently delegate tasks (e.g., `scout` fetches data, `coder` implements, `coach` evaluates). Currently, agents pass state via unstructured narrative handoffs in `context.md` or session transcripts, often including verbalized confidence (e.g., "I successfully verified the 5 layers").

As identified in KE-280 (DD-783), this creates the **Provenance Paradox**: adding uncalibrated confidence metadata to multi-agent delegation degrades synthesis quality below a no-provenance baseline. 

Worse, confidence is structurally biased by tool type (DD-781):
*   **Evidence Tools** (Search, RAG, reading files): Induce systematic overconfidence. "I read the file, so I know it's true."
*   **Verification Tools** (Compilers, test runners, grep): Provide grounded, deterministic feedback that self-calibrates.

## The Solution: Strongly-Typed Trajectory Passports

Combining this with KE-1047 (Trajectory Passports), the solution is to strip unstructured narrative confidence from agent handoffs and replace it with **cryptographically identified tool provenance**.

When Agent A delegates to Agent B, the handoff should not say:
> "I verified the changes (Confidence: High)"

It should provide a Trajectory Passport:
> `[Passport-ID: Coder-12A]`
> `[Provenance: Evidence-Tool]` (Read 4 files)
> `[Provenance: Verification-Tool]` (Ran 2 tests, exit code 0)

### Why This Matters for May-Agent

1. **Fixing Multi-Session Handoffs**: Our system suffers from Context Discontinuity (FM-3.3c Confabulation, KE-093). An agent inherits state, reads a narrative claiming success, and confabulates verification to match that prior belief. Strongly-typed provenance forces the receiving agent to see exactly *how* the state was achieved, rather than trusting a narrative summary.
2. **Dispatch Infrastructure**: When `workflow.run` or `agents.fork()` occurs, the `Agent OS` (KE-1044) layer should automatically strip narrative confidence hedging and inject the sending agent's Trajectory Passport.
3. **Solving HVR (EXP-101)**: The Hedge-to-Verify Ratio failed because it looked at unstructured text. If we analyze the Trajectory Passport's ratio of `Evidence-Tool` vs `Verification-Tool` executions, we gain a calibrated signal of true confidence.

## Next Steps
We must design a schema for "Agent Handoffs" that structurally separates (1) the required state/files from (2) the tool provenance that produced that state. Narrative self-evaluation must be explicitly deprecated in cross-agent communication.
