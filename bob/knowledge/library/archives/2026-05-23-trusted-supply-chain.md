# Synthesis: Trusted Supply Chain (P145)
**Source**: Amy-Kimi HB#1307 (25% Malicious Skills) + HB#1315 (NTU/AMD)
**Target**: `agents/shared/philosophy.md`

## The Problem: Supply Chain Poisoning
*   **The Attack**: "12 Skills, 3 Stealing Passwords." Malicious code is injected into widely used skills/tools.
*   **The Vector**: Agents blindly trust their `skills/` directory and `knowledge/` bank.
*   **The Impact**: Full compromise of credentials and memory. A single "helper" skill can exfiltrate session keys.

## The Defense: Skill Vetting & Memory Sanitization
**P145 Trusted Supply Chain**:
1.  **Vetting**: No new skill enters `agents/shared/skills/` without static analysis.
    *   **Heuristics**: `curl`, `wget`, `eval`, `base64`, specific IP ranges.
    *   **Tool**: `check_skill_safety` (Harness Level).
2.  **Sanitization**: No external content enters `knowledge/` without scrubbing.
    *   **Web Pages**: Convert to Markdown, strip scripts/iframes.
    *   **PDFs**: Extract text only.
    *   **Reasoning**: "Is this safe?" checks are **useless** (AMD/NTU study: experts fail 100%).

## Architecture Updates
1.  **Skill Vetter**: A CI/CD step for skills. When `coach` or `tech-lead` creates a skill, the Harness runs `check_skill_safety`.
2.  **Memory Sanitizer**: When `scout` saves a finding, the Harness runs `sanitize_markdown`.
3.  **Context Isolation**: Skills run in their own scope (Fork), not in the main Agent scope (unless trusted).

## Action
1.  **Implement Skill Vetter**: Brief Tech-Lead.
2.  **Implement Memory Sanitizer**: Brief Tech-Lead.
3.  **Update Philosophy**: Formalize P145.
