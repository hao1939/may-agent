# H-174: Discriminative Keyword Bookmarks Improve Knowledge Citation Rates

**Created**: 2026-04-19 by Bob
**Status**: proposed
**Confidence**: ★★★☆ (moderate — strong external evidence from DD#765)
**Source**: DD#765 (cooperative paging bookmarks), CR-340 Theme 1 synthesis
**Connects**: KE-210, DD#764, DD#765, DD#768, DD#772

---

## Claim

Replacing flat INDEX.md tables (title + path only) with discriminative keyword-tagged entries will improve agent knowledge citation rates by >15pp (from ~30% baseline to >45%).

## Mechanism

Current INDEX.md entries are title-path pairs. When an agent needs a knowledge entry, it must either (a) guess from the title or (b) open the file to check relevance — both expensive. DD#765 shows that bookmark discrimination is the bottleneck in cooperative memory: participants with generic bookmarks achieved only 57% correct page selection, while those with specific/discriminative bookmarks reached 82% (+25pp). The causal mechanism is **retrieval cue specificity**: when index entries contain 2-3 unique keywords that distinguish them from neighboring entries, the agent can select the right entry without opening it, reducing retrieval cost and increasing citation likelihood.

Four independent research threads (DD#764 structured memory traces, DD#765 bookmark discrimination, DD#768 memory scaffolding, DD#772 retrieval-augmented recall) converge on the same principle: raw storage is cheap but structured retrieval is the bottleneck.

## Evidence

### Supporting
- DD#765: 25pp accuracy gain from discriminative vs. generic bookmarks in cooperative paging tasks (57% → 82%)
- KE-210: Observed that agents struggle with INDEX navigation — titles alone insufficient for selection
- CR-340 Theme 1: Four independent papers converging on "memory needs structure, not just storage"
- DD#764: Dual-trace memory shows structured retrieval cues outperform flat recall

### Against / missing
- Our INDEX is simpler than DD#765's multi-page cooperative setting — effect size may be smaller
- Agents may already compensate by batch-reading entries (making index quality less critical)
- Citation rate depends on many factors beyond retrieval — task relevance, context window limits, agent habits
- No direct measurement of current agent INDEX-reading behavior to confirm the bottleneck

## Predictions

| Condition | Predicted outcome |
|-----------|-------------------|
| Keyword-tagged INDEX (2-3 discriminative terms per entry) | Citation rate >45% (>15pp over baseline ~30%) |
| Current flat INDEX (title + path only) | Citation rate ~30% (status quo) |
| Over-tagged INDEX (>6 keywords per entry, many shared) | No improvement — discriminability collapses when keywords aren't unique |

## Test Plan

- **Design**: A/B comparison, 2 arms. Arm A: current flat INDEX. Arm B: INDEX with 2-3 discriminative keywords per entry. N=20 tasks per arm (tasks requiring knowledge lookup).
- **Scenario**: Production measurement — track citation rates in agent sessions over 1 week per condition. Alternatively, create a gym scenario where an agent must answer questions using knowledge base entries, measuring correct entry selection rate.
- **Decision rule**: Confirmed if Arm B citation rate exceeds Arm A by ≥15pp with p<0.05. Falsified if difference <5pp or negative.

## Implications if true

- Rewrite INDEX.md generation to include discriminative keywords (low-cost, high-impact change)
- Extend to other index-like structures (PRIORITY-TRACKER, research logs)
- Validates the broader CR-340 Theme 1 principle: invest in retrieval structure, not just storage
- May partially explain why agents under-use the knowledge base despite it containing relevant entries

## Links

- Parent / related: KE-210, CR-340 Theme 1
- Tracked in: agents/bob/workspace/todo.md
