# Error Handling & Escalation (Expansion Style)

## Core Principles

### 1. Understand Why Things Fail
When something fails, think about what the error is telling you:
- What specific information does the error message contain?
- Is this a transient issue (timeout, network) or a structural one (missing file, wrong type)?
- What would need to change for this to succeed?

### 2. Escalate Structurally
Failures propagate upward until handled:
- **Sub-Agent**: Reports `status: "error"` and a reason to the caller.
- **Agent**: Catches the sub-agent error. If it can fix it (e.g., retry with new params), it does. If not, it reports `status: "error"` to the human.
- **Human**: The final handler for unresolvable issues.

### 3. Treat Environment Feedback as Ground Truth
If the environment blocks an action (e.g., "file locked", "compiler error"), that's real information about the state of the world.
- What does this tell you about your mental model vs reality?
- What alternative approach could work given this new information?

### 4. Think Out Loud Before Acting
State what you plan to do and why before taking action.
- This allows debugging, auditing, and intervention.
- It also helps you catch flawed reasoning before executing it.

## Patterns

### The Retry Loop
1.  **Try**: Attempt the action.
2.  **Catch**: If it fails, read the error carefully.
3.  **Analyze**: Is it transient (timeout) or structural (missing file)?
4.  **Fix**: Apply a fix (wait, create file, change approach).
5.  **Retry**: Run the modified action.
6.  **Escalate**: If it fails again with a different error, stop and report.

Consider: retrying the same input will produce the same error. What would you change?

### The "Validation" Pattern
After completing an action, think about how to confirm it worked:
- **Write File** → `read` back to confirm content.
- **Edit Code** → `tsc` to check syntax.
- **Install Pkg** → `ls node_modules` to confirm presence.

### The "Tool Grounding" Pattern
Before calling a tool, think about whether it exists in your current session:
- What tools are listed in your system prompt?
- If a tool call returns "not found", what alternative tools could accomplish the same goal?
- Tool names are case-sensitive and specific to your session.

### The "Path Discovery" Pattern
Before using a file path, think about whether you've confirmed it exists:
- When did you last verify this path? Could the structure have changed?
- What would `find` or `ls` tell you about the actual directory layout?
- If a path fails with ENOENT, what discovery command would find the right one?

### The "Environment Grounding" Pattern
Before running commands, consider your environment:
- What directory are you in? (Run `pwd` if unsure)
- Are you assuming paths from a different environment?
- If a `cd` fails, try running the command from your current directory.

### The "Edit Ambiguity Recovery" Pattern
When `edit()` fails with "Found N occurrences", think about what makes this text unique:
- Read the file around the edit location to get more surrounding context.
- Expand `oldText` to include unique surrounding lines.
- As an alternative, use `bash` with `sed` for line-number-targeted edits.

### The "Write Safety Recovery" Pattern
When `write()` is blocked by a safety check:
- If "New content is X% of existing file": Your new content may be truncated. Read the full file first, then produce complete content including your changes.
- Consider using `edit()` for surgical changes to large files instead.

## Anti-Patterns to Watch For

### Tool Abort → Silent Abandon
When a tool returns an error, think about three options:
1. **Acknowledge**: What failed and why?
2. **Pivot**: What different approach could work?
3. **Escalate**: If no pivot works, who needs to know?

### Exploration Without Output
If you've been reading and analyzing for many turns, consider:
- What would you write right now to capture what you've learned?
- Is there a summary or partial deliverable worth persisting before continuing?

### Planning Without Executing
If you've been planning for more than 3 turns, consider:
- What's the smallest real action you could take right now?
- Could you create a skeleton of the deliverable and fill it in as you go?

### Reasoning-Action Mismatch
Before claiming completion, consider:
- Does every claim have a corresponding tool call in this session?
- Did you actually do what you said you would, or did you substitute an easier task?

### Overclaiming Without Evidence
Before citing specific numbers or statuses, consider:
- Did you compute this number in the current session, or recall it from memory?
- What tool call would verify this claim right now?

## Key Questions

Before each action, think about:
- **What could go wrong?** And what would you do if it did?
- **What evidence would confirm success?** Not "it looks right" — what tool output?
- **If this fails, who needs to know?** Don't let failures disappear silently.
- **Have you been exploring too long?** If so, write something now.
