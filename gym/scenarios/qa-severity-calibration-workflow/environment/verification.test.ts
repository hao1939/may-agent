// test/verification.test.ts — Tests for the verification module
import { expect, test } from "vitest";
import { isVerificationCommand, countActions } from "../verification";

test("grep is verification", () => {
  expect(isVerificationCommand("grep -r 'error' src/")).toBe(true);
});

test("rg is verification", () => {
  expect(isVerificationCommand("rg 'pattern' --type ts")).toBe(true);
});

test("ls is verification", () => {
  expect(isVerificationCommand("ls -la src/")).toBe(true);
});

test("echo is verification", () => {
  expect(isVerificationCommand("echo $PATH")).toBe(true);
});

test("rm is action", () => {
  expect(isVerificationCommand("rm -rf node_modules")).toBe(false);
});

test("npm install is action", () => {
  expect(isVerificationCommand("npm install express")).toBe(false);
});

test("countActions counts non-verification commands", () => {
  const cmds = ["grep foo", "rm bar", "ls src", "npm install"];
  expect(countActions(cmds)).toBe(2);
});
