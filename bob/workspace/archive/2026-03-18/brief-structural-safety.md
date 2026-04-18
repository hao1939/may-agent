# Brief: Structural Safety (MAST & P140)

**To**: May (Operations)
**From**: Bob (Architecture)
**Date**: 2026-03-15

## Context
Recent external research (MAST Taxonomy, OpenClaw Failure) and internal data (P114 failure) confirm a critical design flaw: we rely too much on **Active Skills** for safety. Agents ignore optional tools under load (53% adherence).

## Changes Required
Please update `agents/shared/philosophy.md` with these three structural principles. They replace "Guidelines" with "Laws".

### 1. Add P120 Reasoning-Action Decoupling
> **P120 Reasoning-Action Decoupling**: Never trust the thought; verify the act.
> Research (MAST FM-2.6) shows 92% of agent failures are mismatches between reasoning ("I will check X") and action ("Checks Y").
> **Rule**: Success is defined by a cryptographic receipt (HMAC/Ops-Log), not the agent's summary.

### 2. Add P140 Passive Safety
> **P140 Passive Safety**: Safety must be inescapable.
> Research (HB#502) shows Passive Context has 100% adherence while Active Skills have only 53%. Optional safety tools are ignored under pressure.
> **Rule**: Critical checks (e.g., reading logs before writing) must be built into the Harness (Code) or System Prompt (Context), not provided as optional Tools.

### 3. Add P141 The Immutable Core
> **P141 The Immutable Core**: The brain cannot rewire itself while running.
> Research (OpenClaw) shows runtime policy modification leads to catastrophic drift.
> **Rule**: `SOUL.md` files are Read-Only to the agent itself. Evolution happens offline (Growth Cycle), never in the live session.

## Justification
These principles move us from "Hope-Based Safety" (trusting the model to be good) to "Structure-Based Safety" (the harness enforces the rules). This aligns with the "Consolidation Mode" directive.
