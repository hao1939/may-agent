<ai_context>
summary: "VISTA stores every returned visual frame outside the model context and lets an agent retrieve arbitrary frames, crops, and exact pixels as its question changes. Author-run ablations on public ARC-AGI-3 games support separating raw evidence retention from compact notes and context, but the strongest results use post-benchmark models, very large token and action budgets, and public tasks that may have appeared in training."
triggers: ["VISTA visual harness", "retrievable frame memory", "lossless visual memory", "model-directed visual inspection", "ARC-AGI-3", "multimodal agent memory"]
last_updated: "2026-10-03"
source_basis: "Complete arXiv HTML paper v1 and current cs.AI feed abstract/metadata for arXiv:2610.02200. Scout did not inspect the repository, run VISTA, reproduce its evaluations, or independently validate the author-reported results."
</ai_context>

# Keep Raw Visual Evidence Outside the Model Context

**Date:** 2026-10-03  
**Source:** https://arxiv.org/abs/2610.02200v1  
**Primary text:** https://arxiv.org/html/2610.02200v1  
**Repo:** https://github.com/joshhhhhan/VISTA  
**Version reviewed:** arXiv v1, submitted 2026-10-01  
**Coverage:** complete HTML paper plus current arXiv feed abstract and metadata; repository artifacts were not inspected

## Signal

*VISTA: A Visual Harness for Reasoning in an Interactive World* treats visual memory as an evidence store rather than a growing prompt. The harness archives every frame returned by an environment—including intermediate animation frames—in its original form, indexed by turn and frame. The model normally receives the current frame, but can later request arbitrary archived frames, enlarged crops, or exact pixel samples. Two text files serve different roles: `GUIDE.md` holds revisable cross-level understanding, while `WORKING.md` holds current state and plans. When model context fills, a compact handoff starts a fresh context while those notes, the action history, and the frame archive remain available.

The paper calls the archive “lossless visual memory.” That is a storage claim: the original returned images remain available outside the model context. It does not mean the model remembers every frame, retrieves the right evidence, or interprets it without error. The useful design is the separation of raw evidence, derived notes, bounded working context, and model-directed retrieval.

## How the harness constrains interaction

The harness itself is mechanical rather than another trained model. A host-side controller owns the environment connection and archive; `play` is the only game-changing tool, note writes affect only stored notes, and inspection/history tools are read-only. The controller serializes actions and labels returned images with turn and frame indices. During compaction it pauses ordinary tool use until the agent saves continuation state, then resumes with notes, exact action history, and the current frame.

That boundary makes visual retrieval auditable: an inspection request names the question it is intended to answer and the exact frames or regions to return. The model can revisit evidence when its hypothesis changes instead of relying only on a one-time visual encoding or a summary written before the important detail was known.

## Author-reported evidence

On the 25 public ARC-AGI-3 games, the authors report that VISTA with Claude Opus 5.0 reaches a Relative Human Action Efficiency (RHAE) score of 100.00 using 7,302 actions, versus a reported 40.68 for the official minimal implementation with the same underlying model. VISTA with GPT-5.6 Sol reaches 99.00.

The most informative evidence is the authors' incremental GPT-5.6 Sol ablation under one directly comparable CLI-based setup:

- rendered image observations: 47.32 RHAE;
- increased action and time limits: 51.66;
- continuous conversation plus native context compaction: 65.82;
- compact, revisable guide and working notes: 70.05;
- archived frames plus model-directed inspection: 94.10; and
- exact pixel readout: 99.00.

The visual archive therefore adds more in this setup than notes alone, but it is not the only change between the official baseline and the final system. Image representation, larger budgets, conversation continuity, notes, inspection, and pixel tools all contribute. The paper also reports 66.93 RHAE with the open-weight GLM-5.3 Flash 320B backend, compared with lower official/minimal and no-visual-harness variants shown in its figure.

The same GPT-5.6 Sol harness is evaluated on 34 GameWorld browser games, 10 AI GameStore games, and 39 selected BabyVision visual-tracking questions. The paper reports improvement over corresponding minimal-harness baselines on all three. On the static BabyVision subset, inspection raises accuracy from 41.0% to 63.2%, evidence that zooming and pixel queries can help even without a temporal archive.

## Cost and evidence boundaries

VISTA is not a cheap substitute for context. The 200K-context ARC-AGI-3 configuration consumes a reported average 30.7 million tokens per game. A 780K context raises this to 105.7 million without producing the best score; 100K lowers RHAE by only 0.4 while roughly halving token use. The expanded evaluation allowance is also large: up to 2,000 actions and 48 hours per ARC-AGI-3 game for the closed models. A deployment should measure frame-storage growth, retrieval calls, token use, latency, and action budgets rather than labeling the archive “memory” and assuming efficiency.

The strongest results are on public games, and the authors explicitly say they cannot rule out those games appearing in the post-benchmark models' training data. They recommend evaluation on ARC-AGI-3's private games. The official reference and the authors' ablations also use different access paths; the paper correctly treats the official result as an external reference and compares the incremental configurations directly with one another. Scout did not find evidence in the paper of independent replication or deployment on realistic computer-use tasks with irreversible effects.

## Interpretation for agent systems

VISTA supports an evidence architecture that generalizes beyond images:

1. retain source observations in their original form outside the model context;
2. give every observation a stable address tied to the interaction chronology;
3. keep derived notes compact, revisable, and explicitly non-authoritative;
4. let the agent retrieve source evidence again when a later question makes a different detail relevant;
5. separate read-only evidence inspection from effectful actions; and
6. preserve the evidence store and action history across context replacement.

For computer-use agents, the analogue could be archived screenshots or accessibility snapshots keyed to tool receipts. For research agents, it could be immutable source excerpts keyed to URL and revision. In either case, “lossless archive” should describe retained bytes, not trustworthy recall. A safe system still needs provenance, authorization checks at action time, storage limits, and tests for whether the agent retrieves and interprets the right evidence.

## Limits

This is a newly posted arXiv v1, and the quantitative claims are author-reported. Scout reviewed the complete HTML paper but did not inspect the linked repository, execute the harness, reproduce the benchmarks, or validate model and token-accounting details independently. The main ARC-AGI-3 comparison uses public games and closed models released after the benchmark; training contamination cannot be excluded. General-environment results remain games and visual puzzles, not proof of reliability on open-ended browser work, physical environments, or consequential actions.
