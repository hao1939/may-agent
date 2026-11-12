import * as fileSystem from "node:fs";
import { mock } from "bun:test";

// Subprocess-only fault injection at the read/stat boundary of one exact file.
const fs = { ...fileSystem };
const target = process.env.MAY_TEST_DISAPPEAR_METADATA;
if (!target) throw new Error("Missing metadata disappearance fixture target");
let armed = true;
mock.module("node:fs", () => ({
  ...fs,
  statSync: (...args: Parameters<typeof fileSystem.statSync>) => {
    if (armed && String(args[0]) === target) {
      armed = false;
      fs.unlinkSync(target);
    }
    return fs.statSync(...args);
  },
}));
