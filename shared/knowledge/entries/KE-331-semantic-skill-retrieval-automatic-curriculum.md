# KE-331: Semantic Skill Retrieval and Automatic Curriculum — Skills Must Be Findable, Not Just Available

**Status**: Theoretical (strong external evidence, untested internally)
**Source**: DD-831 (Agent Learning Mechanisms Survey — Voyager analysis)
**Confidence**: High (Voyager: 3.3× capability improvement from skill reuse; no weight updates, purely in-context)
**Created**: 2026-04-22

---

## One-Sentence Summary

Voyager demonstrates that executable skills stored with embedded descriptions and retrieved by semantic similarity produce 3.3× capability improvement — our `skills/` directory has 41 skills loaded by explicit path with no automatic retrieval, explaining the near-zero utilization (KE-026, KE-011).

---

## The Finding

### What Voyager Does
Voyager (Wang et al., 2023) achieves lifelong learning with zero weight updates:
1. **Skill library**: Successful programs stored as reusable functions with natural-language descriptions
2. **Retrieval**: Given new task, embed task description → retrieve top-k similar skills as context
3. **Composition**: Skills call other skills (hierarchical)
4. **Automatic curriculum**: Agent proposes *what to learn next* based on current capabilities
5. **Self-verification**: Agent writes success criteria, checks whether met

Result: 3.3× more unique items discovered than baselines; skills transfer across tasks.

### Our Current State
- 41 skills in `skills/` directory (see INDEX.md)
- Skills loaded by **explicit path** — agent must know the skill exists and its filename
- **Zero automatic retrieval** by task similarity
- **Zero curriculum**: agents react to assigned work, never propose "I should learn X next"
- KE-026 confirmed: pull discovery is dead (0/30 across 3 resource types)
- KE-011 confirmed: knowledge files are passive (0/29 across 3 studies)

**The gap is retrieval, not content**: We have skills. Agents can't find them.

### Predicted Impact
- P-831b: Semantic skill retrieval will increase skill utilization from ~10% to 40%+
- This directly validates KE-052 (structural access > content quality): the skills exist but access structure is wrong

### Experiment Design
**EXP-next: Skill Embeddings + Retrieval**
1. Embed all 41 skill descriptions
2. Add `find_relevant_skill(task_description)` tool or automatic injection of top-3 skills
3. Measure: skill reference rate (treatment) vs. baseline; task quality with/without
4. Bonus: test curriculum — let agent propose skills to create after completing tasks

---

## Connections
- **Directly addresses KE-026** (Pull Model Discovery Dead): Semantic retrieval converts pull to push
- **Directly addresses KE-011** (Knowledge Files Passive): Retrieval makes skills active
- **Extends KE-052** (Structural Access): Skill embeddings are an access structure improvement
- **Extends KE-079** (Structure-Aware Retrieval): DAG matching for experiences, embedding matching for skills
- **Extends KE-087** (Infrastructure Primitives): Skill retrieval is L4 (Experience Extraction) improvement
- **Connects to KE-065** (Few-Shot): Retrieved skills could serve as few-shot examples

---

*From DD#831 Voyager analysis. The skill library pattern works — our implementation is missing the retrieval layer that makes it work.*
