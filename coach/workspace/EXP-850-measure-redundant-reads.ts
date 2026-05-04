/**
 * EXP-850 Measurement Script: Redundant File Reads
 * 
 * Parses a gym session transcript (JSON array of tool calls) and identifies
 * redundant read() calls — files read in full more than once per session,
 * excluding post-edit verifications.
 * 
 * Usage: npx ts-node EXP-850-measure-redundant-reads.ts <session-log.json>
 * 
 * Input format: Array of tool call objects with shape:
 *   { tool: "read"|"edit"|"bash"|..., params: { path?: string, offset?: number, limit?: number }, timestamp: number }
 * 
 * Output: JSON with metrics:
 *   - redundant_reads: number (reads of files already fully read, excluding post-edit verification)
 *   - total_reads: number
 *   - unique_files_read: number
 *   - total_tool_calls: number
 *   - redundant_read_details: { path, occurrence }[]
 *   - correctness: "pass"|"fail" (from final test result if available)
 */

interface ToolCall {
  tool: string;
  params: Record<string, any>;
  timestamp?: number;
  result?: string;
}

interface Metrics {
  redundant_reads: number;
  total_reads: number;
  unique_files_read: number;
  total_tool_calls: number;
  redundant_read_details: { path: string; occurrence: number }[];
  post_edit_verifications: number;
}

function isFullRead(call: ToolCall): boolean {
  // A "full read" is a read() with no offset or offset=1 and no limit
  if (call.tool !== 'read') return false;
  const { offset, limit } = call.params;
  if (limit) return false; // partial read
  if (offset && offset > 1) return false; // continuation read
  return true;
}

function measureRedundantReads(calls: ToolCall[]): Metrics {
  const fullReadsPerFile: Map<string, number[]> = new Map(); // path -> indices of full reads
  const editsPerFile: Map<string, number[]> = new Map(); // path -> indices of edits

  // First pass: collect all full reads and edits by file
  for (let i = 0; i < calls.length; i++) {
    const call = calls[i];
    const path = call.params?.path;
    if (!path) continue;

    if (isFullRead(call)) {
      if (!fullReadsPerFile.has(path)) fullReadsPerFile.set(path, []);
      fullReadsPerFile.get(path)!.push(i);
    }
    if (call.tool === 'edit' || (call.tool === 'write')) {
      if (!editsPerFile.has(path)) editsPerFile.set(path, []);
      editsPerFile.get(path)!.push(i);
    }
  }

  // Second pass: for each file with multiple full reads, classify each repeat
  let redundant_reads = 0;
  let post_edit_verifications = 0;
  const redundant_read_details: { path: string; occurrence: number }[] = [];

  for (const [path, readIndices] of fullReadsPerFile) {
    if (readIndices.length <= 1) continue;

    const editIndices = editsPerFile.get(path) || [];

    // For each read after the first, check if there was an edit between this read and the previous read
    for (let r = 1; r < readIndices.length; r++) {
      const prevReadIdx = readIndices[r - 1];
      const thisReadIdx = readIndices[r];

      // Was there an edit to this file between prevRead and thisRead?
      const editBetween = editIndices.some(e => e > prevReadIdx && e < thisReadIdx);

      if (editBetween) {
        post_edit_verifications++;
      } else {
        redundant_reads++;
        redundant_read_details.push({ path, occurrence: r + 1 });
      }
    }
  }

  const total_reads = calls.filter(c => c.tool === 'read').length;
  const unique_files_read = fullReadsPerFile.size;

  return {
    redundant_reads,
    total_reads,
    unique_files_read,
    total_tool_calls: calls.length,
    redundant_read_details,
    post_edit_verifications,
  };
}

// CLI entrypoint
import * as fs from 'fs';
import * as path from 'path';

const inputFile = process.argv[2];
if (!inputFile) {
  // Demo mode: show example usage
  console.log('EXP-850 Redundant Read Measurement Script');
  console.log('==========================================');
  console.log('');
  console.log('Usage: npx ts-node EXP-850-measure-redundant-reads.ts <session-log.json>');
  console.log('');
  console.log('Demo with synthetic data:');

  const demoData: ToolCall[] = [
    { tool: 'read', params: { path: 'src/cart.js' } },
    { tool: 'read', params: { path: 'src/pricing.js' } },
    { tool: 'read', params: { path: 'src/checkout.js' } },
    { tool: 'edit', params: { path: 'src/cart.js', oldText: 'calculateTotal', newText: 'computeOrderTotal' } },
    { tool: 'read', params: { path: 'src/cart.js' } }, // post-edit verification — OK
    { tool: 'read', params: { path: 'src/pricing.js' } }, // REDUNDANT — no edit between
    { tool: 'edit', params: { path: 'src/pricing.js', oldText: 'calculateTotal', newText: 'computeOrderTotal' } },
    { tool: 'read', params: { path: 'src/pricing.js' } }, // post-edit verification — OK
    { tool: 'read', params: { path: 'src/cart.js' } }, // REDUNDANT — no edit since last read
    { tool: 'bash', params: { command: 'npm test' } },
  ];

  const metrics = measureRedundantReads(demoData);
  console.log(JSON.stringify(metrics, null, 2));
  process.exit(0);
}

const raw = fs.readFileSync(inputFile, 'utf-8');
const calls: ToolCall[] = JSON.parse(raw);
const metrics = measureRedundantReads(calls);
console.log(JSON.stringify(metrics, null, 2));

export { measureRedundantReads };
export type { Metrics, ToolCall };
