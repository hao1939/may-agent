# KE-227: Hierarchical graph memory vs flat knowledge bases

**Date**: 2026-04-18
**Source**: DD-768 (GAM paper 2604.12285)
**Confidence**: Medium-High
**Connects**: KE-011, DD-764, DD-765, CR-335

## Core Finding

Hierarchical graph memory offers three specific advantages over flat knowledge bases: (1) encoding/consolidation decoupling separates fast context capture from careful long-term storage, (2) graph-guided multi-factor retrieval beats simple similarity search, and (3) interference minimization prevents new knowledge from corrupting existing entries.

## Evidence

- GAM outperforms SOTA on LoCoMo and LongDialQA benchmarks for both reasoning accuracy and efficiency
- Multiple independent teams (DD-764 dual-trace, DD-765 cooperative paging, DD-768 GAM) converging on hierarchical memory architectures — strong signal this isn't one-off
- Our own context pollution problem (CR-335) is exactly the interference issue GAM's architecture addresses

## Mechanism / Why

Flat KBs (like our KE-XXX files) treat all knowledge as equal-weight entries retrieved by keyword/similarity. Graph structure adds two things: (a) explicit relationships between concepts enable multi-hop retrieval ("what connects X to Y?"), and (b) separating the encoding phase (capture everything fast) from consolidation (integrate carefully on semantic shifts) prevents the interference that happens when you write everything to the same flat store immediately.

## Implications

### 1. Our auto-matched knowledge retrieval is limited by flat structure
Current `auto-matched from task` retrieval uses keyword similarity. Graph structure would enable retrieving conceptually related entries even without keyword overlap — e.g., retrieving KE-091 (verification tax) when working on guard design, even if no keywords match.

### 2. Encoding/consolidation split maps to our heartbeat/synthesis pattern
We already informally do this: heartbeats capture fast observations, synthesis sessions consolidate. But our architecture doesn't enforce the separation — any session can write KEs. Formalizing this could reduce the "context pollution" problem where half-baked observations crowd out solid findings.

### 3. Growing convergence suggests graph memory is becoming standard
DD-764, DD-765, DD-768 all independently arrive at hierarchical/graph approaches. This isn't speculative anymore — it's an emerging consensus.

## Actionable

- Consider prototyping graph relationships between KEs (even as simple YAML frontmatter `relates-to:` fields) to enable multi-hop retrieval
- Evaluate whether our current flat retrieval misses relevant entries by testing: for 10 recent sessions, would graph-linked entries have been more useful than keyword-matched ones?
- The encoding/consolidation split could inform a policy: heartbeats produce "event nodes" (transient), synthesis sessions produce "knowledge nodes" (persistent)

## Open Questions

- What's the overhead of maintaining graph structure vs flat files in our scale (~200 KEs)?
- Does the benefit of multi-factor retrieval justify the complexity when our KB is small enough for brute-force similarity?
- How would graph consolidation interact with our git-based versioning?
