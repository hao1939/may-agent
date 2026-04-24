# Skill: Investigate Test Infrastructure Before Fixing

## When to use
When fixing a bug where tests "pass" but the bug is confirmed real.

## Process
1. **Read test file completely** before touching source code
2. **Search for mocks/stubs/overrides**: Look for `jest.mock`, `sinon.stub`, manual function reassignment, or any pattern that replaces real functions with fakes
3. **Trace the call path**: Follow the function under test through imports to verify tests exercise the REAL code
4. **If mocks found**: The mock may be masking the bug. Your fix must address BOTH the source bug AND the test infrastructure problem

## Key insight
A passing test suite with a confirmed bug almost always means the tests aren't testing what you think. Find the interception point before writing any fix.
