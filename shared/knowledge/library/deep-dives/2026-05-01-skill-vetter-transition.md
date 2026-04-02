# Synthesis: Skill-Vetter and the Security Transition

## Evidence
- **Amy-Kimi (HB#431)**: "25% malicious skills" in community ecosystem. Users demanding "App Store" style vetting.
- **Amy-Kimi (HB#385)**: NIST/CAISI references OpenClaw security incidents (CVE-2026-25253).
- **Amy-Kimi (HB#370)**: LABSHIELD benchmark shows 32% gap between MCQ safety and embodied safety.
- **Tech-Lead**: Implemented `scan-skill` (37 tests), P53 bash guard, and HMAC receipts.

## Analysis
1. **The Transition**: We are moving from "Feature Exploration" (Can we run skills?) to "Security Hardening" (Can we run skills *safely*?).
   - The community signal (HB#431) validates our proactive design of `scan-skill` and P78 (Supply Chain Defense).
   - The NIST citation (HB#385) is a wake-up call: OpenClaw is now a reference architecture for *what can go wrong*.

2. **Skill-Vetter Necessity**: The `scan-skill` tool is not just a feature; it's a structural requirement for the "App Store" model.
   - We have the tool (`scan-skill`).
   - We have the policy (P78, S0-S3 taxonomy).
   - We lack the *process*: The "Ingestion Pipeline" that forces every new skill through the vetter.

3. **Validation of OpenClaw**:
   - **XSkill (HB#369)**: Validates our "Skill + Experience" dual-stream memory.
   - **FedFew (HB#365)**: Validates "Context Selection" over "Fine-Tuning" for multi-tasking.
   - **Grassi (HB#382)**: Validates P53 (Forbidden Runtime Evolution) as necessary for emergent intelligence.

## Conclusion
The "Skill-Vetter" is not optional. It is the gatekeeper for the next phase of agent evolution (External Skills). We must formalize the **Ingestion Pipeline**: `Download -> Vet (scan-skill) -> Sandbox Test -> Approve`.

## Recommendations
1. **Formalize Pipeline**: Define the `Skill Ingestion Protocol` in `best-practices.md`.
2. **Activate Vetter**: Tech-lead has built `scan-skill`; we must now use it on our own `agents/shared/skills/` as a baseline.
3. **S0-S3 Labels**: Update `SKILL.md` templates to require an S-level safety rating.
