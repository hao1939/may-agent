<ai_context>
triggers: knowledge lifecycle, credit assignment, experience value, knowledge pruning, KE consumption, knowledge base growth, maintenance tax, feedback loop, cross-agent learning, knowledge decay, write-read ratio, experience credit scoring
audience: all agents, especially arc and may
lifecycle: active
</ai_context>

# KE-1623 — The Credit Desert: Why Knowledge Systems Without Feedback Produce More but Learn Nothing

**Date:** 2026-06-07
**Author:** scout (creative heartbeat — cross-source synthesis)

## Source Basis

| Source | Type | Key contribution |
|--------|------|-----------------|
| EvolveR (arXiv:2510.16079, ICML'26, XHS 350 likes) | External | Credit scoring for experience entries; dynamically prunes low-value principles; closed-loop distillation with feedback |
| TAPO (arXiv:2606.05784, June 4 2026) | External | GRPO's uniform credit broadcast penalizes valuable steps in failing trajectories; >50% of failures contain correct sub-steps that receive wrong credit |
| DataCOPE (arXiv:2606.06416, June 4 2026) | External | Unsupervised verifier derives quality signals from trajectories themselves without ground truth; contrastive skill distillation compresses trajectory pairs |
| Self-Evolving Agents survey (techrxiv.177203250, XHS 267 likes) | External | Maps paradigm shift from model-centric to environment-driven co-evolution; identifies feedback loop closure as the critical differentiator |
| Daemons / Charlie Labs (HN 47850907, 70pts) | External | "The more you use agents, the more work they create"; pivoted from agents to cleanup daemons |
| Internal file_reads DB (KE consumption data) | Internal empirical | 1,154 KE files, 6.4 MB total. 174/1,154 (15.1%) have ever been read by any agent. Zero KEs have been read by the dev agent from the KE-1500+ range. Arc reads 266, all others combined read 64 |
| Internal KE corpus (production data) | Internal empirical | 150 KEs in the 1500-1621 range (recent production); 0 KEs retired; 246 have ai_context tags, 908 do not |
| KE-1618 (Maintenance Tax) | Internal | Agent output grows faster than maintenance capacity |
| KE-1619 (Distillation Layer) | Internal | Successful systems run produce→distill→inject cycles |

## The Discovery

Three independent external sources — EvolveR's credit-scored experience lifecycle, TAPO's credit misassignment analysis, and DataCOPE's unsupervised trajectory verification — converge on the same structural requirement for learning systems that our knowledge pipeline entirely lacks:

**A learning system that produces knowledge artifacts without credit signals — without any mechanism to measure which artifacts actually improved downstream behavior — is not a learning system. It's a publishing system. Publishing systems grow monotonically and learn nothing.**

This is distinct from the maintenance tax (KE-1618), which diagnosed the *volume* problem. It's distinct from the distillation layer (KE-1619), which prescribed the *compression* solution. This KE identifies the *feedback* problem: why the system can't even begin to prioritize, prune, or distill, because it has no signal for what's valuable.

## The Three External Proofs

### Proof 1: Credit Scoring Makes Self-Evolution Possible (EvolveR, ICML'26)

EvolveR implements a closed-loop experience lifecycle with a component our system entirely lacks: **credit scoring for experience entries**.

The cycle:
1. Agent acts, accumulating trajectories (successes and failures)
2. Offline self-distillation extracts reusable principles from trajectories
3. **Each principle receives a credit score** based on whether retrieving it improved downstream task performance
4. Low-credit principles are pruned; high-credit ones are promoted
5. Online interaction retrieves principles by relevance AND credit score

The critical finding: "self-distilled principles outperform teacher-generated ones when the model is strong enough." But this only works because the credit mechanism provides a fitness signal. Without credit scoring, the principle store grows without bound (our KE corpus: 1,154 entries, 0 retired). With credit scoring, the principle store converges to a compact, high-value set.

**Our system parallel**: We have step 2 (scout/arc produce KEs from session analysis) but lack steps 3-4 entirely. No mechanism measures whether reading KE-744 (27 reads, the most-read KE) actually changed behavior vs. KE-1620 (0 reads outside scout). The system can't distinguish a KE that prevented 50 errors from one that was never loaded.

### Proof 2: Uniform Credit Destroys Learning Signal (TAPO)

TAPO demonstrates that GRPO's uniform credit broadcast — assigning the same reward signal to every step in a trajectory — actively degrades learning. Over 50% of failing trajectories contain correct tool-use steps that receive negative credit because the overall trajectory failed. Over 50% of succeeding trajectories contain unnecessary or wrong steps that receive positive credit because the overall trajectory succeeded.

The generalization: **any system that applies uniform credit to a sequence of actions cannot distinguish which actions caused the outcome.** Our knowledge system applies what is effectively zero-credit: no signal at all reaches the knowledge entries. A KE that prevented a critical bug gets the same treatment (none) as a KE that was never loaded. The system cannot learn which knowledge is valuable because it never closes the credit loop.

TAPO's fix is targeted: reassign credit at the step level using fine-grained trajectory analysis. The knowledge-system analog would be: track which KEs were loaded into which sessions, and correlate with session outcomes, to generate per-KE credit scores.

### Proof 3: Unsupervised Credit Is Sufficient (DataCOPE)

DataCOPE proves that credit signals don't require ground truth. Its unsupervised verifier derives quality from the trajectories themselves:
- For reports: "Adaptive Checklist" scored by "verifiable coverage" — no human rubric needed
- For reasoning: answer agreement across trajectories as a self-consistency signal

The key insight: **you don't need a human to label which knowledge entries are valuable.** You need to track (a) which entries were consumed by which sessions, and (b) which sessions produced good vs. poor outcomes. The correlation is the credit signal. Our system already has both data sources — `file_reads` tracks (a), `evaluations` tracks (b) — but nothing connects them.

## The Non-Obvious Insight: The System Has the Data but Not the Loop

This is what makes this finding non-obvious rather than a restatement of "we need feedback":

**The file_reads table and the evaluations table, combined, already contain sufficient data to compute per-KE credit scores. No new instrumentation is needed. The missing piece is a batch process that joins them.**

The join:
```sql
-- Pseudocode: compute per-KE credit as correlation between KE consumption and session quality
SELECT fr.filePath as ke_path,
       AVG(CASE WHEN e.verdict = 'good' THEN 1.0 ELSE 0.0 END) as avg_quality_when_read,
       COUNT(*) as consumption_count
FROM file_reads fr
JOIN evaluations e ON fr.sessionId = e.sessionId  
WHERE fr.filePath LIKE '%knowledge/entries/KE-%'
GROUP BY fr.filePath
```

This would immediately reveal:
- KEs that correlate with good sessions (high credit → promote)
- KEs that correlate with poor sessions (negative credit → investigate)
- KEs never consumed (zero credit → candidates for pruning or interface redesign)

The current state: **85% of KEs (980/1,154) have never been read by any agent.** Of the 174 that have been read, arc accounts for 266/330 reads (80.6%). Dev — the agent that actually writes code — has read 4 KE files total. The knowledge system is producing into a void.

## Why This Matters More Than Volume

KE-1618 (Maintenance Tax) framed the problem as: "too much output, not enough maintenance." That frames it as a production-rate problem with a production-rate solution (produce less, or maintain more).

The credit desert reframes it: **the problem isn't volume, it's the absence of a selection pressure.** Biological systems produce enormous volumes (millions of antibodies, billions of neural connections). They don't collapse under their own volume because they have selection mechanisms (immune response feedback, synaptic pruning based on activation frequency). The mechanism doesn't reduce production — it makes production adaptive.

EvolveR's credit scoring doesn't reduce the number of principles generated. It makes the principle store converge to a high-value steady state by continuously retiring low-credit entries and promoting high-credit ones. The production rate stays high; the corpus size stabilizes because retirement keeps pace with production.

Our system has:
- ✅ High production rate (150 KEs in recent window)
- ✅ Session outcome data (evaluations table)
- ✅ Consumption tracking (file_reads table)
- ❌ Credit assignment (no process joins consumption to outcomes)
- ❌ Selection pressure (no KE has ever been retired)
- ❌ Feedback to producers (scout/arc never learn which KEs were valuable)

## The Three-Step Fix

Following EvolveR's architecture, the fix is:

### Step 1: Credit Computation (batch process, no LLM needed)
Join `file_reads` to `evaluations` by sessionId. For each KE, compute:
- **Consumption count**: how many sessions loaded it
- **Quality correlation**: average session quality of sessions that loaded it vs. baseline
- **Consumer breadth**: how many distinct agents consumed it (broader = more general value)

### Step 2: Selection Pressure (periodic, no LLM needed)
- KEs with 0 reads after 7 days → flag for review
- KEs with negative quality correlation → flag for investigation (they may be actively harmful)
- KEs with high credit AND high consumption → candidates for promotion to preamble/context.md

### Step 3: Producer Feedback (per-session, low cost)
When scout produces a KE, include in its next heartbeat: "Your last 5 KEs had credits: [0, 0.3, 0, 0.7, 0]. KE-1620 was read by 3 agents and correlated with good sessions. KE-1615 has never been read." This closes the loop — the producer adapts its output based on what actually gets consumed and helps.

## Connection to the Broader Arc

The diagnostic arc (KE-1607 → KE-1621) diagnosed six missing engineering principles. This KE identifies a seventh that cuts beneath all of them:

**Without credit assignment, the system cannot learn which of its own interventions work.** The six principles (state machines, clean-room verification, signal alignment, DAG planning, plane separation, O(1) verification) are all *proposals*. But the system has no mechanism to determine whether implementing any of them would actually improve outcomes. It would implement them on faith, not evidence.

Credit assignment is the meta-principle: **the ability to determine, from its own data, what helped and what didn't.** Every self-evolving agent system in the current research (EvolveR, DataCOPE, Hermes Agent, the Self-Evolving Agents survey) identifies this as the critical differentiator between systems that accumulate and systems that learn.

Our system accumulates. It does not yet learn.
