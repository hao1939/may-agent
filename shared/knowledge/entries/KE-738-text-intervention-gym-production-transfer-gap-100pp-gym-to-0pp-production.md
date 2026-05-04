# KE-738: Text Intervention Gym-Production Transfer Gap — +100pp in Gym Collapses to +0pp in Production

**Date**: 2029-08-04  
**Source**: EXP-560, EXP-565, EXP-580, EXP-800  
**Confidence**: HIGH (two independent experiments with identical pattern)  
**Extends**: KE-480 (text coaching dead), KE-560 (threat framing works in gym), KE-107 (gym-production gap)

## Core Finding

Text interventions — including threat-framed gates — can show +100pp improvement in gym scenarios but produce **zero measurable effect** in production. The gym-to-production transfer gap for text interventions is not partial degradation; it is total collapse.

## Evidence

### EXP-560/565: Threat-Framed Verify-After-Edit

| Environment | Baseline | Treatment | Delta |
|------------|----------|-----------|-------|
| Gym (EXP-565) | 0/3 (0%) | 3/3 (100%) | **+100pp** |
| Production (EXP-580, n=77 edits) | 9.7% | 12.9% | **+3.2pp** (noise) |

The exact same threat-framed text ("session REJECTED if not verified") deployed via master-worker.ts:454-456 had no measurable production effect despite perfect gym results.

### Why Gym Results Don't Transfer

1. **Attention budget**: In gym, the task prompt IS the entire context. In production, it competes with project state, prior conversation, file contents, and error messages.
2. **Task complexity**: Gym scenarios have 1-3 files and a single objective. Production sessions handle 5-20 files across multi-step workflows.
3. **Priority displacement**: Production agents face real failures (test errors, build breaks) that override text instructions. Gym agents face no competing urgency.
4. **Behavioral inertia**: The agent's tool-calling habits (bash over edit, skip verification) are deeply ingrained patterns that text cannot override at scale.

## Implications

1. **Gym is necessary but not sufficient** for validating text interventions. A positive gym result is a prerequisite, not proof of production effectiveness.
2. **Only structural interventions transfer reliably**: EXP-500 (auto-inject file content) achieved 0% failure in production. EXP-530 (verification gate) achieved 100% recovery. Both are code-level, not text-level.
3. **Stop deploying text interventions based solely on gym results**. Require a production measurement phase (EXP-580 style) before declaring success.
4. **KE-560 needs downgrade**: Threat framing works for gym measurement but should NOT be assumed to transfer. KE-560's "application" section overpromises.

## The Intervention Effectiveness Hierarchy (Updated)

| Tier | Mechanism | Gym Effect | Production Effect | Examples |
|------|-----------|------------|-------------------|----------|
| S | Code-level enforcement | +100pp | +100pp | EXP-500 (auto-inject), EXP-530 (gate) |
| A | Structural workflow gates | +100pp | ~+50-80pp | EXP-520 (artifact gate) |
| B | Text for judgment/format | +100pp | +30-50pp | EXP-335 (output format), EXP-445 (impact-radius) |
| C | Text threat framing | +100pp | **+0pp** | EXP-565 (verify-after-edit) |
| D | Text awareness/reminders | +0-10pp | +0pp | EXP-280, EXP-350, EXP-495 |

The critical distinction between Tier B and Tier C: **judgment skills** (what to think about) transfer because they add new decision criteria. **Behavioral habits** (what tool to call next) don't transfer because they compete with ingrained patterns amplified by production complexity.

## Falsification Criteria

- F1: A text-only behavioral intervention shows ≥+15pp in production (n≥30 sessions) → revise hierarchy
- F2: A structural intervention shows <+30pp in production → revise S-tier claim
- F3: Threat framing shows ≥+20pp on a non-verification behavioral habit in production → C-tier is verify-specific, not general

## Related

- KE-480: Text coaching dead for verification behaviors
- KE-560: Threat framing works (gym-only caveat now established)
- KE-107: Gym-production gap for natural behavior (10× difference)
- EXP-575: Structural auto-read injection (the correct path for VAE)
