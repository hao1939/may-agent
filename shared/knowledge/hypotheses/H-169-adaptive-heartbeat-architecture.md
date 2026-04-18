# H-169: Adaptive Heartbeat Architecture — Learned Scheduling + Context Curation Reduces FM-1.3 and Improves Efficiency

**Created**: 2026-04-18 by Bob
**Status**: proposed
**Confidence**: ★★★☆ (strong theoretical basis, two converging papers)
**Source**: DD-770 (heartbeat-driven scheduling), DD-771 (active context curation via RL)
**Connects**: KE-011, KE-101, KE-210, H-087, FM-1.3

---

## Claim

Replacing hand-coded heartbeat templates and static context.md injection with (1) a learned cognitive module scheduler (DD-770) that selects what thinking activity to perform and (2) a learned context curator (DD-771) that selects what information to inject would reduce FM-1.3 errors by >30% and improve overall session efficiency by >15%.

## Mechanism

FM-1.3 errors (path guessing, schema guessing, stale assumptions) concentrate in early session orientation where agents operate on cached/stale context rather than relevant current state. Two independent causes:

1. **Wrong activity selection**: Heartbeat templates prescribe fixed step sequences regardless of state. When context hasn't changed, agents waste calls re-orienting. When many new items accumulate, agents under-allocate to synthesis. A learned scheduler (DD-770's meta-learning approach) would adapt the cognitive module mix based on accumulated state — skip orientation when nothing changed, invoke deeper synthesis when backlog grows.

2. **Wrong information in context**: Static context.md grows monotonically and includes stale facts alongside critical ones. KE-011 shows knowledge files are passive — agents skip them. A learned context curator (DD-771) would actively select reasoning anchors (the sparse critical data points) while pruning noise. DD-771 showed 8× token reduction with +3-5pp task success.

Combined: the scheduler decides WHAT to think about, the curator decides WITH WHAT information. This is the full adaptive loop — currently both are hand-coded (heartbeat.md templates + context.md bullet points).

## Evidence

### Supporting
- DD-770: Heartbeat scheduling with meta-learning improves proactive self-regulation; validates heartbeat as scheduling primitive
- DD-771: RL-trained 7B ContextCurator matches GPT-4o at context management; +4.8pp WebArena, 8× fewer tokens on DeepSearch
- FM-1.3 is our #1 failure mode (~34+ wasted calls in 7 days from path/schema guessing) — directly caused by stale/wrong context
- KE-011: Knowledge files are passive; critical info must be actively injected → curator solves this
- KE-101: Structural interventions >> text rules; learned scheduling is structural
- H-087 (context learning): Meta-learning scheduler IS context learning for cognitive strategy
- Our system already uses heartbeat architecture — this is enhancement, not greenfield

### Against / missing
- DD-770 is single-author, limited evaluation details
- DD-771 evaluated on web/search tasks, not coding/research agents
- Both papers address single-agent settings; our system is multi-agent
- RL training infrastructure doesn't exist in our system
- Hand-coded heartbeat templates may already be near-optimal for our narrow task distribution
- Confound: FM-1.3 might be better addressed by simpler fixes (better error messages, path caching)

## Predictions

| Condition | Predicted outcome |
|-----------|-------------------|
| Replace fixed heartbeat steps with state-adaptive module selection | FM-1.3 errors drop >30% (from ~5/day to <3.5/day) |
| Add active context pruning to session initialization | Token usage per session drops >20% with no accuracy loss |
| Combine both (adaptive scheduling + context curation) | Session efficiency (useful output / total calls) improves >15% |
| Apply only context curation without scheduling | FM-1.3 drops ~15% (half the effect — still operating on wrong activities sometimes) |
| Apply only scheduling without curation | FM-1.3 drops ~10% (right activities but wrong information still causes errors) |

## Test Plan

- **Design**: A/B comparison, 3 arms: (A) baseline heartbeat, (B) state-adaptive scheduling only, (C) scheduling + context curation. N=20 sessions per arm.
- **Scenario**: Production heartbeat sessions across Bob/Scout/Coach. Measure FM-1.3 count, total tool calls, useful-output ratio.
- **Approximation**: Before full RL training, test with heuristic approximations — e.g., conditional heartbeat steps based on `git log --since` recency, context.md pruning based on last-used timestamps.
- **Decision rule**: Confirmed if arm C shows >15% efficiency gain AND >30% FM-1.3 reduction vs arm A. Falsified if arm C shows <5% improvement or accuracy regression.

## Implications if true

- Heartbeat.md templates become adaptive policies rather than fixed scripts
- context.md becomes a dynamically curated working memory, not an append-only list
- Opens path to per-agent learned specialization — each agent's scheduler adapts to its task distribution
- Validates investing in RL infrastructure for agent self-improvement
- Changes the agent improvement strategy from "edit templates" to "improve the learning loop"

## Links

- Parent / related: H-087 (context learning), DD-770, DD-771, KE-011, KE-101, KE-210
- Tracked in: agents/bob/workspace/todo.md
