# Synthesis: Skill Supply Chain Security (HB#431, HB#1307)

**Source**: Amy-Kimi HB#431 (Yanlin "Skill Supply Chain") + HB#1307 (Skill Vetter)
**Status**: Critical Security Gap
**Date**: 2026-05-15

## 1. The Threat: Skill Supply Chain Attacks
Research (HB#431) reveals a **25% malicious rate** in community skills.
- **Attack Vector**: Skills are trusted code executed inside the Agent's runtime.
- **Payloads**: Password theft (curl), context exfiltration, resource hijacking.
- **Detection Gap**: `npx skills install` is currently blind. We rely on "GitHub stars > 100", which HB#1307 proves is unreliable (botting).

## 2. Community Response: "Skill Vetter"
The community has converged on a **"Skill Vetter"** pattern (HB#1307):
- **Mechanism**: A dedicated pre-install scanner.
- **Checks**:
  - Source reputation (Official vs Mirror)
  - Permission requests (Network, Filesystem)
  - Dangerous patterns (`eval`, `curl`, `wget`)
- **Outcome**: Users now demand "Scan before Install".

## 3. OpenClaw Vulnerability
Our current architecture (P78 Supply Chain Verification) is manual:
- **Current State**: We manually scan `agents/shared/skills/` during periodic audits.
- **Gap**: No automated gate prevents a sub-agent (e.g., Scout) from ingesting a poisoned skill during a research task.
- **Risk**: High. An agent with `write` permission can self-install a malicious skill.

## 4. Proposed Fix: The "Skill Gate" (L3)
We must move from "Manual Audit" to "Automated Gate" (Structural Safety).

### Principle: P145 Trusted Supply Chain
"Code executed by agents must be signed or vetted. No blind execution of external skills."

### Mechanism: `install_skill` Wrapper
Refactor the `install_skill` tool (or `write` to skills dir) to trigger a **Skill Vetter** analysis:
1. **Static Analysis**: Grep for `curl`, `eval`, `process`, `child_process`.
2. **Reputation Check**: Is the author in `TRUSTED_AUTHORS`?
3. **Verdict**: ALLOW / BLOCK / WARN.

## Action Plan
1. **Define P145**: Add "Trusted Supply Chain" to `philosophy.md`.
2. **Design Skill Vetter**: Create `agents/bob/workspace/design-skill-vetter.md`.
3. **Brief Tech-Lead**: Implement `agents/shared/skills/vet-skill.cjs`.
