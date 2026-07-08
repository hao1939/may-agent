// Shared chart helpers used by the live and metrics pages.
function renderSparklineWithValues(points, threshold, width, height, alertOp) {
  if (!points || points.length === 0) return '<div style="color:var(--fg2);font-size:12px;height:' + height + 'px;display:flex;align-items:center;justify-content:center">Collecting data...</div>';
  var values = points.map(function(p) { return p.value; });
  var min = Math.min.apply(null, values.concat([threshold != null ? threshold * 0.8 : values[0]]));
  var max = Math.max.apply(null, values.concat([threshold != null ? threshold * 1.2 : values[0]]));
  var range = max - min || 1;
  var padTop = 14; // space for labels above
  var padBot = 4;
  var chartH = height - padTop - padBot;
  var xStep = width / Math.max(points.length - 1, 1);

  function yPos(v) { return padTop + chartH - ((v - min) / range) * chartH; }

  var coords = values.map(function(v, i) {
    return (i * xStep).toFixed(1) + ',' + yPos(v).toFixed(1);
  });

  var latest = values[values.length - 1];
  var breached = threshold != null && ((alertOp === 'above' || alertOp === '>') ? latest > threshold : latest < threshold);
  var color = threshold == null ? 'var(--accent)' : (breached ? 'var(--red)' : 'var(--green)');
  var lastX = ((values.length - 1) * xStep).toFixed(1);
  var lastYVal = yPos(latest).toFixed(1);

  var svg = '<svg viewBox="0 0 ' + width + ' ' + height + '" style="display:block;width:100%;height:' + height + 'px;overflow:visible">';

  // Threshold line
  if (threshold != null) {
    var threshY = yPos(threshold).toFixed(1);
    svg += '<line x1="0" y1="' + threshY + '" x2="' + width + '" y2="' + threshY + '" stroke="var(--fg2)" stroke-dasharray="4,3" stroke-width="1" opacity="0.4"/>';
  }

  // Line
  svg += '<polyline points="' + coords.join(' ') + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>';

  // Value labels — only first and last to avoid clutter
  var labelPairs = [[0, values[0]], [values.length - 1, latest]];
  for (var li = 0; li < labelPairs.length; li++) {
    var idx = labelPairs[li][0];
    var val = labelPairs[li][1];
    var lx = (idx * xStep).toFixed(1);
    var ly = yPos(val);
    // Place label above the point, clamped to not go above viewBox
    var labelY = Math.max(10, ly - 4).toFixed(1);
    var anchor = idx === 0 ? 'start' : 'end';
    var label = val >= 100 ? Math.round(val).toString() : (val >= 1 ? val.toFixed(1) : val.toFixed(3));
    svg += '<text x="' + lx + '" y="' + labelY + '" font-size="10" fill="var(--fg)" text-anchor="' + anchor + '" font-family="system-ui,sans-serif">' + label + '</text>';
  }

  // Current dot
  svg += '<circle cx="' + lastX + '" cy="' + lastYVal + '" r="3" fill="' + color + '"/>';
  svg += '</svg>';
  return svg;
}
