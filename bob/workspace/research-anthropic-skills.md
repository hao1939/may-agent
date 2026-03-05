# Research: Anthropic Skill Creator / Custom Skills

**Source**: Extracted from Anthropic documentation via Scout (s_1772712166111_24).

## 1. What is it?
"Custom Skills" (or just "Skills") is a standardized format for packaging specialized knowledge and workflows for Claude. It is supported natively in **Claude Code** (the CLI tool) and the Claude.ai web interface.

It is essentially a **Prompt Engineering Pattern + Directory Structure** that enables **Progressive Disclosure** (Lazy Loading).

## 2. Structure & Format
A Skill is a directory containing at minimum a `SKILL.md` file.

**`SKILL.md` Format:**
- **YAML Frontmatter**: Required. Must contain `name` and `description`.
  ```markdown
  ---
  name: Brand Guidelines
  description: Apply Acme Corp brand guidelines to presentations and documents.
  ---
  ```
- **Markdown Body**: The actual instructions, examples, or knowledge.

## 3. Mechanism: Progressive Disclosure
The system (e.g., Claude Code or a custom agent) uses a two-step process to manage context window usage:

1. **Discovery (Level 1)**: At startup, the agent reads only the **metadata** (name/description) of all installed skills and injects them into the System Prompt.
   > "You have access to the following skills: ..."
2. **Activation (Level 2)**: When the model determines a skill is relevant (based on the description), it "loads" the skill.
   - In Claude Code/Web: The harness detects this intent and injects the full `SKILL.md` content into the context.
   - For API users: You must implement this logic (tool use -> read file).

## 4. Relevance to Our System

**Current State**:
- We inject `domain.md`, `lessons.md`, and `tools` fully at startup.
- We have `knowledge/` files but no standardized auto-loading mechanism (agents must explicitly `read` them).

**Value Proposition**:
- **Standardization**: A clean format (`SKILL.md`) for defining modular capabilities.
- **Context Efficiency**: The "Progressive Disclosure" pattern allows us to have 50 skills available but only pay the context cost for the one currently in use.
- **Interoperability**: If we adopt this format, we might be able to use community-created skills (if/when they exist).

**Comparison**:
- **Our Approach**: `knowledge/*.md` (Passive) vs. **Skills**: `SKILL.md` (Active/Lazy-Loaded).
- **Implementation**: We would need to write a "Skill Loader" in `agent-loader.ts` or `system-prompt.ts` to:
  1. Scan `skills/` directories.
  2. Inject summaries into System Prompt.
  3. Give the agent a tool (e.g., `use_skill(name)`) or simply let it `read` the file when it decides to.

## 5. Next Steps
- **Hands-on Test**: Create a simple `SKILL.md` and see if `claude-code` (via Master) picks it up.
- **Decision**: Should we refactor our `knowledge/` folder into `skills/`?
