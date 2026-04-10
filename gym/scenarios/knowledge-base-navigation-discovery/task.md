# Phase 0: Directory Discovery (MANDATORY)

Your ONLY job in this phase is to discover the directory structure and create a navigation map. Do NOT start the main task yet.

## Instructions

1. List the top-level contents of the working directory to see the knowledge base structure:
   ```
   ls .
   ```

2. Read `INDEX.md` to understand the full structure.

3. For each subdirectory, list its contents:
   ```
   ls hypotheses/
   ls entries/
   ls experiments/
   ls library/
   ```
   (And any deeper subdirectories you discover)

4. Write a navigation map to `nav-map.md` in the working directory:
   ```markdown
   # Navigation Map
   
   ## Directory Structure
   - hypotheses/ → [list files]
   - entries/ → [list files]
   - experiments/ → [list subdirs and their files]
   - library/ → [list subdirs and their files]
   
   ## Key Files for Synthesis Task
   - Hypotheses: [paths to active hypothesis files]
   - Entries: [paths to knowledge entry files]
   - Deep dives: [paths to relevant deep dive files]
   - Experiments: [paths to experiment result files]
   ```

5. Call finish() with a summary of what you found.

⚠️ CONSTRAINTS:
- Do NOT read any content files (only INDEX.md and directory listings)
- Do NOT start analyzing or synthesizing
- Do NOT write synthesis.md
- ONLY list directories, read INDEX.md, and write nav-map.md

---

# Phase 1: Synthesize Research Status Report

You have a navigation map in `nav-map.md` from Phase 0. Use it to find files efficiently.

## Requirements

Write a file called `synthesis.md` (in the current working directory) with the following sections:

### 1. Active Hypotheses Summary
Find all active hypotheses and for each one, list:
- The hypothesis ID and claim
- What experiments are testing it
- Current status of those experiments

### 2. Evidence Gap Analysis
Identify which knowledge entries are still pending verification and what evidence is missing.

### 3. Key Finding About FM-1.3
Find the deep dive about failure modes and extract the specific information about FM-1.3 (path guessing). Include:
- The definition of FM-1.3
- The listed triggers
- The intervention candidates mentioned

### 4. Cross-Reference Check
Find the experiment that tested SOUL text vs workflow enforcement, and verify whether its conclusion aligns with the relevant verified knowledge entry (RKE-003). State whether they agree and quote the key data.

## Important
- Use the paths from `nav-map.md` — do NOT guess paths.
- If you need a file not in your navigation map, `ls` its parent directory first.
- The knowledge base has ~17 files. You should only need to read 6-8 specific files.
- Budget: aim for <15 tool calls in this phase.
