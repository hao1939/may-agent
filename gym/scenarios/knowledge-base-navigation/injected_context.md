## Reference: Efficient Knowledge Base Navigation

An experienced researcher needed to write a synthesis from a knowledge base in `environment/`. The directory had ~18 files across nested subdirectories.

### What the efficient researcher did (8 tool calls for 4 file reads):

```
# Step 1: Read the map (2 calls)
bash("ls environment/")
→ INDEX.md  entries  experiments  hypotheses  library  synthesis-templates

read("environment/INDEX.md")
→ Full directory map showing:
  - hypotheses/ → RH-044.md, RH-048.md, PRIORITY-TRACKER.md
  - experiments/ → RX-031/ (design.md, results.md), RX-055/, RX-058/, etc.
  - library/deep-dives/ → failure-taxonomy-analysis.md, few-shot-literature-review.md
  - entries/ → RKE-003.md, RKE-007.md, RKE-011.md, RKE-015.md

# Step 2: Plan which files to read (from INDEX.md, not memory)
# Need: RH-044, RH-048, failure taxonomy deep dive, RX-031 results, RKE-003, RKE-007
# That's 6 specific files — no need to read all 18

# Step 3: ls parent → read file (6 targeted reads)
bash("ls environment/hypotheses/")
→ PRIORITY-TRACKER.md  RH-044.md  RH-048.md
read("environment/hypotheses/RH-044.md")
read("environment/hypotheses/RH-048.md")

bash("ls environment/library/deep-dives/")
→ INDEX.md  failure-taxonomy-analysis.md  few-shot-literature-review.md
read("environment/library/deep-dives/failure-taxonomy-analysis.md")

bash("ls environment/experiments/RX-031/")
→ design.md  results.md
read("environment/experiments/RX-031/results.md")

bash("ls environment/entries/")
→ RKE-003.md  RKE-007.md  RKE-011.md  RKE-015.md
read("environment/entries/RKE-003.md")
read("environment/entries/RKE-007.md")
```

**Result**: 14 tool calls total (4 ls + 1 INDEX read + 6 file reads + 2-3 writes). Zero ENOENT errors. Only read the 6 files actually needed.

### What a wasteful researcher did (35+ tool calls):

```
read("environment/hypotheses/RH-044.md")   → ERROR: ENOENT
read("environment/research/hypotheses/RH-044.md")  → ERROR: ENOENT
bash("find environment/ -name 'RH-044*'")  → found it, but also dumped 18 other paths
read("environment/hypotheses/RH-044.md")   → SUCCESS (but burned 3 extra calls)
# ... repeated this pattern for every file, reading ALL 18 files "just in case"
```

**Key rule**: Read INDEX.md first. Use `ls` to confirm each directory before reading. Plan which files you need — don't read everything. Budget: aim for <20 tool calls total.
