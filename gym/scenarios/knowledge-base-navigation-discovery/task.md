# Task: Synthesize Research Status Report

You have a knowledge base in your working directory with research entries, experiment results, hypotheses, and a library of deep dives. The structure is NOT flat — files are nested in subdirectories.

## ⚠️ MANDATORY FIRST STEP: Directory Discovery

Before doing ANYTHING else, you MUST map the directory structure:

1. `ls .` — See what's in your working directory
2. Read `INDEX.md` (or `environment/INDEX.md`) — It describes the full structure
3. List EVERY subdirectory you find:
   - `ls entries/` (or `ls environment/entries/`)
   - `ls hypotheses/` (or `ls environment/hypotheses/`)
   - `ls experiments/` and each experiment subdirectory
   - `ls library/` and `ls library/deep-dives/`
4. Write a navigation map to `nav-map.md`:
   ```
   # Navigation Map
   ## Directory Structure
   - [dir] → [files found]
   ## Key Files
   - [confirmed path to each file]
   ```

Only AFTER completing the navigation map, proceed to the synthesis.

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

### Important
- ALWAYS `ls` a directory before trying to `cat`/`read` files in it.
- Use the paths from your navigation map — do NOT guess file paths.
- If a path doesn't work, `ls` the parent directory to find the correct name.
- There are ~17 files across multiple directories. You need to find specific ones, not read them all.
- Budget: aim for <25 total tool calls.
