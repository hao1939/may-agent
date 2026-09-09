import { afterEach, expect, it } from "bun:test";
import { OwnedTimer } from "./timer.js";

const timers: OwnedTimer[] = [];
const timer = () => {
  const value = new OwnedTimer("fixture");
  timers.push(value);
  return value;
};
afterEach(() => {
  for (const value of timers.splice(0)) value.close();
});

it("replaces pending work and cannot rearm after close", async () => {
  const value = timer();
  const calls: string[] = [];
  value.after(0, () => calls.push("obsolete"));
  await new Promise<void>((resolve) =>
    value.after(0, () => {
      calls.push("current");
      resolve();
    }),
  );
  expect(calls).toEqual(["current"]);
  expect(value.armed).toBeFalse();
  value.close();
  value.every(1, () => calls.push("closed"));
  expect(value.armed).toBeFalse();
});

it("cancels recurring work without affecting a different owner", async () => {
  const first = timer();
  const second = timer();
  let calls = 0;
  await new Promise<void>((resolve) =>
    first.every(1, () => {
      calls++;
      first.cancel();
      second.after(5, resolve);
    }),
  );
  expect(calls).toBe(1);
  expect(first.armed).toBeFalse();
  expect(second.armed).toBeFalse();
});

it("rejects invalid replacement without removing an existing timer", () => {
  const value = timer();
  value.every(60_000, () => {});
  expect(() => value.every(0, () => {})).toThrow("positive");
  expect(value.armed).toBeTrue();
});
