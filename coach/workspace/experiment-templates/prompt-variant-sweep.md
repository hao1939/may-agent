# EXP-NNN: <short title> (prompt-variant sweep)

**Type:** (c) prompt-variant sweep
**Created:** YYYY-MM-DD
**Hypothesis:** <which phrasing of a prompt/rule maximizes pass rate>
**Reference:** EXP-143..156 (C1.x variant sweeps in prove-the-loop)

## Phase 1 — Design

- **Scenario(s):** `<scenario-id>` (single scenario for clean signal)
- **Variable:** prompt text for <rule / injection / SOUL section>
- **Variants (3–5 max):**
  - V0 (control): <baseline text or empty>
  - V1: <variant 1 — one-word summary>
  - V2: <variant 2>
  - V3: <variant 3>
- **Primary metric:** pass rate
- **N trials per variant:** ≥ 10 (sweep needs tighter error bars)
- **Decision rule:** winner = highest pass rate AND delta over V0 ≥ 0.15; tie → pick shortest text (KE-025)

## Phase 2 — Setup

```bash
# Each variant is one overlay file applied via --common-sense or prompt overlay
mkdir -p agents/coach/workspace/EXP-NNN/variants
# V0 = baseline (no overlay); V1..Vn = files in variants/
printf '<V1 TEXT>\n' > agents/coach/workspace/EXP-NNN/variants/v1.md
printf '<V2 TEXT>\n' > agents/coach/workspace/EXP-NNN/variants/v2.md
```

## Phase 3 — Run

```bash
# Use gym-batch with --variants if available, otherwise loop
for v in v0 v1 v2 v3; do
  overlay=""
  [ "$v" != "v0" ] && overlay="--common-sense agents/coach/workspace/EXP-NNN/variants/$v.md"
  scripts/gym-run.sh <scenario-id> --agent <agent> --trials 10 $overlay \
    > agents/coach/workspace/EXP-NNN/$v.log
done
```

## Phase 4 — Analyze

- Extract pass rate per variant:
  `grep -c 'PASS' agents/coach/workspace/EXP-NNN/<v>.log`
- Sort by pass rate; compute delta vs V0
- Check token overhead (KE-025 instruction-overhead paradox): if best variant is longest, be suspicious
- Check failure-mode shift between variants

### Results
| Variant | Text (summary) | Pass | Δ vs V0 | Tokens |
|---------|----------------|------|---------|--------|
| V0      | baseline       |      | 0       | 0      |
| V1      |                |      |         |        |
| V2      |                |      |         |        |
| V3      |                |      |         |        |

## Phase 5 — Graduate

- [ ] Winner Δ ≥ +0.15 → promote winning text into agent file
- [ ] Replicate on 1 additional scenario (~5 trials) to check generalization before promotion
- [ ] Log in `experiments.jsonl`
- [ ] Delete variant files if none promoted

## Constraints
- KE-025: prefer shorter text when deltas tie.
- KE-133: do NOT add few-shot examples on discovery-style tasks.
- Keep variants to ≤5 — combinatorial blow-up wastes trials.
