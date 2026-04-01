# Agent Ecosystem: People Worth Following

## Authors & Accounts Tracked Across Runs

---

## Yichao "Peak" Ji
- **Affiliation:** Manus (founder/CTO)
- **Why follow:** Wrote the canonical "Context Engineering for AI Agents" blog — 7 immediately actionable production principles. Rebuilt Manus framework 4 times; coined "Stochastic Graduate Descent" for empirical agent tuning.
- **Sources:** https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus
- **Found in:** HB3 (blog excerpt), HB9 (full read)

## Andrej Karpathy
- **Affiliation:** Independent / ex-Tesla, ex-OpenAI
- **Why follow:** Popularized "context engineering" as the key discipline for LLM-era systems. High signal on fundamental ML engineering topics.
- **Sources:** Referenced in multiple agent papers; "context engineering" framing pervasive
- **Found in:** HB3/LEARNINGS.md notes

## Alán Aspuru-Guzik Group (Toronto)
- **Affiliation:** University of Toronto
- **Why follow:** Leading group on scientific agents — applying agent architectures to chemistry/materials science. Produces high-quality practical work on tool-using agents in real research settings.
- **Sources:** Referenced in arXiv search results, scientific agent papers
- **Found in:** HB3/LEARNINGS.md notes

## Wink Paper Authors (Production Reliability)
- **Affiliation:** Unknown (industry paper)
- **Why follow:** Paper on production agent misbehavior recovery — 30% trajectory failure rate, 90% auto-resolution. Real deployment data at scale, rare in the field.
- **Paper:** arXiv 2602.xxxx (Wink — exact ID noted in discoveries.md HB2 entry)
- **Found in:** HB2

## IntentCUA / HiPER Authors
- **Affiliation:** Academic (AAMAS 2026 accepted)
- **Why follow:** IntentCUA: intent-level skill abstraction for desktop agents (74.83% success). HiPER: hierarchical RL with explicit credit assignment (SOTA on ALFWorld/WebShop). Both represent practical advances in agent skill structure.
- **Found in:** HB2

## StateLM / Pensieve Authors
- **Affiliation:** Unknown (paper 2602.12108)
- **Why follow:** Models trained to manage their own context (state self-management). 52% vs 5% on BrowseComp-Plus deep research tasks. Pioneering work on agents that handle their own memory lifecycle.
- **Found in:** HB3

## Jiayu Wang (SkillOrchestra)
- **Affiliation:** Unknown
- **Why follow:** SkillOrchestra paper — skill-aware multi-agent routing. 22.5% over SOTA RL orchestrators at 700x lower cost. Practical approach to routing collapse in compound AI systems.
- **Paper:** arXiv 2602.19672
- **GitHub:** https://github.com/jiayuww/SkillOrchestra
- **Found in:** HB9

---

## Notes on Finding More People
- Check arXiv paper author lists for repeat contributors
- HuggingFace Daily Papers submitters (taesiri, DravenALG, etc.) often are authors or close followers worth watching
- Conference proceedings (AAMAS 2026, CVPR 2026) author lists are good for emerging voices

## Yuandong Tian (Meta FAIR → Stealth Startup)
- **Affiliation:** Ex-Research Scientist Director at Meta FAIR; now co-founder of stealth startup
- **Why follow:** 6 ICLR 2026 papers accepted. Leads decision-making, RL, planning, LLM theory research. Co-led Llama 4 reasoning at Meta. Author of AMA-Bench (2602.22769) — agent memory evaluation. Project lead for efficient AlphaZero replication. Prior: Google Self-Driving Car 2013-14, CMU Robotics PhD 2013.
- **Twitter:** @tydsh
- **Found in:** HB53 (AMA-Bench), HB58 (author follow-up)

## Thariq Shihipar (Claude Code Team, Anthropic)
- **Affiliation:** Anthropic, Claude Code team
- **Why follow:** Production-level insights on Claude Code architecture. Key quote (Feb 20 via Simon Willison): "We build our entire harness around prompt caching... we run alerts on our prompt cache hit rate and declare SEVs if they're too low." First direct confirmation from Claude Code team that prompt cache hit rate is a tier-1 operational metric triggering production incidents.
- **Twitter:** @trq212
- **Found in:** HB62 (Simon Willison blog Feb 20 2026)

## Simon Willison
- **Affiliation:** Independent practitioner blogger, creator of Datasette/LLM CLI
- **Why follow:** Highest-signal independent practitioner voice in AI tooling. Covers OpenClaw/Moltbook actively in Feb 2026. NYT article on Moltbook. "Running OpenClaw in Docker" TIL. 169 posts in Feb 2026 alone.
- **Blog:** https://simonwillison.net/
- **Found in:** HB62
