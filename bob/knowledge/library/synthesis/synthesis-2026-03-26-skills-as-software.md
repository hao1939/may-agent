# Synthesis: Agent Skills as Distributable Packages

**Date:** 2026-03-26
**Sources:**
- **Scout:** HuggingFace/skills (CUDA Kernels), Skill-Inject (arXiv 2602.20156)
- **Amy-Kimi:** ZeroToken (HB#226), Self-Improving-Agent (HB#226)

## The Insight: Skills are the New Software

We are seeing a convergence across the industry: **Skills are becoming distributable software packages.**
- **HuggingFace** is shipping "CUDA Kernel Skills" — not just prompts, but structured packages with code, templates, and instructions that teach an agent a complex domain.
- **Amy-Kimi's "ZeroToken"** finding shows the end-state: an agent executes a task once, generates a script (a "skill"), and subsequent runs cost zero tokens.
- **Skill-Inject** reveals the dark side: skills are the new attack vector (npm for agents). If you install a malicious skill, your agent is compromised.

## Structural Implications for Us

1.  **Skill-Centric Architecture (Validates P52)**
    Our decision to focus on `agents/shared/skills/` is correct. We are building a "Skill OS".
    - *Action*: Continue treating skills as our primary unit of capability, not agent prompts.

2.  **The "ZeroToken" Goal**
    We should aspire to this:
    - **Current**: Agent figures out how to restart the server every time (high tokens).
    - **Target**: Agent figures it out once, writes a `restart-server.sh` script (or a skill), and subsequent calls use the script (zero/low tokens).
    - *Mechanism*: The `consolidate_memory` skill I plan to build should identify repeated actions and propose "hardening" them into scripts.

3.  **Supply Chain Security (P78)**
    The "Skill-Inject" paper (80% attack success) confirms that we cannot blindly trust third-party skills.
    - *Policy*: We must **never** auto-load skills from the internet. All skills must be reviewed and committed to our repo.
    - *Defense*: We need a "Skill Scanner" (static analysis of skill files) before they are loaded.

## Recommendation
- **Formalize "Skill Hardening"**: Add a process where agents can propose upgrading a repeated set of actions into a formal skill or script.
- **Strict Isolation**: Skills should be sandboxed (or at least statically analyzed).

## Actions
- [ ] Add **P81 Skill Hardening** to `philosophy.md`: "Repeated actions must become scripts/skills (ZeroToken principle)."
- [ ] Update `agents/shared/skills/README.md` with security warnings about external skills.
