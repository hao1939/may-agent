## Phase 0: Directory Discovery (MANDATORY — DO NOT SKIP)

Before starting the main task, you must map the directories you'll need. Your working directory contains a knowledge base with nested subdirectories.

### Instructions
1. List the root of your working directory:
   - `ls` or `bash("ls")`
   
2. Find and read the INDEX.md file (it's a directory map).

3. List each subdirectory mentioned in INDEX.md:
   - `ls entries/`
   - `ls hypotheses/`
   - `ls experiments/`
   - `ls library/`
   - `ls library/deep-dives/`
   - Any other directories you discover

4. Write a NAVIGATION MAP to `nav-map.md` in the current working directory:
   ```
   # Navigation Map
   
   ## Directory Structure
   - entries/ → [list files]
   - hypotheses/ → [list files]
   - experiments/ → [list subdirs and their files]
   - library/deep-dives/ → [list files]
   
   ## Key Files I'll Need
   - [file 1] at [confirmed path]
   - [file 2] at [confirmed path]
   ```

5. Call finish() with the navigation map summary.

⚠️ You must ONLY list directories, read INDEX.md, and write the navigation map.
   Do NOT start analyzing any content files. Do NOT read research entries.
   Do NOT start writing synthesis.md.
   The next phase will handle the actual task using your map.

---

## Phase 1: Synthesize Research Status Report

You have a knowledge base in your working directory with research entries, experiment results, hypotheses, and a library of deep dives. The structure is NOT flat — files are nested in subdirectories.

### Navigation Map
A previous phase mapped the directory structure. Read `nav-map.md` in your working directory FIRST — it contains confirmed file paths. Use ONLY paths from that map. If you need a file not in the map, `ls` its parent directory first before trying to read it.

### Requirements

Write a file called `synthesis.md` (in the current working directory) with the following sections:

#### 1. Active Hypotheses Summary
Find all active hypotheses and for each one, list:
- The hypothesis ID and claim
- What experiments are testing it
- Current status of those experiments

#### 2. Evidence Gap Analysis
Identify which knowledge entries are still pending verification and what evidence is missing.

#### 3. Key Finding About FM-1.3
Find the deep dive about failure modes and extract the specific information about FM-1.3 (path guessing). Include:
- The definition of FM-1.3
- The listed triggers
- The intervention candidates mentioned

#### 4. Cross-Reference Check
Find the experiment that tested SOUL text vs workflow enforcement, and verify whether its conclusion aligns with the relevant verified knowledge entry (RKE-003). State whether they agree and quote the key data.

### Important
- Read `nav-map.md` first for the directory structure.
- Use the confirmed paths from the navigation map. Do NOT guess paths.
- If a path from the map doesn't work, `ls` the parent directory to find the correct name.
- There are ~17 files across multiple directories. You need to find specific ones, not read them all.
- Budget: aim for <20 tool calls total in this phase.
