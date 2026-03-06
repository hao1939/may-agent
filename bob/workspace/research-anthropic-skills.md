# Research: Anthropic Skill Creator / Custom Skills

**Status**: Research Complete
**Date**: 2026-03-05
**Outcome**: The "Skill Creator" tool itself is less relevant than the **Progressive Disclosure** pattern it uses. We should adopt the pattern, not the specific tool.

## 1. What is it?
"Custom Skills" is a standardized format (`SKILL.md` with YAML frontmatter) for packaging capabilities. It is designed to work with **Claude Code** (CLI) and the Claude.ai web interface.

**Key Mechanism: Progressive Disclosure**
1. **Discovery**: System reads metadata (name/description) from all skills and injects *only that* into the system prompt.
2. **Activation**: When the model decides a skill is relevant, it "loads" the full content (via tool use or context injection).

## 2. Findings from `claude-code` Testing (via Master)
We tested `claude-code` to see if it natively auto-discovers `skills/` directories.
- **Result**: **No native auto-discovery.** `claude-code` did not automatically see `skills/hello-world/SKILL.md`.
- **Workaround**: It only worked when explicitly told to read the file.
- **Native Equivalent**: `claude-code` uses `CLAUDE.md` (project-level instructions) as its primary customization hook, which is auto-loaded.

## 3. Recommendation for May Agent System

We should **NOT** use Anthropic's "Skill Creator" tool directly, as it generates artifacts for a runtime we don't fully control.

However, we **SHOULD** adopt the **Progressive Disclosure** pattern for our own agent knowledge.

### The Problem
Currently, we inject `knowledge/domain.md`, `knowledge/lessons.md`, and all `tools/` definitions into the context at startup.
- **Cost**: High token usage for unused knowledge.
- **Distraction**: Irrelevant knowledge confuses the model.

### The Solution: "Skill" Architecture
Refactor `knowledge/` into modular "Skills":

1. **Structure**:
   ```
   agents/coder/skills/
     react-best-practices/SKILL.md  (Metadata + Content)
     typescript-tips/SKILL.md       (Metadata + Content)
   ```

2. **System Prompt (Lazy Loading)**:
   Instead of dumping all files, the System Prompt Generator (`system-prompt.ts`) should:
   - Scan `skills/` directories.
   - Extract `name` and `description` from YAML frontmatter.
   - Inject a summary:
     ```
     ## Available Skills
     - React Best Practices: Guidelines for functional components and hooks.
     - TypeScript Tips: specialized type manipulation patterns.
     (To use a skill, use the read tool on its file path.)
     ```

3. **Behavior**:
   The agent sees the menu. If it needs "React Best Practices", it calls `read('.../react-best-practices/SKILL.md')`.
   
### Value
- **Scalability**: We can have 100 skills but only pay for the ones used.
- **Focus**: Agent starts with a clean slate and pulls in context only as needed.

## 4. Next Actions
- [ ] Create a prototype "Skill" for Coder (e.g., specific testing patterns).
- [ ] Update `system-prompt.ts` to support `skills` directory scanning and metadata extraction.
