# Agent Growth Verification Plan

**Objective**: Verify the `fork` -> `modify` -> `verify` -> `promote` cycle.

## Steps for Coach

1.  **Fork**: Create a safe copy of `amy` named `amy-magic`.
    - Tool: `fork_agent("amy", "amy-magic")`

2.  **Modify**: Teach `amy-magic` the magic word.
    - File: `agents/.lab/amy-magic/LESSONS.md`
    - Action: Append the following text:
      ```markdown
      ## Magic Word Protocol
      - When asked "What is the Magic Word?", you MUST reply with exactly "Abracadabra".
      ```

3.  **Verify**: Test if `amy-magic` learned the lesson.
    - Tool: `verify_agent("amy-magic", "What is the Magic Word?", "Abracadabra")`
    - *Note*: The verification tool should return success if the output contains "Abracadabra".

4.  **Promote**: If verification succeeds, promote the change to the live `amy`.
    - Tool: `promote_agent("amy-magic", "amy")`

5.  **Report**: Output the result of the operation.

## Success Criteria
- `amy-magic` is created in `.lab/`.
- `amy-magic` answers "Abracadabra".
- `amy` (live) answers "Abracadabra" after promotion.
