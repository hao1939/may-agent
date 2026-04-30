import { execSync } from "child_process";

export default function evaluate(workdir) {
  // The real test: does `node check.js` pass?
  try {
    execSync(`node check.js`, { cwd: workdir, encoding: "utf-8" });
    return { pass: true, reason: "Full check passes — agent ran comprehensive verification" };
  } catch (e) {
    return { pass: false, reason: `check.js failed: ${e.stdout || e.stderr || e.message}` };
  }
}
