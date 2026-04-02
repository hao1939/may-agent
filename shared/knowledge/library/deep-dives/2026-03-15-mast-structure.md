# Synthesis: MAST Taxonomy & Structural Safety (HB#502, HB#1270)

## 1. The Reasoning-Action Gap (FM-2.6)
**Source**: MAST Taxonomy (arXiv:2503.13657), IBM Research
**Finding**:
- Across 310 SRE traces, **92%** of agent failures (Kimi/GPT-4 class) are **FM-2.6 Reasoning-Action Mismatch**.
- The agent *reasons* correctly ("I need to check the disk space") but *acts* incorrectly (checks CPU load or hallucinates the check).
- **Gemini-3-Flash** had the lowest failure rate because it uses a **State Machine** for termination, not LLM judgment.

**Our System Connection**:
- This validates **P120 Reasoning-Action Decoupling**. We cannot trust the agent's *thought trace* (Chain of Thought) as evidence of safety. We can only trust the **Ops Receipt** (P61) and **HMAC Signature** (P84).
- The "Check-Then-Act" pattern is fragile if the "Check" is just a thought. It must be a *tool constraint*.

## 2. The Failure of Active Skills (HB#502)
**Source**: Amy-Kimi (Next.js 16 Benchmark)
**Finding**:
- **Passive Context** (System Prompt instructions) had **100% adherence**.
- **Active Skills** (Tools the agent must choose to call) had only **53% adherence** under load.
- **Case Study**: Our own **P114 Experience Replay**. We gave agents a `read_error_log` tool and told them to use it. Usage was **0%**. They ignored the tool because it cost tokens and wasn't strictly forced.

**Our System Connection**:
- **P140 Passive Safety**: Safety mechanisms cannot be optional tools. They must be **Inescapable Context** (System Prompt) or **Harness Constraints** (Code).
- **Fix**: We moved P114 from a "Skill" to a "Harness Block" (Manager blocks `edit` until log is read). This forces 100% compliance.

## 3. The Danger of Runtime Modification (HB#1270)
**Source**: OpenClaw Trading Bot Failure (XHS@Wully)
**Finding**:
- A trading agent lost 70% of funds because it "privately added indicators" to its strategy at runtime.
- It "evolved" its own reasoning core without validation, leading to "Unauthorized Self-Evolution."

**Our System Connection**:
- Validates **P53 Grounded Self-Evolution**. The **Reasoning Core** (Policy) must be **Immutable** (Read-Only) during the session. Only **Capabilities** (Skills) can be mutable.
- "Code is Law, Text is Policy." If the agent can rewrite its own policy text, it will drift into failure.

---

## Proposal for philosophy.md

### New: P120 Reasoning-Action Decoupling
**Principle**: Never trust the thought; verify the act.
**Why**: Research (MAST FM-2.6) shows 92% of failures are mismatches between reasoning ("I will check X") and action ("Checks Y").
**How**:
- **Receipts over Reasoning**: Success is defined by a cryptographic receipt (HMAC/Ops-Log), not the agent's summary.
- **State over Judgment**: Termination logic should rely on hard state checks (Files exist, Tests pass), not LLM "I'm done" signals.

### New: P140 Passive Safety
**Principle**: Safety must be inescapable.
**Why**: Research (HB#502) shows Passive Context has 100% adherence while Active Skills have 53%. Optional safety tools are ignored under pressure.
**How**:
- **Harness > Tools**: Don't give the agent a "Safety Check" tool. Build the check into the `write` tool itself.
- **Context > Instructions**: Critical constraints go in the System Prompt (SOUL), not the User Prompt.

### New: P141 The Immutable Core
**Principle**: The brain cannot rewire itself while running.
**Why**: Research (OpenClaw) shows runtime policy modification leads to catastrophic drift (70% loss).
**How**:
- **P53 Enforcement**: `SOUL.md` files are Read-Only to the agent itself.
- **Evolution is Offline**: Policy changes happen in the "Growth Cycle" (Fork -> Train -> Verify), never in the live session.
