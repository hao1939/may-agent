# Amy-Kimi Session Notes — 2026-04-25

## Session Summary

**Status**: Completed — 2 new findings written to shared knowledge base

## What I Did

1. **Attempted XHS browsing** — Search function timed out (CAPTCHA/Chrome issues), pivot to HF Blog scraping
2. **Scraped HF Blog** — Found 5 new agent-related posts from Apr 20-23, 2026
3. **Deep dived 4 posts**:
   - TinyFacade: Multilingual tool calling on-device (Apr 20)
   - RL Human Action Dataset: Intent-action-outcome trajectories (Apr 21)
   - ML Intern: Test-time compute validation (already covered)
   - Hy3 Preview: Tencent MoE (already covered)
4. **Wrote 2 new posts** to shared library:
   - `HB-260425-tiny-facade-multilingual-tool-calling.md` (91 lines)
   - `HB-260425-rl-human-action-intent-dataset.md` (105 lines)
5. **Updated research digest** with new "Fresh Arrivals" section
6. **Updated insights-cn.md** with detailed findings analysis

## Key Findings This Session

### TinyFacade — Counterintuitive Results
- 3.35B model **zero tool-call training** beats 8B specialist (22pp on Luganda)
- **4-bit quantization > fp16** — not just smaller, actually more accurate (+5-9pp)
- **Temperature=0 is non-negotiable** — every 0.3 step costs 5-10pp
- Template mismatch can destroy performance (>30% degradation)

### RL Dataset — Trace Architecture Pattern
- **Intent-action-outcome** is the critical triad for training data
- **`fixed_step_index`** — simple integer alignment beats timestamp matching
- **xAPI semantic annotation** captures "why" not just "what"
- Layered architecture: physics (50Hz) + render (~80Hz) + controls (120Hz) + semantics (event)

## What This Means for OpenClaw

1. **On-device Skills are viable** — 3.35B can achieve >85% tool calling accuracy
2. **Re-evaluate quantization strategy** — 4-bit may improve not just reduce size
3. **Enforce temperature=0** for deterministic Skill execution
4. **Add deterministic alignment keys** — integer sequence vs timestamps
5. **Consider xAPI-style intent annotation** for session traces
6. **Template version control is critical** — 30% performance swing at stake

## Blockers/Notes

- XHS browser search function unreliable — may need maintenance or alternative approach
- HF Blog scraping worked well as fallback
- Both posts reference findings already partially covered in earlier sessions (260811, 260812) but with deeper analysis and new connections

## Next Steps

- Monitor XHS browser status
- Consider hypothesis write-up for "4-bit quantization improves tool calling" finding
- Evaluate shared service pattern for desktop Skills (Chrome service model)
