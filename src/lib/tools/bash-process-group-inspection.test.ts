import { describe, expect, it } from "bun:test";
import { processGroupContainsLiveMember } from "./bash.js";

function procStat(pid: number, state: string, pgid: number): string {
  return `${pid} (command) ${state} 1 ${pgid} 0 0`;
}

describe("bash process-group inspection", () => {
  it("ignores a process that exits during the scan and recognizes zombie-only residue as drained", () => {
    const vanished = Object.assign(new Error("process exited"), { code: "ENOENT" });
    expect(
      processGroupContainsLiveMember(42, ["101", "102"], (pid) => {
        if (pid === "101") throw vanished;
        return procStat(102, "Z", 42);
      }),
    ).toBe(false);
  });

  it("still fails closed on an unexpected proc inspection error", () => {
    const denied = Object.assign(new Error("inspection denied"), { code: "EACCES" });
    expect(
      processGroupContainsLiveMember(42, ["101"], () => {
        throw denied;
      }),
    ).toBe(true);
  });

  it("recognizes a non-zombie member of the exact process group", () => {
    expect(
      processGroupContainsLiveMember(42, ["101", "102"], (pid) =>
        pid === "101" ? procStat(101, "S", 7) : procStat(102, "R", 42),
      ),
    ).toBe(true);
  });
});
