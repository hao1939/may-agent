# System Constraints

## What We Have
- LLM API access (Claude, GPT-4) — inference only, no fine-tuning
- Prompt engineering capability — we control system prompts, task descriptions, skill files
- Gym infrastructure — can run controlled experiments with scenarios
- Session transcripts — full logs of every agent session
- Knowledge base — shared markdown files for persistent knowledge

## What We DON'T Have
- GPU training infrastructure — no fine-tuning capability
- Custom model serving — we use API providers
- Large labeled datasets — we have ~500 gym transcripts, not 50K
- Real-time monitoring — no live dashboard, only post-hoc analysis
- Budget for expensive experiments — keep under 100 gym runs per experiment
