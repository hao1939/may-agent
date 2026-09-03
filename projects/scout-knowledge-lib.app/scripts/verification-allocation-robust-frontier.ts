import { createHash } from "node:crypto";
import {
  buildToyDirectionalQuantileCalibrationSpec,
  buildToyDirectionalQuantilePowerSpec,
  calibrateDirectionalQuantiles,
  measureCalibratedDirectionalPower,
} from "./verification-allocation-factorial";
import { parseIdentityRobustFrontierCliInput } from "./verification-allocation-frontier-cli";
import { selectIdentityRobustFrontierPointFromFreezeBundle } from "./verification-allocation-frontier-freeze";
import { selectIdentityRobustFrontierPoint } from "./verification-allocation-frontier-policy";

type Row = {
  runBlockCount: number;
  calibrationSpecSha256: string;
  powerSpecSha256: string;
  maximumNullFalseDirectionalProbability: number;
  strongCorrectDirectionalProbability: number;
  strongWrongDirectionalProbability: number;
  moderateCorrectDirectionalProbability: number;
  moderateWrongDirectionalProbability: number;
};

function sha256(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function generateRows(first: number, last: number, step = 1): Row[] {
  const rows: Row[] = [];
  for (
    let runBlockCount = first;
    runBlockCount <= last;
    runBlockCount += step
  ) {
    const calibrationSpec = {
      ...buildToyDirectionalQuantileCalibrationSpec(),
      runBlockCount,
      candidateLowerQuantiles: [0.0025],
    };
    const calibration = calibrateDirectionalQuantiles(calibrationSpec);
    const power = measureCalibratedDirectionalPower(
      calibrationSpec,
      buildToyDirectionalQuantilePowerSpec(calibration),
    );
    if (!calibration.ok || !power.ok) {
      throw new Error(`invalid exact row at ${runBlockCount}`);
    }
    const nullReport = calibration.candidates[0]!.nullReport;
    const strong = power.report.find(
      (entry) => entry.processId === "strong-positive",
    )!;
    const moderate = power.report.find(
      (entry) => entry.processId === "moderate-positive",
    )!;
    rows.push({
      runBlockCount,
      calibrationSpecSha256: calibration.calibrationSpecSha256,
      powerSpecSha256: power.powerSpecSha256,
      maximumNullFalseDirectionalProbability: Math.max(
        ...nullReport.map((entry) => entry.falseDirectionalProbability),
      ),
      strongCorrectDirectionalProbability: strong.correctDirectionalProbability,
      strongWrongDirectionalProbability: strong.wrongDirectionalProbability,
      moderateCorrectDirectionalProbability:
        moderate.correctDirectionalProbability,
      moderateWrongDirectionalProbability: moderate.wrongDirectionalProbability,
    });
  }
  return rows;
}

if (process.argv[2] === "worker") {
  const first = Number(process.argv[3]);
  const last = Number(process.argv[4]);
  const step = Number(process.argv[5] ?? 1);
  process.stdout.write(JSON.stringify(generateRows(first, last, step)));
  process.exit(0);
}

const ranges = [
  [64, 256, 4],
  [65, 256, 4],
  [66, 256, 4],
  [67, 256, 4],
] as const;
const workerRows = await Promise.all(
  ranges.map(async ([first, last, step]) => {
    const child = Bun.spawn(
      [
        process.execPath,
        import.meta.path,
        "worker",
        String(first),
        String(last),
        String(step),
      ],
      { stdout: "pipe", stderr: "inherit" },
    );
    const output = await new Response(child.stdout).text();
    const exitCode = await child.exited;
    if (exitCode !== 0)
      throw new Error(`worker ${first}-${last}/${step} failed`);
    return JSON.parse(output) as Row[];
  }),
);
const rows = workerRows
  .flat()
  .sort((left, right) => left.runBlockCount - right.runBlockCount);
if (
  rows.length !== 193 ||
  rows.some((row, index) => row.runBlockCount !== index + 64)
) {
  throw new Error("row coverage is incomplete");
}

const modelCount = 6;
const minimumCorrectMarginalSum = 5.4;
const maximumTotal = 256 * modelCount;
const gaps = [
  ...new Set(
    rows.map(
      (row) =>
        row.strongCorrectDirectionalProbability -
        row.moderateCorrectDirectionalProbability,
    ),
  ),
].sort((left, right) => left - right);
type Best = {
  runBlockCount: number;
  episodeCount: number;
  allocation: number[];
  worstCorrectMarginalSum: number;
  uniformDriftBuffer: number;
  aggregateWrongDirectionalUpperBound: number;
};
const bestByTotal: Array<Best | null> = Array(maximumTotal + 1).fill(null);

for (const gapLimit of gaps) {
  const eligible = rows
    .map((row, index) => ({ row, index }))
    .filter(
      ({ row }) =>
        row.strongCorrectDirectionalProbability -
          row.moderateCorrectDirectionalProbability <=
        gapLimit,
    );
  let previous = new Float64Array(maximumTotal + 1);
  previous.fill(Number.NEGATIVE_INFINITY);
  previous[0] = 0;
  const choices: Int16Array[] = [new Int16Array(maximumTotal + 1).fill(-1)];
  for (let selected = 1; selected <= modelCount; selected += 1) {
    const next = new Float64Array(maximumTotal + 1);
    next.fill(Number.NEGATIVE_INFINITY);
    const choice = new Int16Array(maximumTotal + 1);
    choice.fill(-1);
    for (let total = 0; total <= maximumTotal; total += 1) {
      const prior = previous[total]!;
      if (!Number.isFinite(prior)) continue;
      for (const { row, index } of eligible) {
        const nextTotal = total + row.runBlockCount;
        if (nextTotal > maximumTotal) continue;
        const value = prior + row.strongCorrectDirectionalProbability;
        if (value > next[nextTotal]!) {
          next[nextTotal] = value;
          choice[nextTotal] = index;
        }
      }
    }
    previous = next;
    choices.push(choice);
  }

  for (let total = 64 * modelCount; total <= maximumTotal; total += 1) {
    if (!Number.isFinite(previous[total]!)) continue;
    const selectedRows: Row[] = [];
    let remaining = total;
    for (let selected = modelCount; selected > 0; selected -= 1) {
      const rowIndex = choices[selected]![remaining]!;
      if (rowIndex < 0) throw new Error(`cannot reconstruct total ${total}`);
      const row = rows[rowIndex]!;
      selectedRows.push(row);
      remaining -= row.runBlockCount;
    }
    const orderedRows = selectedRows.sort(
      (left, right) => left.runBlockCount - right.runBlockCount,
    );
    const actualGap = Math.max(
      ...orderedRows.map(
        (row) =>
          row.strongCorrectDirectionalProbability -
          row.moderateCorrectDirectionalProbability,
      ),
    );
    const worstCorrectMarginalSum =
      orderedRows.reduce(
        (sum, row) => sum + row.strongCorrectDirectionalProbability,
        0,
      ) - actualGap;
    const existing = bestByTotal[total];
    if (existing && existing.worstCorrectMarginalSum >= worstCorrectMarginalSum)
      continue;
    const worstWrongSum = Math.max(
      ...orderedRows.map((moderateRow, moderateIndex) =>
        orderedRows.reduce(
          (sum, row, index) =>
            sum +
            (index === moderateIndex
              ? moderateRow.moderateWrongDirectionalProbability
              : row.strongWrongDirectionalProbability),
          0,
        ),
      ),
    );
    bestByTotal[total] = {
      runBlockCount: total,
      episodeCount: total * 32,
      allocation: orderedRows.map((row) => row.runBlockCount),
      worstCorrectMarginalSum,
      uniformDriftBuffer:
        (worstCorrectMarginalSum - minimumCorrectMarginalSum) / modelCount,
      aggregateWrongDirectionalUpperBound: Math.min(1, worstWrongSum / 4),
    };
  }
}

const results = bestByTotal.filter((entry): entry is Best => entry !== null);
const passing = results.filter(
  (entry) =>
    entry.worstCorrectMarginalSum >= minimumCorrectMarginalSum &&
    entry.aggregateWrongDirectionalUpperBound <= 0.01,
);
const frontier: Best[] = [];
let bestReserve = Number.NEGATIVE_INFINITY;
for (const entry of passing) {
  if (entry.uniformDriftBuffer > bestReserve) {
    frontier.push(entry);
    bestReserve = entry.uniformDriftBuffer;
  }
}
const resultRepresentation = results.map((entry) => ({
  runBlockCount: entry.runBlockCount,
  allocation: entry.allocation,
  worstCorrectMarginalSum: entry.worstCorrectMarginalSum,
  uniformDriftBuffer: entry.uniformDriftBuffer,
  aggregateWrongDirectionalUpperBound:
    entry.aggregateWrongDirectionalUpperBound,
}));
const maximumNull = rows.reduce((worst, row) =>
  row.maximumNullFalseDirectionalProbability >
  worst.maximumNullFalseDirectionalProbability
    ? row
    : worst,
);
const localTotals = new Set([1_029, 1_030, 1_031, 1_032]);
const cliInput = parseIdentityRobustFrontierCliInput(process.argv.slice(2));
const frozenSelection = cliInput
  ? await selectIdentityRobustFrontierPointFromFreezeBundle(
      frontier,
      cliInput.policyCandidate,
      cliInput.evidenceManifestCandidate,
      cliInput.evidenceRoot,
      cliInput.freezeBundleRoot,
    )
  : null;
const selection =
  frozenSelection?.selection ??
  selectIdentityRobustFrontierPoint(frontier, null, null);
process.stdout.write(
  `${JSON.stringify(
    {
      rowCount: rows.length,
      rowSha256: sha256(rows),
      resultSha256: sha256(resultRepresentation),
      maximumNull: {
        runBlockCount: maximumNull.runBlockCount,
        probability: maximumNull.maximumNullFalseDirectionalProbability,
      },
      firstPass: passing[0],
      localBest: results.filter((entry) =>
        localTotals.has(entry.runBlockCount),
      ),
      frontierCount: frontier.length,
      frontierFirst: frontier.slice(0, 12),
      frontierLast: frontier.slice(-12),
      final: frontier.at(-1),
      freezeVerification: frozenSelection?.freezeVerification ?? null,
      selection,
    },
    null,
    2,
  )}\n`,
);
