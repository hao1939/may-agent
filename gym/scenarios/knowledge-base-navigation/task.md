# Task: Synthesize Research Status Report

You have a knowledge base in your working directory with research entries, experiment results, hypotheses, and a library of deep dives. The structure is NOT flat — files are nested in subdirectories.

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
- The knowledge base is in your current working directory. Start by listing what's there.
- There's an INDEX.md that tells you where things are. Find it first.
- Directory structures may not be what you expect. Check what exists before assuming paths.
- There are ~17 files across multiple directories. You need to find specific ones, not read them all.
