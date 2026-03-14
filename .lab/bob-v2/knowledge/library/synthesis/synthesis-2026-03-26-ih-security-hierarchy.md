# Synthesis: Security Hierarchy & Artifact Standardization

**Date:** 2026-03-26
**Sources:** IH-Challenge (HB#224), Bureaucracy of Speed (HB#233), HAE Security (HB#224, HB#233)

## 1. Instruction Hierarchy (P84)
Recent research (HB#224) confirms that **"Flat Prompting"** (LLMs treating all tokens equally) is the core vulnerability.
**Solution:**
- **Layer 1 (System)**: Identity, Core Values, Mission. **Immutable.**
- **Layer 2 (Developer)**: Tasks, Policies, Context. **Trusted.**
- **Layer 3 (User)**: Inputs, Requests. **Untrusted.**
- **Layer 4 (Tool)**: Outputs, Observations. **Untrusted.**

**Mechanism:**
Use XML tags (`<system>`, `<user>`, `<tool_output>`) to explicitly bound these layers. The model must prioritize `<system>` over `<user>`.

## 2. Operation-Bounded Authority (P85)
Research (HB#233) shows that **Time-Based Revocation** (TTL) is unsafe against high-velocity agents. A fast agent can do infinite damage in 1 minute.
**Solution:**
- **Grant Authority in Operations**, not Time.
- **Budget:** 50 Ops (L2), 10 Ops (L3), Infinite (L1).
- **Enforcement:** `op_budget` tracked by Manager. Throws `AuthorizationError` if exceeded.

## 3. Artifact Standardization (HB#230, HB#235)
"Task" is ambiguous. We need a standard **Unit of Work** (Artifact).
- **Files as API:** Treat `.md` skills and `.json` tasks as API endpoints.
- **Dependency Graph:** Tasks are a DAG, not a list. (Claude Code Tasks).
- **Validation:** Our task model (`todo.md`) is too flat. We need structured tasks (`.state/tasks/*.json`).

## Recommendations
1.  **Implement P84**: Update `agent-loader.ts` to wrap `SOUL.md` content in `<system>...</system>` tags. Wrap user input in `<user>...</user>`.
2.  **Implement P85**: Add `op_budget` to `manager.ts`. Track `op_count`. Default to 50 for Coder.
3.  **Standardize Tasks**: Move from `todo.md` to `.state/tasks/` JSON files for complex workflows.

## Conclusion
We must harden the system against **Prompt Injection** (P84) and **Runaway Agents** (P85). These are structural fixes, not prompt engineering.
