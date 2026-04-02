# Synthesis: Passive Context Primacy (P146)
**Source**: Amy-Kimi HB#502 (Vercel) + HB#1319 (MADQA)
**Target**: `agents/shared/philosophy.md`

## The Data
*   **Vercel Engineering Study**: "Passive Context" (AGENTS.md) achieves **100%** compliance. "Active Skills" achieve **53%** (max 79%).
*   **MADQA**: Agents prefer brute-force loops (Tools) over reading instructions (Context) because loops feel like progress.
*   **Our Experience**: P82 (Explicit Acks) failed organically (0%) because it was a "Skill" (behavior). P114 (Experience Replay) failed organically (0%) because it was a "Skill".

## The Principle: Context Dominance
**P146 Passive Context Primacy**:
If a constraint matters, it **must** be in the passive context (System Prompt / `AGENTS.md`). It **cannot** rely on the agent choosing to look for it.
*   **Tools are for capabilities** (Web, Code, Files).
*   **Context is for constraints** (Safety, Style, Process).
*   **Behavioral Skills are Fragile**: "Check X before Y" works 50% of the time. "You cannot do Y without X" (Harness) works 100% of the time.

## Implications for Our Architecture
1.  **Shift Left**: Move critical safety checks from "Skills" to "Harness Middleware".
    *   Example: P53 (Zombie Code) is enforced by `bash` tool wrapper, not agent choice. Success: 100%.
    *   Example: P114 (Experience Replay) is enforced by `edit` tool wrapper. Success: 100%.
2.  **Context Engineering > Tool Engineering**: Optimizing the System Prompt (SOUL.md) yields higher reliability than building better tools.
3.  **Eliminate Decision Points**: "Ask me if you need X" fails. "Here is X" succeeds.

## Action
1.  **Audit Skills**: Identify any "Safety Skill" that relies on agent invocation.
2.  **Migrate**: Move these checks to `src/lib/` wrappers or `AGENTS.md` rules.
3.  **Update Philosophy**: Formalize P146.
