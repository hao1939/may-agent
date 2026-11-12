<ai_context>
summary: "A BEHAVIOR Challenge report uses one learned VLA policy for 100 household tasks but routes 14 tasks to a coding agent that controls the robot through observation and motion tools from a frozen practice-session state. The abstract reports a large score gap on those selected tasks, but route selection, practice provenance, and per-route evaluation remain necessary to interpret the hybrid result."
triggers: ["embodied agent routing", "robot coding agent", "BEHAVIOR Challenge", "hybrid robot policy", "frozen practice session", "VLA routing", "Astra robot agent"]
last_updated: "2026-11-12"
source_basis: "arXiv:2611.14432v1 title, metadata, comment, and abstract retrieved through the workflow-owned cs.AI feed request on 2026-11-12. Scout did not inspect the full paper, code, checkpoint, project page, demonstrations, evaluation infrastructure, route-selection method, practice session, simulator states, task results, or submission artifacts."
</ai_context>

# Embodied-agent routing needs route-specific receipts

**Date:** 2026-11-12  
**Source:** [One Policy for 100 Household Tasks: Our Solution for the 2026 BEHAVIOR Challenge](https://arxiv.org/abs/2611.14432v1)  
**Source revision:** arXiv:2611.14432v1  
**Coverage:** Title, metadata, comment, and abstract only  
**Disposition:** New knowledge

## Question

What does a household-robot system that combines a learned vision-language-action policy with a separately routed coding agent establish about hybrid embodied-agent architecture and evaluation?

## What the abstract reports

The paper describes a ninth-place solution to the 2026 BEHAVIOR Challenge, covering 100 long-horizon household tasks in the OmniGibson simulator. Its main learned component is one vision-language-action (VLA) checkpoint shared across all 100 tasks. The abstract reports a Q score of 0.371 on the 50 tasks shared with the team's 2025 entry, up from 0.260, and 0.392 across all 100 tasks.

The reported training changes include migrating from 50 to 100 tasks, warm-starting new task and stage embeddings from similar old tasks, variance-reduced multi-sample flow matching, and a 200,000-step training run over about 211 million demonstration frames. The authors also describe cloud evaluation infrastructure that retains provenance, episode diagnostics, and restorable simulator states.

The system is not solely the learned policy. Fourteen tasks are routed to a "GPT-6 Astra coding agent" that controls the robot through observation and motion tools and starts each episode from a frozen copy of its own practice session on training instances. Across those 14 tasks, the abstract reports mean Q of 0.639 for Astra versus 0.108 for the learned policy. The public submission reportedly included only part of the Astra results and achieved 0.446 Q with 27.3% full-task success.

## Scout interpretation

The useful signal is **asymmetric task routing between different execution paradigms**, not simply that one robot policy handles 100 tasks. A shared learned policy supplies a broad default lane, while selected tasks move to a tool-using coding agent with its own practice-derived state. The large reported gap on those 14 tasks suggests that some long-horizon household procedures may benefit from explicit observation, planning, and motion-tool use rather than a single learned action policy.

However, the hybrid score needs route-specific receipts before it can support a general architectural claim:

1. **Selection receipt:** Which 14 tasks were routed, by what rule, and was the choice made before seeing evaluation outcomes?
2. **Practice receipt:** What information entered the frozen practice state, which training instances produced it, and how was leakage into evaluation prevented?
3. **Executor receipt:** Which model, prompt, observation interface, motion tools, retries, and simulator restore points were used for each coding-agent episode?
4. **Matched outcome receipt:** How do both executors perform on the same routed and non-routed task sets under matched attempt, time, intervention, and compute budgets?
5. **Submission receipt:** Which Astra results were included in the public score, and how do omitted results affect aggregate comparisons?

A frozen practice snapshot is valuable for reproducibility because it can bind an episode to a specific acquired state. It is not automatically a fair baseline or a generalizable memory. If the route is selected after learning which tasks favor the coding agent, or if practice state contains task-instance-specific information, the 0.639-versus-0.108 comparison may measure a selected specialized lane rather than a deployable router.

This finding complements [Agentic manipulation policies need harness and memory ablations](./2026-11-10-agentic-manipulation-policies-need-harness-and-memory-ablations.md). That paper reports a generalist harness competing with specialist policies; this source instead reports a hybrid system whose executors differ in model, control interface, and acquired state. Together they argue for treating model, harness, memory, route, and task slice as separate evaluation identities.

## Retrieval record

The workflow-owned bounded request checked:

- **Endpoint:** `https://export.arxiv.org/api/query?search_query=cat%3Acs.AI&start=0&max_results=20&sortBy=submittedDate&sortOrder=descending`
- **HTTP status:** 200
- **Latency:** 283 ms
- **Request count:** 1
- **Retry-After:** not present

## Evidence limits

Scout reviewed only the arXiv feed's title, metadata, comment, and abstract. The full paper, code repository, released checkpoint, project page, challenge rules, demonstrations, training configuration, evaluation infrastructure, episode records, restorable states, route-selection logic, practice-session contents, per-task scores, model access, costs, interventions, and public submission were not inspected.

The abstract does not establish that the 14 tasks were selected prospectively, that the coding agent saw no evaluation-specific information, that its practice state transfers to unseen task instances, that both executors received matched budgets, or that the reported mean difference is statistically stable. It also does not isolate whether Astra's advantage comes from the model, the coding-agent loop, motion tools, practice state, task selection, retries, or their combination. Results from one simulator challenge do not establish safe or reliable physical-robot deployment.
