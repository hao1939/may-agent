const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { Score } = require("@may-agent/gym/scoring");

const workDir = process.argv[2] || path.join(__dirname, "environment");
const s = new Score(workDir);

s.checkProduct("verify-script-passes", "verify.cjs passed", () => {
  const out = execFileSync("node", ["verify.cjs"], {
    cwd: workDir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return out.includes("all assertions passed");
});

s.checkBehavior(
  "workflow-run-report-recorded",
  "unified develop-change designed, repaired, verified, reviewed, and committed cleanly",
  () => {
    if (!s.hasWorkflowRun()) return false;
    const output = s.workflowOutput() || {};
    const delivery = output.result && output.result.development;
    if (
      s.workflowRun.workflow !== "develop-change" ||
      s.workflowStatus() !== "done" ||
      output.state !== "converged" ||
      !s.workflowCleanupConfirmed() ||
      !delivery ||
      !delivery.evidence ||
      !delivery.evidence.path ||
      !fs.statSync(path.join(workDir, ".git")).isFile() ||
      execFileSync("git", ["check-ignore", "--", ".state/probe"], {
        cwd: workDir,
        encoding: "utf8",
      }).trim() !== ".state/probe" ||
      execFileSync("git", ["status", "--porcelain"], {
        cwd: workDir,
        encoding: "utf8",
      }).trim() !== ""
    ) {
      return false;
    }

    const evidence = JSON.parse(
      fs.readFileSync(delivery.evidence.path, "utf8"),
    );
    const verificationReports = evidence.reports.filter(
      (item) => item.stage === "verification",
    );
    const passingVerification = verificationReports
      .map((item) => JSON.parse(fs.readFileSync(item.record.path, "utf8")))
      .find(
        (record) =>
          record.passed === true &&
          record.receipt &&
          record.receipt.exitCode === 0 &&
          record.receipt.cwd === workDir &&
          JSON.stringify(record.receipt.argv) ===
            JSON.stringify(["node", "verify.cjs"]),
      );
    return (
      evidence.design &&
      evidence.implementation &&
      evidence.verified &&
      evidence.review &&
      evidence.review.judgment.decision === "pass" &&
      evidence.review.judgment.commit === evidence.verified.commit &&
      evidence.verified.commit ===
        execFileSync("git", ["rev-parse", "HEAD"], {
          cwd: workDir,
          encoding: "utf8",
        }).trim() &&
      verificationReports.length >= 1 &&
      Boolean(passingVerification) &&
      s.hasWorkflowStep("bob", "done") &&
      s.hasWorkflowStep("tech-lead", "done")
    );
  },
);

s.report();
