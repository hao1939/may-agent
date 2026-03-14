# L3 Investigation: Bob -> Tech-Lead Failures (Continued)

## Findings
- **Success Case**:
  - Children: `s_1773395769849_222` (Success) and `s_1773395878119_228` (Success)
  - Parent: `s_1773395347762_207` (Success)
  - ISR impact: **Integrated**.

- **Failure Case Candidate**: `s_1773399628875_352` (P53 Bash Guard)
  - Parent: `s_1773399618726_351` ("Jailbreak" - Success)
  - ISR impact: **Integrated**.

Wait. If the parent is SUCCESS, then ISR should be high.
The table says:
- TSR: 81.3% (3 failures out of 16)
- ISR: 50.0% (8 failures out of 16)

So there are **5 sessions** where Tech-Lead Succeeded, but Parent Failed.

Let's find one of those.
I will look for `bob->tech-lead` calls where status is `success` BUT parent status is `error`.

## Strategy: Manual Sampling
I need to check the parent status for all successful Tech-Lead calls.

Recent successful calls:
1. `s_1773395769849_222` (Parent Done)
2. `s_1773395878119_228` (Parent Done)
3. `s_1773399628875_352` (Parent Done)

Where are the failures?
Maybe the failures are OLDER?
The `limit=100` covers "Last 79 entries".
There are only 16 calls total.

Let's list ALL `bob->tech-lead` calls from the file.
