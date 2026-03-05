# TODO

## Research Tasks

- [ ] **Anthropic Skill Creator** — Anthropic provides a skill-creator tool that can create skills for agents. Research:
  1. Learn how it works — what does it create, what format, how does it integrate?
  2. Try it hands-on — create a skill, see what it produces
  3. Evaluate: does this provide value for our agent system? Could we use it to generate skills for our agents? What are the limitations?
  4. Compare against our current approach (knowledge files, domain.md, coaching.md)
  - Delegate to Scout for initial research, then hands-on evaluation yourself

- [ ] **RALPH Loop** — Investigate the RALPH (Reason, Act, Learn, Plan, Hypothesize) loop pattern. Research:
  1. How does it work? What's the loop structure and what problem does it solve?
  2. How well does it perform compared to standard ReAct or plan-then-execute?
  3. What specific problems does it address that simpler loops don't?
  4. Try it — build a small prototype or run the demo
  5. Evaluate: is this useful for our agent system? Could it improve our agents' reasoning?
  - References:
    - https://github.com/thomas-chong/google-adk-ralph-loop-demo
    - https://github.com/PageAI-Pro/ralph-loop
  - Delegate to Scout to fetch and analyze both repos first, then synthesize

## OpenClaw Learnings — Design & Architecture

- [ ] **Import Design Philosophy Principles** — OC Bob maintained 42 design principles (553 lines). Read `/home/hao/openclaw-config/knowledge/design-philosophy.md`. Key ones to evaluate for our system:
  - P31 (Context Engineering > Prompt Engineering), P32 (pass@k vs pass^k), P34 (Verify-on-Edit), P35 (Harness = Moat), P40 (Acceptance Criteria Before Decomposition), P41 (Minimalism), P42 (Static Policies Fail)
  - Integrate applicable ones into `agents/shared/philosophy.md`

- [ ] **Weekly Synthesis Brief** — OC Bob produced weekly briefs: signal inventory, gold metric check ("is the system measurably better?"), structured findings. Start producing a weekly synthesis for our system. Template: `/home/hao/openclaw-config/knowledge/weekly-briefs/2026-W10.md`

- [ ] **Product Roadmap** — OC maintained a living `product-roadmap.md` capturing product direction from user input. Evaluate if our system needs one and what it would contain. Source: `/home/hao/openclaw-config/knowledge/product-roadmap.md`

- [ ] **Agent Evaluation Framework Upgrade** — OC has per-agent L1/L2/L3 capability profiles with specific eval questions (not generic rubrics). Review `/home/hao/openclaw-config/knowledge/agent-evaluation.md` and propose targeted evaluation criteria for each of our agents.

## Ideas from OpenClaw Bob (to validate)

- [ ] **Scout synthesis** — OpenClaw Bob produced 19 synthesis files cross-referencing Scout's tech discoveries with the system's design. Pattern: `[Scout finding] → [our system state] → [judgment/action]`. Reference examples in `knowledge/synthesis/`. Try this when Scout has new discoveries.

- [ ] **Amy + Scout cross-synthesis** — "The community (Amy/XHS) thinks X about agents, the field (Scout/arXiv) has Y, our system does Z." Higher-order pattern that no single agent can see. OpenClaw Bob did 2 of these.

- [ ] **User observation (MEMORY.md)** — OpenClaw Bob maintained a running memory of the human's design patterns, decision styles, and principles. See `workspace/memory-openclaw.md` and `workspace/user-profile.md` for reference. Consider whether maintaining similar docs improves Bob's design reviews.

- [ ] **SIGNALS.md** — Cross-agent coordination channel. Amy/Scout write one-liner signals when they find something relevant to Bob's domain. Bob reads at startup. Low-overhead way to connect exploration to synthesis without INBOX overhead.

# Tracking

_(empty)_
