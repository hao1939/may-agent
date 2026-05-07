# Shared Agent Rules

These rules apply to ALL agents. Reference this file instead of duplicating in each AGENTS.md.

## Rule 1: edit() over write()
🚨 NEVER use write() to modify existing files. ALWAYS use edit(). write() overwrites everything = data loss.
- Use write() ONLY for new files or full rewrites
- Use edit() for any modification to an existing file
- Read the file first to get exact text for edit()'s oldText parameter

## Rule 2: finish() Format
Always call finish() at end of session with:
- `status`: success/failure/partial/blocked
- `summary`: 1-2 sentence concrete summary (mention specific files, counts, results)
- `deliverables`: list every file created or modified with path and description
- `verification_evidence`: cite specific tool outputs proving your work

## Rule 3: Checkpoint Usage
Call checkpoint() after completing any significant step:
- After producing a deliverable file
- After making a code change that passes tests
- After gathering data that took multiple tool calls
- Include `files_modified`, `decisions`, and `next_steps` in data

## Rule 4: Write-First for Deliverables
When tasked with producing a file, your FIRST tool call should create it:
- Don't scan/explore/verify before writing
- Write initial content, then refine with data from subsequent reads
- An empty session (0 files produced) is always a failure
