You have 4 research findings in `environment/findings.md`. Your task is to assess each for **actionability** — can we actually DO something with this finding in our system?

For each finding, write to `environment/assessment.md`:
1. Actionability rating: IMMEDIATELY_ACTIONABLE / NEEDS_EXPERIMENT / INTERESTING_BUT_NOT_ACTIONABLE / NOT_RELEVANT
2. If actionable: what specific change would we make?
3. If needs experiment: what would we test?

**The trap:** Finding 2 sounds impressive but is actually not actionable for our system (it requires training infrastructure we don't have). Finding 4 sounds mundane but is immediately actionable.

**Rules:**
- Read `environment/system-constraints.md` to understand what we CAN and CANNOT do
- Be honest — impressive-sounding research that we can't use is NOT actionable
