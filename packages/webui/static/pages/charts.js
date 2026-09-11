// Samples are observations at real times, not evenly spaced chart indices.
function renderSparklineWithValues(points, threshold, width, height, _alertOp, options = {}) {
  const samples = (points || []).filter(p => Number.isFinite(p.value) && Number.isSafeInteger(p.measured_at) && p.measured_at >= 0 && p.measured_at <= 8.64e15).sort((a, b) => a.measured_at - b.measured_at);
  if (!samples.length) return '<p class="health-note">No retained observations in this window.</p>';
  const start = options.start ?? samples[0].measured_at;
  const end = options.end ?? samples[samples.length - 1].measured_at;
  const span = Math.max(1, end - start);
  const values = samples.map(p => p.value);
  if (Number.isFinite(threshold)) values.push(threshold);
  let min = Math.min(...values), max = Math.max(...values);
  if (min === max) { min -= 1; max += 1; }
  const range = max - min;
  const x = time => (50 + (time - start) / span * (width - 58)).toFixed(2);
  const y = value => (height - 18 - (value - min) / range * (height - 36)).toFixed(2);
  let svg = `<svg role="img" aria-label="Metric observations over time" viewBox="0 0 ${width} ${height}" style="width:100%;height:${height}px">`;
  for (const value of [min, max]) svg += `<text x="2" y="${y(value)}" fill="var(--fg2)" font-size="11">${Number(value.toPrecision(4))}</text><line x1="50" x2="${width - 8}" y1="${y(value)}" y2="${y(value)}" stroke="var(--border)"/>`;
  if (Number.isFinite(threshold)) svg += `<line x1="50" x2="${width - 8}" y1="${y(threshold)}" y2="${y(threshold)}" stroke="var(--fg2)" stroke-dasharray="4,3"/>`;
  const failures = (options.failures || []).map(f => f.timestamp).filter(Number.isFinite);
  let previous = null;
  for (const point of samples) {
    const gap = previous && (options.gapMs == null || point.measured_at - previous.measured_at > options.gapMs || failures.some(t => t >= previous.measured_at && t <= point.measured_at));
    if (previous && !gap) svg += `<line x1="${x(previous.measured_at)}" y1="${y(previous.value)}" x2="${x(point.measured_at)}" y2="${y(point.value)}" stroke="var(--accent)"/>`;
    svg += `<circle data-sample-time="${point.measured_at}" cx="${x(point.measured_at)}" cy="${y(point.value)}" r="2.5" fill="var(--accent)"><title>${point.value} at ${new Date(point.measured_at).toISOString()}</title></circle>`;
    previous = point;
  }
  for (const time of failures) svg += `<line x1="${x(time)}" x2="${x(time)}" y1="8" y2="${height - 8}" stroke="var(--red)" stroke-dasharray="2,4"><title>Collection failed</title></line>`;
  return svg + '</svg>';
}
