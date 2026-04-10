# Phase 0: Directory Discovery (MANDATORY)

Your ONLY job in this phase is to map the LOCAL directory structure and create a navigation map.

CRITICAL: The knowledge base IS your current working directory. All files are in `.` (the current directory).
Do NOT navigate to /app/ or any parent directory. Do NOT look in agents/ or src/.
The relevant directories are RIGHT HERE: entries/, hypotheses/, experiments/, library/.

## Instructions

1. List the current directory:
   ```
   ls .
   ```
   You should see: INDEX.md, entries/, hypotheses/, experiments/, library/, synthesis-templates/

2. Read `./INDEX.md` to understand the full structure.

3. List each subdirectory you find:
   ```
   ls entries/
   ls hypotheses/
   ls experiments/
   ls experiments/RX-031/
   ls experiments/RX-055/
   ls experiments/RX-058/
   ls experiments/RX-061/
   ls experiments/RX-067/
   ls library/
   ls library/deep-dives/
   ls synthesis-templates/
   ```

4. Write a navigation map to `nav-map.md`:
   ```markdown
   # Navigation Map
   
   ## Directory Structure
   - entries/ → [list the .md files you found]
   - hypotheses/ → [list the .md files you found]
   - experiments/ → [list subdirs and their contents]
   - library/deep-dives/ → [list the .md files you found]
   
   ## Key Files for Synthesis Task
   - Hypotheses: hypotheses/RH-044.md, hypotheses/RH-048.md
   - Entries: entries/RKE-003.md, entries/RKE-007.md, etc.
   - Deep dives: library/deep-dives/failure-taxonomy-analysis.md, etc.
   - Experiments: experiments/RX-031/results.md, etc.
   ```

5. Call finish() with a summary of what you found.

⚠️ CONSTRAINTS:
- Do NOT navigate outside the current directory (no /app/, no agents/, no src/)
- Do NOT read any content files (only INDEX.md and directory listings)
- Do NOT start analyzing or synthesizing
- Do NOT write synthesis.md
- ONLY: ls directories, read INDEX.md, write nav-map.md

---

# Phase 1: Synthesize Research Status Report

A previous phase mapped the directory structure. Read `nav-map.md` FIRST.

CRITICAL: All files are in the CURRENT DIRECTORY. Paths like entries/RKE-003.md, hypotheses/RH-044.md, etc.
Do NOT navigate to /app/ or parent directories.

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
- Read `nav-map.md` first — it has the confirmed paths from Phase 0.
- All paths are relative to current directory (e.g., `entries/RKE-003.md`, not `/app/...`).
- If a path from nav-map.md doesn't work, `ls` its parent directory first.
- The knowledge base has ~17 files. You should only need to read 6-8 specific files.
- Budget: aim for <15 tool calls in this phase.
