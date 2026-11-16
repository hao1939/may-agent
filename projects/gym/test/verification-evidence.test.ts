import { expect, test } from "bun:test";
import { verificationMethod } from "../src/scoring/verification-evidence";

const work = "/tmp/current work", origin = "/tmp/original work";
for (const command of [
  "node --test test/duration.test.cjs",
  "node test/duration.test.cjs",
  "bun test ./test/duration.test.cjs",
  "node --test --test-reporter=dot test/duration.test.cjs",
  "node --test --test-reporter tap test/duration.test.cjs",
  "cat docs/durations.md && node --test test/duration.test.cjs",
  "node --test test/duration.test.cjs && git diff --stat",
  `cd '${origin}' && node --test test/duration.test.cjs`,
  `cd "${origin}" && node --test "${origin}/test/duration.test.cjs"`,
  `node --test '${origin}/test/duration.test.cjs'`,
]) {
  test(`recognizes actual test invocation: ${command}`, () => {
    expect(verificationMethod("bash", command, work, origin)).toBe("test");
  });
}
for (const command of [
  "node --check test/duration.test.cjs",
  "node -c test/duration.test.cjs",
  "node --version",
  "echo 'node --test test/duration.test.cjs'",
  "cat docs/durations.md",
]) {
  test(`does not count non-verification: ${command}`, () => {
    expect(verificationMethod("bash", command, work, origin)).toBe("none");
  });
}
for (const command of [
  "custom-runner verify-duration",
  "node --test --test-only test/duration.test.cjs",
  "node --test --require ./hook.cjs test/duration.test.cjs",
  "node --test --eval='console.log(1)' test/duration.test.cjs",
  "node --test test/duration.test.cjs; echo success",
  "false || node --test test/duration.test.cjs",
  "cat docs/durations.md | node --test test/duration.test.cjs",
  "node --test test/duration.test.cjs # trailing comment",
  'node --test "$(pwd)/test/duration.test.cjs"',
  "node --test 'test/duration.test.cjs",
  "node --test test/duration.test.cjs &&",
  "cd /tmp/unrelated-project && node --test test/duration.test.cjs",
  "node --test /tmp/unrelated-project/test/duration.test.cjs",
  `node -e 'console.log("src/duration.cjs parseDurationMs 3m 180000 assert.equal")'`,
  `node -e 'const assert=require("node:assert/strict"); assert.equal(require("./src/duration.cjs").parseDurationMs("3m"),180000);'`,
]) {
  test(`needs evidence review, not a guessed verdict: ${command}`, () => {
    expect(verificationMethod("bash", command, work, origin)).toBe("review");
  });
}

test("relocation needs the runner's recorded origin, not a guessed cd target", () => {
  const command = `cd '${origin}' && node --test test/duration.test.cjs`;
  expect(verificationMethod("bash", command, work)).toBe("review");
  expect(verificationMethod("bash", command, work, origin)).toBe("test");
  expect(verificationMethod("write", undefined, work)).toBe("none");
});
